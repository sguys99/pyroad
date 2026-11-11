-- ============================================================
-- 업적 시스템: 정의 테이블 41종(브론즈·실버·골드) + 사용자 업적 + 판정(기존 기록에서 파생) + 받기 + 기존 뱃지 5종 이관 (Idempotent)
--   (P8-09, §3 F5, §2.6 보상은 학습 행동에만, §12-Q62 ③ "받기", 금액은 00031 coin_reward('achievement', 1·2·3) = 10·30·100)
-- 릴리즈 단계: ① 추가형 (새 테이블 2개·새 함수·user_progress 새 열 + complete_quest 본문 교체. 인자·권한 그대로, 반환은
--                       new_achievements 키가 늘고 new_badges 는 늘 [] — 이전 앱은 뱃지 축하만 안 보임. user_badges 는 읽기만 남김,
--                       지우기·decide_new_badges·has_three_day_streak 정리는 나중 ③)
--
-- 하는 일
--   1. user_progress.overcame_error: 에러(실행 오류)를 만난 뒤 끝까지 풀어 통과한 퀘스트 (서버 전용, 보호 트리거에 추가).
--      서버는 브라우저(Pyodide) 실행 에러를 모르므로 완료 요청이 "이번 풀이 중 에러가 있었음"(p_submission.had_error)을 보냄.
--      이 값은 실패 칭찬 업적 판정에만 쓰고 XP·별·코인 계산에는 쓰지 않음 — 거짓으로 보내 얻는 것은 업적 3개(한 번씩)뿐이고
--      일부러 틀린 코드를 돌려도 똑같이 얻을 수 있어 악용 여지가 없음
--   2. achievements (정의, 로그인 사용자 읽기): id·name·description·icon(Lucide 이름)·tier(bronze|silver|gold)·category·metric·
--      goal(NULL = 그 지표의 전체 수, 지금은 quests 만)·sort·hidden(도감에서 받기 전 이름을 가림, P8-10)
--   3. user_achievements (본인 행 읽기만, 쓰기는 RPC): achieved_at · claimed_at(받기). 한 번 얻은 업적은 진행 초기화 뒤에도 남음
--      (코인 원장처럼 — 다시 모아 다시 받는 길을 열지 않음)
--   4. achievement_progress(user) (service_role, P8-10 진행도): 모든 업적의 (id, progress, goal). 별도 카운터 없이 기존 기록에서
--        quests        직접 푼 코드·프로젝트 완료 (황금키 완료는 처음 직접 풀었을 때) / quests_total 전체 코드·프로젝트 퀘스트 수
--        projects      그중 마지막(is_final) 스테이지 · stages 코드·프로젝트를 모두 완료한 스테이지(황금키 완료도 진행이라 셈, 00026)
--                      중 마지막으로 끝낸 퀘스트를 직접 푼 것 (Q25: 황금키로 마지막을 열어 깬 스테이지는 업적 아님 — 예전 stage_clear 와 같음)
--        no_hint       직접 푼 완료 중 힌트 0 · hint_finish 힌트를 1번 이상 보고 끝까지(황금키 없이)
--        stars         best_stars 합(직접 푼 것) · three_stars ⭐3 퀘스트 수
--        quiz_correct  맞힌 퀴즈 수(서로 다른 문제) · quiz_comeback 틀린 뒤 다시 풀어 맞힌 퀴즈 수(attempt_no ≥ 2 정답)
--        reviews       복습 도전한 퀘스트 수: 코드는 별 판정 2번 이상(황금키 퀘스트는 직접 풀이 판정을 빼고), 퀴즈는 review 모드로 끝냄
--        streak        가장 길었던 연속 학습일(streak_learning_days ∪ 방패 날, 00035) · level users.current_level
--        attendance·missions·chests  코인 원장 행 수(출석 도장·미션 받기·스테이지 상자)
--        errors        overcame_error 퀘스트 수
--   5. evaluate_achievements(user) (service_role): 목표에 닿은 업적을 user_achievements 에 넣고(ON CONFLICT 로 동시·반복 한 번)
--      이번에 새로 얻은 것만 [{id, name, description, icon, tier, coins}] (sort 순). 코인은 주지 않음 — "받기"로
--      부르는 곳: complete_quest(이 파일, 같은 트랜잭션) · submit_quiz_answer·claim_daily_mission·stamp_attendance·open_stage_chest 는
--      API 가 RPC 뒤에 바로 부름(src/lib/quest/rewardRpc.ts) — 긴 함수 4개 본문을 다시 적지 않으려고. 판정은 멱등이라 둘 사이에
--      실패해도 다음 보상 때 잡힘
--   6. claim_achievement(user, id) (service_role, /api/achievements/claim): 얻은 업적의 코인 coin_apply('achievement', '<id>',
--      coin_reward('achievement', 티어 1·2·3)) + claimed_at. 안 얻었으면 achievement_not_earned(409), 이미 받았으면 already_claimed(0).
--      users 행 잠금 + 원장 키라 동시·반복도 한 번
--   7. 이관: user_badges(first_code·hint_master·stage_clear·streak_3·project_builder) → 같은 id 업적, achieved_at = earned_at,
--      claimed_at 없음(받기 가능 — 코인은 받기로 한 번, P8-11 소급이 따로 주지 않음). 다시 실행해도 그대로
--   8. complete_quest: 00032 + overcame_error 기록 + 뱃지 판정 대신 evaluate_achievements (첫 완료·복습 도전·직접 풀이 때) →
--      반환 new_achievements, new_badges 는 [] (user_badges 에 더 쓰지 않음)
--   9. 권한 + 자기 검증
--   ⚠️ 00019·00026·00031·00032 파일을 다시 실행하면 complete_quest 가 뱃지 정의로 돌아갑니다. 다시 실행했다면 00036 도 다시 실행
-- 적용 후 NOTICE `[00036] 업적 41종: evaluate_achievements·claim_achievement service_role 전용, 뱃지 n개 이관` 확인
-- 확인: supabase/tests AC-1~5, RPC-6, RW-2 등(이관된 5종이 예전 뱃지 규칙대로 나오는지)
-- 되돌리기: supabase/rollback/00036_achievements.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. user_progress.overcame_error
-- ------------------------------------------------------------
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS overcame_error BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.user_progress.overcame_error IS
  '에러를 만난 뒤 끝까지 풀어 통과 (서버 전용, P8-09). 실패 칭찬 업적 판정에만';

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
      NEW.overcame_error     := false;
    ELSE
      NEW.earned_xp          := OLD.earned_xp;
      NEW.stars              := OLD.stars;
      NEW.best_stars         := OLD.best_stars;
      NEW.attempts           := OLD.attempts;
      NEW.stars_judged_on    := OLD.stars_judged_on;
      NEW.solved_directly_at := OLD.solved_directly_at;
      NEW.overcame_error     := OLD.overcame_error;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.user_progress_protect_earned_xp() IS
  'anon/authenticated 가 user_progress 의 서버 값(earned_xp·stars·best_stars·attempts·stars_judged_on·solved_directly_at·overcame_error)에 쓴 값을 버림 (P1-03, P1-08, P8-05, P8-09). 컬럼 권한(00011) 뒤에도 이중 방어로 유지';

