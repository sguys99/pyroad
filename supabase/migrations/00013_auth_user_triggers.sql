-- ============================================================
-- 가입·로그인 트리거 정리: search_path 고정 · 실행 권한 회수 · last_login_* 갱신 · provider 이름 복사 중단 (Idempotent)
--                                                                         (B24, B16, B34 · P3-06 의 DB 부분)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포·동작 확인 뒤에 적용)
--
-- 배경
--   - B24: handle_new_user(SECURITY DEFINER)와 prevent_status_downgrade 에 search_path 가 없고(Advisors
--     function_search_path_mutable), handle_new_user 를 anon·authenticated 가 EXECUTE 할 수 있음
--     (anon/authenticated_security_definer_function_executable. 트리거 함수라 /rpc 호출은 실패하지만 권한은 회수).
--     users.last_login_at 은 가입 때 값에서 바뀌지 않음.
--   - B16 잔여(§2.8 공개 정보): handle_new_user 가 provider 가 준 full_name·name(Google 실명, Kakao 닉네임)과
--     프로필 사진을 공개 필드 display_name·avatar_url 에 복사함. 게시판(user_profiles_public)으로 다른 사용자에게 보임.
--   출발점: spikes/p0-04-kakao/handle_new_user.draft.sql (P0-04 에서 GoTrue 실제 가입·로그인으로 검증)
--
-- 하는 일
--   1. 보조 함수 (service_role 만 실행)
--        social_login_provider(provider, iss)  app_metadata.provider / user_metadata.iss → google | kakao | naver | NULL
--        placeholder_display_name(user_id)     온보딩 전 표시 이름 "모험가0000"~"모험가9999" (user id 해시, 다시 계산해도 같음)
--   2. handle_new_user 재작성 (SET search_path = '', 이메일 미참조)
--        display_name = 자리표시자, avatar_url = '' (provider 이름·닉네임·사진을 복사하지 않음)
--        nickname 은 NULL (온보딩 P3-11 에서 본인이 정함), last_login_provider·last_login_at 은 가입한 identity 기준
--        ⚠️ 기존 사용자 행(운영 Google 사용자의 실명 display_name·사진)은 바꾸지 않습니다 → P3-12·P3-13
--   3. 로그인 트리거 handle_user_signed_in (AFTER UPDATE OF last_sign_in_at ON auth.users)
--        last_login_at = 새 last_sign_in_at,
--        last_login_provider = 이번 로그인 identity 의 user_metadata.iss 로 판별 (모르는 값이면 그대로)
--          GoTrue 는 로그인할 때마다 그 identity 의 데이터를 raw_user_meta_data 에 병합하고 세션 발급 때 last_sign_in_at 을
--          갱신합니다(P0-04 실측 S10). app_metadata.provider 는 처음 연결한 identity 로 고정이라 쓰지 않습니다(§2.2).
--          iss 는 사용자가 updateUser({ data }) 로 바꿀 수 있으므로 UI 힌트로만 씁니다(인가 판단 금지).
--   4. prevent_status_downgrade: SET search_path = '' (본문은 NEW/OLD 만 써서 바뀌는 동작 없음)
--   5. 실행 권한: 트리거 함수 4개(handle_new_user·handle_user_signed_in·prevent_status_downgrade) 와 보조 함수의
--      EXECUTE 를 PUBLIC·anon·authenticated 에서 회수. 트리거는 실행 권한과 상관없이 동작합니다
--      (GoTrue 의 supabase_auth_admin INSERT·UPDATE, 사용자의 user_progress UPDATE 모두. 회귀 B24-1·2·3, APP-W1·W2)
--   6. 기존 사용자의 last_login_at·last_login_provider 를 auth.users 값으로 한 번 맞춤 (공개 필드가 아니라 B16 과 무관)
--   7. 자기 검증
--
-- 왜 ③ 인가: 기존 함수의 EXECUTE 회수(5)가 들어 있어 ① 추가형과 섞지 않음(supabase/README.md "릴리즈 단계").
--   새 앱은 이 파일의 결과(자리표시자 이름·last_login_*)에 기대지 않으므로 ① 만 적용된 DB 에서도 동작합니다.
--   이전 앱으로 되돌려도 영향 없음(트리거는 DB 안에서만 동작).
-- 적용 후 NOTICE `[00013] handle_new_user·handle_user_signed_in·prevent_status_downgrade: search_path 고정, anon/authenticated 실행 불가, last_login 백필 N` 확인
-- 확인: 새로 가입한 계정의 display_name 이 "모험가NNNN", 다시 로그인하면 users.last_login_at 이 auth.users.last_sign_in_at 과 같음
--       (docs/release/v0.4-runbook.md "00013 확인"), supabase/tests ST-3·ST-4·ST-6·B24-*·B16-*
-- 되돌리기: supabase/rollback/00013_auth_user_triggers.rollback.sql (00001 의 handle_new_user 로)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. 보조 함수
-- ------------------------------------------------------------

-- provider → google | kakao | naver. provider 로 모르면 issuer 로 판별 (P0-03·P0-04)
--   google: https://accounts.google.com
--   kakao : https://kapi.kakao.com (내장 kakao) / https://kauth.kakao.com (OIDC custom:kakao)
--   naver : https://nid.naver.com (custom:naver)
CREATE OR REPLACE FUNCTION public.social_login_provider(p_provider TEXT, p_iss TEXT)
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

