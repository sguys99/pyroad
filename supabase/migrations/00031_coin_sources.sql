-- ============================================================
-- 코인 획득처 연결: 금액표 coin_reward + 퀘스트 첫 완료·퀴즈 별·레벨 업 코인 (Idempotent)
--   (P8-04, §3 "초기 코인 밸런스안", §12-Q62, 원장·멱등은 00030)
-- 릴리즈 단계: ① 추가형 (새 함수 + complete_quest·submit_quiz_answer 본문 교체. 인자·권한 그대로, 반환은 키만 늘어
--                       이전 앱은 새 키를 읽지 않음)
--
-- 하는 일
--   1. coin_reward(kind, n): 코인 금액표 (TS 사본 src/lib/quest/coins.ts coinReward, 대조 supabase/tests/fixtures/reward-rules.json
--      "coins" 행 — vitest rewardRules.test.ts 와 test:rls RW-1). 확정 밸런스는 P8-14. 모르는 kind·범위 밖 n 은 0
--        quest        10   코드·프로젝트 퀘스트 첫 완료 (황금키 완료 0, 퀴즈는 별 코인만)
--        star          5   별 1개당, 별 번호마다 처음 한 번
--        level_up    n=레벨 2~50: 20, 5레벨마다 100 (TS levelUpCoins)
--        mission     n=난이도 1·2·3: 10·15·20            (P8-07)
--        attendance  n=출석 1~7일째: 5·5·10·10·15·20·30   (P8-08)
--        chest       n=1 스테이지 상자 30 · 2 마지막 스테이지 50 (P8-06)
--        achievement n=티어 1 브론즈 10 · 2 실버 30 · 3 골드 100 (P8-09)
--   2. grant_star_coins(user, quest, stars): 별 1..stars 마다 coin_apply('star', '<quest_id>:<별 번호>') → 이미 받은 별 번호는 0
--      (복습으로 늘어난 별만, 리셋 뒤 다시 모아도 0). 받은 코인 합 반환. 코드 퀘스트 별(P8-05)도 best_stars 를 갱신한 자리에서 부름
--   3. grant_level_up_coins(user, from_level, to_level): 지나간 레벨 from+1..to 마다 coin_apply('level_up', '<레벨>')
--      → [{level, coins}] (이미 받은 레벨은 coins 0). XP 를 올리는 모든 RPC 가 users 갱신 직후 부름 (P8-07 미션 XP 도)
--      두 헬퍼는 coin_apply 처럼 SECURITY INVOKER + 소유자만 실행 (보상 RPC 안에서만)
--   4. complete_quest: 00026 정의 + 첫 완료 코인(quest, ref = quest_id) + 레벨 업 코인
--   5. submit_quiz_answer: 00026 정의 + 별 판정(first·review)이 나면 별 코인 + XP 가 오르면 레벨 업 코인. 연습(practice) 0
--      두 RPC 반환에 coins_earned(이번 요청에서 늘어난 코인 전부) · coins_balance(잔액) · level_ups([{level, coins}]) 추가
--   6. 권한 다시 적음 + 자기 검증
--   P8-06~09 가 붙일 때: 같은 트랜잭션에서 PERFORM public.coin_apply(p_user_id, '<source>', '<ref>', public.coin_reward('<kind>', n))
--      ref 형식은 00030 머리 주석 (mission `<KST 날짜>:<미션 id>`, attendance `<KST 날짜>`, chest `<stage_id>`, achievement `<업적 id>`)
--   ⚠️ 00019·00026 파일을 다시 실행하면 complete_quest·submit_quiz_answer 가 코인 없는 정의로 돌아갑니다. 다시 실행했다면 00031 도 다시 실행
-- 적용 후 NOTICE `[00031] 코인 획득처: coin_reward 금액표, complete_quest·submit_quiz_answer 코인 지급, service_role 전용` 확인
-- 확인: supabase/tests RW-1(금액표), CN-8~10, RPC-6
-- 되돌리기: supabase/rollback/00031_coin_sources.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. coin_reward: 금액표
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coin_reward(p_kind TEXT, p_n INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(CASE p_kind
    WHEN 'quest'       THEN 10
    WHEN 'project'     THEN 40   -- 프로젝트 첫 완료 (§12-Q65 (a), XP 4배에 맞춤)
    WHEN 'star'        THEN 5
    WHEN 'level_up'    THEN CASE WHEN p_n BETWEEN 2 AND 50 THEN CASE WHEN p_n % 5 = 0 THEN 100 ELSE 20 END END
    WHEN 'mission'     THEN (ARRAY[10, 15, 20])[p_n]
    WHEN 'attendance'  THEN (ARRAY[5, 5, 10, 10, 15, 20, 30])[p_n]
    WHEN 'chest'       THEN (ARRAY[30, 50])[p_n]
    WHEN 'achievement' THEN (ARRAY[10, 30, 100])[p_n]
  END, 0);
$$;

COMMENT ON FUNCTION public.coin_reward(TEXT, INTEGER) IS
  '코인 금액표 (P8-04). TS 사본 src/lib/quest/coins.ts, 대조 reward-rules.json coins. 모르는 kind·범위 밖 n 은 0';

-- ------------------------------------------------------------
-- 2·3. 별·레벨 업 코인 헬퍼 (소유자만 실행)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_star_coins(p_user_id UUID, p_quest_id UUID, p_stars INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_total INTEGER := 0;
  v_star  INTEGER;
BEGIN
  FOR v_star IN 1 .. LEAST(COALESCE(p_stars, 0), 3) LOOP
    v_total := v_total + (public.coin_apply(p_user_id, 'star', p_quest_id::text || ':' || v_star,
                                            public.coin_reward('star'))->>'delta')::integer;
  END LOOP;
  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.grant_star_coins(UUID, UUID, INTEGER) IS
  '별 코인 (P8-04): 별 번호 1..stars 마다 한 번 (ref <quest_id>:<n>). 받은 코인 합. 보상 RPC 안에서만 (소유자 실행)';

CREATE OR REPLACE FUNCTION public.grant_level_up_coins(p_user_id UUID, p_from_level INTEGER, p_to_level INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_out   JSONB := '[]'::jsonb;
  v_level INTEGER;
  v_coins INTEGER;
BEGIN
  FOR v_level IN GREATEST(COALESCE(p_from_level, 1), 1) + 1 .. LEAST(COALESCE(p_to_level, 0), 50) LOOP
    v_coins := public.coin_reward('level_up', v_level);
    IF v_coins > 0 THEN
      v_coins := (public.coin_apply(p_user_id, 'level_up', v_level::text, v_coins)->>'delta')::integer;
    END IF;
    v_out := v_out || jsonb_build_object('level', v_level, 'coins', v_coins);
  END LOOP;
  RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.grant_level_up_coins(UUID, INTEGER, INTEGER) IS
  '레벨 업 코인 (P8-04): 지나간 레벨 from+1..to 마다 한 번 (ref <레벨>). [{level, coins}] (이미 받은 레벨은 0). 보상 RPC 안에서만';

-- ------------------------------------------------------------
-- 4. complete_quest: 00026 + 첫 완료 코인·레벨 업 코인 (반환에 coins_earned·coins_balance·level_ups)
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
  v_level_ups      JSONB;
  v_coins          INTEGER;
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

  SELECT q.id, q.stage_id, q."order", q.xp_reward, q.quest_type, s."order" AS stage_order, s.title AS stage_title, s.is_final
    INTO v_quest
    FROM public.quests q
    JOIN public.stages s ON s.id = q.stage_id
   WHERE q.id = p_quest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'quest_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 잠금 순서: users → user_progress (reset_progress·use_golden_key 와 같음)
  SELECT u.total_xp, u.current_level, u.golden_keys, u.coins
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
      'used_golden_key',   v_progress.used_golden_key,
      'coins_earned',      0,
      'coins_balance',     v_user.coins,
      'level_ups',         '[]'::jsonb);
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

  -- 코인 (00031): 첫 완료 코인(황금키 완료는 XP 처럼 0, 퀴즈는 별 코인만) + 지나간 레벨마다 레벨 업 코인.
  -- 원장 키(quest:<quest_id>, level_up:<레벨>)가 남아 리셋 뒤 다시 풀어도 다시 받지 않음 (P8-03)
  IF NOT v_progress.used_golden_key AND v_quest.quest_type <> 'quiz' THEN
    PERFORM public.coin_apply(p_user_id, 'quest', p_quest_id::text, public.coin_reward(CASE WHEN v_quest.quest_type = 'project' THEN 'project' ELSE 'quest' END));
  END IF;
  v_level_ups := public.grant_level_up_coins(p_user_id, v_user.current_level, v_level_after);
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id;

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
    'used_golden_key',   v_progress.used_golden_key,
    'coins_earned',      v_coins - v_user.coins,
    'coins_balance',     v_coins,
    'level_ups',         v_level_ups);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03, Q25, 00026 퀴즈 제외, 00031 코인). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 지급, 황금키 완료는 뱃지·코인 없음';

