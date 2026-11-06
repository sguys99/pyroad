-- ============================================================
-- 00024 되돌리기: 나이 확인·보호자 동의 열과 함수 삭제, complete_onboarding 을 00023(6인자) 정의로   (P3-15)
-- 마이그레이션 실행 대상이 아님 (supabase/migrations 밖에 둠). 문제가 생겼을 때 사용자가 직접 실행합니다.
-- ⚠️ 먼저 P3-15 이전 앱으로 되돌린 뒤 실행합니다 (새 앱은 9인자 complete_onboarding 과 새 열을 씀).
-- ⚠️ 나이 확인 결과·보호자 동의 시각·파기 기한·보호자 관계가 지워지고 되살릴 수 없습니다. 보호자 동의 기록 자체
--    (user_agreements 의 guardian_* 행)는 남습니다. 지우기 전에 아래를 CSV 로 보관하세요:
--    select id, age_band, age_checked_at, guardian_consented_at, consent_deadline from public.users where age_band is not null;
-- ⚠️ 파기 크론(/api/cron/purge-unconsented)을 먼저 끄세요 (Vercel → Settings → Cron Jobs 또는 CRON_SECRET 삭제)
-- 실행 후 상태 = 00023 까지 적용된 상태
-- 실행: SQL Editor 에서 BEGIN; … COMMIT; 으로 감싸거나
--       docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/rollback/00024_guardian_consent.rollback.sql
-- ============================================================

DROP FUNCTION IF EXISTS public.list_expired_unconsented(INTEGER);
DROP FUNCTION IF EXISTS public.record_guardian_consent(UUID, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT, TEXT, JSONB, TEXT);

-- 00023 의 6인자 정의 (supabase/migrations/00023_onboarding.sql 3절과 같음)
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
REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, SMALLINT, JSONB, TEXT) TO service_role;

ALTER TABLE public.user_agreements DROP CONSTRAINT IF EXISTS user_agreements_relation_check;
ALTER TABLE public.user_agreements DROP COLUMN IF EXISTS relation;
DROP INDEX IF EXISTS public.idx_users_consent_deadline;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_age_band_check;
ALTER TABLE public.users DROP COLUMN IF EXISTS consent_deadline;
ALTER TABLE public.users DROP COLUMN IF EXISTS guardian_consented_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS age_checked_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS age_band;
