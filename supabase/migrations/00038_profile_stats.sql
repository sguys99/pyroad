-- ============================================================
-- 프로필 통계·학습 달력 한 번에 읽기 (Idempotent)
--   (P8-13, §3 F5, §2.6 프로필은 본인 전용 — 공개 프로필 뷰는 그대로)
-- 릴리즈 단계: ① 추가형 (새 함수 3개 + 기존 함수 2개 본문을 같은 결과의 공용 함수 호출로 바꿈. 인자·반환·권한 그대로,
--                       이전 앱은 profile_stats 를 부르지 않음)
--
-- 하는 일
--   1. learning_day_quests(user) (소유자만): 학습일 기록을 (KST 날짜, 퀘스트) 쌍으로 — streak_learning_days(00035)의 네 출처
--      (완료·직접 풀이·복습 판정·퀴즈 끝냄, 황금키 완료 제외) 그대로. 달력이 "그날 푼 퀘스트 수"를 셈
--   2. streak_learning_days(user) = 위 함수의 서로 다른 날짜 (같은 결과, 정의를 한 곳에)
--   3. achievement_stats(user) (소유자만): 업적 지표 jsonb (00036 achievement_progress 의 stats 그대로 옮김)
--   4. achievement_progress(user) = achievement_stats 를 부름 (같은 결과, 지표 정의를 한 곳에 — 프로필 통계와 업적이 같은 수)
--   5. profile_stats(user) (service_role, /profile 서버가 확인한 id 로): 방패 정산(멱등, world_daily_status 와 같음) 뒤
--        {stats(업적 지표, 목표에서 자르지 않음), quiz_tries·quiz_right(퀴즈 시도·정답 시도 수), streak(지금 연속), shields,
--         days {KST 날짜: 그날 푼 퀘스트 수}, shield_days, stamp_days(출석 도장 날짜), coins_week(이번 주 월요일부터 번 코인)}
--        달력 자료는 최근 400일만 (화면은 최근 12개월)
--   6. 권한 + 자기 검증
-- 적용 후 NOTICE `[00038] 프로필 통계: profile_stats service_role 전용` 확인
-- 확인: supabase/tests PF-1(실행 거부)·PF-2(학습일·업적 진행 같은 값, 달력 셈), RPC-6, AC-2·AT-3(바뀐 두 함수)
-- 되돌리기: supabase/rollback/00038_profile_stats.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1·2. 학습일 (퀘스트 단위) · 학습일
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.learning_day_quests(p_user_id UUID)
RETURNS TABLE (day DATE, quest_id UUID)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.kst_date(up.completed_at), up.quest_id FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed' AND up.completed_at IS NOT NULL AND NOT up.used_golden_key
  UNION
  SELECT public.kst_date(up.solved_directly_at), up.quest_id FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.solved_directly_at IS NOT NULL
  UNION
  SELECT up.stars_judged_on, up.quest_id FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.stars_judged_on IS NOT NULL
     AND NOT (up.used_golden_key AND up.solved_directly_at IS NULL)
  UNION
  SELECT public.kst_date(qa.created_at), qa.quest_id FROM public.quiz_attempts qa
   WHERE qa.user_id = p_user_id AND (qa.is_correct OR qa.attempt_no >= 3);
$$;

COMMENT ON FUNCTION public.learning_day_quests(UUID) IS
  '학습일 (KST 날짜, 퀘스트) 쌍 (P8-13): 완료·직접 풀이·복습 판정·퀴즈 끝냄, 황금키 완료 제외. 소유자만';

CREATE OR REPLACE FUNCTION public.streak_learning_days(p_user_id UUID)
RETURNS SETOF DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT DISTINCT l.day FROM public.learning_day_quests(p_user_id) l;
$$;

COMMENT ON FUNCTION public.streak_learning_days(UUID) IS
  '학습일 (P8-08, 00038 부터 learning_day_quests 의 날짜): 퀘스트·퀴즈를 푼 KST 날짜(황금키 완료 제외). 소유자만';

