-- ============================================================
-- 3월드(메이커 시티) 업적 9종 (Idempotent)   (P11-14, §12-Q75 ⑪, docs/curriculum/world3.md §12)
-- 릴리즈 단계: ① 추가형 (카테고리 CHECK 넓힘('maker') · 업적 정의 9행 upsert · achievement_stats 본문 교체(새 키만 늘고 인자·반환·권한 그대로).
--                       evaluate_achievements·claim_achievement 는 00053 그대로(업적별 금액·코인 0 배지). 이전 앱은 "메이커 시티" 절을 그리지 않을 뿐)
--
-- 하는 일
--   1. achievements_category_check 에 'maker'(메이커 시티) 추가 — 도감에서 메이커 띠로 따로 모음
--   2. achievement_stats (00053 + 새 키). 3월드 = worlds."order" = 3 (slug maker-city). 깸·완벽 규칙은 sea 와 같음
--        maker_saves 지금 남은 내 작품 수 (creations 00054) · maker_posts 갤러리에 낸 적 있는 작품 수 (published_at)
--        maker_bosses 3월드 보스 승리 수 · maker_bosses_total
--        maker_turtle 3-1 깸 · maker_story 3-2·3-3·3-4 중 깬 수 · maker_game 3-6 깸 · maker_clear 3-F(최종 보스 "메가 로봇 버그버그")까지
--        maker_perfect 별 3개 스테이지 수 · maker_perfect_total
--        maker_cheers 남의 작품에 스티커를 붙인 작품 수 (creation_reactions 00055, 주는 쪽만)
--   3. 업적 정의 9행 (카테고리 maker, sort 810~890) — 합 320코인 (world3.md §12):
--        maker_first_save 첫 작품(브론즈 10) · maker_first_post 첫 전시(브론즈 10) · maker_boss_first 도시 보스 첫 승리(브론즈 10) ·
--        turtle_painter 거북이 화가(실버 30) · story_weaver 이야기 짓는 사람(실버 30, 3스테이지) · game_maker 게임 개발자(실버 30) ·
--        maker_citizen 메이커 시티 명예 시민(골드 100) · perfect_city 완벽한 도시(골드 100, 숨김) · cheer_leader 응원 단장(배지만, 코인 0)
--      "스티커를 많이 받기"는 두지 않음 (인기 경쟁, §2.6)
-- 소급: 따로 지급하지 않음 (00053 과 같음). 지표가 기존 기록(진행·작품·스티커)에서 나오므로 이미 조건을 채운 학생도 다음 판정
--       (퀘스트·작품 저장·출품·스티커 뒤, 또는 업적 도감 열기) 때 얻고, 코인은 "받기"로
-- ⚠️ 00036·00038·00047·00048·00051·00053 을 다시 실행하면 achievement_stats 가 옛 본문으로 돌아갑니다. 다시 실행했다면 00057 도 다시 실행
-- 적용 후 NOTICE `[00057] 메이커 시티 업적 9종(응원 단장은 코인 없음): 업적 n종` 확인
-- 확인: supabase/tests MAKER-1(지표·판정·코인 없는 배지·받기)
-- 되돌리기: supabase/rollback/00057_maker_achievements.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 카테고리
-- ------------------------------------------------------------
ALTER TABLE public.achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE public.achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('learn', 'star', 'quiz', 'habit', 'growth', 'grit', 'sea', 'maker'));

-- ------------------------------------------------------------
-- 2. achievement_stats (00053 + 3월드 키)
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
  ),
  -- 3월드(메이커 시티) 스테이지마다: 위 sea 와 같은 규칙 + 스테이지 id (P11-14)
  maker AS (
    SELECT s.id, s.is_final,
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
     WHERE w."order" = 3
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
    'sea_perfect_total', (SELECT count(*) FROM sea WHERE has_quests),
    -- ── 3월드 메이커 시티 (P11-14) ──
    -- 작품: 지금 남아 있는 내 작품 수 · 갤러리에 한 번이라도 낸(published_at) 작품 수 (지운 작품은 안 셈, 얻은 업적은 그대로)
    'maker_saves',   (SELECT count(*) FROM public.creations c WHERE c.user_id = p_user_id),
    'maker_posts',   (SELECT count(*) FROM public.creations c WHERE c.user_id = p_user_id AND c.published_at IS NOT NULL),
    'maker_bosses',  (SELECT count(*) FROM prog p JOIN public.stages s ON s.id = p.stage_id JOIN public.worlds w ON w.id = s.world_id
                       WHERE w."order" = 3 AND p.quest_type = 'boss' AND p.direct),
    'maker_bosses_total', (SELECT count(*) FROM public.quests q JOIN public.stages s ON s.id = q.stage_id
                            JOIN public.worlds w ON w.id = s.world_id
                           WHERE w."order" = 3 AND q.quest_type = 'boss'),
    -- 3-1 거북이 화가 공방 · 3-2~3-4(이야기 극장·퀴즈쇼·펫 돌봄) · 3-6 미니 게임 오락실 깸
    'maker_turtle',  (SELECT count(*) FROM maker WHERE cleared AND id = 'a3000000-0000-0000-0000-000000000001'),
    'maker_story',   (SELECT count(*) FROM maker WHERE cleared AND id IN ('a3000000-0000-0000-0000-000000000002',
                                                                          'a3000000-0000-0000-0000-000000000003',
                                                                          'a3000000-0000-0000-0000-000000000004')),
    'maker_game',    (SELECT count(*) FROM maker WHERE cleared AND id = 'a3000000-0000-0000-0000-000000000006'),
    'maker_clear',   (SELECT count(*) FROM maker WHERE cleared AND is_final),
    'maker_perfect', (SELECT count(*) FROM maker WHERE perfect),
    'maker_perfect_total', (SELECT count(*) FROM maker WHERE has_quests),
    -- 응원 단장: 남의 작품에 스티커를 붙인 작품 수 (주는 쪽만, 받은 스티커는 업적으로 두지 않음 — §2.6)
    'maker_cheers',  (SELECT count(DISTINCT r.creation_id) FROM public.creation_reactions r
                       JOIN public.creations c ON c.id = r.creation_id
                      WHERE r.user_id = p_user_id AND c.user_id <> p_user_id)
  );
