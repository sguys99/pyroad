-- ============================================================
-- users 쓰기 권한을 프로필 컬럼으로 제한 + 정책 재작성 (Idempotent)        (P1-01, B04, B34)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포·동작 확인 뒤에만 적용)
--
-- 배경: users_update_own 정책이 모든 컬럼을 허용해, 로그인 사용자가 브라우저에서
--   PATCH /rest/v1/users {total_xp, current_level, golden_keys} 로 XP·레벨·황금키를 직접 바꿀 수 있습니다(B04, 회귀 B04-1·2·7).
--   P1-03 이후 앱은 XP·레벨·황금키를 service_role 전용 RPC(00006)로만 쓰고, 사용자 클라이언트로 users 에 쓰는 곳은
--   /api/settings 의 preferred_provider 하나뿐입니다(custom_api_keys 는 B13 으로 user_api_keys 로 옮김).
--
-- 전제: 새 앱(B13: /api/settings 가 API 키를 service_role 로 user_api_keys 에 저장) 배포. 이전 앱은 사용자 클라이언트로
--   users.custom_api_keys 를 UPDATE 하므로 이 파일을 먼저 적용하면 이전 앱의 키 저장이 403 이 됩니다.
--
-- 하는 일
--   1. anon·authenticated 의 users 권한을 모두 회수하고 SELECT 만 다시 줌
--      (SELECT 컬럼 권한은 건드리지 않음: PostgREST select=* 가 42501 로 깨짐, §2.2 권한 원칙)
--   2. authenticated 에 앱이 실제로 쓰는 컬럼만 UPDATE: preferred_provider (/api/settings)
--      total_xp·current_level·golden_keys(이후 coins)는 클라이언트 쓰기 불가. 새 프로필 컬럼(nickname·settings 등)은
--      그 컬럼을 만드는 마이그레이션(P1-08·P3)에서 필요한 것만 GRANT UPDATE (…) 로 추가합니다.
--   3. INSERT 권한·users_insert_own 정책 제거 (가입 시 행은 handle_new_user 트리거가 만듦, SECURITY DEFINER)
--   4. users_select_own·users_update_own 을 TO authenticated + (select auth.uid()) 로 다시 씀 (B34 auth_rls_initplan)
--      UPDATE 정책에 WITH CHECK 추가 (id 를 다른 값으로 바꾸지 못함. id 는 UPDATE 권한도 없음)
--   5. 자기 검증: XP·레벨·황금키 UPDATE 권한이 남아 있으면 예외 → 전체 롤백
--
-- service_role 권한(00003 의 ALL)은 그대로 둡니다. RPC(00006)·handle_new_user 는 SECURITY DEFINER 라 영향 없음.
-- 확인: supabase/tests B04-1·2·7 (deny), APP-W3 (preferred_provider 저장 allow)
-- 되돌리기: supabase/rollback/00008_users_update_privileges.rollback.sql (00003·00001 의 권한·정책으로)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1·2·3. 권한: SELECT 만 + UPDATE (preferred_provider)
--    REVOKE ALL 은 INSERT·UPDATE·DELETE·TRUNCATE·REFERENCES·TRIGGER(·PG17 MAINTAIN)과 기존 컬럼 권한까지 회수
-- ------------------------------------------------------------
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.users TO anon, authenticated;
GRANT UPDATE (preferred_provider) ON TABLE public.users TO authenticated;

-- ------------------------------------------------------------
-- 3·4. 정책
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "users_insert_own" ON public.users;

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ------------------------------------------------------------
-- 5. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_role TEXT;
  v_col  TEXT;
  v_bad  TEXT[] := '{}';
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.users', 'INSERT, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':INSERT/DELETE/TRUNCATE');
    END IF;
    FOR v_col IN
      SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'
    LOOP
      IF has_column_privilege(v_role, 'public.users', v_col, 'UPDATE')
         AND NOT (v_role = 'authenticated' AND v_col = 'preferred_provider') THEN
        v_bad := v_bad || (v_role || ':UPDATE(' || v_col || ')');
      END IF;
    END LOOP;
  END LOOP;
  IF NOT has_column_privilege('authenticated', 'public.users', 'preferred_provider', 'UPDATE') THEN
    v_bad := v_bad || 'authenticated:UPDATE(preferred_provider) 없음'::TEXT;
  END IF;
  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00008] users 권한이 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00008] users: anon·authenticated SELECT, authenticated UPDATE(preferred_provider) 만 남음';
END $$;
