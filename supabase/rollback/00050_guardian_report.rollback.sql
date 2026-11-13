-- ============================================================
-- 00050 되돌리기: 보호자 주간 리포트 링크 테이블·함수 삭제   (P9-15)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P9-15 이전 앱으로 되돌린 뒤 실행합니다.
-- 잃는 데이터: 만든 보호자 링크(해시)만 — 보낸 링크는 모두 404, 학습 기록은 그대로. 다시 적용하면 학생이 링크를 새로 만들어야 함
-- 실행 후 상태 = 00049 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00050_guardian_report.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.guardian_report(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.guardian_report_link(UUID, TEXT);
DROP TABLE IF EXISTS public.guardian_report_links;

DO $$
BEGIN
  RAISE NOTICE '[00050 rollback] guardian_report_links·guardian_report_link·guardian_report 삭제 완료';
END $$;
