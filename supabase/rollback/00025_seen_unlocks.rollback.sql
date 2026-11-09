-- ============================================================
-- 00025 되돌리기: 잠금 해제 연출 본 기록 테이블·RPC 삭제   (P5-05)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 잠금 해제 연출이 없는 앱(P5-05 이전)으로 되돌린 뒤 실행합니다. 새 앱이 남아 있어도 화면은 막히지 않지만
--    (본 기록을 못 읽으면 연출·기록을 하지 않음) 다시 적용하면 모든 사용자가 처음처럼 조용히 기록부터 다시 합니다.
-- 잃는 데이터: 사용자별 "이 스테이지의 해제 연출을 봤음" 기록뿐 (진행·보상과 무관)
-- 실행 후 상태 = 00024 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00025_seen_unlocks.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.record_seen_unlocks(UUID, UUID[]);
DROP TABLE IF EXISTS public.user_seen_unlocks;
