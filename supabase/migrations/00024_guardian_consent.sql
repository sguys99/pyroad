-- ============================================================
-- 만 14세 미만 법정대리인 동의: 나이 확인 결과·동의 시각·파기 기한, 보호자 동의 기록 RPC, 미동의 계정 목록 (Idempotent)   (P3-15)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 새 컬럼·함수를 쓰지 않으므로 그대로 동작)
--
-- 배경 (§12-Q5 일반 공개 서비스 · Q35 동의 흐름은 지금, 발송은 Phase 12 · Q36 미동의 30일 파기)
--   - 온보딩(P3-11, 00023)의 약관 동의 다음에 나이 확인 → 만 14세 미만이면 "보호자와 함께 이 화면에서" 법정대리인 동의.
--     동의 전에는 제한 모드(학습만, 게시판 쓰기·신고 불가 — API 가 막음), 30일 안에 동의가 없으면 계정 파기(크론)
--   - 최소 수집: 태어난 해·달은 서버가 계산에만 쓰고 **저장하지 않는다**. 저장하는 것은 결과(age_band)와 확인 시각뿐
--
-- 하는 일
--   1. users 에 4열 (모두 NULL 허용, 클라이언트 UPDATE 권한 없음 — ③ 00008 그대로 preferred_provider 만)
--      age_band              'under14' | '14plus' (NULL = 아직 확인 전 → 앱은 만 14세 미만처럼 제한)
--      age_checked_at        나이를 확인한 시각 (처음 값 유지)
--      guardian_consented_at 법정대리인 동의를 마친 시각
--      consent_deadline      만 14세 미만 + 동의 전일 때 파기 기한 = 나이 확인 + 30일. 동의하면 NULL
--        ⚠️ 기존 사용자는 가입일이 아니라 **나이를 확인한 날**부터 30일 (배포 날 오래된 계정이 지워지지 않게, P3-12)
--   2. user_agreements.relation: 보호자와 아이의 관계 (선택, 'mother'·'father'·'other'). 보호자 이름·연락처는 받지 않음
--   3. complete_onboarding 다시 정의 (00023 의 6인자 → 9인자: + p_age_band, p_guardian_agreements, p_guardian_relation)
--      - age_band 는 한 번 정해지면 바꾸지 않음 (온보딩을 다시 불러 만 14세 이상으로 바꿔 제한을 피하지 못하게)
--      - 만 14세 미만 + 보호자 동의 기록이 함께 오면 동의 마침(기한 없음), 아니면 기한 = coalesce(기존 기한, now() + 30일)
--      - 보호자 동의 기록은 method 'guardian_in_person'(보호자가 아이와 함께 이 화면에서, Q35)
--   4. record_guardian_consent(p_user_id, p_agreements, p_relation, p_method) → jsonb: 나중에 동의 (/onboarding/guardian)
--      만 14세 미만이 아니면 not_under14(PT409). 이미 동의했으면 처음 시각 유지
--   5. list_expired_unconsented(p_limit) → setof uuid: 기한이 지난 미동의 만 14세 미만 계정 (크론 /api/cron/purge-unconsented 가
--      한 명씩 다시 확인하고 탈퇴와 같은 경로로 지움)
--   6. 자기 검증: 새 함수에 anon·authenticated 가 실행 불가
--
-- 왜 ① 인가: 새 컬럼·함수와, ① 00023 이 처음 만든 complete_onboarding 의 재정의뿐. users 에 GRANT 없음, 권한을 좁히지 않음.
--   00023 과 같은 릴리즈 묶음(v0.4-phase3 ①)에서 00023 바로 뒤에 적용되므로 6인자 함수를 쓰는 앱은 배포되지 않는다
-- 앱: src/app/api/onboarding (온보딩 저장), src/app/api/consent/guardian (나중에 동의), src/app/api/cron/purge-unconsented (파기),
--     src/lib/consent/ (상태·제한 모드), 게시판 API (제한 모드 403)
-- 확인: supabase/tests GC-1~4, APP-15
-- 되돌리기: supabase/rollback/00024_guardian_consent.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00024] users 나이·보호자 동의 4열, complete_onboarding 9인자, record_guardian_consent·list_expired_unconsented: service_role 전용` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. users: 나이 확인 결과·동의·파기 기한
-- ------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age_band TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age_checked_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS guardian_consented_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS consent_deadline TIMESTAMPTZ;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_age_band_check;
ALTER TABLE public.users ADD CONSTRAINT users_age_band_check
  CHECK (age_band IS NULL OR age_band IN ('under14', '14plus'));

COMMENT ON COLUMN public.users.age_band IS
  '만 14세 미만 여부 (P3-15): under14 | 14plus. 태어난 해·달은 저장하지 않고 결과만. NULL = 확인 전 (앱은 제한 모드)';
COMMENT ON COLUMN public.users.age_checked_at IS '나이를 확인한 시각 (P3-15, 처음 값 유지)';
COMMENT ON COLUMN public.users.guardian_consented_at IS '법정대리인 동의를 마친 시각 (P3-15). 기록은 user_agreements';
COMMENT ON COLUMN public.users.consent_deadline IS
  '만 14세 미만 + 동의 전 계정의 파기 기한 = 나이 확인 + 30일 (P3-15, Q36). 동의하면 NULL';

CREATE INDEX IF NOT EXISTS idx_users_consent_deadline
  ON public.users (consent_deadline)
  WHERE age_band = 'under14' AND guardian_consented_at IS NULL;

-- ------------------------------------------------------------
-- 2. user_agreements.relation
-- ------------------------------------------------------------
ALTER TABLE public.user_agreements ADD COLUMN IF NOT EXISTS relation TEXT;
ALTER TABLE public.user_agreements DROP CONSTRAINT IF EXISTS user_agreements_relation_check;
ALTER TABLE public.user_agreements ADD CONSTRAINT user_agreements_relation_check
  CHECK (relation IS NULL OR relation IN ('mother', 'father', 'other'));
COMMENT ON COLUMN public.user_agreements.relation IS
  '보호자 동의일 때 보호자와 아이의 관계 (선택, P3-15). 보호자 이름·연락처는 받지 않음';

-- ------------------------------------------------------------
-- 3. complete_onboarding (9인자)
--   p_guardian_agreements: NULL 또는 [{ "item", "version" }, …] (보호자가 동의한 항목, 1~8개)
--   반환: { onboarded_at, first, age_band, restricted }
--   오류: invalid_arguments(PT400) · user_not_found(PT404) · 닉네임 중복 23505 · CHECK 23514
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id             UUID,
  p_nickname            TEXT,
  p_skin                TEXT,
  p_grade               SMALLINT,
  p_agreements          JSONB,
  p_method              TEXT,
  p_age_band            TEXT,
  p_guardian_agreements JSONB,
  p_guardian_relation   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_before   TIMESTAMPTZ;
  v_band     TEXT;
  v_consent  TIMESTAMPTZ;
  v_guardian BOOLEAN;
  v_row      public.users%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_nickname IS NULL OR p_skin IS NULL OR p_skin !~ '^[a-z]{1,16}$'
     OR (p_grade IS NOT NULL AND p_grade NOT BETWEEN 1 AND 6)
     OR p_method IS NULL OR p_method !~ '^[a-z][a-z_]{0,31}$'
     OR p_age_band IS NULL OR p_age_band NOT IN ('under14', '14plus')
     OR (p_guardian_relation IS NOT NULL AND p_guardian_relation NOT IN ('mother', 'father', 'other'))
     OR p_agreements IS NULL OR jsonb_typeof(p_agreements) <> 'array'
     OR jsonb_array_length(p_agreements) NOT BETWEEN 1 AND 16
     OR (p_guardian_agreements IS NOT NULL AND (jsonb_typeof(p_guardian_agreements) <> 'array'
         OR jsonb_array_length(p_guardian_agreements) NOT BETWEEN 1 AND 8)) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_agreements || coalesce(p_guardian_agreements, '[]'::jsonb)) AS a(v)
     WHERE jsonb_typeof(a.v) <> 'object'
        OR jsonb_typeof(a.v -> 'item') IS DISTINCT FROM 'string'
        OR jsonb_typeof(a.v -> 'version') IS DISTINCT FROM 'string'
  ) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.onboarded_at, u.age_band, u.guardian_consented_at INTO v_before, v_band, v_consent
    FROM public.users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 나이 확인 결과는 한 번 정해지면 그대로 (다시 온보딩해 제한을 피하지 못하게)
  v_band := coalesce(v_band, p_age_band);
  v_guardian := v_band = 'under14' AND p_guardian_agreements IS NOT NULL;

  UPDATE public.users AS u
     SET nickname              = p_nickname,
         grade                 = p_grade,
         avatar_config         = u.avatar_config || jsonb_build_object('skin', p_skin),
         onboarded_at          = coalesce(u.onboarded_at, now()),
         age_band              = v_band,
         age_checked_at        = coalesce(u.age_checked_at, now()),
         guardian_consented_at = CASE WHEN v_guardian THEN coalesce(u.guardian_consented_at, now())
                                      ELSE u.guardian_consented_at END,
         consent_deadline      = CASE WHEN v_band = 'under14' AND NOT v_guardian AND u.guardian_consented_at IS NULL
                                      THEN coalesce(u.consent_deadline, now() + interval '30 days')
                                      ELSE NULL END
   WHERE u.id = p_user_id
  RETURNING u.* INTO v_row;

  INSERT INTO public.user_agreements (user_id, item, version, method)
  SELECT DISTINCT p_user_id, a.v ->> 'item', a.v ->> 'version', p_method
    FROM jsonb_array_elements(p_agreements) AS a(v)
  ON CONFLICT (user_id, item, version) DO NOTHING;

  IF v_guardian THEN
    INSERT INTO public.user_agreements (user_id, item, version, method, relation)
    SELECT DISTINCT p_user_id, a.v ->> 'item', a.v ->> 'version', 'guardian_in_person', p_guardian_relation
      FROM jsonb_array_elements(p_guardian_agreements) AS a(v)
    ON CONFLICT (user_id, item, version) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'onboarded_at', v_row.onboarded_at,
    'first', v_before IS NULL,
    'age_band', v_row.age_band,
    'restricted', v_row.age_band = 'under14' AND v_row.guardian_consented_at IS NULL
  );
END;
$$;

COMMENT ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT, TEXT, JSONB, TEXT) IS
  '온보딩 저장 (P3-11·P3-15): 닉네임·학년·스킨·완료 시각·나이 확인 결과·(보호자 동의) + 약관 동의 기록을 한 트랜잭션에. service_role 전용';

REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT, TEXT, JSONB, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 4. record_guardian_consent: 나중에 보호자 동의 (제한 모드에서)
--   반환: { consented_at, first }   오류: invalid_arguments(PT400) · user_not_found(PT404) · not_under14(PT409)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_guardian_consent(
  p_user_id    UUID,
  p_agreements JSONB,
  p_relation   TEXT,
  p_method     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_band    TEXT;
  v_before  TIMESTAMPTZ;
  v_after   TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_method IS NULL OR p_method !~ '^guardian_[a-z_]{1,23}$'
     OR (p_relation IS NOT NULL AND p_relation NOT IN ('mother', 'father', 'other'))
     OR p_agreements IS NULL OR jsonb_typeof(p_agreements) <> 'array'
     OR jsonb_array_length(p_agreements) NOT BETWEEN 1 AND 8
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_agreements) AS a(v)
        WHERE jsonb_typeof(a.v) <> 'object'
           OR jsonb_typeof(a.v -> 'item') IS DISTINCT FROM 'string'
           OR jsonb_typeof(a.v -> 'version') IS DISTINCT FROM 'string'
     ) THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  SELECT u.age_band, u.guardian_consented_at INTO v_band, v_before
    FROM public.users AS u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;
  IF v_band IS DISTINCT FROM 'under14' THEN
    RAISE EXCEPTION 'not_under14' USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.users AS u
     SET guardian_consented_at = coalesce(u.guardian_consented_at, now()),
         consent_deadline      = NULL
   WHERE u.id = p_user_id
  RETURNING u.guardian_consented_at INTO v_after;

  INSERT INTO public.user_agreements (user_id, item, version, method, relation)
  SELECT DISTINCT p_user_id, a.v ->> 'item', a.v ->> 'version', p_method, p_relation
    FROM jsonb_array_elements(p_agreements) AS a(v)
  ON CONFLICT (user_id, item, version) DO NOTHING;

  RETURN jsonb_build_object('consented_at', v_after, 'first', v_before IS NULL);
END;
$$;

COMMENT ON FUNCTION public.record_guardian_consent(UUID, JSONB, TEXT, TEXT) IS
  '법정대리인 동의 기록 (P3-15): 동의 시각·기한 해제 + user_agreements. service_role 전용: /api/consent/guardian';

REVOKE ALL ON FUNCTION public.record_guardian_consent(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_guardian_consent(UUID, JSONB, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 5. list_expired_unconsented: 파기 대상 (기한이 지난 미동의 만 14세 미만)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_expired_unconsented(p_limit INTEGER)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT u.id FROM public.users AS u
   WHERE u.age_band = 'under14'
     AND u.guardian_consented_at IS NULL
     AND u.consent_deadline IS NOT NULL
     AND u.consent_deadline < now()
   ORDER BY u.consent_deadline
   LIMIT greatest(1, least(coalesce(p_limit, 50), 500));
$$;

COMMENT ON FUNCTION public.list_expired_unconsented(INTEGER) IS
  '파기 기한이 지난 미동의 만 14세 미만 계정 (P3-15, Q36). service_role 전용: /api/cron/purge-unconsented';

REVOKE ALL ON FUNCTION public.list_expired_unconsented(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_unconsented(INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 6. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.complete_onboarding(uuid, text, text, smallint, jsonb, text, text, jsonb, text)',
    'public.record_guardian_consent(uuid, jsonb, text, text)',
    'public.list_expired_unconsented(integer)'
  ] LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '[00024] anon/authenticated 가 % 를 실행할 수 있음', v_fn;
    END IF;
    IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION '[00024] service_role 이 % 를 실행할 수 없음', v_fn;
    END IF;
  END LOOP;
  IF to_regprocedure('public.complete_onboarding(uuid, text, text, smallint, jsonb, text)') IS NOT NULL THEN
    RAISE EXCEPTION '[00024] 예전 6인자 complete_onboarding 이 남아 있음';
  END IF;
  RAISE NOTICE '[00024] users 나이·보호자 동의 4열, complete_onboarding 9인자, record_guardian_consent·list_expired_unconsented: service_role 전용';
END $$;
