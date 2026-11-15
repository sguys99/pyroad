-- ============================================================
-- 00053 되돌리기: 코드 바다 업적 7종 정의·얻은 기록 삭제 + achievement_stats 를 00051 정의로,
--                 evaluate_achievements·claim_achievement 를 00036 정의로, achievements.coins 열·카테고리 'sea' 삭제   (P10-11)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P10-11 이전 앱으로 되돌린 뒤 실행합니다 (지금 앱은 achievements.coins 열을 읽음).
-- 잃는 데이터: 코드 바다 업적·"실력 인정"을 얻은 기록(user_achievements, 정의 삭제로 CASCADE). 이미 받은 코인(원장 achievement/<id>)은 그대로
-- 실행 후 상태 = 00052 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00053_sea_achievements.rollback.sql
-- ============================================================

DELETE FROM public.achievements
 WHERE id IN ('skill_pass', 'sea_stage_1', 'sea_boss_1', 'sea_bug_doctor', 'sea_captain', 'sea_bosses_all', 'sea_perfect');

ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('learn', 'star', 'quiz', 'habit', 'growth', 'grit'));
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_coins_check;

-- evaluate_achievements: 00036 정의 (coins 열을 읽지 않음 → 열을 지우기 전에)
CREATE OR REPLACE FUNCTION public.evaluate_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  WITH ins AS (
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT p_user_id, p.achievement_id
      FROM public.achievement_progress(p_user_id) p
     WHERE p.goal > 0 AND p.progress >= p.goal
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING achievement_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id',          a.id,
           'name',        a.name,
           'description', a.description,
           'icon',        a.icon,
           'tier',        a.tier,
           'coins',       public.coin_reward('achievement', array_position(ARRAY['bronze', 'silver', 'gold'], a.tier)))
           ORDER BY a.sort), '[]'::jsonb)
    INTO v_new
    FROM ins
    JOIN public.achievements a ON a.id = ins.achievement_id;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.evaluate_achievements(UUID) IS
  '업적 판정 (P8-09). service_role 전용: 보상 RPC 뒤(complete_quest 안, 나머지는 API). 새로 얻은 업적만 반환, 코인은 claim_achievement';

-- claim_achievement: 00036 정의
CREATE OR REPLACE FUNCTION public.claim_achievement(p_user_id UUID, p_achievement_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coins INTEGER;
  v_row   RECORD;
  v_res   JSONB;
BEGIN
  IF p_user_id IS NULL OR p_achievement_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 받기를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT ua.claimed_at, a.tier
    INTO v_row
    FROM public.user_achievements ua
    JOIN public.achievements a ON a.id = ua.achievement_id
   WHERE ua.user_id = p_user_id AND ua.achievement_id = p_achievement_id
     FOR UPDATE OF ua;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'achievement_not_earned' USING ERRCODE = 'PT409';
  END IF;
  IF v_row.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', true, 'already_claimed', true, 'coins_earned', 0, 'coins_balance', v_coins);
  END IF;

  v_res := public.coin_apply(p_user_id, 'achievement', p_achievement_id,
                             public.coin_reward('achievement', array_position(ARRAY['bronze', 'silver', 'gold'], v_row.tier)));
  UPDATE public.user_achievements
     SET claimed_at = NOW()
   WHERE user_id = p_user_id AND achievement_id = p_achievement_id;

  RETURN jsonb_build_object(
    'claimed',         true,
    'already_claimed', false,
    'coins_earned',    (v_res->>'delta')::integer,
    'coins_balance',   (v_res->>'coins')::integer);
END;
$$;

COMMENT ON FUNCTION public.claim_achievement(UUID, TEXT) IS
  '업적 코인 받기 (P8-09, §12-Q62 ③). service_role 전용: /api/achievements/claim. 티어 10·30·100, 원장 achievement/<id> 로 한 번';

ALTER TABLE public.achievements DROP COLUMN IF EXISTS coins;

-- achievement_stats: 00051 정의
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

REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.evaluate_achievements(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.claim_achievement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_achievement(UUID, TEXT) TO service_role;
