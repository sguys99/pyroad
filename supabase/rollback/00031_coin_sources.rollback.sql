-- ============================================================
-- 00031 되돌리기: complete_quest·submit_quiz_answer 를 00026 정의(코인 없음)로, coin_reward·grant_star_coins·grant_level_up_coins 삭제   (P8-04)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-04 이전 앱으로 되돌린 뒤 실행합니다 (응답의 coins_earned·coins_balance·level_ups 가 없어짐 — 새 앱은 0 으로 읽음).
-- 잃는 데이터: 없음 (이미 지급한 코인·원장은 그대로. 이후 완료·퀴즈는 코인을 주지 않음)
-- 실행 후 상태 = 00030 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00031_coin_sources.rollback.sql
-- ============================================================

-- complete_quest (00026)
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
   WHERE q.stage_id = v_quest.stage_id
     AND q.quest_type <> 'quiz';  -- 퀴즈는 보너스 (00026)
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
    JOIN public.quests q ON q.id = up.quest_id
   WHERE up.user_id = p_user_id AND up.status = 'completed'
     AND q.quest_type <> 'quiz';  -- 퀴즈 완료는 first_code·streak_3 에 넣지 않음 (00026)

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
  '퀘스트 완료·보상 (P1-03, Q25, 00026 퀴즈는 클리어 계산에서 제외). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 지급, 황금키 완료는 뱃지 없음';

-- submit_quiz_answer (00026)
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_user_id  UUID,
  p_quest_id UUID,
  p_answer   JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_max_answer CONSTANT INTEGER := 4096;  -- 바이트 (quiz_attempts_answer_size 와 같음)
  c_max_tries  CONSTANT INTEGER := 3;     -- 3번째 오답이면 정답 공개 + ⭐1
  c_xp_per_star CONSTANT INTEGER := 10;   -- 사용자 결정 2 (Q60)
  v_quest       RECORD;
  v_user        RECORD;
  v_progress    RECORD;
  v_last        RECORD;
  v_key         JSONB;
  v_today       DATE := public.kst_today();
  v_mode        TEXT;
  v_attempt_no  INTEGER;
  v_correct     BOOLEAN;
  v_reveal      BOOLEAN;
  v_stars       INTEGER := 0;
  v_best        INTEGER;
  v_xp          INTEGER := 0;
  v_total_xp    INTEGER;
  v_level_after INTEGER;
  v_judged_on   DATE;
  v_explanation TEXT;
