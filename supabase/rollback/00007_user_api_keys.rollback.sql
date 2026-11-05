-- ============================================================
-- 00007 되돌리기: user_api_keys 테이블 삭제                         (B13)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 00009 를 되돌리고(00009 rollback), 이전 앱(users.custom_api_keys 평문을 쓰는 버전)으로 되돌린 뒤 실행합니다.
--    새 앱은 이 테이블이 없으면 내 API 키 저장이 실패하고 튜터는 서버 무료 티어로만 동작합니다.
-- ⚠️ 테이블의 키는 암호문이라 SQL 로 평문 컬럼에 되돌릴 수 없습니다. 지우면 사용자가 키를 다시 등록해야 합니다.
-- 실행 후 상태 = 00006 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00007_user_api_keys.rollback.sql
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'custom_api_keys') THEN
    RAISE EXCEPTION '00009 가 적용된 상태입니다. 먼저 supabase/rollback/00009_drop_users_custom_api_keys.rollback.sql 을 실행하세요';
  END IF;
END $$;

DROP TABLE IF EXISTS public.user_api_keys;
