-- ============================================================
-- 보스를 "힌트 없이" 집계에서 빼기 (Idempotent)   (B75, §12-Q69 ④)
-- 릴리즈 단계: ① 추가형 (함수 3개 본문만 교체. 인자·반환·권한·search_path 그대로 — 이전 앱도 같은 키·같은 RPC)
--
-- 왜: 보스(quest_type = 'boss', 00046)는 힌트가 없어 늘 hints_used = 0 → 이기기만 하면 "힌트 없이 풀기"로 셈 (00047 머리 주석에서 그대로 둔 것).
--     사용자 결정(2026-11-13): 보스는 "힌트 없이" 집계에서 뺌
-- 하는 일
--   1. achievement_stats (00048 + no_hint 에서 보스 뺌): 업적 hint_master·no_hint_10 등. hint_finish 는 힌트 1번 이상이라 보스가 원래 안 들어감
--   2. daily_mission_progress (00034 + no_hint 에서 보스 뺌): 데일리 미션 "힌트 없이 퀘스트 n개 클리어"
--   3. daily_mission_possible (00034 + no_hint 배정 조건의 남은 퀘스트에서 보스 뺌)
--   4. 자기 검증
-- 고칠 기존 데이터: 없음 — 운영에 보스 완료 기록이 없음(보스는 같은 묶음 v0.7-phase9 에서 처음 들어감). 이미 얻은 업적·받은 미션은 지우지 않음
-- ⚠️ 00034·00036·00038·00047·00048 을 다시 실행하면 그 함수가 옛 본문으로 돌아갑니다. 다시 실행했다면 00051 도 다시 실행
--    (00036 다시 실행 순서: 00036 → 00038 → 00047 → 00048 → 00051, 00048 머리 주석·RLS AC-5)
-- 적용 후 NOTICE `[00051] "힌트 없이" 집계에서 보스 뺌: 업적·데일리 미션` 확인
-- 확인: supabase/tests B75-1
-- 되돌리기: supabase/rollback/00051_boss_no_hint.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. achievement_stats
-- ------------------------------------------------------------
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
    -- 보스는 힌트가 없어 "힌트 없이"에서 뺌 (B75)
    'no_hint',       (SELECT count(*) FROM prog WHERE quest_type NOT IN ('quiz', 'boss') AND direct AND hints_used = 0),
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

COMMENT ON FUNCTION public.achievement_stats(UUID) IS
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김, B74 보스 반영, P9-18 주 n일, B75 no_hint 보스 제외): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

-- ------------------------------------------------------------
-- 2. daily_mission_progress
-- ------------------------------------------------------------
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
    -- 보스는 힌트가 없어 뺌 (B75)
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.user_progress up JOIN public.quests q ON q.id = up.quest_id
       WHERE up.user_id = p_user_id AND q.quest_type NOT IN ('quiz', 'boss') AND up.status = 'completed'
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

COMMENT ON FUNCTION public.daily_mission_progress(UUID, DATE, TEXT, UUID[]) IS
  '데일리 미션 진행 (P8-07): 그 KST 날짜의 기존 기록(user_progress·quiz_attempts)에서 셈(no_hint 는 보스 제외, B75). 소유자만';

-- ------------------------------------------------------------
-- 3. daily_mission_possible
-- ------------------------------------------------------------
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
    -- 힌트 없이 풀 수 있는 코드·프로젝트 퀘스트가 목표만큼 남았는지 (보스 빼고, B75)
    WHEN 'no_hint' THEN (
      SELECT count(*) FROM public.quests q
       WHERE q.quest_type NOT IN ('quiz', 'boss')
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

-- 권한 (00034·00038 그대로: 소유자만)
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_progress(UUID, DATE, TEXT, UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.daily_mission_possible(UUID, DATE, TEXT, INTEGER, UUID[]) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_stats(uuid)'::regprocedure
                  AND prosrc LIKE '%quest_type NOT IN (''quiz'', ''boss'') AND direct AND hints_used = 0%'
                  AND prosrc LIKE '%weeks_three%') THEN
    v_bad := v_bad || 'achievement_stats 정의'::TEXT;
  END IF;
  IF (SELECT count(*) FROM pg_proc
       WHERE oid IN ('public.daily_mission_progress(uuid, date, text, uuid[])'::regprocedure,
                     'public.daily_mission_possible(uuid, date, text, integer, uuid[])'::regprocedure)
         AND prosrc LIKE '%WHEN ''no_hint'' THEN (%quest_type NOT IN (''quiz'', ''boss'')%') <> 2 THEN
    v_bad := v_bad || 'daily_mission 정의'::TEXT;
  END IF;
  IF has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.daily_mission_progress(uuid, date, text, uuid[])', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.daily_mission_possible(uuid, date, text, integer, uuid[])', 'EXECUTE') THEN
    v_bad := v_bad || '권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00051] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00051] "힌트 없이" 집계에서 보스 뺌: 업적·데일리 미션';
END $$;
