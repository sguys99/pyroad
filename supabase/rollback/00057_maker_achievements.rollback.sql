-- ============================================================
-- 00057 되돌리기: 메이커 시티 업적 9종 정의·얻은 기록 삭제 + achievement_stats 를 00053 정의로, 카테고리 'maker' 삭제   (P11-14)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P11-14 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 메이커 시티 업적을 얻은 기록(user_achievements, 정의 삭제로 CASCADE). 이미 받은 코인(원장 achievement/<id>)은 그대로
-- 실행 후 상태 = 00056 까지 적용된 상태
-- ============================================================

DELETE FROM public.achievements
 WHERE id IN ('maker_first_save', 'maker_first_post', 'maker_boss_first', 'turtle_painter', 'story_weaver',
              'game_maker', 'maker_citizen', 'perfect_city', 'cheer_leader');

ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('learn', 'star', 'quiz', 'habit', 'growth', 'grit', 'sea'));

-- achievement_stats: 00053 정의
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
  ),
  -- 2월드(코드 바다) 스테이지마다: 깸(위 stages 와 같은 규칙) · 완벽(위 perfect_stages 와 같은 규칙) (P10-11)
  sea AS (
    SELECT s.is_final,
           EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id) AS has_quests,
           EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id AND q.quest_type <> 'quiz')
             AND NOT EXISTS (SELECT 1 FROM public.quests q
                              WHERE q.stage_id = s.id AND q.quest_type <> 'quiz'
                                AND q.id NOT IN (SELECT quest_id FROM prog))
             AND COALESCE((SELECT p.direct FROM prog p
                            WHERE p.stage_id = s.id AND p.quest_type <> 'quiz'
                            ORDER BY p.completed_at DESC NULLS LAST LIMIT 1), false) AS cleared,
           EXISTS (SELECT 1 FROM public.quests q WHERE q.stage_id = s.id)
             AND NOT EXISTS (SELECT 1 FROM public.quests q
                              WHERE q.stage_id = s.id
                                AND q.id NOT IN (SELECT quest_id FROM prog WHERE direct AND best_stars >= 3)) AS perfect
      FROM public.stages s
      JOIN public.worlds w ON w.id = s.world_id
     WHERE w."order" = 2
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
                                             AND q.id NOT IN (SELECT quest_id FROM prog WHERE direct AND best_stars >= 3))),
    -- ── 2월드 코드 바다 (P10-11) ──
    'skill_pass',    (SELECT count(DISTINCT sc.world_id) FROM public.skill_check_attempts sc
                       WHERE sc.user_id = p_user_id AND sc.passed),
    'sea_stages',    (SELECT count(*) FROM sea WHERE cleared),
    'sea_clear',     (SELECT count(*) FROM sea WHERE cleared AND is_final),
    'sea_bosses',    (SELECT count(*) FROM prog p JOIN public.stages s ON s.id = p.stage_id JOIN public.worlds w ON w.id = s.world_id
                       WHERE w."order" = 2 AND p.quest_type = 'boss' AND p.direct),
    'sea_bosses_total', (SELECT count(*) FROM public.quests q JOIN public.stages s ON s.id = q.stage_id
                          JOIN public.worlds w ON w.id = s.world_id
                         WHERE w."order" = 2 AND q.quest_type = 'boss'),
    -- 2-5 버그 병원선: 보스·퀴즈 빼고 힌트 없이 직접 (B75 와 같은 기준)
    'sea_bug_fix',   (SELECT count(*) FROM prog
                       WHERE stage_id = 'a2000000-0000-0000-0000-000000000005' AND quest_type NOT IN ('quiz', 'boss')
                         AND direct AND hints_used = 0),
    'sea_bug_fix_total', (SELECT count(*) FROM public.quests q
                           WHERE q.stage_id = 'a2000000-0000-0000-0000-000000000005' AND q.quest_type NOT IN ('quiz', 'boss')),
    'sea_perfect',   (SELECT count(*) FROM sea WHERE perfect),
    'sea_perfect_total', (SELECT count(*) FROM sea WHERE has_quests)
  );
$$;

COMMENT ON FUNCTION public.achievement_stats(UUID) IS
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김, B74 보스 반영, P9-18 주 n일, B75 no_hint 보스 제외, P10-11 코드 바다·실력 확인): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;
