-- ============================================================
-- 00035 되돌리기: 출석·스트릭 방패 테이블·함수 삭제   (P8-08)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P8-08 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 함수가 없으면 출석 카드를 숨기고 스트릭을 완료 시각으로 셈).
-- 잃는 데이터: 가진 스트릭 방패 수(user_streak_shields)와 방패로 메운 날(streak_shield_days). 출석 기록·준 코인(원장 attendance/<날짜>)은 그대로.
--   다시 적용하면 출석 사이클은 원장에서 이어지고, 방패는 0개에서 다시 시작
-- 실행 후 상태 = 00034 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00035_attendance_streak.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.stamp_attendance(UUID);
DROP FUNCTION IF EXISTS public.world_daily_status(UUID);
DROP FUNCTION IF EXISTS public.settle_streak_shields(UUID);
DROP FUNCTION IF EXISTS public.current_streak(DATE[], DATE);
DROP FUNCTION IF EXISTS public.streak_learning_days(UUID);
DROP TABLE IF EXISTS public.streak_shield_days;
DROP TABLE IF EXISTS public.user_streak_shields;