REVOKE ALL ON FUNCTION public.user_progress_protect_earned_xp() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2·3. 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  tier        TEXT NOT NULL,
  category    TEXT NOT NULL,
  metric      TEXT NOT NULL,
  goal        INTEGER,
  sort        INTEGER NOT NULL,
  hidden      BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT achievements_id_format CHECK (id ~ '^[a-z0-9_]{1,40}$'),
  CONSTRAINT achievements_tier_check CHECK (tier IN ('bronze', 'silver', 'gold')),
  CONSTRAINT achievements_category_check CHECK (category IN ('learn', 'star', 'quiz', 'habit', 'growth', 'grit')),
  CONSTRAINT achievements_goal_check CHECK (goal IS NULL OR goal > 0)
);

COMMENT ON TABLE public.achievements IS
  '업적 정의 (P8-09). 로그인 사용자 읽기만, 이 마이그레이션이 upsert. 판정은 achievement_progress 의 metric·goal';

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  achieved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at     TIMESTAMPTZ,
  PRIMARY KEY (user_id, achievement_id)
);

COMMENT ON TABLE public.user_achievements IS
  '얻은 업적 (P8-09). 본인 행 읽기만, 쓰기는 evaluate_achievements·claim_achievement. claimed_at = 코인 받은 시각';

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.achievements FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.user_achievements FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.achievements TO authenticated, service_role;
GRANT SELECT ON TABLE public.user_achievements TO authenticated;
-- service_role DELETE: 앱은 쓰지 않음(쓰기는 RPC). 운영 정리·e2e 사용자 초기화용
GRANT SELECT, DELETE ON TABLE public.user_achievements TO service_role;

