-- ============================================================
-- 별점 시스템: 코드·프로젝트 퀘스트 별 판정 · 다시 풀기로 best_stars 갱신 · 새 별에만 코인 ·
--   황금키 퀘스트를 처음 직접 풀면 그때 뱃지 (Idempotent)
--   (P8-05, §2.3·§12-Q17·Q25·Q51·Q59, 코인 헬퍼는 00031)
-- 릴리즈 단계: ① 추가형 (새 컬럼·함수 + complete_quest 본문 교체. 인자·권한 그대로, 반환은 키만 늘어 이전 앱은 읽지 않음.
--                       이전 앱은 retry 를 보내지 않으므로 지금처럼 already_completed 만 받음)
--
-- 하는 일
--   1. user_progress.solved_directly_at: 황금키로 완료한 퀘스트를 처음 직접 풀어 통과한 시각 (서버 전용, 보호 트리거에 추가)
--   2. code_quest_stars(hints, golden): 코드 퀘스트 별 (TS 사본 src/lib/quest/xp.ts codeQuestStars, 대조 reward-rules.json "stars"
--      — vitest rewardRules.test.ts 와 test:rls RW-1). 황금키 1 / 힌트 0회 3 / 1회 2 / 그 외 1
--   3. is_solution_copy(quest, code): 제출 코드가 정답 코드(solution_code·단계별 solution_code)와 주석·공백만 다른지.
--      황금키가 공책에 넣어 준 정답을 그대로 다시 돌린 것은 "직접 푼 것"이 아님 (소유자만 실행)
--   4. complete_quest: 00031 + 별
--      - 첫 완료: stars = best_stars = code_quest_stars(DB hints_used, used_golden_key), stars_judged_on = 오늘(KST), attempts + 1.
--        별 코인(grant_star_coins)은 황금키 완료면 주지 않음 (황금키 별 1개는 "통과 표시", §2.6 보상은 학습 행동에만 — Q59 확정)
--      - 다시 풀기(p_submission.retry = true, 이미 완료, 서버 재채점 통과, 퀴즈 아님): 다시 풀기 화면은 힌트·황금키를 쓸 수 없으므로
--        (힌트 버튼 잠김, record_hint·use_golden_key 도 완료 행은 그대로/거절) 이번 별 = code_quest_stars(0, false) = 3.
--        best_stars = max(best_stars, 별), 새 별 번호에만 별 코인(원장 키라 리셋 뒤·동시 요청도 한 번). XP 는 주지 않음
--        (코드 퀘스트 XP 는 그 풀이의 힌트 배율로 정한 첫 완료 보상 — 같은 날 다시 풀어 1.5배를 채우는 길을 열지 않음. P8-14 점검)
--        코드 퀘스트는 퀴즈와 달리 같은 날에도 바로 갱신 (메인 기본값, §2.3 "코드 퀘스트 같은 날 재도전"은 P8-14 에서 점검)
--      - 황금키로 완료한 퀘스트의 첫 직접 풀이(위 다시 풀기 + solved_directly_at 없음 + 정답 복사 아님): solved_directly_at 기록,
--        그때 처음 학습 보상 — XP quest_xp(base, DB hints_used, 황금키 아님) · 첫 완료 코인 · 별 코인(1..3) · 레벨 업 코인 ·
--        뱃지 판정(first_code·hint_master·project_builder·streak_3, 스테이지 클리어는 이미 진행으로 셌으므로 아님)
--      - first_code·streak_3 이 세는 "직접 푼 완료"는 used_golden_key = false 또는 solved_directly_at 있음 (streak 날짜는
--        직접 푼 시각). 00019 의 "다시 풀어도 판정하지 않음"을 여기서 채움
--      - retry 가 아니거나 통과하지 않은 이미 완료 요청(중복 클릭·동시 요청)은 지금처럼 아무것도 바꾸지 않음
--      반환에 stars(이번 판정, 없으면 0) · best_stars · new_stars(이번에 늘어난 best) · solved_directly · solution_copy 추가
--   5. 권한 다시 적음 + 자기 검증
--   기존 완료 행의 별(지금 0)은 P8-11 소급에서 채움. 화면은 0별 완료 줄에 별을 그리지 않음 (StageSheet)
--   ⚠️ 00031 (또는 00019·00026) 파일을 다시 실행하면 complete_quest 가 별 없는 정의로 돌아갑니다. 다시 실행했다면 00032 도 다시 실행
-- 적용 후 NOTICE `[00032] 별점: code_quest_stars, complete_quest 별·다시 풀기·황금키 직접 풀이, service_role 전용` 확인
-- 확인: supabase/tests RW-1(stars 행), ST-1~4, RPC-6
-- 되돌리기: supabase/rollback/00032_star_system.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. solved_directly_at
-- ------------------------------------------------------------
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS solved_directly_at TIMESTAMPTZ;
COMMENT ON COLUMN public.user_progress.solved_directly_at IS
  '황금키로 완료한 퀘스트를 처음 직접 풀어 통과한 시각 (서버 전용, P8-05). 이때 뱃지·XP 를 판정';

