-- ============================================================
-- 00038 되돌리기: profile_stats·achievement_stats·learning_day_quests 삭제, streak_learning_days·achievement_progress 를
--   00035·00036 본문으로 되돌림 (같은 결과라 데이터 변화 없음)   (P8-13)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-13 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 profile_stats 가 없으면 프로필 통계·달력이 0 으로 보임 — 화면은 그대로 열림).
-- 잃는 데이터: 없음 (함수만)
-- 실행 후 상태 = 00037 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00038_profile_stats.rollback.sql
-- ============================================================

-- 00035 본문
CREATE OR REPLACE FUNCTION public.streak_learning_days(p_user_id UUID)
RETURNS SETOF DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.kst_date(up.completed_at) FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.status = 'completed' AND up.completed_at IS NOT NULL AND NOT up.used_golden_key
  UNION
  SELECT public.kst_date(up.solved_directly_at) FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.solved_directly_at IS NOT NULL
  UNION
  SELECT up.stars_judged_on FROM public.user_progress up
   WHERE up.user_id = p_user_id AND up.stars_judged_on IS NOT NULL
     AND NOT (up.used_golden_key AND up.solved_directly_at IS NULL)
  UNION
  SELECT public.kst_date(qa.created_at) FROM public.quiz_attempts qa
   WHERE qa.user_id = p_user_id AND (qa.is_correct OR qa.attempt_no >= 3);
$$;

-- 00036 본문
CREATE OR REPLACE FUNCTION public.achievement_progress(p_user_id UUID)
RETURNS TABLE (achievement_id TEXT, progress INTEGER, goal INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
  ),
  stats AS (
    SELECT jsonb_build_object(
      'quests',        (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND direct),
      'quests_total',  (SELECT count(*) FROM public.quests q WHERE q.quest_type <> 'quiz'),
      'projects',      (SELECT count(*) FROM prog WHERE quest_type <> 'quiz' AND is_final AND direct),
      -- 코드·프로젝트를 모두 완료했고(황금키 완료도 진행이라 셈) 마지막으로 끝낸 퀘스트를 직접 푼 스테이지 (Q25: 황금키로 마지막을
      -- 열면 클리어는 되지만 업적은 아님 — 그 퀘스트를 나중에 직접 풀면 셈)
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
    ) AS v
  )
  SELECT a.id,
         LEAST(COALESCE((stats.v->>a.metric)::integer, 0), g.goal),
         g.goal
    FROM public.achievements a
    CROSS JOIN stats
    CROSS JOIN LATERAL (SELECT COALESCE(a.goal, (stats.v->>(a.metric || '_total'))::integer, 0) AS goal) g
   ORDER BY a.sort;
$$;

DROP FUNCTION IF EXISTS public.profile_stats(UUID);
DROP FUNCTION IF EXISTS public.achievement_stats(UUID);
DROP FUNCTION IF EXISTS public.learning_day_quests(UUID);

REVOKE ALL ON FUNCTION public.streak_learning_days(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.achievement_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.achievement_progress(UUID) TO service_role;

DO $$
BEGIN
  RAISE NOTICE '[00038 rollback] profile_stats 삭제, 학습일·업적 진행도 00035·00036 본문으로';
END $$;