COMMENT ON FUNCTION public.social_login_provider(TEXT, TEXT) IS
  'provider 이름·issuer → google | kakao | naver | NULL (B24, P3-06·P3-08)';

-- 온보딩(P3-11) 전 표시 이름. 닉네임을 정하기 전까지 게시판 등에 보이는 값 (P3-12 와 같은 형식)
CREATE OR REPLACE FUNCTION public.placeholder_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT '모험가' || lpad((abs(pg_catalog.hashtextextended(p_user_id::text, 0)) % 10000)::text, 4, '0')
$$;

COMMENT ON FUNCTION public.placeholder_display_name(UUID) IS
  '온보딩 전 표시 이름 "모험가0000"~"모험가9999" (user id 해시, B16·P3-12). 유일하지 않음 (표시용)';

-- ------------------------------------------------------------
-- 2. 가입 트리거 (AFTER INSERT ON auth.users)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url, last_login_provider, last_login_at)
  VALUES (
    NEW.id,
    public.placeholder_display_name(NEW.id),  -- 실명(full_name·name)·provider 닉네임을 복사하지 않음 (§2.8)
    '',                                       -- provider 프로필 사진을 복사하지 않음 (§2.6)
    public.social_login_provider(NEW.raw_app_meta_data ->> 'provider', NEW.raw_user_meta_data ->> 'iss'),
    COALESCE(NEW.last_sign_in_at, pg_catalog.now())
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'auth.users 가입 → public.users 행 (B16·B24). display_name 은 자리표시자, provider 이름·사진은 복사하지 않음';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 3. 로그인 트리거 (AFTER UPDATE OF last_sign_in_at ON auth.users)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_signed_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL
     AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.users
       SET last_login_at       = NEW.last_sign_in_at,
           last_login_provider = COALESCE(
             public.social_login_provider(NULL, NEW.raw_user_meta_data ->> 'iss'),
             last_login_provider)
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_signed_in() IS
  '로그인(auth.users.last_sign_in_at 갱신) → users.last_login_at·last_login_provider (B24, P3-08). provider 는 user_metadata.iss 로 판별';

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_signed_in();

-- ------------------------------------------------------------
-- 4. prevent_status_downgrade (00001): 본문은 그대로, search_path 만 고정
-- ------------------------------------------------------------
ALTER FUNCTION public.prevent_status_downgrade() SET search_path = '';

-- ------------------------------------------------------------
-- 5. 실행 권한 (트리거 함수는 아무도 직접 부르지 않음. 보조 함수는 service_role 만)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_signed_in() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_status_downgrade() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.social_login_provider(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.placeholder_display_name(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_login_provider(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.placeholder_display_name(UUID) TO service_role;

-- ------------------------------------------------------------
-- 6. 기존 사용자의 마지막 로그인 (가입 시각에 멈춰 있던 값을 auth.users 와 맞춤. 다시 실행해도 안전)
--    last_login_provider 는 비어 있을 때만: 지금까지 로그인 이력의 identity 를 알 수 없으므로 iss → 첫 identity 순서로 추정
--    (운영 identity 는 Google 뿐, 2026-11-04). display_name·avatar_url 은 바꾸지 않음 (P3-12·P3-13)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.users u
     SET last_login_at = GREATEST(u.last_login_at, COALESCE(a.last_sign_in_at, u.last_login_at)),
         last_login_provider = COALESCE(
           u.last_login_provider,
           public.social_login_provider(NULL, a.raw_user_meta_data ->> 'iss'),
           public.social_login_provider(a.raw_app_meta_data ->> 'provider', NULL))
    FROM auth.users a
   WHERE a.id = u.id
     AND (a.last_sign_in_at > u.last_login_at
          OR (u.last_login_provider IS NULL
              AND COALESCE(public.social_login_provider(NULL, a.raw_user_meta_data ->> 'iss'),
                           public.social_login_provider(a.raw_app_meta_data ->> 'provider', NULL)) IS NOT NULL));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE '[00013] last_login 백필 %행', v_rows;
END $$;

-- ------------------------------------------------------------
-- 7. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_exec    TEXT;
  v_no_path TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_exec
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('handle_new_user', 'handle_user_signed_in', 'prevent_status_downgrade',
                       'social_login_provider', 'placeholder_display_name')
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  IF v_exec IS NOT NULL THEN
    RAISE EXCEPTION '[00013] anon/authenticated 가 실행할 수 있는 함수: %', v_exec;
  END IF;

  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_no_path
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('handle_new_user', 'handle_user_signed_in', 'prevent_status_downgrade',
                       'social_login_provider', 'placeholder_display_name')
     AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) c WHERE c = 'search_path=""');
  IF v_no_path IS NOT NULL THEN
    RAISE EXCEPTION '[00013] search_path 가 고정되지 않은 함수: %', v_no_path;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_signed_in')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created') THEN
    RAISE EXCEPTION '[00013] auth.users 트리거가 없음';
  END IF;

  RAISE NOTICE '[00013] handle_new_user·handle_user_signed_in·prevent_status_downgrade: search_path 고정, anon/authenticated 실행 불가';
END $$;
