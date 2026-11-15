-- ============================================================
-- 2월드(코드 바다) 업적 7종 + 코인 없는 배지 "실력 인정" (Idempotent)   (P10-11, §12-Q73 ⑥·제안 K, §3 F5)
-- 릴리즈 단계: ① 추가형 (achievements 새 열 coins · 카테고리 CHECK 넓힘('sea') · 업적 정의 7행 upsert ·
--                       achievement_stats 본문 교체(새 키만 늘고 인자·반환·권한 그대로) · evaluate_achievements·claim_achievement
--                       본문 교체(인자·반환 모양·권한 그대로). 이전 앱은 'sea' 카테고리 절을 그리지 않을 뿐 도감·받기는 그대로 —
--                       "실력 인정"은 얻는 순간 받은 것(claimed_at)으로 기록돼 받기 단추가 안 뜸)
--
-- 하는 일
--   1. achievements.coins (NULL = 티어 금액 10·30·100, 0 = 코인 없는 배지). "실력 인정"만 0 (제안 K: 건너뛰기에 보상을 주면
--      1월드를 깬 학생보다 이득처럼 보임)
--   2. achievements_category_check 에 'sea'(코드 바다) 추가 — 도감에서 바다 띠로 따로 모음
--   3. achievement_stats (00051 + 새 키). 2월드 = worlds."order" = 2 (slug code-sea). 퀘스트 id 를 박지 않고 기록에서 셈
--        skill_pass       실력 확인 퀴즈에 합격한 월드 수 (skill_check_attempts.passed, 00052)
--        sea_stages       2월드에서 깬 스테이지 수 (00036 stages 와 같은 규칙: 코드·프로젝트·보스를 모두 완료 + 마지막 완료를 직접, Q25)
--        sea_clear        그중 마지막(is_final) 스테이지 2-F = 최종 보스 "버그버그 선장"까지 이김 (Q73 ④)
--        sea_bosses       2월드 보스 승리 수 · sea_bosses_total 2월드 보스 수 (목표 NULL = 모두, 지금 7)
--        sea_bug_fix      2-5 버그 병원선(a2…05)의 코드 퀘스트를 힌트 0·직접 푼 수 · sea_bug_fix_total 그 코드 퀘스트 수
--                         (보스·퀴즈는 뺌 — 보스는 힌트가 없어 "힌트 없이"에서 빠짐, Q69 ④·B75)
--        sea_perfect      2월드에서 모든 퀘스트(퀴즈 포함)가 별 3개인 스테이지 수 · sea_perfect_total 퀘스트가 있는 2월드 스테이지 수
--      월드가 아직 seed 에 없으면(초안) _total 이 0 → 목표 0 이라 아무도 못 얻음 (evaluate 는 goal > 0 만)
--   4. 업적 정의 7행 (카테고리 sea, sort 710~770):
--        skill_pass 실력 인정(실버, 코인 0) · sea_stage_1 첫 항해(브론즈 10) · sea_boss_1 바다 보스 첫 승리(브론즈 10) ·
--        sea_bug_doctor 버그 병원선 명의(실버 30) · sea_captain 코드 바다 선장(실버 30) · sea_bosses_all 일곱 바다의 용사(골드 100) ·
--        sea_perfect 완벽한 바다(골드 100, 숨김) — 2월드 전용 업적 코인 최대 280 (docs/balance.md 3.8)
--   5. evaluate_achievements (00036 + 금액 COALESCE(coins, 티어) · 코인 0 업적은 얻는 순간 claimed_at 도 채움 — 받을 것이 없으니 받기 단추 없음)
--   6. claim_achievement (00036 + 같은 금액. 0 이면 원장에 쓰지 않고 claimed_at 만 — 이미 얻어 둔 0 코인 업적을 눌러도 안전)
--   7. 권한 + 자기 검증
-- 소급: 따로 지급하지 않음 (00048 과 같음). 지표가 기존 기록(진행·합격 행)에서 나오므로 이미 조건을 채운 학생도 다음 판정
--       (퀘스트·퀴즈·미션·출석·상자·실력 확인 퀴즈 합격 뒤, 또는 업적 도감 열기) 때 얻고, 코인은 "받기"로
-- ⚠️ 00036·00038·00047·00048·00051 을 다시 실행하면 achievement_stats·evaluate_achievements·claim_achievement 가 옛 본문으로 돌아갑니다.
--    다시 실행했다면 00053 도 다시 실행 (00036 자기 검증은 새 지표를 "모르는 지표"로 보고 실패 — 00048 머리 주석처럼 새 정의를 먼저 지움)
-- 적용 후 NOTICE `[00053] 코드 바다 업적 7종(실력 인정은 코인 없음): 업적 n종` 확인
-- 확인: supabase/tests SEA-1(지표·판정·코인 없는 배지·받기)
-- 되돌리기: supabase/rollback/00053_sea_achievements.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1·2. achievements 열·카테고리
-- ------------------------------------------------------------
ALTER TABLE public.achievements ADD COLUMN IF NOT EXISTS coins INTEGER;
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_coins_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_coins_check CHECK (coins IS NULL OR coins >= 0);
COMMENT ON COLUMN public.achievements.coins IS
  '받기 코인 (P10-11). NULL = 티어 금액(coin_reward achievement 1·2·3), 0 = 코인 없는 배지(얻는 순간 받은 것으로)';

ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('learn', 'star', 'quiz', 'habit', 'growth', 'grit', 'sea'));