CREATE OR REPLACE FUNCTION public.user_progress_protect_earned_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.earned_xp          := 0;
      NEW.stars              := 0;
      NEW.best_stars         := 0;
      NEW.attempts           := 0;
      NEW.stars_judged_on    := NULL;
      NEW.solved_directly_at := NULL;
    ELSE
      NEW.earned_xp          := OLD.earned_xp;
      NEW.stars              := OLD.stars;
      NEW.best_stars         := OLD.best_stars;
      NEW.attempts           := OLD.attempts;
      NEW.stars_judged_on    := OLD.stars_judged_on;
      NEW.solved_directly_at := OLD.solved_directly_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_progress_protect_earned_xp() IS
  'anon/authenticated 가 user_progress 의 서버 값(earned_xp·stars·best_stars·attempts·stars_judged_on·solved_directly_at)에 쓴 값을 버림 (P1-03, P1-08, P8-05). 컬럼 권한(00011) 뒤에도 이중 방어로 유지';

REVOKE ALL ON FUNCTION public.user_progress_protect_earned_xp() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. code_quest_stars
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.code_quest_stars(p_hints_used INTEGER, p_used_golden_key BOOLEAN)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN COALESCE(p_used_golden_key, false) THEN 1
           WHEN COALESCE(p_hints_used, 0) = 0 THEN 3
           WHEN p_hints_used = 1 THEN 2
           ELSE 1
         END;
$$;

COMMENT ON FUNCTION public.code_quest_stars(INTEGER, BOOLEAN) IS
  '코드·프로젝트 퀘스트 별 (P8-05, F3): 황금키 1 / 힌트 0회 3 / 1회 2 / 그 외 1. TS 사본 xp.ts codeQuestStars, 대조 reward-rules.json stars';

