-- ============================================================
-- 퀴즈 채점 RPC submit_quiz_answer + 퀴즈는 보너스(스테이지 잠금·클리어에서 뺌) (Idempotent)   (P7-02, §2.3, §12-Q17·Q60)
-- 릴리즈 단계: ① 추가형 (새 함수 + 함수 본문 교체. 이전 앱은 submit_quiz_answer 를 부르지 않고, 퀴즈 콘텐츠가 아직 없어
--                       is_stage_unlocked·complete_quest 의 결과도 지금 데이터에서는 같음)
--
-- 하는 일
--   1. is_stage_unlocked: 00012 정의 + 앞 스테이지의 "완료해야 하는 퀘스트"에서 quest_type = 'quiz' 를 뺌 (사용자 결정 1, Q60)
--      앞 스테이지에 퀴즈만 있으면 코드 퀘스트가 없어 열리지 않음 (00012 의 "빈 스테이지는 클리어 불가"와 같은 규칙)
--      TS 사본: src/lib/world/getStageStatuses.ts (countsForClear)
--   2. complete_quest: 00019 정의 + 퀴즈를 빼고 셈
--        - 스테이지 클리어(stage_cleared·황금키 3개·stage_clear 뱃지): 퀴즈를 안 풀어도 코드 퀘스트를 모두 끝내면 클리어
--        - first_code·streak_3 의 "직접 푼 완료": 퀴즈 완료는 넣지 않음 (퀴즈를 먼저 풀면 first_code 를 영영 못 받던 경우)
--      반환·오류·잠금·멱등성은 00019 그대로
--   3. submit_quiz_answer(p_user_id, p_quest_id, p_answer) → jsonb (SECURITY DEFINER, service_role 전용)
--      /api/quest/answer 가 auth.getUser() 로 확인한 id 만 넘김 (§2.3: 클라이언트가 부르는 채점 RPC 금지 — 정답 오라클)
--   4. 자기 검증
--
-- submit_quiz_answer 흐름 (한 트랜잭션)
--   잠금: users → user_progress 순서로 FOR UPDATE (complete_quest·use_golden_key·reset_progress 와 같은 순서, 교착 없음)
--         진행 행이 없으면 만들고 다시 잠금. 같은 사용자의 제출은 모두 직렬화 → 보기를 동시에 여러 개 보내도 "첫 시도"는 하나
--   스테이지 잠금: is_stage_unlocked 가 아니면 stage_locked (시도도 기록하지 않음)
--   mode (user_progress.stars_judged_on = 마지막 별 판정일, KST)
--     first     아직 별 판정 없음 (stars_judged_on IS NULL)
--     review    마지막 판정일 < 오늘(public.kst_today()) — 다음 날(KST 자정 이후) 복습 도전
--     practice  마지막 판정일 = 오늘 — 연습: 채점·해설은 그대로, 별·XP·진행 값은 바뀌지 않음
--   회차와 시도 번호 (quiz_attempts.attempt_no): 한 회차 = 같은 mode 의 연속 시도. 회차는 정답이나 3번째 오답으로 끝남.
--     마지막 시도(이 진행 행이 생긴 뒤, clock_timestamp 순)가 같은 mode·오답·3번째 미만이면 이어서 +1, 아니면 1
--     → 시도 번호는 1~3. 오답 두 번 뒤 다음 날 와도 그 회차(first/review)가 이어짐 (판정 전이라 날짜가 안 바뀜)
--     (진행 리셋으로 진행 행이 지워졌다 다시 생기면 그 전 시도는 보지 않음)
--   채점: quest_answer_keys.quiz_answer->'accepted' 중 하나와 jsonb = (키 순서 무관·배열 순서 그대로. @> 는 쓰지 않음)
--   별 (§12-Q17): 회차 안 1번째 정답 3 · 2번째 2 · 3번째 1. 3번째도 틀리면 정답 공개(revealed) + 1 로 판정("⭐ 1개로 클리어")
--     first·review 에서 판정이 나면: stars = 이번 별, best_stars = max, stars_judged_on = 오늘, status = completed(처음이면 completed_at)
--       XP = (새 best_stars − 이전 best_stars) × 10 (사용자 결정 2: 별 1개당 10 XP, 복습은 늘어난 별만) → earned_xp 에 더하고
--       users.total_xp·current_level(level_for_xp) 갱신. 원장 테이블은 아직 없음(coin_ledger 는 Phase 8) — complete_quest 처럼
--       진행 행 잠금 아래에서 판정이 날 때만 지급하고, 리셋은 SUM(earned_xp) 로 total_xp 를 다시 계산 (B12)
--     practice: 별·XP 없음. 3번째 오답이면 정답 공개만
--     review 에서 best_stars 보다 낮게 맞혀도 stars·stars_judged_on 은 갱신 (오늘 판정 → 오늘은 다시 연습)
--   시도 수 user_progress.attempts 는 제출마다 +1
--   반환 { correct, attempt_no, mode, stars(이번 판정 별, 판정 없으면 0), best_stars, xp_awarded, total_xp, level_before,
--          level_after, explanation, revealed, next_review_on }
--     explanation 정답: 정답 해설(quiz_answer.explanation) / 오답: 고른 보기(객관식 보기 id, bug_hunt 는 수정안→줄 순)의
--                 id별 해설(quiz_answer.explanations) 만, 없으면 null. 오답 응답에는 정답이 들어가지 않음
--     revealed    3번째 오답일 때만 { answer: accepted[0], explanation: 정답 해설 } (응답에 정답이 들어가는 유일한 경우)
--     next_review_on  별을 다시 받을 수 있는 날 (stars_judged_on + 1, KST 'YYYY-MM-DD'). 판정 전이면 null
--   오류 (message): invalid_arguments(PT400: 인자 없음·kind 와 맞지 않는 모양) · answer_too_large(PT413: 4096 바이트 초과)
--                   quest_not_found(PT404) · not_quiz(PT400) · user_not_found(PT404) · stage_locked(PT403)
--                   answer_key_missing(PT500: 콘텐츠 seed 누락)
--
-- 운영 적용 순서 (v0.6 릴리즈, docs/release/v0.6-runbook.md): ① 이 파일 → ② 앱 배포 (Phase 7) → 퀴즈 콘텐츠 seed
--   적용 후 NOTICE `[00026] submit_quiz_answer·is_stage_unlocked·complete_quest: service_role 전용, 퀴즈 잠금 제외 확인` 확인
--   ⚠️ 00012·00019 파일 전체를 다시 실행하면 is_stage_unlocked·complete_quest 가 그 정의로 돌아갑니다
-- 확인: supabase/tests QZ-1~9 (RPC-8·9)
-- 되돌리기: supabase/rollback/00026_quiz_answer_rpc.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 출발점: spikes/p0-08-answer-keys/grade_quiz_rpc.draft.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. is_stage_unlocked: 00012 + 퀴즈 제외
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_stage_unlocked(p_user_id UUID, p_stage_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH cur AS (
    SELECT w."order" AS world_order, s."order" AS stage_order
      FROM public.stages s
      JOIN public.worlds w ON w.id = s.world_id
     WHERE s.id = p_stage_id
  ),
  prev AS (
    SELECT p.id
      FROM cur
      JOIN public.stages p ON true
      JOIN public.worlds pw ON pw.id = p.world_id
     WHERE (pw."order", p."order") < (cur.world_order, cur.stage_order)
     ORDER BY pw."order" DESC, p."order" DESC
     LIMIT 1
  )
  SELECT NOT EXISTS (SELECT 1 FROM prev)
      OR (
        EXISTS (SELECT 1 FROM public.quests q JOIN prev ON q.stage_id = prev.id
                 WHERE q.quest_type <> 'quiz')
        AND NOT EXISTS (
          SELECT 1
            FROM public.quests q
            JOIN prev ON q.stage_id = prev.id
           WHERE q.quest_type <> 'quiz'
             AND NOT EXISTS (
               SELECT 1 FROM public.user_progress up
                WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed'))
      );
$$;

-- ------------------------------------------------------------
-- 2. complete_quest: 00019 + 스테이지 클리어·first_code·streak_3 에서 퀴즈 제외
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

-- ------------------------------------------------------------
-- 3. submit_quiz_answer: 퀴즈 채점 + 시도 기록 + 별·XP (한 트랜잭션, 흐름은 머리 주석)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. 권한: service_role 만 실행 (CREATE OR REPLACE 는 기존 권한을 유지하지만 §2.2 대로 다시 적음)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_stage_unlocked(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_stage_unlocked(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 5. 자기 검증: 실행 권한 + 퀴즈 제외 규칙이 함수 본문에 있는지
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad  TEXT[] := '{}';
  v_exec TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('submit_quiz_answer', 'is_stage_unlocked', 'complete_quest')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
          OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'));
  IF v_exec IS NOT NULL THEN
    v_bad := v_bad || ('실행 권한이 service_role 전용이 아닌 함수: ' || v_exec);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.is_stage_unlocked(uuid, uuid)'::regprocedure
                    AND prosrc LIKE '%quest_type <> ''quiz''%')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.complete_quest(uuid, uuid, jsonb)'::regprocedure
                    AND prosrc LIKE '%quest_type <> ''quiz''%') THEN
    v_bad := v_bad || '퀴즈 제외 규칙이 없음 (00012·00019 를 다시 실행했나요?)'::TEXT;
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00026] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00026] submit_quiz_answer·is_stage_unlocked·complete_quest: service_role 전용, 퀴즈 잠금 제외 확인';
END $$;
