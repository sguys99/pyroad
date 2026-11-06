-- ============================================================
-- 첫 로그인 온보딩: 완료 시각·약관 동의 기록·한 번에 저장하는 RPC (Idempotent)   (P3-11)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 새 컬럼·테이블·함수를 쓰지 않으므로 그대로 동작)
--
-- 배경
--   - 첫 로그인 온보딩(약관 동의 → 닉네임 → 파이뱀 색 → (선택) 학년 → 30초 튜토리얼)을 마친 아이만 앱 화면으로 보냄.
--     끝냈는지 = users.onboarded_at (NULL = 아직). 로그인 레이아웃이 이미 읽는 users 조회에 한 열만 더함 (요청마다 추가 조회 없음)
--   - 이용약관·개인정보처리방침 동의는 "일시·항목·버전·방법"을 남겨야 함 (P3-14 문서 버전, P3-15 보호자 동의도 같은 표에 기록)
--   - 닉네임은 금칙어까지 서버가 다시 검사해야 하므로(src/lib/profile/nickname.ts) 클라이언트 UPDATE 권한을 열지 않고
--     /api/onboarding 이 검사한 뒤 service_role 로 이 함수를 부름. 닉네임·스킨·학년·완료 시각·동의 기록을 **한 트랜잭션**에 씀
--     (닉네임 중복 23505 면 동의 기록도 남지 않음)
--
-- 하는 일
--   1. users.onboarded_at TIMESTAMPTZ (NULL = 온보딩 전). 기존 사용자도 NULL → 다음 로그인 때 온보딩으로 (P3-12 가 기존 사용자 흐름을 다듬음)
--      권한은 바꾸지 않음: SELECT 는 표 권한을 따르고, authenticated 의 UPDATE 는 ③ 00008 의 (preferred_provider) 그대로
--   2. user_agreements: (user_id, item, version) 마다 1행. agreed_at(서버 시각)·method(누가 어떻게 동의했는지)
--      - item·version 은 src/lib/legal/agreements.ts 의 AGREEMENT_ITEMS id·version (TERMS_VERSION·PRIVACY_VERSION)
--      - method: 'self'(본인이 온보딩 화면에서). P3-15 가 'guardian_*' 를 더함 (형식만 CHECK, 값 목록은 앱이 정함)
--      - 같은 버전 동의를 다시 받아도 처음 시각을 남김 (ON CONFLICT DO NOTHING). 새 버전은 새 행
--      - service_role 전용 (RLS ON + 정책 없음 + anon·authenticated 권한 없음): 법적 기록이라 클라이언트가 지우거나 바꾸면 안 됨,
--        화면에서 읽을 일도 없음. 탈퇴하면 users 와 함께 지워짐 (ON DELETE CASCADE, B28)
--   3. complete_onboarding(p_user_id, p_nickname, p_skin, p_grade, p_agreements, p_method) → jsonb  (SECURITY INVOKER, service_role 전용)
--      - users.nickname·grade·avatar_config.skin(다른 키는 그대로 두고 합침)·onboarded_at(처음 값 유지) + user_agreements 를 한 번에
--      - 값 검사는 API 가 먼저 함(닉네임 규칙·금칙어, 스킨 id, 학년, 필수 동의·현재 버전). 여기서는 모양만 다시 봄(형식 CHECK·DB CHECK 가 마지막 방어)
--      - 닉네임 중복은 users_nickname_lower_key(00012) 의 23505 가 그대로 올라감 → API 가 409 로 바꿈
--      - SECURITY DEFINER 가 아님: 부르는 쪽이 service_role 이라 권한이 이미 있고, 실수로 EXECUTE 가 열려도 authenticated 는
--        users.nickname 을 UPDATE 하거나 user_agreements 에 INSERT 할 권한이 없음 (00020 patch_user_settings 와 같은 방식)
--   4. is_nickname_taken(p_nickname, p_user_id) → boolean (service_role 전용): 입력 중 중복 확인. lower() 비교라 유일 인덱스를 씀
--   5. 자기 검증: 테이블·함수에 anon·authenticated 가 접근할 수 없음
--
-- 왜 ① 인가: 새 컬럼·새 테이블·새 함수뿐이고 기존 권한을 좁히거나 ③ 파일이 처음 만든 함수를 바꾸지 않음. users 에 GRANT 도 없음
--   (GRANT 를 ① 에 두면 운영에서 나중에 적용되는 ③ 00008 의 REVOKE 가 지움 — 그래서 클라이언트 쓰기 대신 서버 경유)
-- 앱: src/app/api/onboarding/route.ts (쓰기), src/app/api/profile/nickname/route.ts (중복 확인, 읽기만),
--     src/app/(protected)/layout.tsx (onboarded_at 이 NULL 이면 /onboarding 으로)
-- 확인: supabase/tests OB-1~6, APP-15
-- 되돌리기: supabase/rollback/00023_onboarding.rollback.sql (동의 기록이 지워지므로 백업 뒤에만)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00023] users.onboarded_at 추가 (온보딩 마친 사용자 N), user_agreements·complete_onboarding·is_nickname_taken: service_role 전용` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 온보딩 완료 시각
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.onboarded_at IS
  '첫 로그인 온보딩(약관 동의·닉네임·파이뱀 색·학년)을 마친 시각. NULL 이면 로그인 화면 대신 /onboarding (P3-11). complete_onboarding 으로만 씀';

-- ------------------------------------------------------------
-- 2. 약관 동의 기록
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_agreements (
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item      TEXT NOT NULL CONSTRAINT user_agreements_item_check CHECK (item ~ '^[a-z][a-z0-9_]{0,31}$'),
  version   TEXT NOT NULL CONSTRAINT user_agreements_version_check CHECK (version ~ '^[0-9A-Za-z._-]{1,32}$'),
  agreed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method    TEXT NOT NULL CONSTRAINT user_agreements_method_check CHECK (method ~ '^[a-z][a-z_]{0,31}$'),
  PRIMARY KEY (user_id, item, version)
);

COMMENT ON TABLE public.user_agreements IS
  '약관·개인정보 동의 기록 (P3-11, P3-15). (user_id, item, version) 1행, 처음 동의한 시각·방법. service_role 전용: complete_onboarding 으로만 씀';

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_agreements FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_agreements TO service_role;

-- ------------------------------------------------------------
-- 3. complete_onboarding
--   p_agreements: [{ "item": "terms", "version": "2026-11-06" }, …] (동의한 항목만, 1~16개)
--   반환: { onboarded_at, first }  first = 이번 호출로 처음 온보딩을 마쳤는지
--   오류 (message): invalid_arguments(PT400) · user_not_found(PT404) · 닉네임 중복 23505 · CHECK 위반 23514
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id    UUID,
  p_nickname   TEXT,
  p_skin       TEXT,
  p_grade      SMALLINT,
  p_agreements JSONB,
  p_method     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_before TIMESTAMPTZ;
  v_after  TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_nickname IS NULL OR p_skin IS NULL OR p_skin !~ '^[a-z]{1,16}$'
     OR (p_grade IS NOT NULL AND p_grade NOT BETWEEN 1 AND 6)
     OR p_method IS NULL OR p_method !~ '^[a-z][a-z_]{0,31}$'
     OR p_agreements IS NULL OR jsonb_typeof(p_agreements) <> 'array'
     OR jsonb_array_length(p_agreements) NOT BETWEEN 1 AND 16 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_agreements) AS a(v)
     WHERE jsonb_typeof(a.v) <> 'object'
        OR jsonb_typeof(a.v -> 'item') IS DISTINCT FROM 'string'
        OR jsonb_typeof(a.v -> 'version') IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.onboarded_at INTO v_before FROM public.users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  UPDATE public.users AS u
     SET nickname      = p_nickname,
         grade         = p_grade,
         avatar_config = u.avatar_config || jsonb_build_object('skin', p_skin),
         onboarded_at  = coalesce(u.onboarded_at, now())
   WHERE u.id = p_user_id
  RETURNING u.onboarded_at INTO v_after;

  INSERT INTO public.user_agreements (user_id, item, version, method)
  SELECT DISTINCT p_user_id, a.v ->> 'item', a.v ->> 'version', p_method
    FROM jsonb_array_elements(p_agreements) AS a(v)
  ON CONFLICT (user_id, item, version) DO NOTHING;

  RETURN jsonb_build_object('onboarded_at', v_after, 'first', v_before IS NULL);
END;
$$;

COMMENT ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT) IS
  '온보딩 저장 (P3-11): 닉네임·학년·스킨·완료 시각 + 약관 동의 기록을 한 트랜잭션에. service_role 전용: /api/onboarding (값 검사는 API)';

REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 4. is_nickname_taken: 닉네임 중복 확인 (온보딩 입력 중, /api/profile/nickname)
--   lower(nickname) 비교라 유일 인덱스 users_nickname_lower_key(00012)를 그대로 씀. 본인 행(p_user_id)은 빼고 셈
--   (이미 닉네임이 있는 기존 사용자가 같은 이름을 다시 고를 수 있게, P3-12). 반환: 다른 사용자가 쓰는지
--   다른 아이의 닉네임 목록을 훑을 수 없도록 service_role 전용 (API 가 사용자별 요청 한도를 걸고 부름)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_nickname_taken(
  p_nickname TEXT,
  p_user_id  UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u
     WHERE lower(u.nickname) = lower(p_nickname)
       AND u.id IS DISTINCT FROM p_user_id
  );
$$;

COMMENT ON FUNCTION public.is_nickname_taken(TEXT, UUID) IS
  '닉네임 중복 확인 (P3-11): lower(nickname) 이 같은 다른 사용자가 있는지. service_role 전용: /api/profile/nickname·/api/onboarding';

REVOKE ALL ON FUNCTION public.is_nickname_taken(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_nickname_taken(TEXT, UUID) TO service_role;

-- ------------------------------------------------------------
-- 5. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_done INTEGER;
BEGIN
  IF has_function_privilege('anon', 'public.complete_onboarding(uuid, text, text, smallint, jsonb, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.complete_onboarding(uuid, text, text, smallint, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00023] anon/authenticated 가 complete_onboarding 을 실행할 수 있음';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.complete_onboarding(uuid, text, text, smallint, jsonb, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00023] service_role 이 complete_onboarding 을 실행할 수 없음';
  END IF;
  IF has_function_privilege('anon', 'public.is_nickname_taken(text, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_nickname_taken(text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00023] anon/authenticated 가 is_nickname_taken 을 실행할 수 있음';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.is_nickname_taken(text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00023] service_role 이 is_nickname_taken 을 실행할 수 없음';
  END IF;
  IF has_table_privilege('anon', 'public.user_agreements', 'SELECT, INSERT, UPDATE, DELETE')
     OR has_table_privilege('authenticated', 'public.user_agreements', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION '[00023] anon/authenticated 가 user_agreements 에 접근할 수 있음';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_agreements'::regclass) THEN
    RAISE EXCEPTION '[00023] user_agreements RLS 가 꺼져 있음';
  END IF;
  SELECT count(*) INTO v_done FROM public.users WHERE onboarded_at IS NOT NULL;
  RAISE NOTICE '[00023] users.onboarded_at 추가 (온보딩 마친 사용자 %), user_agreements·complete_onboarding·is_nickname_taken: service_role 전용', v_done;
END $$;