-- ------------------------------------------------------------
-- 3. is_solution_copy: 주석(#…줄 끝)·공백을 지우고 정답 코드와 같으면 true
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_solution_copy(p_quest_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH norm AS (
    SELECT regexp_replace(regexp_replace(COALESCE(p_code, ''), '#[^\r\n]*', '', 'g'), '\s', '', 'g') AS code
  )
  SELECT EXISTS (
    SELECT 1
      FROM public.quest_answer_keys k
      CROSS JOIN norm
     WHERE k.quest_id = p_quest_id
       AND norm.code <> ''
       AND norm.code IN (
             SELECT regexp_replace(regexp_replace(s.code, '#[^\r\n]*', '', 'g'), '\s', '', 'g')
               FROM (SELECT k.solution_code AS code
                     UNION ALL
                     SELECT st.v->>'solution_code'
                       FROM jsonb_array_elements(CASE WHEN jsonb_typeof(k.steps) = 'array' THEN k.steps ELSE '[]'::jsonb END) AS st(v)
                    ) s
              WHERE s.code IS NOT NULL));
$$;

COMMENT ON FUNCTION public.is_solution_copy(UUID, TEXT) IS
  '제출 코드가 정답 코드와 주석·공백만 다른지 (P8-05: 황금키 정답을 그대로 다시 돌린 것은 직접 풀이가 아님). 보상 RPC 안에서만 (소유자 실행)';

-- ------------------------------------------------------------
-- 4. complete_quest: 00031 + 별·다시 풀기·황금키 직접 풀이
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
  v_first          BOOLEAN;
  v_direct         BOOLEAN := false;  -- 황금키 퀘스트의 첫 직접 풀이 (이번 요청)
  v_copy           BOOLEAN := false;  -- 황금키 정답을 그대로 다시 돌림
  v_has_stars      BOOLEAN;
  v_stars          INTEGER := 0;
  v_best           INTEGER;
  v_xp             INTEGER;
  v_total_xp       INTEGER;
  v_level_after    INTEGER;
  v_golden_keys    INTEGER;
  v_stage_total    INTEGER;
  v_stage_done     INTEGER;
  v_stage_cleared  BOOLEAN := false;
  v_stage_info     JSONB;
  v_completed      INTEGER;
  v_completions    TIMESTAMPTZ[];
  v_earned         TEXT[];
  v_to_award       TEXT[] := '{}';
  v_new_badges     TEXT[] := '{}';
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
  -- 퀴즈 별은 submit_quiz_answer 가 정함 (00026)
  v_has_stars := v_quest.quest_type <> 'quiz';

  -- 잠금 순서: users → user_progress (reset_progress·use_golden_key 와 같음)
  SELECT u.total_xp, u.current_level, u.golden_keys, u.coins
    INTO v_user
    FROM public.users u
   WHERE u.id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at
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

  v_first := v_progress.status IS DISTINCT FROM 'completed';

  IF NOT v_first THEN
    -- 다시 풀기는 화면이 retry 를 보내고 서버 재채점을 통과했을 때만. 나머지(중복 클릭·동시 요청)는 아무것도 바꾸지 않음
    IF v_has_stars AND v_passed AND COALESCE(p_submission->'retry' = 'true'::jsonb, false)
       AND v_progress.used_golden_key AND v_progress.solved_directly_at IS NULL THEN
      v_copy := public.is_solution_copy(p_quest_id, v_code);
      v_direct := NOT v_copy;
    END IF;
    IF NOT (v_has_stars AND v_passed AND COALESCE(p_submission->'retry' = 'true'::jsonb, false)) OR v_copy THEN
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
        'level_ups',         '[]'::jsonb,
        'stars',             0,
        'best_stars',        v_progress.best_stars,
        'new_stars',         0,
        'solved_directly',   false,
        'solution_copy',     v_copy);
    END IF;
  END IF;

  IF NOT public.is_stage_unlocked(p_user_id, v_quest.stage_id) THEN
    RAISE EXCEPTION 'stage_locked' USING ERRCODE = 'PT403';
  END IF;

  IF v_first THEN
    IF NOT v_passed AND NOT COALESCE(v_progress.used_golden_key, false) THEN
      RAISE EXCEPTION 'not_passed' USING ERRCODE = 'PT422';
    END IF;

    -- 진행 행이 없으면 만든다 (users 잠금 아래라 동시 INSERT 경합 없음)
    IF v_progress.status IS NULL THEN
      INSERT INTO public.user_progress (user_id, quest_id, status)
      VALUES (p_user_id, p_quest_id, 'in_progress')
      ON CONFLICT (user_id, quest_id) DO NOTHING;
      SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at
        INTO v_progress
        FROM public.user_progress up
       WHERE up.user_id = p_user_id AND up.quest_id = p_quest_id
         FOR UPDATE;
    END IF;

    -- 보상 계산은 DB 값으로 (B05)
    v_xp := public.quest_xp(v_quest.xp_reward, v_progress.hints_used, v_progress.used_golden_key);
    IF v_has_stars THEN
      v_stars := public.code_quest_stars(v_progress.hints_used, v_progress.used_golden_key);
    END IF;
    v_best := GREATEST(v_progress.best_stars, v_stars);

    UPDATE public.user_progress
       SET status          = 'completed',
           completed_at    = NOW(),
           earned_xp       = v_xp,
           code_submitted  = COALESCE(v_code, code_submitted),
           stars           = CASE WHEN v_has_stars THEN v_stars ELSE stars END,
           best_stars      = v_best,
           stars_judged_on = CASE WHEN v_has_stars THEN public.kst_today() ELSE stars_judged_on END,
           attempts        = attempts + CASE WHEN v_has_stars THEN 1 ELSE 0 END
     WHERE user_id = p_user_id AND quest_id = p_quest_id;

    -- 스테이지 클리어 (이번 완료 포함)
    SELECT count(*), count(*) FILTER (WHERE up.status = 'completed')
      INTO v_stage_total, v_stage_done
      FROM public.quests q
      LEFT JOIN public.user_progress up ON up.quest_id = q.id AND up.user_id = p_user_id
     WHERE q.stage_id = v_quest.stage_id
       AND q.quest_type <> 'quiz';  -- 퀴즈는 보너스 (00026)
    v_stage_cleared := v_stage_total > 0 AND v_stage_total = v_stage_done;
  ELSE
    -- 다시 풀기: 힌트·황금키 없이 통과 → 3. XP 는 황금키 퀘스트의 첫 직접 풀이 때만 (그 풀이까지 받은 힌트 기준)
    v_stars := public.code_quest_stars(0, false);
    v_best := GREATEST(v_progress.best_stars, v_stars);
    v_xp := CASE WHEN v_direct THEN public.quest_xp(v_quest.xp_reward, v_progress.hints_used, false) ELSE 0 END;

    UPDATE public.user_progress
       SET stars              = v_stars,
           best_stars         = v_best,
           stars_judged_on    = public.kst_today(),
           attempts           = attempts + 1,
           earned_xp          = earned_xp + v_xp,
           solved_directly_at = CASE WHEN v_direct THEN NOW() ELSE solved_directly_at END
     WHERE user_id = p_user_id AND quest_id = p_quest_id;
  END IF;

  v_total_xp := v_user.total_xp + v_xp;
  v_level_after := public.level_for_xp(v_total_xp);

  -- 스테이지를 클리어하면 다음 스테이지를 위해 황금키 3개로
  v_golden_keys := CASE WHEN v_stage_cleared THEN 3 ELSE v_user.golden_keys END;

  UPDATE public.users
     SET total_xp      = v_total_xp,
         current_level = v_level_after,
         golden_keys   = v_golden_keys
   WHERE id = p_user_id;

  -- 코인 (00031): 첫 완료 코인(황금키 완료는 XP 처럼 0 → 첫 직접 풀이 때, 퀴즈는 별 코인만) + 별 코인 + 레벨 업 코인.
  -- 원장 키(quest:<quest_id>, star:<quest_id>:<n>, level_up:<레벨>)가 남아 리셋 뒤·동시 요청에도 한 번
  IF v_has_stars AND (v_direct OR (v_first AND NOT v_progress.used_golden_key)) THEN
    PERFORM public.coin_apply(p_user_id, 'quest', p_quest_id::text, public.coin_reward('quest'));
  END IF;
  -- 별 코인: 새로 얻은 별 번호만. 황금키 완료의 별 1개는 통과 표시라 주지 않음 → 직접 풀면 1..3 을 그때
  IF v_has_stars AND NOT (v_first AND v_progress.used_golden_key) THEN
    PERFORM public.grant_star_coins(p_user_id, p_quest_id, v_best);
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

  -- 뱃지: 첫 완료 또는 황금키 퀘스트의 첫 직접 풀이 때만 (그냥 다시 풀기는 판정하지 않음)
  IF v_first OR v_direct THEN
    SELECT COALESCE(array_agg(b.badge_type), '{}') INTO v_earned
      FROM public.user_badges b WHERE b.user_id = p_user_id;
    -- first_code·streak_3 은 직접 푼 완료만 셉니다 (Q25). 황금키 완료도 나중에 직접 풀면(solved_directly_at) 그 시각으로 셈 (P8-05).
    -- 스테이지 클리어(v_stage_cleared)는 진행이므로 황금키 퀘스트도 완료로 셉니다 (잠금 해제·황금키 3개·축하 그대로).
    SELECT count(*) FILTER (WHERE NOT up.used_golden_key OR up.solved_directly_at IS NOT NULL),
           array_agg(CASE WHEN up.used_golden_key THEN up.solved_directly_at ELSE up.completed_at END)
             FILTER (WHERE NOT up.used_golden_key OR up.solved_directly_at IS NOT NULL)
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
      v_progress.used_golden_key AND NOT v_direct,
      CASE WHEN 'streak_3' = ANY (v_earned) THEN false
           ELSE public.has_three_day_streak(v_completions) END);

    WITH ins AS (
      INSERT INTO public.user_badges (user_id, badge_type)
      SELECT p_user_id, b FROM unnest(v_to_award) AS b
      ON CONFLICT (user_id, badge_type) DO NOTHING
      RETURNING badge_type
    )
    SELECT COALESCE(array_agg(badge_type), '{}') INTO v_new_badges FROM ins;
  END IF;

  RETURN jsonb_build_object(
    'already_completed', NOT v_first,
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
    'level_ups',         v_level_ups,
    'stars',             v_stars,
    'best_stars',        v_best,
    'new_stars',         v_best - v_progress.best_stars,
    'solved_directly',   v_direct,
    'solution_copy',     false);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03, Q25, 00026 퀴즈 제외, 00031 코인, 00032 별·다시 풀기). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 XP, 다시 풀기는 새 별 코인만, 황금키 퀘스트는 처음 직접 풀 때 XP·뱃지';

