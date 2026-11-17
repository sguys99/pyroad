-- ============================================================
-- 학생 세션이 직접 쓰는 열의 크기 상한: 진행 자동 저장·선호 provider (Idempotent)   (B108, P12-05)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱이 그대로 동작)
--
-- 배경
--   진행 자동 저장은 브라우저가 PostgREST 로 user_progress 에 직접 씁니다(00011 컬럼 권한: code_submitted·current_step·
--   step_submissions). 길이 상한이 없어서 로그인한 학생이 POST /rest/v1/user_progress 로 한 행에 수십 MB 를 넣을 수 있었습니다
--   (P12-05 로컬 실측: 50MB 한 행 저장됨). 퀘스트 수만큼 행이 있으니 계정 하나로 GB 단위 → 운영 DB 디스크·백업을
--   채우는 비용·서비스 거부. users.preferred_provider(00008 UPDATE 컬럼 권한)도 같음(행 하나).
--
-- 하는 일 (모두 CHECK, 앱이 쓰는 값보다 넉넉함 → 이전·새 앱 모두 통과)
--   user_progress_code_submitted_size     char_length(code_submitted) <= 50,000  (완료 API 상한 20,000자의 2.5배)
--   user_progress_step_submissions_size   octet_length(step_submissions::text) <= 524,288 (프로젝트 단계별 코드, 512KB)
--   users_preferred_provider_size         char_length(preferred_provider) <= 32   (값은 anthropic·openai·gemini)
--   운영에 이미 넘는 행이 있으면 그 제약만 NOT VALID 로 추가하고(새 INSERT·UPDATE 만 검사) NOTICE 로 알림 (00014 과 같은 방식)
--   → 행을 정리한 뒤 ALTER TABLE … VALIDATE CONSTRAINT.
--
-- 확인: supabase/tests B108-1~3
-- 되돌리기: supabase/rollback/00060_client_write_size_limits.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00060] 크기 CHECK 3개 (모두 VALID)` 확인
-- ============================================================

DO $$
DECLARE
  v_code  INTEGER;
  v_steps INTEGER;
  v_pref  INTEGER;
BEGIN
  SELECT count(*) FILTER (WHERE char_length(code_submitted) > 50000),
         count(*) FILTER (WHERE octet_length(step_submissions::text) > 524288)
    INTO v_code, v_steps
    FROM public.user_progress;
  SELECT count(*) FILTER (WHERE char_length(preferred_provider) > 32)
    INTO v_pref
    FROM public.users;

  ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_code_submitted_size;
  ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_step_submissions_size;
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_preferred_provider_size;

  EXECUTE 'ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_code_submitted_size'
       || ' CHECK (char_length(code_submitted) <= 50000)'
       || CASE WHEN v_code > 0 THEN ' NOT VALID' ELSE '' END;
  EXECUTE 'ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_step_submissions_size'
       || ' CHECK (octet_length(step_submissions::text) <= 524288)'
       || CASE WHEN v_steps > 0 THEN ' NOT VALID' ELSE '' END;
  EXECUTE 'ALTER TABLE public.users ADD CONSTRAINT users_preferred_provider_size'
       || ' CHECK (char_length(preferred_provider) <= 32)'
       || CASE WHEN v_pref > 0 THEN ' NOT VALID' ELSE '' END;

  IF v_code + v_steps + v_pref > 0 THEN
    RAISE NOTICE '[00060] ⚠️ 이미 상한을 넘는 행: 코드 % · 단계 코드 % · provider % → 해당 CHECK 는 NOT VALID (새 쓰기만 검사). 정리 후 VALIDATE',
      v_code, v_steps, v_pref;
  ELSE
    RAISE NOTICE '[00060] 크기 CHECK 3개 (모두 VALID)';
  END IF;
END $$;

-- 자기 검증: 세 제약이 있어야 함
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_constraint
       WHERE conname IN ('user_progress_code_submitted_size', 'user_progress_step_submissions_size',
                         'users_preferred_provider_size')) <> 3 THEN
    RAISE EXCEPTION '[00060] 크기 CHECK 가 3개가 아님';
  END IF;
END $$;
