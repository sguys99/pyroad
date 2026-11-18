-- ============================================================
-- 00060 되돌리기: 학생 세션이 쓰는 열의 크기 CHECK 를 지움 (B108)
-- 지우기만 하므로 잃는 데이터 없음. 이전·새 앱 모두 그대로 동작(다시 크기 제한 없음)
-- 운영 SQL Editor 로 BEGIN; … COMMIT; 으로 감싸서 실행합니다.
-- ============================================================
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_code_submitted_size;
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_step_submissions_size;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_preferred_provider_size;
