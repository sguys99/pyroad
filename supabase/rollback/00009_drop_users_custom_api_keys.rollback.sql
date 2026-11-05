-- ============================================================
-- 00009 되돌리기: users.custom_api_keys 컬럼을 빈 값으로 다시 만듦   (B13)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 이전 앱(이 컬럼을 select 하는 버전)으로 되돌려야 할 때만 필요합니다. 새 앱은 이 컬럼이 없어도 동작합니다.
-- ⚠️ 키 값은 돌아오지 않습니다. 이관된 키는 user_api_keys 에 암호문으로 남고, 이전 앱은 그것을 읽지 못하므로
--    이전 앱에서는 사용자가 키를 다시 등록해야 합니다.
-- 실행 후 상태 = 00008 까지 적용된 상태 (컬럼은 비어 있음)
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00009_drop_users_custom_api_keys.rollback.sql
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_api_keys JSONB DEFAULT '{}';

-- 00008 이 적용돼 있으면 이전 앱의 키 저장(사용자 클라이언트 UPDATE)이 막히므로, 이전 앱으로 되돌릴 때는
-- 00008 rollback 도 함께 실행합니다.
