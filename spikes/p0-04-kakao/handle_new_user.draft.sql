-- ============================================================
-- [DRAFT] Phase 3 handle_new_user 재작성 (P3-06, P3-08, B16, B24)
-- P0-04 스파이크 산출물. 그대로 운영 DB에 적용하지 말고 Phase 3 마이그레이션으로 옮길 것.
--
-- 바뀌는 점 (00001 대비)
-- 1. provider 인식: app_metadata.provider(google / kakao / custom:kakao / custom:naver …)를 3종으로 정규화
-- 2. 실명·provider 닉네임을 공개 필드에 저장하지 않음
--    - display_name: "모험가1234" 자리표시자 (P3-12와 같은 형식). nickname은 온보딩(P3-11)에서 본인이 확정
--    - avatar_url: provider 프로필 사진을 복사하지 않음 (§2.6 "프로필 사진 비노출", 캐릭터 아바타 사용)
--    - 온보딩의 닉네임 기본 제안값은 클라이언트가 세션의 identity_data를 정규화해서 만든다
--      (spikes/p0-04-kakao/src/normalizeProviderMetadata.ts). DB에는 저장하지 않는다.
-- 3. 이메일 없는 계정 OK: NEW.email 을 전혀 참조하지 않음 (Kakao 비즈앱 미전환, Q12)
-- 4. SET search_path = '' + 모든 객체 스키마 명시 (B24)
-- 5. last_login_provider / last_login_at: 가입 시 1회 + 로그인 때마다 갱신 (P3-08, B24)
--    GoTrue는 로그인 때마다 해당 identity의 identity_data(iss 포함)를 raw_user_meta_data에 덮어쓰고,
--    세션 발급 시 auth.users.last_sign_in_at 을 갱신한다 → 그 UPDATE 에 트리거를 건다.
--    (supabase/auth@004f767 api/external.go AccountExists → UpdateUserMetaData, models/user.go UpdateLastSignInAt)
--
-- 전제: 00001 + 00002 적용된 DB, Supabase Auth(GoTrue) v2.19x
-- ============================================================

-- ------------------------------------------------------------
-- 0. 선행 컬럼 (Phase 3 마이그레이션에서 정식 추가. §2.2 users 확장)
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nickname TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_provider TEXT;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_last_login_provider_check
    CHECK (last_login_provider IS NULL OR last_login_provider IN ('google', 'kakao', 'naver'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.users.nickname IS
  '공개 닉네임. 온보딩(P3-11)에서 본인이 확정한 값만 저장. 트리거·provider 메타데이터로 채우지 않음';
COMMENT ON COLUMN public.users.last_login_provider IS
  '최근 로그인 provider (google|kakao|naver). UI 힌트용 (P3-08). 인가 판단에 쓰지 않음';

-- ------------------------------------------------------------
-- 1. 보조 함수
-- ------------------------------------------------------------

-- provider 이름 → 3종. provider 가 비어 있으면 issuer 로 판별
--   google: https://accounts.google.com
--   kakao : https://kapi.kakao.com (내장 OAuth) / https://kauth.kakao.com (OIDC: custom:kakao, id_token)
--   naver : https://nid.naver.com (custom:naver, P0-03)
CREATE OR REPLACE FUNCTION public.pyroad_social_provider(p_provider TEXT, p_iss TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(btrim(p_provider)) = 'google' THEN 'google'
    WHEN lower(btrim(p_provider)) IN ('kakao', 'custom:kakao') THEN 'kakao'
    WHEN lower(btrim(p_provider)) IN ('naver', 'custom:naver') THEN 'naver'
    WHEN p_iss = 'https://accounts.google.com' THEN 'google'
    WHEN p_iss IN ('https://kapi.kakao.com', 'https://kauth.kakao.com') THEN 'kakao'
    WHEN p_iss = 'https://nid.naver.com' THEN 'naver'
    ELSE NULL
  END
$$;

-- 온보딩 전 표시용 자리표시자 "모험가0000~9999" (user id 기반이라 재실행해도 같은 값)
CREATE OR REPLACE FUNCTION public.pyroad_placeholder_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '모험가' || lpad((abs(pg_catalog.hashtextextended(p_user_id::text, 0)) % 10000)::text, 4, '0')
$$;

-- ------------------------------------------------------------
-- 2. 가입 트리거 (AFTER INSERT ON auth.users)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url, nickname, last_login_provider, last_login_at)
  VALUES (
    NEW.id,
    public.pyroad_placeholder_name(NEW.id),   -- 실명(full_name/name)·provider 닉네임 복사 금지
    '',                                       -- provider 프로필 사진 복사 금지
    NULL,                                     -- 온보딩에서 본인이 확정
    public.pyroad_social_provider(
      NEW.raw_app_meta_data ->> 'provider',
      NEW.raw_user_meta_data ->> 'iss'
    ),
    COALESCE(NEW.last_sign_in_at, pg_catalog.now())
  )
  ON CONFLICT (id) DO NOTHING;               -- 서버 브릿지가 먼저 만든 경우 등 재실행 안전
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 3. 로그인 트리거 (AFTER UPDATE OF last_sign_in_at ON auth.users)
--    - last_login_at 갱신 (B24)
--    - last_login_provider = 이번 로그인 identity 의 iss (P3-08)
--      raw_user_meta_data.iss 는 사용자가 updateUser({ data }) 로 바꿀 수 있으므로 UI 힌트로만 사용
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_signed_in()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL
     AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.users
       SET last_login_at = NEW.last_sign_in_at,
           last_login_provider = COALESCE(
             public.pyroad_social_provider(NULL, NEW.raw_user_meta_data ->> 'iss'),
             last_login_provider
           )
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_signed_in();

-- ------------------------------------------------------------
-- 4. 권한: public 스키마 함수는 PostgREST RPC 로 노출되므로 실행 권한 회수
--    (트리거는 함수 소유자 권한으로 실행되므로 영향 없음. e2e 에서 GoTrue(supabase_auth_admin) INSERT 로 확인)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_signed_in() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pyroad_social_provider(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pyroad_placeholder_name(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 5. 기존 사용자 (참고, 이 초안에서는 실행하지 않음 → P3-12/P3-13)
--   UPDATE public.users u
--      SET last_login_provider = public.pyroad_social_provider(a.raw_app_meta_data ->> 'provider', a.raw_user_meta_data ->> 'iss')
--     FROM auth.users a WHERE a.id = u.id AND u.last_login_provider IS NULL;
--   display_name 에 들어 있는 Google 실명은 P3-13 에서 자리표시자로 교체하고, 공개 뷰는 nickname 만 노출
-- ------------------------------------------------------------
