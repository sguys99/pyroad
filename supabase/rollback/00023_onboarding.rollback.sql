-- ============================================================
-- 00023 되돌리기: 온보딩 RPC·약관 동의 기록·users.onboarded_at 삭제   (P3-11)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 온보딩이 없는 앱(P3-11 이전)으로 되돌린 뒤 실행합니다. 새 앱은 onboarded_at 이 없으면 온보딩 관문을 건너뛰지만
--    (로그인 화면은 그대로) 온보딩 저장이 실패(500)합니다.
-- ⚠️ user_agreements 의 약관 동의 기록(일시·버전·방법)과 온보딩 완료 시각이 지워지고 되살릴 수 없습니다.
--    지우기 전에 SQL Editor 에서 `select * from public.user_agreements` 결과를 CSV 로 내보내 보관하세요.
--    닉네임·학년·스킨(users.nickname·grade·avatar_config)은 그대로 남습니다.
-- 실행 후 상태 = 00022 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00023_onboarding.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.is_nickname_taken(TEXT, UUID);
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT);
DROP TABLE IF EXISTS public.user_agreements;
ALTER TABLE public.users DROP COLUMN IF EXISTS onboarded_at;
