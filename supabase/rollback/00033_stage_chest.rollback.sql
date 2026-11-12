-- ============================================================
-- 00033 되돌리기: open_stage_chest · stage_chest_goal 삭제   (P8-06)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-06 이전 앱으로 되돌린 뒤 실행합니다 (새 앱의 "열기" 버튼은 함수가 없으면 오류 안내만 보임).
-- 잃는 데이터 없음: 이미 연 상자 기록(coin_ledger chest/<stage_id>)과 준 코인은 그대로. 다시 적용하면 연 상자는 열린 채로
-- 실행 후 상태 = 00032 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00033_stage_chest.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.open_stage_chest(UUID, UUID);
DROP FUNCTION IF EXISTS public.stage_chest_goal(INTEGER);