-- ------------------------------------------------------------
-- 3·4. 업적 지표 · 업적 진행도
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.achievement_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH prog AS (
    SELECT up.quest_id, up.hints_used, up.used_golden_key, up.best_stars, up.attempts, up.overcame_error,
           up.completed_at, q.stage_id, q.quest_type, s.is_final,
           (NOT up.used_golden_key OR up.solved_directly_at IS NOT NULL) AS direct
      FROM public.user_progress up
      JOIN public.quests q ON q.id = up.quest_id
      JOIN public.stages s ON s.id = q.stage_id
     WHERE up.user_id = p_user_id AND up.status = 'completed'
  ),
  quiz AS (
    SELECT qa.quest_id, qa.mode, qa.attempt_no, qa.is_correct
      FROM public.quiz_attempts qa
     WHERE qa.user_id = p_user_id
  ),
  days AS (
    SELECT d FROM public.streak_learning_days(p_user_id) AS d
    UNION
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'quests',        (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND direct),
    'quests_total',  (SELECT count(*) FROM public.quests q WHERE q.quest_type <> 'quiz'),
    'projects',      (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND is_final AND direct),
    -- 코드·프로젝트를 모두 완료했고(황금키 완료도 진행이라 셈) 마지막으로 끝낸 퀘스트를 직접 푼 스테이지 (Q25)
    'stages',        (SELECT count(*) FROM public.stages s
                       WHERE EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id AND q.quest_type <> 'quiz')
                         AND NOT EXISTS (SELECT 1 FROM public.quests q
                                          WHERE q.stage_id = s.id AND q.quest_type <> 'quiz'
                                            AND q.id NOT IN (SELECT quest_id FROM prog))
                         AND (SELECT p.direct FROM prog p
                               WHERE p.stage_id = s.id AND p.quest_type <> 'quiz'
                               ORDER BY p.completed_at DESC NULLS LAST LIMIT 1)),
    'no_hint',       (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND direct AND hints_used = 0),
    'hint_finish',   (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND NOT used_golden_key AND hints_used > 0),
    'stars',         (SELECT COALESCE(sum(best_stars), 0) FROM prog WHERE direct),
    'three_stars',   (SELECT count(*) FROM prog WHERE direct AND best_stars >= 3),
    'quiz_correct',  (SELECT count(DISTINCT quest_id) FROM quiz WHERE is_correct),
    'quiz_comeback', (SELECT count(DISTINCT quest_id) FROM quiz WHERE is_correct AND attempt_no >= 2),
    -- 코드: 첫 판정 1번(황금키 퀘스트는 직접 풀이 판정까지 2번) 다음부터가 복습 도전
    'reviews',       (SELECT count(*) FROM prog
                       WHERE quest_type <> 'quiz' AND attempts >= CASE WHEN used_golden_key THEN 3 ELSE 2 END)
                     + (SELECT count(DISTINCT quest_id) FROM quiz
                         WHERE mode = 'review' AND (is_correct OR attempt_no >= 3)),
    -- 가장 긴 연속: 날짜 − 순번이 같은 묶음
    'streak',        (SELECT COALESCE(max(n), 0) FROM (
                        SELECT count(*) AS n
                          FROM (SELECT d - (row_number() OVER (ORDER BY d))::integer AS grp FROM days) t
                         GROUP BY grp) r),
    'level',         (SELECT u.current_level FROM public.users u WHERE u.id = p_user_id),
    'attendance',    (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'attendance'),
    'missions',      (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'mission'),
    'chests',        (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'chest'),
    'errors',        (SELECT count(*) FROM prog WHERE overcame_error)
  );
$$;

COMMENT ON FUNCTION public.achievement_stats(UUID) IS
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