-- ------------------------------------------------------------
-- 5. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.code_quest_stars(INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.code_quest_stars(INTEGER, BOOLEAN) TO service_role;
REVOKE ALL ON FUNCTION public.is_solution_copy(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 6. 자기 검증: 규칙 표본(reward-rules.json stars) + 권한 + 본문
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF public.code_quest_stars(0, false) <> 3 OR public.code_quest_stars(1, false) <> 2
     OR public.code_quest_stars(2, false) <> 1 OR public.code_quest_stars(0, true) <> 1 THEN
    v_bad := v_bad || '별 규칙 표본'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.complete_quest(uuid, uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_quest(uuid, uuid, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.complete_quest(uuid, uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.code_quest_stars(integer, boolean)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.is_solution_copy(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_solution_copy(uuid, text)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.complete_quest(uuid, uuid, jsonb)'::regprocedure
                    AND prosrc LIKE '%code_quest_stars%' AND prosrc LIKE '%grant_star_coins%'
                    AND prosrc LIKE '%grant_level_up_coins%') THEN
    v_bad := v_bad || '별이 없는 complete_quest 정의 (00019·00026·00031 을 다시 실행했나요?)'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00032] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00032] 별점: code_quest_stars, complete_quest 별·다시 풀기·황금키 직접 풀이, service_role 전용';
END $$;