DROP POLICY IF EXISTS "achievements_select_all" ON public.achievements;
CREATE POLICY "achievements_select_all" ON public.achievements
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "user_achievements_select_own" ON public.user_achievements;
CREATE POLICY "user_achievements_select_own" ON public.user_achievements
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- 정의 (다시 실행하면 문구·목표를 이 표대로). 이름·설명은 초등학생용 쉬운 말
INSERT INTO public.achievements (id, name, description, icon, tier, category, metric, goal, sort, hidden) VALUES
  -- 학습
  ('first_code',      '첫 코드',          '처음으로 퀘스트를 혼자 풀었어요!',               'Code',          'bronze', 'learn',  'quests',        1,    10, false),
  ('quests_10',       '코드 탐험가',      '퀘스트 10개를 혼자 풀었어요.',                   'Compass',       'silver', 'learn',  'quests',        10,   20, false),
  ('quests_30',       '코드 모험왕',      '퀘스트 30개를 혼자 풀었어요.',                   'Mountain',      'gold',   'learn',  'quests',        30,   30, false),
  ('quests_all',      '모든 길을 걸었어요', '지금 있는 퀘스트를 모두 혼자 풀었어요.',        'Crown',         'gold',   'learn',  'quests',        NULL, 40, false),
  ('stage_clear',     '스테이지 클리어',  '스테이지 하나를 끝까지 깼어요!',                 'Flag',          'bronze', 'learn',  'stages',        1,    50, false),
  ('stages_3',        '스테이지 정복자',  '스테이지 3개를 끝까지 깼어요.',                  'Castle',        'silver', 'learn',  'stages',        3,    60, false),
  ('project_builder', '프로젝트 빌더',    '최종 프로젝트를 완성했어요!',                    'Hammer',        'silver', 'learn',  'projects',      1,    70, false),
  ('hint_master',     '힌트 마스터',      '힌트 없이 퀘스트를 풀었어요!',                   'Lightbulb',     'bronze', 'learn',  'no_hint',       1,    80, false),
  ('no_hint_10',      '혼자서도 척척',    '힌트 없이 퀘스트 10개를 풀었어요.',              'Brain',         'silver', 'learn',  'no_hint',       10,   90, false),
  -- 별
  ('stars_10',        '별 줍기',          '별을 10개 모았어요.',                            'Star',          'bronze', 'star',   'stars',         10,  110, false),
  ('stars_50',        '별 바구니',        '별을 50개 모았어요.',                            'Sparkles',      'silver', 'star',   'stars',         50,  120, false),
  ('stars_150',       '은하수 수집가',    '별을 150개나 모았어요!',                         'Telescope',     'gold',   'star',   'stars',         150, 130, false),
  ('three_star_1',    '반짝 별 세 개',    '처음으로 별 3개를 받았어요.',                    'Sparkle',       'bronze', 'star',   'three_stars',   1,   140, false),
  ('three_star_10',   '별 세 개 단골',    '별 3개를 받은 퀘스트가 10개예요.',               'Gem',           'silver', 'star',   'three_stars',   10,  150, false),
  ('three_star_30',   '완벽한 탐험가',    '별 3개를 받은 퀘스트가 30개예요!',               'Orbit',         'gold',   'star',   'three_stars',   30,  160, false),
  -- 퀴즈
  ('quiz_1',          '첫 퀴즈 정답',     '퀴즈를 처음 맞혔어요.',                          'BadgeCheck',    'bronze', 'quiz',   'quiz_correct',  1,   210, false),
  ('quiz_10',         '퀴즈 척척박사',    '퀴즈 10문제를 맞혔어요.',                        'GraduationCap', 'silver', 'quiz',   'quiz_correct',  10,  220, false),
  ('quiz_20',         '퀴즈 왕',          '퀴즈 20문제를 맞혔어요!',                        'Medal',         'gold',   'quiz',   'quiz_correct',  20,  230, false),
  -- 꾸준함
  ('review_1',        '다시 보기 도전',   '복습 도전을 처음 해냈어요.',                     'RotateCcw',     'bronze', 'habit',  'reviews',       1,   310, false),
  ('review_10',       '복습 대장',        '복습 도전을 10번 해냈어요.',                     'Repeat',        'silver', 'habit',  'reviews',       10,  320, false),
  ('streak_3',        '3일 연속',         '3일 연속으로 공부했어요!',                       'Flame',         'bronze', 'habit',  'streak',        3,   330, false),
  ('streak_7',        '일주일 불꽃',      '7일 연속으로 공부했어요.',                       'Flame',         'silver', 'habit',  'streak',        7,   340, false),
  ('streak_30',       '꺼지지 않는 불꽃', '30일 연속으로 공부했어요!',                      'Flame',         'gold',   'habit',  'streak',        30,  350, false),
  ('attend_7',        '출석 도장 7개',    '출석 도장을 7번 찍었어요.',                      'CalendarCheck', 'bronze', 'habit',  'attendance',    7,   360, false),
  ('attend_30',       '출석 도장 30개',   '출석 도장을 30번 찍었어요.',                     'CalendarHeart', 'silver', 'habit',  'attendance',    30,  370, false),
  ('mission_1',       '첫 미션 완료',     '데일리 미션 보상을 처음 받았어요.',              'Target',        'bronze', 'habit',  'missions',      1,   380, false),
  ('mission_10',      '미션 해결사',      '데일리 미션 10개를 해냈어요.',                   'ListChecks',    'silver', 'habit',  'missions',      10,  390, false),
  ('mission_50',      '미션 마스터',      '데일리 미션 50개를 해냈어요!',                   'Rocket',        'gold',   'habit',  'missions',      50,  400, false),
  -- 성장
  ('level_10',        '레벨 10',          '레벨 10이 되었어요.',                            'Zap',           'bronze', 'growth', 'level',         10,  510, false),
  ('level_20',        '레벨 20',          '레벨 20이 되었어요.',                            'Zap',           'silver', 'growth', 'level',         20,  520, false),
  ('level_30',        '레벨 30',          '레벨 30이 되었어요!',                            'Trophy',        'gold',   'growth', 'level',         30,  530, false),
  ('level_50',        '전설의 파이썬 마법사', '가장 높은 레벨 50이 되었어요!',              'WandSparkles',  'gold',   'growth', 'level',         50,  540, true),
  ('chest_1',         '첫 보물상자',      '스테이지 보물상자를 처음 열었어요.',             'Gift',          'bronze', 'growth', 'chests',        1,   550, false),
  ('chest_5',         '보물 사냥꾼',      '스테이지 보물상자를 5개 열었어요.',              'Package',       'silver', 'growth', 'chests',        5,   560, false),
  -- 실패 칭찬 (성장 마인드셋)
  ('error_1',         '첫 에러 친구',     '에러를 만났지만 포기하지 않고 끝까지 풀었어요!', 'Bug',           'bronze', 'grit',   'errors',        1,   610, false),
  ('error_10',        '에러 사냥꾼',      '에러를 이겨 내고 퀘스트 10개를 풀었어요.',       'BugOff',        'silver', 'grit',   'errors',        10,  620, false),
  ('error_50',        '버그 박사',        '에러를 이겨 내고 퀘스트 50개를 풀었어요!',       'Swords',        'gold',   'grit',   'errors',        50,  630, false),
  ('comeback_1',      '다시 일어서기',    '틀린 퀴즈를 다시 풀어 맞혔어요.',                'Sprout',        'bronze', 'grit',   'quiz_comeback', 1,   640, false),
  ('comeback_10',     '포기는 없어',      '틀린 퀴즈 10문제를 다시 풀어 맞혔어요.',         'HeartHandshake','silver', 'grit',   'quiz_comeback', 10,  650, false),
  ('hint_finish_1',   '힌트 친구',        '힌트를 보고 끝까지 해냈어요.',                   'LifeBuoy',      'bronze', 'grit',   'hint_finish',   1,   660, false),
  ('hint_finish_10',  '힌트로 쑥쑥',      '힌트를 보고 퀘스트 10개를 끝까지 해냈어요.',     'Footprints',    'silver', 'grit',   'hint_finish',   10,  670, false)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, tier = EXCLUDED.tier,
      category = EXCLUDED.category, metric = EXCLUDED.metric, goal = EXCLUDED.goal, sort = EXCLUDED.sort,
      hidden = EXCLUDED.hidden;

