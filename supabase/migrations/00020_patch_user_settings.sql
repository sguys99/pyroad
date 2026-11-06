-- ============================================================
-- 사용자 설정 원자적 갱신 RPC patch_user_settings   (P2-14, P2-15 이월)
-- 릴리즈 단계: ① 추가형 (지금 운영 중인 이전 앱은 이 함수를 쓰지 않으므로 그대로 동작함)
--
-- 배경: P2-15 의 PATCH /api/settings 는 users.settings 를 service_role 로 읽고 → 앱에서 합치고 → 통째로 씁니다.
--   P2-14 에서 settings.sound 가 생겨 같은 사용자가 움직임(motion)과 사운드(sound)를 연달아 바꾸면(설정 화면에서 두 절을
--   빠르게 바꾸거나, 설정 화면과 HUD 음소거를 거의 동시에) 두 요청이 같은 옛 값을 읽어 한쪽 변경이 사라질 수 있습니다
--   (lost update). 이 함수는 `settings = settings || p_patch` 한 문장으로 바꿔서, 행 잠금 뒤 최신 값에 합칩니다
--   (READ COMMITTED 의 UPDATE 는 기다린 뒤 최신 행으로 식을 다시 계산함).
--
-- 하는 일
--   1. patch_user_settings(p_user_id, p_patch)  (SECURITY INVOKER, service_role 전용)
--        p_patch 의 최상위 키는 'motion'·'sound' 만, 값은 객체만. 키마다 통째로 바꿈(앱은 항상 키 전체를 보냄).
--        값의 모양은 API 가 zod strict 로 검사함(src/lib/motion/schema.ts, src/lib/sound/schema.ts). 크기는 users_settings_shape
--        CHECK(4KB, 00012)가 막음. 반환: 행을 바꿨는지(사용자 행이 없으면 false)
--        SECURITY DEFINER 가 아니라 INVOKER 입니다: 부르는 쪽이 service_role 이라 권한이 이미 있고, 실수로 EXECUTE 가 열려도
--        authenticated 는 users.settings 를 UPDATE 할 권한이 없어(00008) 아무것도 바꿀 수 없습니다.
--   2. 자기 검증: anon/authenticated 가 실행할 수 없음, service_role 은 실행 가능
--
-- 클라이언트 쓰기 권한은 열지 않습니다(00008 그대로). 앱: src/app/api/settings/route.ts
-- 운영 적용 순서 (Phase 2 릴리즈, v0.5 런북): ① 이 파일 → 새 앱 배포. 새 앱은 이 함수가 없으면 설정 저장만 실패(500)하고
--   기기에는 바뀐 값이 남습니다(화면은 막히지 않음)
--   적용 후 NOTICE `[00020] patch_user_settings: anon/authenticated 실행 불가` 확인
-- 되돌리기: supabase/rollback/00020_patch_user_settings.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. patch_user_settings
--   오류 (message): invalid_arguments(PT400) · invalid_settings_key(PT400)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.patch_user_settings(
  p_user_id UUID,
  p_patch   JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_patch) AS e(key, value)
     WHERE e.key NOT IN ('motion', 'sound') OR jsonb_typeof(e.value) <> 'object'
  ) THEN
    RAISE EXCEPTION 'invalid_settings_key' USING ERRCODE = 'PT400';
  END IF;

  UPDATE public.users AS u
     SET settings = u.settings || p_patch
   WHERE u.id = p_user_id;
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.patch_user_settings(UUID, JSONB) IS
  '사용자 설정 원자적 갱신 (P2-14). settings || p_patch, 키는 motion·sound 만. service_role 전용: /api/settings';

REVOKE ALL ON FUNCTION public.patch_user_settings(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.patch_user_settings(UUID, JSONB) TO service_role;

-- ------------------------------------------------------------
-- 2. 자기 검증
-- ------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.patch_user_settings(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.patch_user_settings(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00020] anon/authenticated 가 patch_user_settings 를 실행할 수 있음';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.patch_user_settings(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '[00020] service_role 이 patch_user_settings 를 실행할 수 없음';
  END IF;
  RAISE NOTICE '[00020] patch_user_settings: anon/authenticated 실행 불가';
END $$;
