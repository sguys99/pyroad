-- ============================================================
-- 기존 사용자 users.display_name 실명·users.avatar_url 프로필 사진 지우기 (Idempotent)   (P3-13, B16 잔여, §2.6)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포·동작 확인 뒤에 적용. ⚠️ 되돌릴 수 없는 데이터 삭제)
--
-- 배경
--   - 00001 의 옛 가입 트리거가 provider 가 준 이름(Google 실명 full_name·name)과 프로필 사진 URL 을 users.display_name·
--     avatar_url 에 복사했습니다. 00013(B24)부터 새 가입자는 "모험가NNNN"·'' 로 들어가지만 기존 행은 그대로이고,
--     다른 사람에게는 00014·00018 뷰가 막지만 본인 화면(이전 앱의 월드맵·프로필)과 DB 에는 실명·사진 URL 이 남아 있습니다.
--     §2.6: 공개 정보는 닉네임 + 캐릭터 아바타뿐이고 실명·사진은 보관할 이유가 없음 (최소 수집)
--
-- 하는 일
--   1. 모든 users 행: display_name = placeholder_display_name(id) ("모험가NNNN", 00013), avatar_url = '' (00013 가입 트리거와 같은 값)
--      닉네임은 건드리지 않음 (화면 이름은 닉네임 → 없으면 같은 자리표시자, user_public_profiles.public_name)
--   2. 자기 검증: 자리표시자가 아닌 display_name·빈 값이 아닌 avatar_url 이 0
--
-- 왜 ③ 인가
--   - 되돌릴 수 없는 삭제라 새 앱이 배포되어 이 컬럼들을 읽지 않는 것을 확인한 뒤에만 실행합니다. 새 앱(P3-13)은 users.display_name·
--     avatar_url 을 화면에 쓰지 않고 user_public_profiles(public_name·avatar_skin, ① 00021)를 읽으므로 이 파일과 무관하게 동작합니다.
--   - 이전 앱으로 되돌려도 깨지지 않습니다: 이전 앱의 월드맵·프로필은 display_name 을 그대로 보여 주고(→ "모험가NNNN"),
--     avatar_url 이 빈 값이면 파이뱀 그림을 그립니다(값이 없을 때의 기존 분기).
--   - placeholder_display_name 은 ③ 00013 이 만든 함수라 ③ 에 둡니다(운영 적용 순서 ①들 → ③들에서 00013 뒤).
-- 되돌리기: 없음. supabase/rollback/00022_clear_legacy_real_names.rollback.sql 은 설명만 담았습니다(지운 이름·사진 URL 은
--   DB 어디에도 남지 않음. 필요하면 적용 전에 운영 백업/PITR 시점을 기록해 둠)
-- 참고: auth.users.raw_user_meta_data 의 provider 원본(full_name·picture)은 GoTrue 가 로그인마다 다시 쓰는 auth 스키마 값이라
--   여기서 지우지 않습니다(앱은 읽지 않음, P3-06 normalizeProviderMetadata 는 온보딩 제안값만 만들고 저장하지 않음).
-- 확인: supabase/tests NM-1 (실명·사진이 남은 행 0), docs/release/v0.4-runbook.md "Phase 3 병합 → 00022 확인"
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00022] users N행: 이름 바꿈 A, 사진 지움 B (남은 실명·사진 0)` 확인
-- ============================================================

DO $$
DECLARE
  v_users   INTEGER;
  v_names   INTEGER;
  v_photos  INTEGER;
  v_left    INTEGER;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE display_name IS DISTINCT FROM public.placeholder_display_name(id)),
         count(*) FILTER (WHERE coalesce(avatar_url, '') <> '')
    INTO v_users, v_names, v_photos
    FROM public.users;

  UPDATE public.users
     SET display_name = public.placeholder_display_name(id),
         avatar_url   = ''
   WHERE display_name IS DISTINCT FROM public.placeholder_display_name(id)
      OR avatar_url IS DISTINCT FROM '';

  SELECT count(*) INTO v_left
    FROM public.users
   WHERE display_name IS DISTINCT FROM public.placeholder_display_name(id)
      OR avatar_url IS DISTINCT FROM '';
  IF v_left > 0 THEN
    RAISE EXCEPTION '[00022] 실명·사진이 남은 행 %', v_left;
  END IF;

  RAISE NOTICE '[00022] users %행: 이름 바꿈 %, 사진 지움 % (남은 실명·사진 0)', v_users, v_names, v_photos;
END $$;
