-- ============================================================
-- "한 주에 n일 공부" 업적 4종 (Idempotent)   (P9-18, §12-Q66 ③·Q67 ③, §3 F5)
-- 릴리즈 단계: ① 추가형 (업적 정의 4행 upsert + achievement_stats 본문 교체 — 새 키 weeks_two·weeks_three 만 늘고 인자·반환·권한 그대로.
--                       이전 앱은 모르는 지표 문구가 비어 보일 뿐 도감·받기는 그대로 동작)
--
-- 왜: 연속 업적(streak_3·streak_7)은 주말에만 공부하는 학생(docs/balance.md "몰아서")이 끝내 못 얻음 → 연속이 아니라
--     KST 주(월~일)마다 공부한 날 수로 세는 습관 업적을 따로 둠. 연속 업적은 그대로
-- 하는 일
--   1. achievement_stats (00047 + 2개 키): weeks_two = 공부한 날이 2일 이상인 KST 주 수 · weeks_three = 3일 이상인 주 수
--      공부한 날 = streak_learning_days(00038, 완료·직접 풀이·복습 판정·퀴즈 끝냄, 황금키 완료 제외). 방패로 메운 날은 안 셈.
--      주 = kst_week_start(00039, 월요일). 이번 주도 그날 수에 닿는 순간 셈
--   2. achievements 4행 (꾸준함, 연속 업적 바로 뒤 sort 352~358): week2_4 브론즈 · week2_12 실버 · week3_4 브론즈 · week3_12 실버
--      금액은 00031 티어 그대로(10·30). 몰아서 학생은 2일 짜리 2개(40코인), 매일 공부하는 학생은 4개(80코인) — balance.md 3.8
--   3. 자기 검증
-- 소급: 따로 지급하지 않음. 지표가 기존 학습 기록에서 나오므로 기존 학생도 다음 판정(퀘스트·퀴즈·미션·출석·상자 보상 뒤,
--       또는 업적 도감 열기) 때 이미 채운 주만큼 얻고, 코인은 "받기"로 (Phase 8 연속 업적과 같은 방식, 00036·00037)
-- ⚠️ 00036 을 다시 실행하면 그 자기 검증이 새 지표(weeks_*)를 "모르는 지표"로 보고 실패(전체 되돌림, 데이터 그대로).
--    다시 실행해야 하면 week2_*·week3_* 정의를 지운 뒤 00036 → 00038 → 00047 → 00048 순서로
-- 적용 후 NOTICE `[00048] 주 n일 공부 업적 4종: 업적 n종` 확인
-- 확인: supabase/tests WK-1
-- 되돌리기: supabase/rollback/00048_weekly_study.rollback.sql
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

COMMENT ON FUNCTION public.achievement_stats(UUID) IS
  '업적 지표 (P8-13, 00036 achievement_progress 에서 옮김, B74 보스 반영, P9-18 주 n일): 기존 기록에서 파생한 수. 업적 진행도·프로필 통계가 같이 씀. 소유자만';

-- ------------------------------------------------------------
-- 2. 업적 정의 (00036 표와 같은 열 순서, 다시 실행하면 문구·목표를 이 표대로)
-- ------------------------------------------------------------
INSERT INTO public.achievements (id, name, description, icon, tier, category, metric, goal, sort, hidden) VALUES
  ('week2_4',         '차곡차곡 공부',    '한 주에 2일 이상 공부한 주가 4번이에요.',        'CalendarDays',  'bronze', 'habit',  'weeks_two',     4,   352, false),
  ('week2_12',        '꾸준한 탐험가',    '한 주에 2일 이상 공부한 주가 12번이에요!',       'CalendarRange', 'silver', 'habit',  'weeks_two',     12,  354, false),
  ('week3_4',         '부지런한 한 주',   '한 주에 3일 이상 공부한 주가 4번이에요.',        'CalendarPlus',  'bronze', 'habit',  'weeks_three',   4,   356, false),
  ('week3_12',        '부지런 대장',      '한 주에 3일 이상 공부한 주가 12번이에요!',       'CalendarFold',  'silver', 'habit',  'weeks_three',   12,  358, false)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, tier = EXCLUDED.tier,
      category = EXCLUDED.category, metric = EXCLUDED.metric, goal = EXCLUDED.goal, sort = EXCLUDED.sort,
      hidden = EXCLUDED.hidden;

-- 권한 (00038 그대로: 소유자만)
REVOKE ALL ON FUNCTION public.achievement_stats(UUID) FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
  v_n   INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM public.achievements;
  IF (SELECT count(*) FROM public.achievements WHERE id IN ('week2_4', 'week2_12', 'week3_4', 'week3_12')) <> 4 THEN
    v_bad := v_bad || '업적 4종 없음'::TEXT;
  END IF;
  -- 모든 정의의 지표가 achievement_stats 에 있는지 (없으면 진행도 0 으로 영영 못 얻음)
  IF EXISTS (SELECT 1 FROM public.achievements a
              WHERE NOT (public.achievement_stats('00000000-0000-0000-0000-000000000000') ? a.metric)) THEN
    v_bad := v_bad || '모르는 지표'::TEXT;
  END IF;
  IF has_function_privilege('service_role', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.achievement_stats(uuid)', 'EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.achievement_stats(uuid)'::regprocedure
                     AND prosrc LIKE '%weeks_three%' AND prosrc LIKE '%quest_type = ''project'' AND direct%') THEN
    v_bad := v_bad || 'achievement_stats 권한·정의'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00048] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00048] 주 n일 공부 업적 4종: 업적 %종', v_n;
END $$;