-- ------------------------------------------------------------
-- 4. achievement_progress: 지표는 기존 기록에서 (별도 카운터 없음)
-- ------------------------------------------------------------
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

COMMENT ON FUNCTION public.achievement_progress(UUID) IS
  '업적 진행도 (P8-09): 모든 업적의 (id, progress, goal), 기존 기록에서 파생. service_role 전용(도감 P8-10·evaluate_achievements)';

-- ------------------------------------------------------------
-- 5. evaluate_achievements
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

-- ------------------------------------------------------------
-- 6. claim_achievement
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. 기존 뱃지 이관 (같은 id). 받기 가능 상태로
-- ------------------------------------------------------------
INSERT INTO public.user_achievements (user_id, achievement_id, achieved_at)
SELECT b.user_id, b.badge_type, b.earned_at
  FROM public.user_badges b
 WHERE b.badge_type IN ('first_code', 'hint_master', 'stage_clear', 'streak_3', 'project_builder')
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- ------------------------------------------------------------
-- 8. complete_quest: 00032 + overcame_error + 업적
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
  v_had_error      BOOLEAN;  -- 이번 풀이 중 실행 에러가 있었음 (브라우저가 알림, 실패 칭찬 업적에만)
  v_first          BOOLEAN;
  v_retry          BOOLEAN := false;  -- 이미 완료 + retry + 서버 재채점 통과 + 퀴즈 아님
  v_practice       BOOLEAN := false;  -- 그중 마지막 별 판정이 오늘(KST) → 연습 (Q64)
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
  v_next_quest_id  UUID;
  v_level_ups      JSONB;
  v_coins          INTEGER;
  v_achievements   JSONB;
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
  v_had_error := COALESCE(p_submission->'had_error' = 'true'::jsonb, false);

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

  SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at, up.stars_judged_on
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
    v_retry := v_has_stars AND v_passed AND COALESCE(p_submission->'retry' = 'true'::jsonb, false);
    -- 복습 도전은 마지막 별 판정 다음 날(KST)부터 (Q64, 퀴즈와 같음). 판정 기록이 없는 예전 완료는 바로 복습 도전
    v_practice := v_retry AND v_progress.stars_judged_on IS NOT NULL
                  AND v_progress.stars_judged_on >= public.kst_today();
    IF v_retry AND NOT v_practice
       AND v_progress.used_golden_key AND v_progress.solved_directly_at IS NULL THEN
      v_copy := public.is_solution_copy(p_quest_id, v_code);
      v_direct := NOT v_copy;
    END IF;
    IF NOT v_retry OR v_practice OR v_copy THEN
      RETURN jsonb_build_object(
        'already_completed', true,
        'xp_gained',         0,
        'total_xp',          v_user.total_xp,
        'level_before',      v_user.current_level,
        'level_after',       v_user.current_level,
        'new_badges',        '[]'::jsonb,
        'new_achievements',  '[]'::jsonb,
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
        'solution_copy',     v_copy,
        'mode',              CASE WHEN v_practice THEN 'practice' END,
        'next_review_on',    to_char(v_progress.stars_judged_on + 1, 'YYYY-MM-DD'));
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
      SELECT up.status, up.hints_used, up.used_golden_key, up.best_stars, up.solved_directly_at, up.stars_judged_on
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
           attempts        = attempts + CASE WHEN v_has_stars THEN 1 ELSE 0 END,
           -- 황금키로 받은 정답 완료는 "이겨 냄"이 아님
           overcame_error  = overcame_error OR (v_had_error AND v_passed AND NOT v_progress.used_golden_key)
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
           solved_directly_at = CASE WHEN v_direct THEN NOW() ELSE solved_directly_at END,
           overcame_error     = overcame_error OR v_had_error
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

  -- 업적 (P8-09): 기록이 바뀐 뒤 판정. 황금키 완료도 진행·레벨이 바뀔 수 있어 판정하되, 지표가 직접 푼 것만 셈
  v_achievements := public.evaluate_achievements(p_user_id);

  RETURN jsonb_build_object(
    'already_completed', NOT v_first,
    'xp_gained',         v_xp,
    'total_xp',          v_total_xp,
    'level_before',      v_user.current_level,
    'level_after',       v_level_after,
    'new_badges',        '[]'::jsonb,
    'new_achievements',  v_achievements,
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
    'solution_copy',     false,
    'mode',              CASE WHEN v_first THEN 'first' ELSE 'review' END,
    'next_review_on',    CASE WHEN v_has_stars THEN to_char(public.kst_today() + 1, 'YYYY-MM-DD') END);