BEGIN
  IF p_user_id IS NULL OR p_quest_id IS NULL OR p_answer IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF octet_length(p_answer::text) > c_max_answer THEN
    RAISE EXCEPTION 'answer_too_large' USING ERRCODE = 'PT413';
  END IF;

  SELECT q.id, q.stage_id, q.quest_type, q.quiz_kind
    INTO v_quest
    FROM public.quests q
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_quest.quest_type <> 'quiz' THEN
    RAISE EXCEPTION 'not_quiz' USING ERRCODE = 'PT400';
  END IF;

  -- 모양만 확인 (정규형은 API 의 zod 가 먼저 봄). 틀린 id 는 오답으로 채점
  IF NOT COALESCE(CASE v_quest.quiz_kind
           WHEN 'multiple_choice' THEN jsonb_typeof(p_answer) = 'string'
           WHEN 'fill_blank'      THEN jsonb_typeof(p_answer) = 'object'
           WHEN 'parsons'         THEN jsonb_typeof(p_answer) = 'array'
           WHEN 'bug_hunt'        THEN jsonb_typeof(p_answer) = 'object'
                                       AND jsonb_typeof(p_answer->'line') = 'string'
                                       AND jsonb_typeof(p_answer->'fix') = 'string'
           ELSE false
         END, false) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT k.quiz_answer INTO v_key
    FROM public.quest_answer_keys k
   WHERE k.quest_id = p_quest_id;
  IF v_key IS NULL OR jsonb_typeof(v_key->'accepted') <> 'array'
     OR jsonb_array_length(v_key->'accepted') = 0 THEN
    RAISE EXCEPTION 'answer_key_missing' USING ERRCODE = 'PT500';
  END IF;

  -- 잠금 순서: users → user_progress
  SELECT u.total_xp, u.current_level
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  INSERT INTO public.user_progress (user_id, quest_id, status)
  VALUES (p_user_id, p_quest_id, 'in_progress')
  ON CONFLICT (user_id, quest_id) DO NOTHING;

  SELECT up.status, up.best_stars, up.stars_judged_on, up.created_at
    INTO v_progress
    FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
     FOR UPDATE;

  v_mode := CASE
              WHEN v_progress.stars_judged_on IS NULL THEN 'first'
              WHEN v_progress.stars_judged_on < v_today THEN 'review'
              ELSE 'practice'
            END;

  -- 회차 이어 가기: 이 진행 행이 생긴 뒤의 마지막 시도
  SELECT qa.mode, qa.attempt_no, qa.is_correct
    INTO v_last
    FROM public.quiz_attempts qa
   WHERE qa.user_id = p_user_id AND qa.quest_id = p_quest_id
     AND qa.created_at >= v_progress.created_at
   ORDER BY qa.created_at DESC
   LIMIT 1;
  v_attempt_no := CASE
                    WHEN v_last.mode = v_mode AND NOT v_last.is_correct
                         AND v_last.attempt_no < c_max_tries
                      THEN v_last.attempt_no + 1
                    ELSE 1
                  END;

  v_correct := EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_key->'accepted') AS a(v) WHERE a.v = p_answer);
  v_reveal := NOT v_correct AND v_attempt_no >= c_max_tries;

  -- clock_timestamp: 잠금을 기다린 트랜잭션도 잠금 뒤 시각이라 시도 순서가 created_at 순서와 같음
  INSERT INTO public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct, created_at)
  VALUES (p_user_id, p_quest_id, v_mode, v_attempt_no, p_answer, v_correct, clock_timestamp());

  v_best := v_progress.best_stars;
  v_judged_on := v_progress.stars_judged_on;
  v_total_xp := v_user.total_xp;
  v_level_after := v_user.current_level;

  IF v_mode <> 'practice' AND (v_correct OR v_reveal) THEN
    v_stars := CASE WHEN v_correct THEN c_max_tries + 1 - v_attempt_no ELSE 1 END;
    v_best := GREATEST(v_progress.best_stars, v_stars);
    v_xp := (v_best - v_progress.best_stars) * c_xp_per_star;
    v_judged_on := v_today;

    UPDATE public.user_progress
       SET stars           = v_stars,
           best_stars      = v_best,
           stars_judged_on = v_today,
           status          = 'completed',
           completed_at    = COALESCE(completed_at, NOW()),
           earned_xp       = earned_xp + v_xp,
           attempts        = attempts + 1
     WHERE user_id = p_user_id AND quest_id = p_quest_id;

    IF v_xp > 0 THEN
      v_total_xp := v_user.total_xp + v_xp;
      v_level_after := public.level_for_xp(v_total_xp);
      UPDATE public.users
         SET total_xp = v_total_xp, current_level = v_level_after
       WHERE id = p_user_id;
    END IF;
  ELSE
    UPDATE public.user_progress
       SET attempts = attempts + 1
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
  END IF;

  -- 해설: 정답이면 정답 해설, 오답이면 고른 것의 해설만 (정답 해설·정답 id 는 넣지 않음)
  v_explanation := CASE
    WHEN v_correct THEN v_key->>'explanation'
    WHEN jsonb_typeof(p_answer) = 'string' THEN v_key->'explanations'->>(p_answer#>>'{}')
    WHEN v_quest.quiz_kind = 'bug_hunt'
      THEN COALESCE(v_key->'explanations'->>(p_answer->>'fix'), v_key->'explanations'->>(p_answer->>'line'))
    ELSE NULL
  END;

  RETURN jsonb_build_object(
    'correct',        v_correct,
    'attempt_no',     v_attempt_no,
    'mode',           v_mode,
    'stars',          v_stars,
    'best_stars',     v_best,
    'xp_awarded',     v_xp,
    'total_xp',       v_total_xp,
    'level_before',   v_user.current_level,
    'level_after',    v_level_after,
    'explanation',    v_explanation,
    'revealed',       CASE WHEN v_reveal
                           THEN jsonb_build_object('answer', v_key->'accepted'->0,
                                                   'explanation', v_key->>'explanation')
                      END,
    'next_review_on', to_char(v_judged_on + 1, 'YYYY-MM-DD'));
END;
$$;

COMMENT ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) IS
  '퀴즈 채점·시도 기록·별·XP (P7-02, §2.3). service_role 전용: /api/quest/answer 가 getUser() 로 확인한 id 만 넘김. 오답 응답에 정답 없음(3번째 오답의 revealed 만)';

REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) TO service_role;

DROP FUNCTION IF EXISTS public.grant_star_coins(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.grant_level_up_coins(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.coin_reward(TEXT, INTEGER);
