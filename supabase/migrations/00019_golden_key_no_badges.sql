-- ============================================================
-- 황금키(정답 보기)로 완료한 퀘스트는 뱃지를 주지 않음: decide_new_badges · complete_quest 교체 (Idempotent)
--                                                                         (B11 후속, §12-Q25)
-- 릴리즈 단계: ① 추가형 (함수 본문만 교체. 이 함수들은 새 앱의 /api/quest/complete 만 부르므로 이전 앱은 그대로 동작)
--
-- 배경 (사용자 결정 2026-11-04, §2.6 "보상은 학습 행동에만")
--   황금키로 연 퀘스트는 이미 XP 0 이고(00006 quest_xp) hint_master 도 주지 않았지만(B11), first_code·stage_clear·
--   project_builder·streak_3 은 받을 수 있었습니다. 정답을 받아 완료한 것은 학습 행동이 아니므로 그 완료로는
--   어떤 뱃지도 새로 주지 않습니다. 황금키 사용은 DB 의 user_progress.used_golden_key (프로젝트는 한 단계라도, 00006).
--
-- 바뀌는 규칙
--   1. decide_new_badges: p_used_golden_key 면 빈 배열 (시그니처·순서 그대로. 회귀 RW-1 이 reward-rules.json 과 대조)
--   2. complete_quest: 뱃지 판정에 넘기는 누적 값을 "직접 푼 완료"(used_golden_key = false)로
--        - first_code      completed_count = 직접 푼 완료 수. 첫 완료가 황금키여도 처음 직접 푼 퀘스트에서 받음
--                          (00006 처럼 전체 완료 수로 세면 황금키로 시작한 아이는 first_code 를 영영 못 받음)
--        - streak_3        직접 푼 완료일만 (황금키 완료로 연속을 잇지 않음)
--        - stage_clear     스테이지 클리어 판정은 그대로 황금키 퀘스트도 완료로 셈. 스테이지 클리어는 진행이라
--                          잠금 해제·황금키 3개·stage_cleared 응답(축하 카드, P1-10)은 그대로이고, 마지막 퀘스트를
--                          직접 풀어 클리어하면 앞의 황금키 퀘스트가 있어도 뱃지를 받음. 마지막 퀘스트를 황금키로
--                          클리어하면 그 순간에는 뱃지가 없고 다음 스테이지를 직접 풀어 클리어할 때 받음
--                          (stage_clear 는 사용자당 1개인 "첫 스테이지 클리어" 뱃지)
--        - project_builder 최종 프로젝트를 한 단계라도 황금키로 완료하면 없음. 지금 구조에서는 다시 풀어도 이미
--                          completed 라 판정하지 않음 → P8-05(다시 풀기·best_stars)에서 직접 푼 재도전 때 판정
--      XP·레벨·황금키 차감·스테이지 클리어·멱등성(FOR UPDATE, 처음 완료될 때만)·잠금 순서·오류 코드·반환 형식은 00006 그대로
--   TS 참조 구현: src/lib/quest/checkBadges.ts (decideNewBadges), 대조표 supabase/tests/fixtures/reward-rules.json
--
-- 권한: CREATE OR REPLACE 는 기존 권한을 유지하지만 §2.2 원칙대로 00006 과 같은 REVOKE/GRANT 를 다시 적습니다
--   (service_role 만 실행. 좁히는 변경이 아니라 같은 상태를 다시 쓰는 것이라 ① 파일에 둠). 스냅샷 변화 없음.
-- 운영 적용 순서 (Phase 1 릴리즈, §12-Q21): ① 00006 뒤 아무 때나 (이 파일) → ② 앱 배포 → ③ …
--   적용 후 NOTICE `[00019] 황금키 완료 뱃지 0, 직접 푼 완료 기준 first_code·streak_3, anon/authenticated 실행 가능 함수 0`
--   ⚠️ 00006 파일 전체를 다시 실행하면 이 두 함수가 00006 정의로 돌아갑니다. ② 뒤 백필은 런북의 UPDATE 만 실행합니다.
-- 이미 받은 뱃지: 바꾸지 않습니다(회수 없음). 운영에서 황금키 완료로 받은 뱃지 수는 런북 "00019 확인"의 읽기 전용 쿼리로 기록만.
-- 되돌리기: supabase/rollback/00019_golden_key_no_badges.rollback.sql (00006 정의로)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. decide_new_badges: 황금키 완료면 빈 배열
--   first_code       직접 푼 완료가 이번 것 하나 (complete_quest 가 직접 푼 완료 수를 넘김)
--   hint_master      힌트 0회 (황금키는 위에서 이미 제외, B11)
--   stage_clear      이번 완료로 스테이지의 모든 퀘스트 완료 (황금키 퀘스트도 완료로 셈)
--   project_builder  최종 프로젝트(is_final 스테이지) 완료
--   streak_3         직접 푼 완료일 기준 3일 연속
-- ------------------------------------------------------------
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
  SELECT CASE
    WHEN COALESCE(p_used_golden_key, false) THEN '{}'::text[]
    ELSE array_remove(ARRAY[
      CASE WHEN NOT ('first_code' = ANY (COALESCE(p_earned, '{}')))
                 AND p_completed_count = 1 THEN 'first_code' END,
      CASE WHEN NOT ('hint_master' = ANY (COALESCE(p_earned, '{}')))
                 AND p_hints_used = 0 THEN 'hint_master' END,
      CASE WHEN NOT ('stage_clear' = ANY (COALESCE(p_earned, '{}')))
                 AND COALESCE(p_stage_cleared, false) THEN 'stage_clear' END,
      CASE WHEN NOT ('project_builder' = ANY (COALESCE(p_earned, '{}')))
                 AND COALESCE(p_is_final_stage, false) THEN 'project_builder' END,
      CASE WHEN NOT ('streak_3' = ANY (COALESCE(p_earned, '{}')))
                 AND COALESCE(p_streak_3, false) THEN 'streak_3' END
    ], NULL)
  END;