END;
$$;

COMMENT ON FUNCTION public.complete_quest(UUID, UUID, JSONB) IS
  '퀘스트 완료·보상 (P1-03, Q25, 00026 퀴즈 제외, 00031 코인, 00032 별·다시 풀기, 00036 업적). service_role 전용: /api/quest/complete 가 getUser() 로 확인한 id 만 넘김. 처음 완료될 때만 XP, 다시 풀기는 새 별 코인만, 업적은 evaluate_achievements';

-- ------------------------------------------------------------
-- 9. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.achievement_progress(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.achievement_progress(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.evaluate_achievements(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_achievements(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.claim_achievement(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_achievement(UUID, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.complete_quest(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(UUID, UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 10. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad   TEXT[] := '{}';
  v_n     INTEGER;
  v_moved INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM public.achievements;
  IF v_n < 30 THEN
    v_bad := v_bad || '업적 30종 미만'::TEXT;
  END IF;
  IF (SELECT count(*) FROM public.achievements
       WHERE id IN ('first_code', 'hint_master', 'stage_clear', 'streak_3', 'project_builder')) <> 5 THEN
    v_bad := v_bad || '기존 뱃지 5종 업적 없음'::TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM public.achievements
              WHERE metric NOT IN ('quests', 'projects', 'stages', 'no_hint', 'hint_finish', 'stars', 'three_stars',
                                   'quiz_correct', 'quiz_comeback', 'reviews', 'streak', 'level', 'attendance',
                                   'missions', 'chests', 'errors')
                 OR (goal IS NULL AND metric <> 'quests')) THEN
    v_bad := v_bad || '모르는 지표'::TEXT;
  END IF;
  IF public.coin_reward('achievement', 1) <> 10 OR public.coin_reward('achievement', 3) <> 100 THEN
    v_bad := v_bad || '업적 금액 (00031 이 먼저 있어야 함)'::TEXT;
  END IF;
  SELECT count(*) INTO v_moved FROM public.user_badges b
   WHERE NOT EXISTS (SELECT 1 FROM public.user_achievements ua
                      WHERE ua.user_id = b.user_id AND ua.achievement_id = b.badge_type);
  IF v_moved > 0 THEN
    v_bad := v_bad || '이관 안 된 뱃지'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.evaluate_achievements(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_achievement(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_achievement(uuid, text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.claim_achievement(uuid, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_progress(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_quest(uuid, uuid, jsonb)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF has_table_privilege('authenticated', 'public.user_achievements', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_achievements', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.achievements', 'INSERT')
     OR has_table_privilege('anon', 'public.achievements', 'SELECT')
     OR has_table_privilege('anon', 'public.user_achievements', 'SELECT') THEN
    v_bad := v_bad || '테이블 권한'::TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.complete_quest(uuid, uuid, jsonb)'::regprocedure
                    AND prosrc LIKE '%evaluate_achievements%' AND prosrc LIKE '%code_quest_stars%') THEN
    v_bad := v_bad || '업적이 없는 complete_quest 정의'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00036] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00036] 업적 %종: evaluate_achievements·claim_achievement service_role 전용, 뱃지 %개 이관',
    v_n, (SELECT count(*) FROM public.user_badges);
END $$;
