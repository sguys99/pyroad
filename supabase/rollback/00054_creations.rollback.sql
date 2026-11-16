-- ============================================================
-- 00054 되돌리기: 작품 테이블·트리거 함수 삭제   (P11-06)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- 먼저 P11-06 이전 앱으로 되돌립니다 (지금 앱은 /api/creations·/profile/creations 에서 이 테이블을 씀).
-- 잃는 데이터: 학생이 저장한 작품 전부(코드·그림 명령·썸네일·대화 기록). 필요하면 먼저 내보내 둡니다.
-- 실행 후 상태 = 00053 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00054_creations.rollback.sql
-- ============================================================

DROP TABLE IF EXISTS public.creations;
DROP FUNCTION IF EXISTS public.creations_guard();
