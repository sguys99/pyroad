-- ============================================================
-- 00010 되돌리기: record_hint 삭제 + status 기본값 'not_started'   (P1-04)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 00011 을 되돌리고(rollback/00011_…) 이전 앱(클라이언트가 hints_used·status 를 직접 upsert 하는 버전)으로
--    되돌린 뒤 실행합니다. 새 앱은 이 함수가 없으면 힌트는 그대로 보이지만 힌트 수가 기록되지 않습니다(XP 보너스가 과다).
-- 실행 후 상태 = 00009 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00010_record_hint_rpc.rollback.sql
-- ============================================================

DO $$
BEGIN
  IF to_regprocedure('public.user_progress_lock_keys()') IS NOT NULL THEN
    RAISE EXCEPTION '00011 이 적용되어 있습니다. 먼저 rollback/00011_progress_badges_privileges.rollback.sql 을 실행하세요';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.record_hint(UUID, UUID, INTEGER);
ALTER TABLE public.user_progress ALTER COLUMN status SET DEFAULT 'not_started';