$$;

COMMENT ON FUNCTION public.achievement_stats(UUID) IS
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김, B74 보스 반영, P9-18 주 n일, B75 no_hint 보스 제외, P10-11 코드 바다·실력 확인, P11-14 메이커 시티): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

-- 권한 (00038 그대로: 소유자만)
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. 업적 정의 (00053 표와 같은 열, 다시 실행하면 문구·목표를 이 표대로)
-- ------------------------------------------------------------
INSERT INTO public.achievements (id, name, description, icon, tier, category, metric, goal, sort, hidden, coins) VALUES
  ('maker_first_save', '첫 작품',              '내 작품을 처음으로 저장했어요!',                                   'Palette',   'bronze', 'maker', 'maker_saves',   1,    810, false, NULL),
  ('maker_first_post', '첫 전시',              '내 작품을 갤러리에 처음으로 전시했어요!',                           'Frame',     'bronze', 'maker', 'maker_posts',   1,    820, false, NULL),
  ('maker_boss_first', '도시 보스 첫 승리',    '메이커 시티 보스를 처음으로 이겼어요!',                             'Bot',       'bronze', 'maker', 'maker_bosses',  1,    830, false, NULL),
  ('turtle_painter',   '거북이 화가',          '거북이 화가 공방을 끝까지 깼어요!',                                 'Brush',     'silver', 'maker', 'maker_turtle',  1,    840, false, NULL),
  ('story_weaver',     '이야기 짓는 사람',     '이야기 극장, 퀴즈쇼 방송국, 펫 돌봄 센터를 모두 깼어요!',           'BookOpen',  'silver', 'maker', 'maker_story',   3,    850, false, NULL),
  ('game_maker',       '게임 개발자',          '미니 게임 오락실을 끝까지 깼어요!',                                 'Gamepad2',  'silver', 'maker', 'maker_game',    1,    860, false, NULL),
  ('maker_citizen',    '메이커 시티 명예 시민', '메가 로봇 버그버그를 이기고 메이커 시티를 끝까지 깼어요!',          'Building2', 'gold',   'maker', 'maker_clear',   1,    870, false, NULL),
  ('perfect_city',     '완벽한 도시',          '메이커 시티의 모든 퀘스트와 퀴즈에서 별 3개를 받았어요!',           'Landmark',  'gold',   'maker', 'maker_perfect', NULL, 880, true,  NULL),
  ('cheer_leader',     '응원 단장',            '친구 작품 5개에 스티커로 응원했어요!',                              'HandHeart', 'bronze', 'maker', 'maker_cheers',  5,    890, false, 0)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, tier = EXCLUDED.tier,
      category = EXCLUDED.category, metric = EXCLUDED.metric, goal = EXCLUDED.goal, sort = EXCLUDED.sort,
      hidden = EXCLUDED.hidden, coins = EXCLUDED.coins;

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad   TEXT[] := '{}';
  v_n     INTEGER;
  v_stats JSONB := public.achievement_stats('00000000-0000-0000-0000-000000000000');
BEGIN
  SELECT count(*) INTO v_n FROM public.achievements;
  IF (SELECT count(*) FROM public.achievements WHERE category = 'maker') <> 9
     OR (SELECT coins FROM public.achievements WHERE id = 'cheer_leader') IS DISTINCT FROM 0
     OR (SELECT sum(CASE tier WHEN 'bronze' THEN 10 WHEN 'silver' THEN 30 ELSE 100 END)
           FROM public.achievements WHERE category = 'maker' AND coins IS NULL) <> 320 THEN
    v_bad := v_bad || '메이커 업적 9종·응원 단장만 코인 0·합 320'::TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM public.achievements a
              WHERE NOT (v_stats ? a.metric) OR (a.goal IS NULL AND NOT (v_stats ? (a.metric || '_total')))) THEN
    v_bad := v_bad || '모르는 지표'::TEXT;
  END IF;
  IF has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_stats(uuid)'::regprocedure
                     AND prosrc LIKE '%maker_cheers%' AND prosrc LIKE '%sea_perfect_total%') THEN
    v_bad := v_bad || 'achievement_stats 권한·정의'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00057] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00057] 메이커 시티 업적 9종(응원 단장은 코인 없음): 업적 %종', v_n;
END $$;
