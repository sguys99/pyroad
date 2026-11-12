-- ============================================================
-- 레벨 곡선 Lv 1~50 + current_level 을 total_xp 에서만 파생 (Idempotent)   (P8-01, B20, §3 F1, §12-Q62)
-- 릴리즈 단계: ① 추가형 (함수 본문 교체 + 트리거 추가. 인자·반환·권한 그대로)
--
-- 하는 일
--   1. level_for_xp: 00006 의 5단계 [0, 100, 300, 600, 1000] → 50단계.
--      Lv N 문턱 = 200 × (N − 1)^1.3 를 10 단위로 반올림 (TS 원본: src/lib/quest/xp.ts LEVEL_THRESHOLDS,
--      근거: docs/balance.md "레벨 곡선", scripts/balance/level-curve.ts). 부동소수 계산 차이가 없게 표를 배열로 둠
--      대조: supabase/tests/fixtures/reward-rules.json (vitest rewardRules + test:rls RW-1)
--   2. B20: users.current_level 을 total_xp 에서만 파생. BEFORE INSERT/UPDATE OF total_xp, current_level 트리거가
--      current_level := level_for_xp(total_xp) 로 덮어씀 → RPC·스크립트가 어떤 값을 쓰든 두 컬럼이 어긋나지 않음
--      (complete_quest 등은 지금처럼 current_level 을 같이 쓰지만 결과가 같음. 클라이언트는 두 컬럼 모두 UPDATE 권한 없음, 00008)
--   3. 권한 다시 적음 + 자기 검증
--   ⚠️ 기존 사용자의 current_level 재계산은 하지 않음 (P8-02). 트리거는 total_xp 가 바뀔 때(퀘스트 완료 등) 그 행만 맞춤
--   ⚠️ 00006 파일 전체를 다시 실행하면 level_for_xp 가 5단계로 돌아갑니다. 다시 실행했다면 00028 도 다시 실행
-- 적용 후 NOTICE `[00028] level_for_xp: 50단계 곡선, users current_level 트리거 확인` 확인
-- 확인: supabase/tests RW-1 (대조표), RPC-6 (권한)
-- 되돌리기: supabase/rollback/00028_level_curve.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. level_for_xp: 50단계 표 중 넘은 개수 (최소 1, 최대 50)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.level_for_xp(p_total_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT GREATEST(1, (SELECT count(*)::integer
                        FROM unnest(ARRAY[0, 200, 490, 830, 1210, 1620, 2050, 2510, 2990, 3480, 3990, 4520, 5060, 5610, 6180, 6760, 7350, 7950, 8570, 9190, 9830, 10470, 11120, 11780, 12450, 13130, 13820, 14510, 15220, 15930, 16650, 17370, 18100, 18840, 19590, 20340, 21100, 21860, 22630, 23410, 24190, 24980, 25780, 26580, 27390, 28200, 29010, 29840, 30670, 31500]) AS t(threshold)
                       WHERE p_total_xp >= t.threshold));
$$;

COMMENT ON FUNCTION public.level_for_xp(INTEGER) IS
  '레벨 (P8-01): Lv N 문턱 = round(200 × (N − 1)^1.3, 10 단위), Lv 1~50. TS src/lib/quest/xp.ts 와 reward-rules.json 으로 대조';

REVOKE ALL ON FUNCTION public.level_for_xp(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.level_for_xp(INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 2. B20: current_level 은 total_xp 에서만 (트리거)
--    SECURITY INVOKER: 이 컬럼을 쓰는 쪽은 SECURITY DEFINER RPC(소유자)·service_role 뿐 (anon·authenticated 는 UPDATE 권한 없음)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_sync_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.current_level := public.level_for_xp(NEW.total_xp);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.users_sync_level() IS
  'users.current_level := level_for_xp(total_xp) (P8-01, B20). 레벨은 total_xp 하나로만 정함';

REVOKE ALL ON FUNCTION public.users_sync_level() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_users_sync_level ON public.users;
CREATE TRIGGER trg_users_sync_level
  BEFORE INSERT OR UPDATE OF total_xp, current_level ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_sync_level();

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_oid OID := 'public.level_for_xp(integer)'::regprocedure;
BEGIN
  IF has_function_privilege('anon', v_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', v_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION '[00028] 검증 실패: level_for_xp 실행 권한이 service_role 전용이 아님';
  END IF;
  IF public.level_for_xp(0) <> 1 OR public.level_for_xp(199) <> 1 OR public.level_for_xp(200) <> 2
     OR public.level_for_xp(3480) <> 10 OR public.level_for_xp(31499) <> 49
     OR public.level_for_xp(31500) <> 50 OR public.level_for_xp(999999) <> 50 THEN
    RAISE EXCEPTION '[00028] 검증 실패: level_for_xp 가 50단계 곡선이 아님';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname = 'trg_users_sync_level' AND tgrelid = 'public.users'::regclass) THEN
    RAISE EXCEPTION '[00028] 검증 실패: trg_users_sync_level 없음';
  END IF;
  RAISE NOTICE '[00028] level_for_xp: 50단계 곡선, users current_level 트리거 확인';
END $$;
