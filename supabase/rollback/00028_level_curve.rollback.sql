-- ============================================================
-- 00028 되돌리기: level_for_xp 를 00006 의 5단계로, current_level 트리거 삭제   (P8-01, B20)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 먼저 이전 앱으로 되돌립니다 (새 앱의 TS 곡선은 50단계라 화면 레벨과 DB 레벨이 어긋남)
-- 잃는 데이터: 없음. 이미 바뀐 current_level 은 다음 완료 때 5단계 값으로 다시 쓰임
-- 실행 후 상태 = 00027 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00028_level_curve.rollback.sql
-- ============================================================

DROP TRIGGER IF EXISTS trg_users_sync_level ON public.users;
DROP FUNCTION IF EXISTS public.users_sync_level();

-- level_for_xp (00006)
CREATE OR REPLACE FUNCTION public.level_for_xp(p_total_xp INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT GREATEST(1, (SELECT count(*)::integer
                        FROM unnest(ARRAY[0, 100, 300, 600, 1000]) AS t(threshold)
                       WHERE p_total_xp >= t.threshold));
$$;

REVOKE ALL ON FUNCTION public.level_for_xp(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.level_for_xp(INTEGER) TO service_role;