CREATE OR REPLACE FUNCTION public.achievement_progress(p_user_id UUID)
RETURNS TABLE (achievement_id TEXT, progress INTEGER, goal INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH stats AS (SELECT public.achievement_stats(p_user_id) AS v)
  SELECT a.id,
         LEAST(COALESCE((stats.v->>a.metric)::integer, 0), g.goal),
         g.goal
    FROM public.achievements a
    CROSS JOIN stats
    CROSS JOIN LATERAL (SELECT COALESCE(a.goal, (stats.v->>(a.metric || '_total'))::integer, 0) AS goal) g
   ORDER BY a.sort;
$$;

COMMENT ON FUNCTION public.achievement_progress(UUID) IS
  '업적 진행도 (P8-09, 00038 부터 achievement_stats): 모든 업적의 (id, progress, goal). service_role 전용(도감 P8-10·evaluate_achievements)';

-- ------------------------------------------------------------
-- 5. profile_stats
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today  DATE := public.kst_today();
  v_from   DATE := public.kst_today() - 400;
  -- 이번 주 월요일 (isodow 1 = 월)
  v_monday DATE := public.kst_today() - (extract(isodow FROM public.kst_today())::integer - 1);
  v_days   DATE[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  -- 월드맵을 거치지 않고 바로 프로필을 열어도 HUD 와 같은 스트릭 (멱등)
  PERFORM public.settle_streak_shields(p_user_id);

  v_days := ARRAY(
    SELECT d FROM public.streak_learning_days(p_user_id) d
    UNION
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = p_user_id);

  RETURN jsonb_build_object(
    'stats',       public.achievement_stats(p_user_id),
    'quiz_tries',  (SELECT count(*) FROM public.quiz_attempts qa WHERE qa.user_id = p_user_id),
    'quiz_right',  (SELECT count(*) FROM public.quiz_attempts qa WHERE qa.user_id = p_user_id AND qa.is_correct),
    'streak',      public.current_streak(v_days, v_today),
    'shields',     COALESCE((SELECT s.shields FROM public.user_streak_shields s WHERE s.user_id = p_user_id), 0),
    'days',        COALESCE((SELECT jsonb_object_agg(to_char(t.day, 'YYYY-MM-DD'), t.n) FROM (
                     SELECT l.day, count(DISTINCT l.quest_id) AS n FROM public.learning_day_quests(p_user_id) l
                      WHERE l.day >= v_from GROUP BY l.day) t), '{}'::jsonb),
    'shield_days', COALESCE((SELECT jsonb_agg(to_char(sd.day, 'YYYY-MM-DD') ORDER BY sd.day)
                               FROM public.streak_shield_days sd
                              WHERE sd.user_id = p_user_id AND sd.day >= v_from), '[]'::jsonb),
    'stamp_days',  COALESCE((SELECT jsonb_agg(l.ref ORDER BY l.ref) FROM public.coin_ledger l
                              WHERE l.user_id = p_user_id AND l.source = 'attendance'
                                AND l.ref >= to_char(v_from, 'YYYY-MM-DD')), '[]'::jsonb),
    'coins_week',  COALESCE((SELECT sum(l.delta) FROM public.coin_ledger l
                              WHERE l.user_id = p_user_id AND l.delta > 0
                                AND l.created_at >= (v_monday::timestamp AT TIME ZONE 'Asia/Seoul')), 0));
END;
$$;

COMMENT ON FUNCTION public.profile_stats(UUID) IS
  '프로필 통계·학습 달력 (P8-13). service_role 전용: /profile 서버가 확인한 id 로. 방패 정산 뒤 업적 지표·퀴즈 정답·스트릭·최근 400일 학습일(퀘스트 수)·방패 날·출석 날·이번 주 코인';

-- ------------------------------------------------------------
-- 6. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.learning_day_quests(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.streak_learning_days(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.achievement_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.achievement_progress(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.profile_stats(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_stats(UUID) TO service_role;

-- ------------------------------------------------------------
-- 7. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF has_function_privilege('anon', 'public.profile_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.profile_stats(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.profile_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_progress(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.achievement_progress(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.learning_day_quests(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.learning_day_quests(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.streak_learning_days(uuid)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_progress(uuid)'::regprocedure
                    AND prosrc LIKE '%achievement_stats%' AND prosecdef) THEN
    v_bad := v_bad || 'achievement_progress 정의'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00038] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00038] 프로필 통계: profile_stats service_role 전용';
END $$;