-- ------------------------------------------------------------
-- 5. submit_quiz_answer: 00026 + 별 코인·레벨 업 코인 (연습 0)
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
  v_level_ups   JSONB := '[]'::jsonb;
  v_coins       INTEGER;
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
  SELECT u.total_xp, u.current_level, u.coins
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
      v_level_ups := public.grant_level_up_coins(p_user_id, v_user.current_level, v_level_after);
    END IF;
    -- 별 코인 (00031): 별 번호마다 한 번 (star:<quest_id>:<n>) → 복습으로 늘어난 별만, 리셋 뒤 다시 모아도 0
    PERFORM public.grant_star_coins(p_user_id, p_quest_id, v_best);
  ELSE
    UPDATE public.user_progress
       SET attempts = attempts + 1
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
  END IF;

  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id;

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
    'next_review_on', to_char(v_judged_on + 1, 'YYYY-MM-DD'),
    'coins_earned',   v_coins - v_user.coins,
    'coins_balance',  v_coins,
    'level_ups',      v_level_ups);
END;
$$;

COMMENT ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) IS
  '퀴즈 채점·시도 기록·별·XP·코인 (P7-02, 00031). service_role 전용: /api/quest/answer 가 getUser() 로 확인한 id 만 넘김. 오답 응답에 정답 없음(3번째 오답의 revealed 만)';

