-- ============================================================
-- 00019 되돌리기: decide_new_badges · complete_quest 를 00006 정의로   (B11 후속, §12-Q25)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 황금키로 완료한 퀘스트에서도 first_code·stage_clear·project_builder·streak_3 을 다시 받고
--    (hint_master 는 여전히 없음, B11), first_code·streak_3 이 황금키 완료까지 셉니다. 이미 지급된 뱃지는 그대로.
--    앱(새 앱)은 반환 형식이 같아 그대로 동작합니다.
-- 실행 후 상태 = 00018 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00019_golden_key_no_badges.rollback.sql
-- ============================================================

-- 새로 줄 뱃지 (checkBadges.ts 의 decideNewBadges 와 같은 순서·규칙)
--   first_code       완료한 퀘스트가 이번 것 하나
--   hint_master      힌트 0회 + 황금키 미사용 (B11)
--   stage_clear      이번 완료로 스테이지의 모든 퀘스트 완료
--   project_builder  최종 프로젝트(is_final 스테이지) 완료
--   streak_3         3일 연속 완료
CREATE OR REPLACE FUNCTION public.decide_new_badges(
  p_earned          TEXT[],
  p_completed_count INTEGER,
  p_stage_cleared   BOOLEAN,
  p_is_final_stage  BOOLEAN,
  p_hints_used      INTEGER,
  p_used_golden_key BOOLEAN,
  p_streak_3        BOOLEAN
)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN NOT ('first_code' = ANY (COALESCE(p_earned, '{}')))
               AND p_completed_count = 1 THEN 'first_code' END,
    CASE WHEN NOT ('hint_master' = ANY (COALESCE(p_earned, '{}')))
               AND p_hints_used = 0 AND NOT COALESCE(p_used_golden_key, false) THEN 'hint_master' END,
    CASE WHEN NOT ('stage_clear' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_stage_cleared, false) THEN 'stage_clear' END,
    CASE WHEN NOT ('project_builder' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_is_final_stage, false) THEN 'project_builder' END,
    CASE WHEN NOT ('streak_3' = ANY (COALESCE(p_earned, '{}')))
               AND COALESCE(p_streak_3, false) THEN 'streak_3' END
  ], NULL);
$$;

