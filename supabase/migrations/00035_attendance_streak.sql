-- ============================================================
-- 출석 달력(7일 사이클·7일째 상자) + 스트릭(학습일) + 스트릭 방패 (Idempotent)
--   (P8-08, §3 F5, §2.6, §12-Q62 ①②③·Q63 ②(출석 XP 없음), 금액은 00031 coin_reward('attendance', 1..7))
-- 릴리즈 단계: ① 추가형 (새 테이블 2개 + 새 함수만. 기존 테이블·함수 변경 없음 — 이전 앱은 부르지 않음)
--
-- 하는 일
--   1. user_streak_shields: 사용자당 1행, 가진 스트릭 방패 수(0~2). 본인 행 읽기만, 쓰기는 아래 RPC 만
--   2. streak_shield_days: 방패로 메운 날 (user, KST 날짜). 본인 행 읽기만. 스트릭은 이 날을 학습일로 셈
--   3. streak_learning_days(user) (소유자만): 학습일 = 퀘스트·퀴즈를 1개 이상 "푼" KST 날짜 (서버 기록이 남는 풀이만)
--        - 코드·프로젝트·퀴즈 완료(completed_at, 황금키 완료는 빼고) · 황금키 퀘스트 첫 직접 풀이(solved_directly_at)
--        - 복습 도전 판정(stars_judged_on, 황금키로만 끝난 퀘스트는 빼고) — 다시 풀기 ⭐3 은 한 번뿐이라 기록이 덮여도 날이 빠지지 않음
--        - 퀴즈를 끝낸 날(quiz_attempts 정답 또는 3번째 오답, 모드 무관 — 연습도 학습). 같은 날 코드 연습은 판정일과 같은 날이라 따로 필요 없음
--        3일 뱃지 has_three_day_streak(00006, 첫 직접 완료만)는 그대로 — 뱃지 날짜 ⊂ 학습일이라 뱃지면 스트릭 ≥ 3
--   4. current_streak(days, today) (service_role, 규칙 함수): 오늘이 학습일이면 오늘부터, 아니면 어제부터 거꾸로 이어진 날 수.
--        TS 사본 src/lib/time/streak.ts currentStreak, 대조 reward-rules.json "streak_days" (vitest + test:rls RW-1)
--   5. settle_streak_shields(user) (소유자만): 다음 방문 때 정산. 마지막 학습일(방패 날 포함) L 이 그제 이전이면 빠진 날 = L+1 .. 어제.
--        빠진 날 수 ≤ 가진 방패면 그 날들을 streak_shield_days 에 넣고 그만큼 줄임. 모자라면 아무것도 쓰지 않음(어차피 끊기므로 아낌).
--        오늘은 아직 안 빠진 날이라 메우지 않음. 방패 행 잠금 아래라 동시에 와도 한 번. 다시 불러도 L = 어제라 그대로(멱등)
--   6. world_daily_status(user) (service_role, 월드맵 로더가 확인한 id 로): 정산 + {streak:{days,today,shields,shield_days(최근 7일),filled},
--        attendance:{today, total, stamped_today, day_n(오늘 찍은 칸 또는 다음 칸 1~7), cycle:[이번 사이클에 찍은 KST 날짜]}}
--   7. stamp_attendance(user) (service_role, /api/attendance/stamp): 출석 도장. 하루 한 번(원장 attendance/<KST 날짜>)
--        칸 = (지금까지 출석 수 % 7) + 1 — 끊겨도 진행 유지(누적 7회로 사이클, §12-Q62 기본값). 코인 coin_reward('attendance', 칸),
--        7일째 = 상자: 30코인 + 방패 1개(최대 2개, 가득이면 0). XP 없음(§12-Q63 ②). 사용자 행 잠금 아래라 동시·중복도 한 번
--        반환 {stamped, already_stamped, day_n, coins_earned, coins_balance, shield_granted, shields}
--   8. 권한 + 자기 검증
-- 적용 후 NOTICE `[00035] 출석·스트릭 방패: world_daily_status·stamp_attendance service_role 전용` 확인
-- 확인: supabase/tests AT-1~1d(권한), AT-2(출석 하루 한 번·동시·7일 사이클·상자 방패·상한), AT-3(방패 정산: 1일·2일 공백·모자람·멱등), RW-1 streak_days
-- 되돌리기: supabase/rollback/00035_attendance_streak.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1·2. 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_streak_shields (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  shields    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_streak_shields_range CHECK (shields BETWEEN 0 AND 2)
);