-- ------------------------------------------------------------
-- 3. achievement_stats (00051 + 2월드 키)
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

-- 권한 (00038 그대로: 소유자만)
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. 업적 정의 (00036 표와 같은 열 순서 + coins, 다시 실행하면 문구·목표를 이 표대로)
-- ------------------------------------------------------------
INSERT INTO public.achievements (id, name, description, icon, tier, category, metric, goal, sort, hidden, coins) VALUES
  ('skill_pass',      '실력 인정',        '실력 확인 퀴즈에 합격해 코드 바다로 바로 떠났어요!', 'ClipboardCheck', 'silver', 'sea', 'skill_pass',  1,    710, false, 0),
  ('sea_stage_1',     '첫 항해',          '코드 바다의 스테이지 하나를 끝까지 깼어요!',       'Sailboat',      'bronze', 'sea',    'sea_stages',  1,    720, false, NULL),
  ('sea_boss_1',      '바다 보스 첫 승리', '코드 바다 보스를 처음으로 이겼어요!',             'Anchor',        'bronze', 'sea',    'sea_bosses',  1,    730, false, NULL),
  ('sea_bug_doctor',  '버그 병원선 명의', '버그 병원선의 코드 퀘스트를 모두 힌트 없이 고쳤어요!', 'Stethoscope', 'silver', 'sea',    'sea_bug_fix', NULL, 740, false, NULL),
  ('sea_captain',     '코드 바다 선장',   '버그버그 선장을 이기고 코드 바다를 끝까지 항해했어요!', 'ShipWheel',  'silver', 'sea',    'sea_clear',   1,    750, false, NULL),
  ('sea_bosses_all',  '일곱 바다의 용사', '코드 바다 보스를 모두 이겼어요!',                  'Waves',         'gold',   'sea',    'sea_bosses',  NULL, 760, false, NULL),
  ('sea_perfect',     '완벽한 바다',      '코드 바다의 모든 퀘스트와 퀴즈에서 별 3개를 받았어요!', 'Shell',      'gold',   'sea',    'sea_perfect', NULL, 770, true,  NULL)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, tier = EXCLUDED.tier,
      category = EXCLUDED.category, metric = EXCLUDED.metric, goal = EXCLUDED.goal, sort = EXCLUDED.sort,
      hidden = EXCLUDED.hidden, coins = EXCLUDED.coins;

