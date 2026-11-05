-- ============================================================
-- 00017 되돌리기: 분석 이벤트 테이블·보존 정리 함수·전역 요청 한도 삭제   (P1-17)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 쌓인 분석 이벤트가 모두 사라집니다(퍼널·일별 활성 기록). 필요하면 먼저 CSV 로 내보냅니다.
--    새 앱은 테이블·함수가 없어도 화면은 그대로 동작하고, 이벤트 기록만 실패합니다(Vercel 로그 `[analytics] … 실패`).
--    기록만 멈추고 싶으면 되돌리지 말고 Vercel env ANALYTICS_SALT 를 지우고 재배포합니다 (런북 "분석 이벤트").
-- 실행 후 상태 = 00016 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00017_analytics_events.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.consume_global_rate_limit(TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS public.api_global_rate_limits;
DROP FUNCTION IF EXISTS public.prune_analytics_events(INTERVAL, INTEGER);
DROP TABLE IF EXISTS public.analytics_events;
