-- ============================================================
-- 00059 되돌리기: Google 이름·사진 지우기 트리거 제거   (B115)
-- 마이그레이션 실행 대상이 아님. 이미 지운 이름·사진은 되돌아오지 않음(다음 Google 로그인 때 GoTrue 가 다시 병합해 저장)
-- ============================================================

DROP TRIGGER IF EXISTS strip_google_profile_users ON auth.users;
DROP TRIGGER IF EXISTS strip_google_profile_identities ON auth.identities;
DROP FUNCTION IF EXISTS public.strip_google_profile();
