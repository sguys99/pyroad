-- ============================================================
-- users.custom_api_keys(평문 API 키) 컬럼 삭제 (Idempotent)                 (B13, P1-01)
-- 릴리즈 단계: ③ 권한 회수형 (새 앱 배포 + 평문 키 이관 확인 뒤에만 적용)
--
-- 전제
--   - ① 00007 적용 + 새 앱 배포: 앱은 user_api_keys(암호문, service_role 전용)만 쓰고, users.custom_api_keys 는
--     평문이 남은 사용자의 키를 암호화해 옮길 때만 읽음(src/lib/tutor/legacyApiKeys.ts). 컬럼이 없으면 이 경로는 건너뜀
--   - 평문 키 이관 완료: 아래 확인 쿼리가 0. 0 이 아니면 scripts/api-keys/migrate-legacy.ts 를 먼저 실행
--     (docs/release/v0.4-runbook.md ②). 이전 앱은 이 컬럼을 select 하므로 이 파일을 먼저 적용하면 월드맵·설정·튜터가 깨집니다.
--       SELECT count(*) FROM public.users WHERE custom_api_keys IS NOT NULL AND custom_api_keys <> '{}'::jsonb;
--
-- 하는 일
--   1. 자기 검증: 평문 키가 남은 사용자가 있으면 예외 → 전체 롤백 (키를 잃지 않게)
--   2. 컬럼 삭제. 브라우저에서 본인 키를 조회하던 경로(B04-8)가 사라짐
--
-- 확인: supabase/tests B04-8 (deny: 컬럼 없음)
-- 되돌리기: supabase/rollback/00009_drop_users_custom_api_keys.rollback.sql (빈 컬럼만 다시 만듦. 키는 user_api_keys 에 남음)
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

DO $$
DECLARE
  v_left INT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'custom_api_keys') THEN
    EXECUTE $q$SELECT count(*) FROM public.users
                WHERE custom_api_keys IS NOT NULL AND custom_api_keys <> '{}'::jsonb$q$
      INTO v_left;
    IF v_left > 0 THEN
      RAISE EXCEPTION '[00009] users.custom_api_keys 에 평문 키가 남은 사용자 % 명. 먼저 scripts/api-keys/migrate-legacy.ts 로 옮기세요 (런북 ②)', v_left;
    END IF;
  END IF;
END $$;

ALTER TABLE public.users DROP COLUMN IF EXISTS custom_api_keys;

DO $$
BEGIN
  RAISE NOTICE '[00009] users.custom_api_keys 삭제 완료, user_api_keys 행 %', (SELECT count(*) FROM public.user_api_keys);
END $$;
