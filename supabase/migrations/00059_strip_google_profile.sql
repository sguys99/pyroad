-- ============================================================
-- Google 로그인의 실명·프로필 사진을 Auth 에 저장하지 않기 (Idempotent)   (B115, P12-06 수집 항목 최소화, §2.6)
-- 릴리즈 단계: ① 추가형 (public 함수 1개 + auth.users·auth.identities BEFORE 트리거 2개. 표·권한·앱 코드 그대로,
--                       이전 앱도 이 값들을 읽지 않음: 온보딩 닉네임 제안은 Google 이름을 실명으로 보고 쓰지 않음 —
--                       src/lib/auth/normalizeProviderMetadata.ts, 공개 필드는 00013·00022 부터 자리표시자)
--
-- 왜
--   GoTrue 의 Google provider 는 scope `email profile` 을 늘 요청하고, id_token 의 name·full_name·given_name·family_name·
--   picture·avatar_url 을 auth.users.raw_user_meta_data 와 auth.identities.identity_data 에 저장한다(로그인할 때마다 다시 병합).
--   서비스는 이 값을 어디에도 쓰지 않으므로 받는 즉시 버린다. 이메일(auth.users.email·identity_data.email)은 GoTrue 가
--   identities.email 생성 열·계정 연결에 쓰므로 남긴다(처리방침 2번 표). Kakao·Naver 는 지금 식별자만 받아 이 값이 없고,
--   Kakao 닉네임(선택 동의)을 나중에 받으면 온보딩 제안에 쓰므로 Google 만 대상으로 한다.
--
-- 하는 일
--   1. public.strip_google_profile(): 트리거 함수. NEW 의 JSONB 에서 위 6개 키만 지움(다른 표를 읽거나 쓰지 않음)
--      - auth.users: raw_user_meta_data ->> 'iss' 가 Google 일 때 (= 방금 Google 로 가입·로그인)
--      - auth.identities: provider = 'google' 일 때
--   2. 트리거 strip_google_profile_users (auth.users BEFORE INSERT OR UPDATE OF raw_user_meta_data)
--      트리거 strip_google_profile_identities (auth.identities BEFORE INSERT OR UPDATE OF identity_data)
--      - 00013 의 AFTER 트리거(handle_new_user·handle_user_signed_in)는 iss·provider 만 읽으므로 순서와 상관없음
--   3. 자기 검증
-- 이미 저장된 값은 지우지 않음(되돌릴 수 없는 정리라 런북에서 따로): docs/legal/v1.0-privacy-audit.md "운영에서 할 일"
-- 적용 후 NOTICE `[00059] Google 이름·사진 저장 안 함: 트리거 2개` 확인
-- 되돌리기: supabase/rollback/00059_strip_google_profile.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

CREATE OR REPLACE FUNCTION public.strip_google_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_keys CONSTANT TEXT[] := ARRAY['name', 'full_name', 'given_name', 'family_name', 'picture', 'avatar_url'];
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.raw_user_meta_data ->> 'iss' IN ('https://accounts.google.com', 'accounts.google.com') THEN
      NEW.raw_user_meta_data := NEW.raw_user_meta_data - v_keys;
    END IF;
  ELSIF TG_TABLE_NAME = 'identities' THEN
    IF NEW.provider = 'google' AND NEW.identity_data IS NOT NULL THEN
      NEW.identity_data := NEW.identity_data - v_keys;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.strip_google_profile() IS
  'Google 로그인의 이름·사진 키를 Auth 메타데이터에서 지우는 트리거 함수 (B115, P12-06). 트리거 전용';

-- 트리거 함수는 발화할 때 EXECUTE 권한을 보지 않음(만들 때만) → 누구에게도 주지 않음
REVOKE ALL ON FUNCTION public.strip_google_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS strip_google_profile_users ON auth.users;
CREATE TRIGGER strip_google_profile_users
  BEFORE INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.strip_google_profile();

DROP TRIGGER IF EXISTS strip_google_profile_identities ON auth.identities;
CREATE TRIGGER strip_google_profile_identities
  BEFORE INSERT OR UPDATE OF identity_data ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION public.strip_google_profile();

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE NOT tgisinternal
     AND tgname IN ('strip_google_profile_users', 'strip_google_profile_identities')
     AND tgrelid IN ('auth.users'::regclass, 'auth.identities'::regclass);
  IF v_n <> 2 THEN
    RAISE EXCEPTION '[00059] 검증 실패: 트리거 % 개 (기대 2)', v_n;
  END IF;
  IF has_function_privilege('anon', 'public.strip_google_profile()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.strip_google_profile()', 'EXECUTE') THEN
    RAISE EXCEPTION '[00059] 검증 실패: anon/authenticated 가 strip_google_profile 을 실행할 수 있음';
  END IF;
  RAISE NOTICE '[00059] Google 이름·사진 저장 안 함: 트리거 %개', v_n;
END $$;
