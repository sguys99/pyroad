-- ============================================================
-- 00020 되돌리기: patch_user_settings 삭제   (P2-14)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 이 함수를 쓰지 않는 앱(P2-14 이전)으로 되돌린 뒤 실행합니다. 새 앱은 이 함수가 없으면 설정(움직임·사운드)
--    서버 저장만 실패하고(500) 기기에는 바뀐 값이 남습니다.
-- 실행 후 상태 = 00019 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00020_patch_user_settings.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.patch_user_settings(UUID, JSONB);
