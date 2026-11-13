-- ============================================================
-- 업적 지표에서 보스 승리 바로 세기 (Idempotent)   (B74, P9-12·P9-13 후속, §12-Q69)
-- 릴리즈 단계: ① 추가형 (achievement_stats 본문만 교체. 인자·반환·권한·search_path 그대로 — 이전 앱도 같은 키를 읽음)
--
-- 보스(quest_type = 'boss', 00046)는 "퀴즈가 아닌 퀘스트"라 00036·00038 지표가 그대로 셌는데, 의도와 다른 두 곳만 고침
--   1. projects: "마지막 스테이지(is_final)의 퀴즈 아닌 완료" → 7단계 보스 승리도 프로젝트로 셈 (업적 project_builder
--      "최종 프로젝트를 완성했어요!"가 보스로 열림) → quest_type = 'project' 만
--   2. reviews: 코드 퀘스트는 attempts(별 판정 수) 2번째부터 복습인데, 보스 attempts 는 진 판·같은 날 연습 판도 셈 → 지고 나서
--      이기면 복습 업적이 오름 → 보스는 "처음 이긴 날(completed_at) 뒤에 다시 이겨 별 판정(stars_judged_on)" 한 퀘스트로 셈
--      (데일리 미션 review 와 같은 기준, 00034)
-- 그대로 둔 것 (보스도 퀘스트로 세는 게 의도 — §12-Q69 ①, docs/balance.md 3.14):
--   quests·quests_total·stages·stars·three_stars·perfect_stages · 스테이지 클리어(complete_quest·boss_answer)·잠금(is_stage_unlocked)·
--   보물상자(00033) · 데일리 미션 quest_clear·no_hint·review(00034) · 공유 카드 주간 수(00043) · 학습일(00038)
--   no_hint: 보스는 힌트가 없어 늘 힌트 0으로 셈 (balance.md 3.14 시뮬레이션 그대로)
-- 고칠 기존 데이터: 없음 — 보스는 이 묶음(v0.7-phase9)에서 처음 들어가 운영에 보스 완료 기록이 없음. 이미 얻은 업적은 지우지 않음(00036 원칙)
-- ⚠️ 00036·00038 을 다시 실행하면 achievement_stats 가 옛 본문으로 돌아갑니다. 다시 실행했다면 00047 도 다시 실행
-- 적용 후 NOTICE `[00047] 업적 지표: projects = 프로젝트 퀘스트만, 보스 복습은 다음 날 승리부터` 확인
-- 확인: supabase/tests B74-1
-- 되돌리기: supabase/rollback/00047_boss_metrics.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
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
  days AS (
    SELECT d FROM public.streak_learning_days(p_user_id) AS d
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
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김, B74 보스 반영): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

-- 권한 (00038 그대로: 소유자만)
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- 자기 검증
DO $$
BEGIN
  IF has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_stats(uuid)'::regprocedure
                     AND prosrc LIKE '%quest_type = ''project'' AND direct%'
                     AND prosrc LIKE '%quest_type = ''boss'' AND stars_judged_on%') THEN
    RAISE EXCEPTION '[00047] 검증 실패: achievement_stats 권한·정의';
  END IF;
  RAISE NOTICE '[00047] 업적 지표: projects = 프로젝트 퀘스트만, 보스 복습은 다음 날 승리부터';
END $$;