-- ------------------------------------------------------------
-- 5. evaluate_achievements (00036 + 업적별 금액, 코인 0 이면 받은 것으로)
-- ------------------------------------------------------------
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
    INSERT INTO public.user_achievements (user_id, achievement_id, claimed_at)
    SELECT p_user_id, p.achievement_id, CASE WHEN a.coins = 0 THEN NOW() END
      FROM public.achievement_progress(p_user_id) p
      JOIN public.achievements a ON a.id = p.achievement_id
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
           'coins',       COALESCE(a.coins, public.coin_reward('achievement', array_position(ARRAY['bronze', 'silver', 'gold'], a.tier))))
           ORDER BY a.sort), '[]'::jsonb)
    INTO v_new
    FROM ins
    JOIN public.achievements a ON a.id = ins.achievement_id;

  RETURN v_new;
END;
$$;

COMMENT ON FUNCTION public.evaluate_achievements(UUID) IS
  '업적 판정 (P8-09, P10-11 업적별 금액). service_role 전용: 보상 RPC 뒤(complete_quest 안, 나머지는 API). 새로 얻은 업적만 반환, 코인은 claim_achievement (코인 0 업적은 얻는 순간 받은 것으로)';

-- ------------------------------------------------------------
-- 6. claim_achievement (00036 + 업적별 금액, 0 이면 원장 없이)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_achievement(p_user_id UUID, p_achievement_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coins  INTEGER;
  v_amount INTEGER;
  v_row    RECORD;
  v_res    JSONB;
BEGIN
  IF p_user_id IS NULL OR p_achievement_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 받기를 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  SELECT ua.claimed_at, a.tier, a.coins
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

  v_amount := COALESCE(v_row.coins,
                       public.coin_reward('achievement', array_position(ARRAY['bronze', 'silver', 'gold'], v_row.tier)));
  IF v_amount > 0 THEN
    v_res := public.coin_apply(p_user_id, 'achievement', p_achievement_id, v_amount);
  ELSE
    v_res := jsonb_build_object('delta', 0, 'coins', v_coins);
  END IF;
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
  '업적 코인 받기 (P8-09, §12-Q62 ③, P10-11 업적별 금액). service_role 전용: /api/achievements/claim. 티어 10·30·100(또는 achievements.coins), 원장 achievement/<id> 로 한 번, 0 이면 원장 없이 받은 것으로';

-- ------------------------------------------------------------
-- 7. 권한 (00036 그대로) + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.evaluate_achievements(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.claim_achievement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_achievement(UUID, TEXT) TO service_role;

DO $$
DECLARE
  v_bad   TEXT[] := '{}';
  v_n     INTEGER;
  v_stats JSONB := public.achievement_stats('00000000-0000-0000-0000-000000000000');
BEGIN
  SELECT count(*) INTO v_n FROM public.achievements;
  IF (SELECT count(*) FROM public.achievements WHERE category = 'sea') <> 7
     OR (SELECT coins FROM public.achievements WHERE id = 'skill_pass') IS DISTINCT FROM 0
     OR EXISTS (SELECT 1 FROM public.achievements WHERE id <> 'skill_pass' AND coins IS NOT NULL) THEN
    v_bad := v_bad || '코드 바다 업적 7종·실력 인정만 코인 0'::TEXT;
  END IF;
  -- 모든 정의의 지표가 achievement_stats 에 있는지 (없으면 진행도 0 으로 영영 못 얻음), 목표 NULL 이면 _total 키도
  IF EXISTS (SELECT 1 FROM public.achievements a
              WHERE NOT (v_stats ? a.metric) OR (a.goal IS NULL AND NOT (v_stats ? (a.metric || '_total')))) THEN
    v_bad := v_bad || '모르는 지표'::TEXT;
  END IF;
  IF has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_stats(uuid)'::regprocedure
                     AND prosrc LIKE '%sea_perfect_total%'
                     AND prosrc LIKE '%quest_type NOT IN (''quiz'', ''boss'') AND direct AND hints_used = 0%'
                     AND prosrc LIKE '%weeks_three%') THEN
    v_bad := v_bad || 'achievement_stats 권한·정의'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_achievement(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_achievement(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.claim_achievement(uuid, text)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00053] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00053] 코드 바다 업적 7종(실력 인정은 코인 없음): 업적 %종', v_n;
END $$;