$$;

-- ------------------------------------------------------------
-- 2. complete_quest: 00006 과 같고, 뱃지 판정의 완료 수·완료일만 직접 푼 완료로 (위 "바뀌는 규칙" 2)
--   p_submission·반환·오류는 00006 "3-1. complete_quest" 주석과 같음
-- ------------------------------------------------------------
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
  -- first_code·streak_3 은 직접 푼 완료만 셉니다 (Q25: 황금키 완료는 학습 행동이 아님).
  -- 황금키로 먼저 완료해도 처음 직접 푼 퀘스트에서 first_code 를 받고, 황금키 완료한 날은 연속에 들어가지 않습니다.
  -- 스테이지 클리어(v_stage_cleared)는 진행이므로 황금키 퀘스트도 완료로 셉니다 (잠금 해제·황금키 3개·축하 그대로).
  SELECT count(*) FILTER (WHERE NOT up.used_golden_key),
         array_agg(up.completed_at) FILTER (WHERE NOT up.used_golden_key)
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
  '퀘스트 완료·보상 (P1-03, Q25). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 지급, 황금키 완료는 뱃지 없음';
-- ------------------------------------------------------------
-- 3. 권한: 00006 과 같이 service_role 만 실행
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_new_badges(TEXT[], INTEGER, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 4. 자기 검증: 규칙 표본(reward-rules.json 의 황금키 행) + 실행 권한
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad  TEXT[] := '{}';
  v_exec TEXT;
BEGIN
  -- 황금키: 첫 완료·스테이지 클리어·최종 프로젝트·3일 연속이어도 빈 배열
  IF public.decide_new_badges('{}', 1, true, true, 0, true, true) <> '{}'::text[] THEN
    v_bad := v_bad || '황금키 완료에 뱃지'::TEXT;
  END IF;
  -- 직접 푼 완료는 00006 과 같은 순서
  IF public.decide_new_badges('{}', 1, true, true, 0, false, true)
     <> ARRAY['first_code', 'hint_master', 'stage_clear', 'project_builder', 'streak_3'] THEN
    v_bad := v_bad || '직접 푼 완료의 뱃지 순서'::TEXT;
  END IF;

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('decide_new_badges', 'complete_quest')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'));
  IF v_exec IS NOT NULL THEN
    v_bad := v_bad || ('실행 권한이 service_role 전용이 아닌 함수: ' || v_exec);
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00019] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00019] 황금키 완료 뱃지 0, 직접 푼 완료 기준 first_code·streak_3, anon/authenticated 실행 가능 함수 0';
END $$;