-- ------------------------------------------------------------
-- 6. 권한: 보상 RPC 는 service_role 만, 금액표는 service_role 도 (quest_xp 와 같음), 헬퍼는 소유자만
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.coin_reward(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_reward(TEXT, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.grant_star_coins(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.grant_level_up_coins(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 7. 자기 검증: 금액표 표본(reward-rules.json coins) + 권한 + 본문에 코인 지급이 있는지
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
  v_fn  TEXT;
BEGIN
  IF public.coin_reward('quest') <> 10 OR public.coin_reward('project') <> 40 OR public.coin_reward('star') <> 5
     OR public.coin_reward('level_up', 1) <> 0 OR public.coin_reward('level_up', 2) <> 20
     OR public.coin_reward('level_up', 5) <> 100 OR public.coin_reward('level_up', 51) <> 0
     OR public.coin_reward('attendance', 7) <> 30 OR public.coin_reward('bogus') <> 0 THEN
    v_bad := v_bad || '금액표 표본'::TEXT;
  END IF;
  FOREACH v_fn IN ARRAY ARRAY['public.complete_quest(uuid, uuid, jsonb)', 'public.submit_quiz_answer(uuid, uuid, jsonb)',
                              'public.coin_reward(text, integer)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      v_bad := v_bad || (v_fn || ' 실행 권한이 service_role 전용이 아님');
    END IF;
  END LOOP;
  FOREACH v_fn IN ARRAY ARRAY['public.grant_star_coins(uuid, uuid, integer)', 'public.grant_level_up_coins(uuid, integer, integer)'] LOOP
    IF has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE') THEN
      v_bad := v_bad || (v_fn || ' 는 소유자만 실행해야 함');
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.complete_quest(uuid, uuid, jsonb)'::regprocedure
                    AND prosrc LIKE '%grant_level_up_coins%' AND prosrc LIKE '%quest_type <> ''quiz''%')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.submit_quiz_answer(uuid, uuid, jsonb)'::regprocedure
                    AND prosrc LIKE '%grant_star_coins%') THEN
    v_bad := v_bad || '코인 지급이 없는 정의 (00019·00026 을 다시 실행했나요?)'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00031] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00031] 코인 획득처: coin_reward 금액표, complete_quest·submit_quiz_answer 코인 지급, service_role 전용';
END $$;