COMMENT ON TABLE public.user_streak_shields IS
  '가진 스트릭 방패 (P8-08, 최대 2). 출석 7일째 상자에서 1개, 학습을 빠뜨린 날 자동 소모. 본인 행 읽기만, 쓰기는 RPC';

CREATE TABLE IF NOT EXISTS public.streak_shield_days (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

COMMENT ON TABLE public.streak_shield_days IS
  '방패로 메운 날 (P8-08). 스트릭이 학습일로 셈. 본인 행 읽기만, 쓰기는 settle_streak_shields';

ALTER TABLE public.user_streak_shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_shield_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_streak_shields FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.streak_shield_days FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_streak_shields TO authenticated;
GRANT SELECT ON TABLE public.streak_shield_days TO authenticated;
-- service_role DELETE: 앱은 쓰지 않음(쓰기는 RPC). 운영 정리·e2e 사용자 초기화용 (지급·소모는 여전히 RPC 만)
GRANT SELECT, DELETE ON TABLE public.user_streak_shields TO service_role;
GRANT SELECT, DELETE ON TABLE public.streak_shield_days TO service_role;

DROP POLICY IF EXISTS "user_streak_shields_select_own" ON public.user_streak_shields;
CREATE POLICY "user_streak_shields_select_own" ON public.user_streak_shields
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "streak_shield_days_select_own" ON public.streak_shield_days;
CREATE POLICY "streak_shield_days_select_own" ON public.streak_shield_days
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- 3. 학습일 (소유자만)
-- ------------------------------------------------------------
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

COMMENT ON FUNCTION public.streak_learning_days(UUID) IS
  '학습일 (P8-08): 퀘스트·퀴즈를 푼 KST 날짜(완료·직접 풀이·복습 판정·퀴즈 끝냄, 황금키 완료 제외). 소유자만';

-- ------------------------------------------------------------
-- 4. 스트릭 수 (규칙 함수)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_streak(p_days DATE[], p_today DATE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_d DATE := CASE WHEN p_today = ANY (COALESCE(p_days, '{}')) THEN p_today ELSE p_today - 1 END;
  v_n INTEGER := 0;
BEGIN
  WHILE v_d = ANY (COALESCE(p_days, '{}')) LOOP
    v_n := v_n + 1;
    v_d := v_d - 1;
  END LOOP;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.current_streak(DATE[], DATE) IS
  '연속 학습일 수 (P8-08): 오늘 학습했으면 오늘부터, 아니면 어제부터. TS currentStreak, 대조 reward-rules.json streak_days';

-- ------------------------------------------------------------
-- 5. 방패 정산 (소유자만)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_streak_shields(p_user_id UUID)
RETURNS DATE[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_today DATE := public.kst_today();
  v_held  INTEGER;
  v_last  DATE;
  v_gap   INTEGER;
  v_days  DATE[];
BEGIN
  -- 방패가 없으면 잠그지 않고 끝 (대부분의 방문)
  SELECT s.shields INTO v_held FROM public.user_streak_shields s WHERE s.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_held <= 0 THEN
    RETURN '{}';
  END IF;

  SELECT max(d) INTO v_last FROM (
    SELECT d FROM public.streak_learning_days(p_user_id) d
    UNION ALL
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = p_user_id
  ) t WHERE d < v_today;
  IF v_last IS NULL OR v_last >= v_today - 1 THEN
    RETURN '{}';
  END IF;

  v_gap := (v_today - 1) - v_last;
  IF v_gap > v_held THEN
    RETURN '{}';  -- 모자라면 메워도 끊기므로 아낌
  END IF;

  v_days := ARRAY(SELECT generate_series(v_last + 1, v_today - 1, interval '1 day')::date);
  INSERT INTO public.streak_shield_days (user_id, day) SELECT p_user_id, unnest(v_days) ON CONFLICT DO NOTHING;
  UPDATE public.user_streak_shields SET shields = shields - v_gap, updated_at = NOW() WHERE user_id = p_user_id;
  RETURN v_days;
END;
$$;

COMMENT ON FUNCTION public.settle_streak_shields(UUID) IS
  '스트릭 방패 정산 (P8-08): 마지막 학습일 다음 날 ~ 어제가 빠졌고 방패가 충분하면 그 날들을 메움. 멱등. 소유자만';

-- ------------------------------------------------------------
-- 6. world_daily_status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_daily_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today   DATE := public.kst_today();
  v_filled  DATE[];
  v_days    DATE[];
  v_shields INTEGER;
  v_total   INTEGER;
  v_stamped BOOLEAN;
  v_k       INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  v_filled := public.settle_streak_shields(p_user_id);

  v_days := ARRAY(
    SELECT d FROM public.streak_learning_days(p_user_id) d
    UNION
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = p_user_id);
  SELECT COALESCE((SELECT s.shields FROM public.user_streak_shields s WHERE s.user_id = p_user_id), 0) INTO v_shields;

  SELECT count(*), bool_or(l.ref = to_char(v_today, 'YYYY-MM-DD')) INTO v_total, v_stamped
    FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'attendance';
  v_stamped := COALESCE(v_stamped, false);
  -- 이번 사이클에 찍은 칸 수: 오늘 찍었으면 오늘 칸까지, 아니면 다음 칸 전까지
  v_k := CASE WHEN v_stamped THEN (v_total - 1) % 7 + 1 ELSE v_total % 7 END;

  RETURN jsonb_build_object(
    'streak', jsonb_build_object(
      'days',        public.current_streak(v_days, v_today),
      'today',       v_today = ANY (v_days),  -- 방패는 어제까지만 메우므로 오늘 = 학습함
      'shields',     v_shields,
      'shield_days', COALESCE((SELECT jsonb_agg(to_char(sd.day, 'YYYY-MM-DD') ORDER BY sd.day)
                                 FROM public.streak_shield_days sd
                                WHERE sd.user_id = p_user_id AND sd.day >= v_today - 7), '[]'::jsonb),
      'filled',      to_jsonb(ARRAY(SELECT to_char(d, 'YYYY-MM-DD') FROM unnest(v_filled) d))),
    'attendance', jsonb_build_object(
      'today',         to_char(v_today, 'YYYY-MM-DD'),
      'total',         v_total,
      'stamped_today', v_stamped,
      'day_n',         CASE WHEN v_stamped THEN v_k ELSE v_k + 1 END,
      'cycle',         COALESCE((SELECT jsonb_agg(r.ref ORDER BY r.ref) FROM (
                         SELECT l.ref FROM public.coin_ledger l
                          WHERE l.user_id = p_user_id AND l.source = 'attendance'
                          ORDER BY l.ref DESC LIMIT v_k) r), '[]'::jsonb)));
END;
$$;

COMMENT ON FUNCTION public.world_daily_status(UUID) IS
  '월드맵 하루 상태 (P8-08). service_role 전용: 월드맵 로더가 확인한 id 로. 방패 정산 뒤 스트릭·방패·출석 사이클';

-- ------------------------------------------------------------
-- 7. stamp_attendance
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_attendance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref     TEXT := to_char(public.kst_today(), 'YYYY-MM-DD');
  v_coins   INTEGER;
  v_total   INTEGER;
  v_n       INTEGER;
  v_res     JSONB;
  v_before  INTEGER;
  v_after   INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 같은 사용자의 도장을 줄 세움 (coin_apply 와 같은 잠금 순서: users 먼저)
  SELECT u.coins INTO v_coins FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;
  SELECT COALESCE((SELECT s.shields FROM public.user_streak_shields s WHERE s.user_id = p_user_id), 0) INTO v_before;

  SELECT count(*) INTO v_total FROM public.coin_ledger l WHERE l.user_id = p_user_id AND l.source = 'attendance';
  IF EXISTS (SELECT 1 FROM public.coin_ledger l
              WHERE l.user_id = p_user_id AND l.source = 'attendance' AND l.ref = v_ref) THEN
    RETURN jsonb_build_object(
      'stamped', true, 'already_stamped', true, 'day_n', (v_total - 1) % 7 + 1, 'coins_earned', 0,
      'coins_balance', v_coins, 'shield_granted', 0, 'shields', v_before);
  END IF;

  v_n := v_total % 7 + 1;
  v_res := public.coin_apply(p_user_id, 'attendance', v_ref, public.coin_reward('attendance', v_n));
  v_after := v_before;
  IF v_n = 7 THEN
    INSERT INTO public.user_streak_shields AS s (user_id, shields) VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE SET shields = least(2, s.shields + 1), updated_at = NOW()
    RETURNING s.shields INTO v_after;
  END IF;

  RETURN jsonb_build_object(
    'stamped',         true,
    'already_stamped', false,
    'day_n',           v_n,
    'coins_earned',    (v_res->>'delta')::integer,
    'coins_balance',   (v_res->>'coins')::integer,
    'shield_granted',  v_after - v_before,
    'shields',         v_after);
END;
$$;

COMMENT ON FUNCTION public.stamp_attendance(UUID) IS
  '출석 도장 (P8-08). service_role 전용: /api/attendance/stamp. 하루 한 번(원장 attendance/<KST 날짜>), 누적 7회 사이클, 7일째 방패 +1(최대 2)';

-- ------------------------------------------------------------
-- 8. 권한
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.streak_learning_days(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.settle_streak_shields(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_streak(DATE[], DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_streak(DATE[], DATE) TO service_role;
REVOKE ALL ON FUNCTION public.world_daily_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_daily_status(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.stamp_attendance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_attendance(UUID) TO service_role;

-- ------------------------------------------------------------
-- 9. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT[] := '{}';
BEGIN
  IF public.coin_reward('attendance', 1) <> 5 OR public.coin_reward('attendance', 7) <> 30 THEN
    v_bad := v_bad || '출석 금액 (00031 이 먼저 있어야 함)'::TEXT;
  END IF;
  IF public.current_streak(ARRAY['2026-11-10', '2026-11-09']::date[], '2026-11-11') <> 2
     OR public.current_streak(ARRAY['2026-11-11', '2026-11-10']::date[], '2026-11-11') <> 2
     OR public.current_streak(ARRAY['2026-11-09']::date[], '2026-11-11') <> 0 THEN
    v_bad := v_bad || 'current_streak'::TEXT;
  END IF;
  IF has_function_privilege('anon', 'public.world_daily_status(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.world_daily_status(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.world_daily_status(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.stamp_attendance(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.stamp_attendance(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.stamp_attendance(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.settle_streak_shields(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.settle_streak_shields(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.streak_learning_days(uuid)', 'EXECUTE') THEN
    v_bad := v_bad || '실행 권한'::TEXT;
  END IF;
  IF has_table_privilege('authenticated', 'public.user_streak_shields', 'INSERT')
     OR has_table_privilege('authenticated', 'public.user_streak_shields', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.streak_shield_days', 'INSERT')
     OR has_table_privilege('anon', 'public.user_streak_shields', 'SELECT')
     OR has_table_privilege('anon', 'public.streak_shield_days', 'SELECT') THEN
    v_bad := v_bad || '테이블 권한'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00035] 검증 실패: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00035] 출석·스트릭 방패: world_daily_status·stamp_attendance service_role 전용';
END $$;
