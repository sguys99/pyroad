-- ============================================================
-- 00034 되돌리기: 데일리 미션 테이블·함수 삭제   (P8-07)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-07 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 함수가 없으면 미션 칸을 숨기고 오늘의 퀴즈를 저장 없이 계산).
-- 잃는 데이터: 그날그날 배정한 미션과 저장한 오늘의 퀴즈 목록(user_daily_missions). 이미 준 코인(원장 mission/<날짜>:<id>)·XP 는 그대로.
--   다시 적용하면 오늘 배정을 새로 하고, 이미 받은 미션은 원장 키라 다시 받지 않음
-- 실행 후 상태 = 00033 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00034_daily_missions.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.claim_daily_mission(UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS public.daily_missions_today(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.daily_mission_list(UUID, DATE, TEXT[], UUID[]);
DROP FUNCTION IF EXISTS public.daily_mission_possible(UUID, DATE, TEXT, INTEGER, UUID[]);
DROP FUNCTION IF EXISTS public.daily_mission_target(TEXT, INTEGER, UUID[]);
DROP FUNCTION IF EXISTS public.daily_mission_progress(UUID, DATE, TEXT, UUID[]);
DROP TABLE IF EXISTS public.user_daily_missions;
DROP TABLE IF EXISTS public.daily_missions;
