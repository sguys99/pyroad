-- ============================================================
-- 00008 되돌리기: users 권한·정책을 00001·00003 상태로              (P1-01)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 로그인 사용자가 다시 XP·레벨·황금키를 직접 바꿀 수 있습니다(B04). 원인을 고친 뒤 00008 을 다시 적용합니다.
-- 실행 후 상태 = 00007 까지 적용된 상태 (00009 와는 무관)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00008_users_update_privileges.rollback.sql
-- ============================================================

-- 컬럼 단위 UPDATE 권한을 지우고 00003 의 테이블 ALL 로
REVOKE ALL ON TABLE public.users FROM anon, authenticated;
GRANT ALL ON TABLE public.users TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