CREATE OR REPLACE FUNCTION public.complete_quest(
  p_user_id    UUID,
  p_quest_id   UUID,
  p_submission JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_submission CONSTANT INTEGER := 65536;  -- 바이트. 코드 퀘스트 제출물은 수 KB
  v_quest          RECORD;
  v_user           RECORD;
  v_progress       RECORD;
  v_code           TEXT;
  v_passed         BOOLEAN;
  v_xp             INTEGER;
  v_total_xp       INTEGER;
  v_level_after    INTEGER;
  v_golden_keys    INTEGER;
  v_stage_total    INTEGER;
  v_stage_done     INTEGER;
  v_stage_cleared  BOOLEAN;
  v_stage_info     JSONB;
  v_completed      INTEGER;
  v_completions    TIMESTAMPTZ[];
  v_earned         TEXT[];
  v_to_award       TEXT[];
  v_new_badges     TEXT[];
  v_next_quest_id  UUID;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  p_submission := COALESCE(p_submission, '{}'::jsonb);
  IF jsonb_typeof(p_submission) <> 'object' THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF pg_column_size(p_submission) > c_max_submission THEN
    RAISE EXCEPTION 'submission_too_large' USING ERRCODE = 'PT413';
  END IF;
  v_code := p_submission->>'code';
  v_passed := COALESCE(p_submission->'passed' = 'true'::jsonb, false);

  SELECT q.id, q.stage_id, q."order", q.xp_reward, s."order" AS stage_order, s.title AS stage_title, s.is_final
    INTO v_quest
    FROM public.quests q
    JOIN public.stages s ON s.id = q.stage_id
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 잠금 순서: users → user_progress (reset_progress·use_golden_key 와 같음)
  SELECT u.total_xp, u.current_level, u.golden_keys
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT up.status, up.hints_used, up.used_golden_key
    INTO v_progress
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;

  -- 다음 퀘스트: 같은 스테이지에서 이 퀘스트 뒤의 첫 미완료 퀘스트
  SELECT q.id INTO v_next_quest_id
    FROM public.quests q
   WHERE q.stage_id = v_quest.stage_id
     AND q."order" > v_quest."order"
     AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                      WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')
   ORDER BY q."order"
   LIMIT 1;

  -- 이미 완료: 아무것도 바꾸지 않고 현재 값만 (중복 클릭·동시 요청·다시 풀기)
  IF v_progress.status = 'completed' THEN
    RETURN jsonb_build_object(
      'already_completed', true,
      'xp_gained',         0,
      'total_xp',          v_user.total_xp,
      'level_before',      v_user.current_level,
      'level_after',       v_user.current_level,
      'new_badges',        '[]'::jsonb,
      'stage_cleared',     NULL,
      'next_quest_id',     v_next_quest_id,
      'golden_keys',       v_user.golden_keys,
      'hints_used',        v_progress.hints_used,
      'used_golden_key',   v_progress.used_golden_key);
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  IF NOT v_passed AND NOT COALESCE(v_progress.used_golden_key, false) THEN
    RAISE EXCEPTION 'not_passed' USING ERRCODE = 'PT422';
  END IF;

  -- 진행 행이 없으면 만든다 (users 잠금 아래라 동시 INSERT 경합 없음)
  IF v_progress.status IS NULL THEN
    INSERT INTO public.user_progress (user_id, quest_id, status)
    VALUES (p_user_id, p_quest_id, 'in_progress')
    ON CONFLICT (user_id, quest_id) DO NOTHING;
    SELECT up.status, up.hints_used, up.used_golden_key
      INTO v_progress
      FROM public.user_progress up
     WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
       FOR UPDATE;
  END IF;

  -- 보상 계산은 DB 값으로 (B05)
  v_xp := public.quest_xp(v_quest.xp_reward, v_progress.hints_used, v_progress.used_golden_key);

  UPDATE public.user_progress
     SET status         = 'completed',
         completed_at   = NOW(),
         earned_xp      = v_xp,
         code_submitted = COALESCE(v_code, code_submitted)
   WHERE user_id = p_user_id AND quest_id = p_quest_id;

  v_total_xp := v_user.total_xp + v_xp;
  v_level_after := public.level_for_xp(v_total_xp);

  -- 스테이지 클리어 (이번 완료 포함)
  SELECT count(*), count(*) FILTER (WHERE up.status = 'completed')
    INTO v_stage_total, v_stage_done
    FROM public.quests q
    LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
   WHERE q.stage_id = v_quest.stage_id;
  v_stage_cleared := v_stage_total > 0 AND v_stage_total = v_stage_done;

  -- 스테이지를 클리어하면 다음 스테이지를 위해 황금키 3개로
  v_golden_keys := CASE WHEN v_stage_cleared THEN 3 ELSE v_user.golden_keys END;

  UPDATE public.users
     SET total_xp      = v_total_xp,
         current_level = v_level_after,
         golden_keys   = v_golden_keys
   WHERE id = p_user_id;

  IF v_stage_cleared THEN
    v_next_quest_id := NULL;
    SELECT jsonb_build_object(
             'stage_id', v_quest.stage_id,
             'order',    v_quest.stage_order,
             'title',    v_quest.stage_title,
             'concepts', COALESCE(jsonb_agg(q.concept ORDER BY q."order"), '[]'::jsonb))
      INTO v_stage_info
      FROM public.quests q
     WHERE q.stage_id = v_quest.stage_id;
  END IF;

  -- 뱃지
  SELECT COALESCE(array_agg(b.badge_type), '{}') INTO v_earned
    FROM public.user_badges b WHERE b.user_id = p_user_id;
  SELECT count(*), array_agg(up.completed_at)
    INTO v_completed, v_completions
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed';

  v_to_award := public.decide_new_badges(
    v_earned,
    v_completed,
    v_stage_cleared,
    v_quest.is_final,
    v_progress.hints_used,
    v_progress.used_golden_key,
    CASE WHEN 'streak_3' = ANY (v_earned) THEN false
         ELSE public.has_three_day_streak(v_completions) END);

  WITH ins AS (
    INSERT INTO public.user_badges (user_id, badge_type)
    SELECT p_user_id, b FROM unnest(v_to_award) AS b
    ON CONFLICT (user_id, badge_type) DO NOTHING
    RETURNING badge_type
  )
  SELECT COALESCE(array_agg(badge_type), '{}') INTO v_new_badges FROM ins;

  RETURN jsonb_build_object(
    'already_completed', false,
    'xp_gained',         v_xp,
    'total_xp',          v_total_xp,
    'level_before',      v_user.current_level,
    'level_after',       v_level_after,
    -- decide_new_badges 순서를 유지 (축하 연출 순서)
    'new_badges',        COALESCE((SELECT jsonb_agg(b ORDER BY o)
                                     FROM unnest(v_to_award) WITH ORDINALITY AS t(b, o)
                                    WHERE b = ANY (v_new_badges)), '[]'::jsonb),
    'stage_cleared',     v_stage_info,
    'next_quest_id',     v_next_quest_id,
    'golden_keys',       v_golden_keys,
    'hints_used',        v_progress.hints_used,
    'used_golden_key',   v_progress.used_golden_key);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 지급';
REVOKE ALL ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;
