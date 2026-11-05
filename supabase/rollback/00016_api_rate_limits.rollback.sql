-- ============================================================
-- 00016 되돌리기: 요청 한도 카운터·consume_rate_limit 삭제   (P1-19)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 되돌리면 튜터 API 의 사용자별 요청 한도가 꺼집니다. 새 앱은 함수가 없으면 한도 없이 통과시키고(fail-open)
--    요청마다 Vercel 로그 `[tutor] consume_rate_limit 실패` + Sentry(10분 3회 제한)를 남깁니다. 튜터는 그대로 동작합니다.
--    한도를 잠깐 풀고 싶을 뿐이면 되돌리지 말고 Vercel env TUTOR_LIMIT_* 를 크게 바꿔 재배포합니다 (런북 "튜터 한도·남용 기록").
-- 카운터(api_rate_limits)는 최근 2일치 사용 횟수뿐이라 지워져도 잃는 기록은 없습니다.
-- 실행 후 상태 = 00015 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00016_api_rate_limits.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS public.api_rate_limits;
