-- ============================================================
-- 사용자 API 키를 service_role 전용 테이블로 분리 (Idempotent)              (B13, P1-01)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 이 테이블을 모르고 users.custom_api_keys 를 그대로 씀)
--
-- 배경: users.custom_api_keys 에 사용자가 등록한 LLM API 키가 평문으로 있고, 본인 브라우저에서
--   GET /rest/v1/users?select=custom_api_keys 로 조회됩니다(B13, 회귀 B04-8). 결정(§12-Q24): 서버 env
--   API_KEY_ENCRYPTION_KEY(32바이트) + Node crypto AES-256-GCM 으로 암호화해 이 테이블에만 저장합니다.
--   암호화 키는 DB 가 모르므로 기존 평문 키는 SQL 로 옮기지 않습니다. 새 앱이 서버에서 옮깁니다:
--     - 그 사용자의 키를 처음 읽을 때(월드맵·설정·튜터) 암호화해 이 테이블에 넣고 users.custom_api_keys 를 비움
--       (src/lib/tutor/legacyApiKeys.ts)
--     - 남은 사용자는 ③ 전에 일회성 스크립트로: scripts/api-keys/migrate-legacy.ts (docs/release/v0.4-runbook.md)
--   ③ 00009 가 users.custom_api_keys 컬럼을 지웁니다(평문이 남아 있으면 거부).
--
-- 테이블 권한: RLS ON + 정책 없음 + anon·authenticated 권한 없음 → service_role 전용 (quest_answer_keys 와 같은 방식).
--   운영(legacy 기본값)은 새 테이블을 만들자마자 anon 에게 ALL 을 주므로 같은 파일에서 바로 회수합니다.
--
-- 적용 후 NOTICE `[00007] user_api_keys 행 0, users.custom_api_keys 평문 키가 있는 사용자 N` 확인
--   (N 은 런북 ⓪의 읽기 전용 확인 쿼리 값과 같아야 함)
-- 되돌리기: supabase/rollback/00007_user_api_keys.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'gemini')),
  -- 암호화 키 버전 (키 교체 대비, src/lib/crypto/apiKeyCipher.ts)
  key_version SMALLINT NOT NULL CHECK (key_version > 0),
  -- base64. AES-256-GCM, IV 12바이트, 태그 16바이트, AAD = user_id·provider
  iv          TEXT NOT NULL CHECK (iv <> ''),
  auth_tag    TEXT NOT NULL CHECK (auth_tag <> ''),
  ciphertext  TEXT NOT NULL CHECK (ciphertext <> ''),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

COMMENT ON TABLE public.user_api_keys IS
  '사용자 LLM API 키 (AES-256-GCM 암호문만). service_role 전용 — RLS ON, 정책 없음 (B13)';

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_api_keys TO service_role;

-- 자기 검증: 클라이언트 역할 권한이 없음 + 이관 대상 수 기록
DO $$
DECLARE
  v_rows   INT;
  v_legacy INT := 0;
BEGIN
  IF has_table_privilege('anon', 'public.user_api_keys', 'SELECT, INSERT, UPDATE, DELETE')
     OR has_table_privilege('authenticated', 'public.user_api_keys', 'SELECT, INSERT, UPDATE, DELETE') THEN
    RAISE EXCEPTION '[00007] anon/authenticated 에 user_api_keys 권한이 남아 있음';
  END IF;

  SELECT count(*) INTO v_rows FROM public.user_api_keys;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'custom_api_keys') THEN
    EXECUTE $q$SELECT count(*) FROM public.users
                WHERE custom_api_keys IS NOT NULL AND custom_api_keys <> '{}'::jsonb$q$
      INTO v_legacy;
  END IF;
  RAISE NOTICE '[00007] user_api_keys 행 %, users.custom_api_keys 평문 키가 있는 사용자 %', v_rows, v_legacy;
END $$;
