-- ============================================================
-- 00051 되돌리기: achievement_stats 를 00048 정의로, daily_mission_progress·daily_mission_possible 을 00034 정의로   (B75)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 잃는 데이터: 없음 (함수 본문만). 되돌리면 보스 승리가 다시 "힌트 없이"로 셈
-- 실행 후 상태 = 00050 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00051_boss_no_hint.rollback.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.achievement_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH prog AS (
    SELECT up.quest_id, up.hints_used, up.used_golden_key, up.best_stars, up.attempts, up.overcame_error,
           up.completed_at, up.stars_judged_on, q.stage_id, q.quest_type, s.is_final,
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
  learn AS (
    SELECT d FROM public.streak_learning_days(p_user_id) AS d
  ),
  -- KST 주(월~일)마다 공부한 날 수 (P9-18, 방패 날은 공부가 아니라 안 셈)
  weeks AS (
    SELECT public.kst_week_start(d) AS w, count(*) AS n FROM learn GROUP BY 1
  ),
  days AS (
    SELECT d FROM learn
    UNION
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = p_user_id
  )
  SELECT jsonb_build_object(
    'quests',        (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND direct),
    'quests_total',  (SELECT count(*) FROM public.quests q WHERE q.quest_type <> 'quiz'),
    -- 최종 프로젝트 퀘스트만 (B74: 마지막 스테이지 보스 승리는 프로젝트가 아님)
    'projects',      (SELECT count(*) FROM prog WHERE quest_type = 'project' AND direct),
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
    -- 보스: attempts 는 진 판도 세므로(00046) 쓰지 않고, 처음 이긴 날 뒤에 다시 이긴 판정(복습)이 있으면 (B74)
    'reviews',       (SELECT count(*) FROM prog
                       WHERE quest_type NOT IN ('quiz', 'boss') AND attempts >= CASE WHEN used_golden_key THEN 3 ELSE 2 END)
                     + (SELECT count(*) FROM prog
                         WHERE quest_type = 'boss' AND stars_judged_on > public.kst_date(completed_at))
                     + (SELECT count(DISTINCT quest_id) FROM quiz
                         WHERE mode = 'review' AND (is_correct OR attempt_no >= 3)),
    -- 가장 긴 연속: 날짜 − 순번이 같은 묶음
    'streak',        (SELECT COALESCE(max(n), 0) FROM (
                        SELECT count(*) AS n
                          FROM (SELECT d - (row_number() OVER (ORDER BY d))::integer AS grp FROM days) t
                         GROUP BY grp) r),
    -- 한 주에 2일·3일 이상 공부한 주 수 (P9-18: 주말만 공부해도 닿는 습관 업적)
    'weeks_two',     (SELECT count(*) FROM weeks WHERE n >= 2),
    'weeks_three',   (SELECT count(*) FROM weeks WHERE n >= 3),
    'level',         (SELECT u.current_level FROM public.users u WHERE u.id = p_user_id),
    'attendance',    (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'attendance'),
    'missions',      (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'mission'),
    'chests',        (SELECT count(*) FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'chest'),
    'errors',        (SELECT count(*) FROM prog WHERE overcame_error),
    -- 모든 퀘스트(퀴즈 포함)를 직접 풀어 별 3개인 스테이지 (§12-Q65 (d), 업적 perfect_stage · 월드맵 "완벽" 표시와 같은 기준)
    'perfect_stages', (SELECT count(*) FROM public.stages s
                        WHERE EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id)
                          AND NOT EXISTS (SELECT 1 FROM public.quests q
                                           WHERE q.stage_id = s.id
                                             AND q.id NOT IN (SELECT quest_id FROM prog WHERE direct AND best_stars >= 3)))
  );
$$;

CREATE OR REPLACE FUNCTION public.daily_mission_progress(p_user_id UUID, p_day DATE, p_kind TEXT, p_quiz_ids UUID[])
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    WHEN 'quest_clear' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND ((NOT up.used_golden_key AND public.kst_date(up.completed_at) = p_day)
              OR (up.solved_directly_at IS NOT NULL AND public.kst_date(up.solved_directly_at) = p_day)))
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND NOT up.used_golden_key AND up.hints_used = 0 AND public.kst_date(up.completed_at) = p_day)
    WHEN 'review' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type <> 'quiz' AND up.status = 'completed'
         AND up.stars_judged_on = p_day AND public.kst_date(up.completed_at) < p_day)
      + (SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
          WHERE qa.user_id = p_user_id AND qa.mode = 'review' AND public.kst_date(qa.created_at) = p_day
            AND (qa.is_correct OR qa.attempt_no >= 3))
    WHEN 'daily_quiz' THEN (
      SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
       WHERE qa.user_id = p_user_id AND qa.quest_id = ANY (COALESCE(p_quiz_ids, '{}'))
         AND public.kst_date(qa.created_at) = p_day AND (qa.is_correct OR qa.attempt_no >= 3))
    WHEN 'quiz_correct' THEN (
      SELECT count(DISTINCT qa.quest_id) FROM public.quiz_attempts qa
       WHERE qa.user_id = p_user_id AND qa.is_correct AND public.kst_date(qa.created_at) = p_day)
    ELSE 0
  END::integer;
$$;

CREATE OR REPLACE FUNCTION public.daily_mission_possible(p_user_id UUID, p_day DATE, p_kind TEXT, p_target INTEGER, p_quiz_ids UUID[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    -- 아직 안 깬 코드·프로젝트 퀘스트가 목표만큼 남았는지. 잠긴 스테이지 퀘스트도 셈 — 지금 스테이지를 깨면 같은 날 다음이 열림(P8-14 확인)
    -- + 목표 3개 이상은 최근 7일(어제까지) 중 하루에 그만큼 깬 적이 있는 학생에게만 (§12-Q65 (e): 하루 30분 학생은 quest_3 을 못 깸, docs/balance.md 3.9)
    WHEN 'quest_clear' THEN (
      SELECT count(*) FROM public.quests q
       WHERE q.quest_type <> 'quiz'
         AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                          WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')) >= p_target
      AND (p_target <= 2
           OR (SELECT max(public.daily_mission_progress(p_user_id, p_day - g.i, 'quest_clear', NULL))
                 FROM generate_series(1, 7) AS g(i)) >= p_target)
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.quests q
       WHERE q.quest_type <> 'quiz'
         AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                          WHERE up.user_id = p_user_id AND up.quest_id = q.id AND up.status = 'completed')) >= p_target
    -- 복습 도전이 열린 퀘스트(별 3개 미만, 판정일 < 그날 또는 판정 기록 없는 예전 완료)가 있는지
    WHEN 'review' THEN EXISTS (
      SELECT 1 FROM public.user_progress up
       WHERE up.user_id = p_user_id AND up.status = 'completed' AND up.best_stars < 3
         AND (up.stars_judged_on IS NULL OR up.stars_judged_on < p_day))
    -- 오늘의 퀴즈(열린 스테이지에서 서버가 고른 것)가 있으면 / 맞힐 퀴즈가 목표만큼 있으면
    WHEN 'daily_quiz' THEN COALESCE(cardinality(p_quiz_ids), 0) > 0
    WHEN 'quiz_correct' THEN COALESCE(cardinality(p_quiz_ids), 0) >= p_target
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_progress(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_possible(UUID, DATE, TEXT, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
