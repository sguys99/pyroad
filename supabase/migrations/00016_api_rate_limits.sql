-- ============================================================
-- 사용자별 요청 한도(rate limit) 카운터 + consume_rate_limit RPC (Idempotent)   (P1-19, B01)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 이 테이블·함수를 쓰지 않으므로 그대로 동작)
--
-- 배경
--   B01 핫픽스로 provider 파라미터와 입력 길이는 막았지만, 로그인한 사용자가 /api/tutor·/api/tutor/stream 을
--   빠르게 반복 호출하면 서버 무료 티어 키(Gemini, 프로젝트 전체가 함께 쓰는 한도)와 서버리스 실행 시간을 혼자 다 쓸 수 있습니다.
--   Vercel 서버리스는 인스턴스마다 메모리가 따로라 인메모리 카운터로는 한도가 지켜지지 않으므로 Postgres 에 셉니다
--   (Vercel 함수와 Supabase 가 같은 서울 리전이라 왕복이 짧음).
--
-- 하는 일
--   1. api_rate_limits: (user_id, bucket) 마다 1행. 분 창·하루(KST) 창의 카운트를 한 행에 같이 둠
--      - 행을 계속 다시 쓰므로 행 수는 "사용자 × 버킷"을 넘지 않음 (요청마다 행이 쌓이지 않음)
--      - bucket: 'tutor:<요청 유형>' (src/lib/tutor/rateLimit.ts). 나중에 퀴즈 채점 API(P7-02)도 'quiz:answer' 처럼 같이 씀
--      - service_role 전용 (RLS ON + 정책 없음 + anon·authenticated 권한 없음). 클라이언트가 지우면 한도가 풀리므로
--      - 탈퇴하면 users 삭제와 함께 지워짐 (ON DELETE CASCADE)
--   2. consume_rate_limit(p_user_id, p_bucket, p_per_minute, p_per_day) → jsonb  (SECURITY DEFINER, service_role 전용)
--      - 한도 안이면 1 차감하고 allowed = true. 넘으면 차감하지 않고 allowed = false + 다시 해도 되는 시각까지 초(retry_after)
--      - 한도 값은 앱이 넘김 (env 로 바꿀 수 있게, src/lib/tutor/rateLimit.ts). 사용자 id 는 API Route 가 getUser() 로 확인한 값만
--      - 경합: 행을 FOR UPDATE 로 잠가 같은 사용자·버킷 요청을 한 줄로 세움 → 동시에 20번 와도 한도 5면 정확히 5번만 허용 (회귀 RL-6)
--      - 창: 분 창은 정각 분(date_trunc), 하루 창은 KST 날짜(public.kst_date, 00012). 고정 창이라 창 경계에서 잠깐 2배까지 가능(의도한 단순화)
--      - 시각은 잠금을 얻은 뒤 clock_timestamp() 로 잼 (now() 는 트랜잭션 시작 시각이라 잠금을 기다린 요청이 지난 창에 셀 수 있음).
--        창은 앞으로만 감 (늦게 온 요청이 창을 되돌리지 않음)
--      - 거부도 셈(denied_minute·denied_today): 짧은 시간에 반복해서 넘으면 앱이 경고 수준을 올림(Sentry)
--   3. 오래된 행 정리: pg_cron 이 없으므로, 어떤 사용자의 버킷이 그날 처음 쓰일 때 마지막 사용이 2일보다 오래된 행을
--      최대 200개 지움 (SKIP LOCKED: 쓰고 있는 행은 건드리지 않음). 오래된 행은 없는 행과 뜻이 같아 지워도 한도는 그대로이고,
--      "언제 튜터를 썼는지" 기록을 오래 두지 않음 (§2.6 최소 수집)
--   4. 자기 검증: anon·authenticated 가 테이블·함수에 접근할 수 없음
--
-- 앱: src/app/api/tutor/helpers.ts (인증·입력 검증 뒤, 퀘스트 조회·캐시·LLM 호출 전). 이 함수가 없거나 실패하면 앱은 한도 없이
--   통과시키고(fail-open: 튜터를 멈추지 않음) 로그·Sentry 로 알림 → 이 파일이 빠졌으면 Vercel 로그에 `[tutor] consume_rate_limit 실패`
-- 확인: supabase/tests RL-1~8
-- 되돌리기: supabase/rollback/00016_api_rate_limits.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00016] api_rate_limits·consume_rate_limit: service_role 전용 (anon/authenticated 접근 불가)` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 카운터 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bucket        TEXT NOT NULL CONSTRAINT api_rate_limits_bucket_check CHECK (bucket ~ '^[a-z][a-z0-9_:]{0,47}$'),
  minute_start  TIMESTAMPTZ NOT NULL,              -- 지금 분 창의 시작 (정각 분)
  minute_count  INTEGER NOT NULL DEFAULT 0,         -- 분 창에서 허용한 수
  minute_denied INTEGER NOT NULL DEFAULT 0,         -- 분 창에서 거부한 수
  day           DATE NOT NULL,                      -- 지금 하루 창 (KST 날짜)
  day_count     INTEGER NOT NULL DEFAULT 0,         -- 오늘 허용한 수
  day_denied    INTEGER NOT NULL DEFAULT 0,         -- 오늘 거부한 수
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(), -- 마지막 요청 (정리 기준)
  PRIMARY KEY (user_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at ON public.api_rate_limits (updated_at);

COMMENT ON TABLE public.api_rate_limits IS
  '사용자별 요청 한도 카운터 (P1-19). (user_id, bucket) 1행, 분·하루(KST) 창. service_role 전용: consume_rate_limit 로만 씀';

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.api_rate_limits TO service_role;

-- ------------------------------------------------------------
-- 2. consume_rate_limit
--   반환: { allowed, retry_after, remaining, scope, denied_minute, denied_today }
--     allowed       이번 요청을 허용했는지 (허용했으면 1 차감됨)
--     retry_after   거부일 때 다시 해도 되는 때까지 초 (1 이상). 허용이면 0
--     remaining     허용일 때 이번 요청 뒤 남은 수 (분·하루 중 작은 쪽). 거부면 0
--     scope         거부 이유가 된 창: 'minute' | 'day'. 허용이면 null (하루 한도가 먼저: 하루를 넘으면 분 창이 지나도 소용없음)
--     denied_minute 이번 분 창에서 거부한 수 (이번 거부 포함)
--     denied_today  오늘(KST) 거부한 수 (이번 거부 포함)
--   오류 (message): invalid_arguments(PT400) · 사용자가 없으면 FK 위반(23503)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id    UUID,
  p_bucket     TEXT,
  p_per_minute INTEGER,
  p_per_day    INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_retention     CONSTANT INTERVAL := interval '2 days';   -- 이보다 오래 안 쓴 행은 정리
  c_cleanup_batch CONSTANT INTEGER := 200;                 -- 한 번에 정리하는 최대 행 수
  v_now     TIMESTAMPTZ;
  v_minute  TIMESTAMPTZ;
  v_today   DATE;
  v_row     public.api_rate_limits;
  v_allowed BOOLEAN;
  v_scope   TEXT;
  v_retry   INTEGER := 0;
  v_new_day BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR p_bucket IS NULL OR p_bucket !~ '^[a-z][a-z0-9_:]{0,47}$'
     OR p_per_minute IS NULL OR p_per_minute < 1 OR p_per_day IS NULL OR p_per_day < 1 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 행이 없으면 만들고(동시에 온 다른 요청이 먼저 만들었으면 그 행을 씀), 잠가서 같은 사용자·버킷 요청을 한 줄로 세움.
  -- 처음 만드는 행은 창을 -infinity 로 두어 아래에서 "새 창"으로 시작
  INSERT INTO public.api_rate_limits (user_id, bucket, minute_start, day)
  VALUES (p_user_id, p_bucket, '-infinity', '-infinity')
  ON CONFLICT (user_id, bucket) DO NOTHING;

  SELECT * INTO v_row
    FROM public.api_rate_limits
   WHERE user_id = p_user_id AND bucket = p_bucket
     FOR UPDATE;
  IF NOT FOUND THEN   -- 그 사이 탈퇴로 지워짐
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  -- 시각은 잠금을 얻은 뒤에 잼. 창은 앞으로만 감
  v_now    := pg_catalog.clock_timestamp();
  v_minute := pg_catalog.date_trunc('minute', v_now);
  v_today  := public.kst_date(v_now);

  IF v_row.minute_start < v_minute THEN
    v_row.minute_start  := v_minute;
    v_row.minute_count  := 0;
    v_row.minute_denied := 0;
  END IF;
  IF v_row.day < v_today THEN
    v_row.day        := v_today;
    v_row.day_count  := 0;
    v_row.day_denied := 0;
    v_new_day        := true;
  END IF;

  IF v_row.day_count >= p_per_day THEN
    v_allowed := false;
    v_scope   := 'day';
    -- 다음 KST 자정까지
    v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM
                 (((v_row.day + 1)::timestamp AT TIME ZONE 'Asia/Seoul') - v_now)))::INTEGER;
  ELSIF v_row.minute_count >= p_per_minute THEN
    v_allowed := false;
    v_scope   := 'minute';
    v_retry := pg_catalog.ceil(EXTRACT(EPOCH FROM ((v_row.minute_start + interval '1 minute') - v_now)))::INTEGER;
  ELSE
    v_allowed := true;
    v_row.minute_count := v_row.minute_count + 1;
    v_row.day_count    := v_row.day_count + 1;
  END IF;

  IF NOT v_allowed THEN
    v_retry := GREATEST(v_retry, 1);
    v_row.minute_denied := v_row.minute_denied + 1;
    v_row.day_denied    := v_row.day_denied + 1;
  END IF;

  UPDATE public.api_rate_limits
     SET minute_start  = v_row.minute_start,
         minute_count  = v_row.minute_count,
         minute_denied = v_row.minute_denied,
         day           = v_row.day,
         day_count     = v_row.day_count,
         day_denied    = v_row.day_denied,
         updated_at    = v_now
   WHERE user_id = p_user_id AND bucket = p_bucket;

  -- 기회적 정리: 이 사용자·버킷의 그날 첫 요청일 때만 (하루에 버킷마다 한 번 → 비용이 활동 사용자 수에 비례해 퍼짐)
  IF v_new_day THEN
    DELETE FROM public.api_rate_limits
     WHERE ctid IN (SELECT ctid
                      FROM public.api_rate_limits
                     WHERE updated_at < v_now - c_retention
                     LIMIT c_cleanup_batch
                       FOR UPDATE SKIP LOCKED);
  END IF;

  RETURN jsonb_build_object(
    'allowed',       v_allowed,
    'retry_after',   v_retry,
    'remaining',     CASE WHEN v_allowed
                          THEN LEAST(p_per_minute - v_row.minute_count, p_per_day - v_row.day_count)
                          ELSE 0 END,
    'scope',         v_scope,
    'denied_minute', v_row.minute_denied,
    'denied_today',  v_row.day_denied);
END;
$$;

COMMENT ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) IS
  '요청 한도 1 차감 (P1-19). 분·하루(KST) 고정 창, 행 잠금으로 경합에 정확. 오래된 행 기회적 정리. service_role 전용: /api/tutor·/api/tutor/stream';

REVOKE ALL ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 3. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad  TEXT[] := '{}';
  v_role TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_table_privilege(v_role, 'public.api_rate_limits', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN
      v_bad := v_bad || (v_role || ':api_rate_limits');
    END IF;
    IF has_function_privilege(v_role, 'public.consume_rate_limit(uuid, text, integer, integer)', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':EXECUTE');
    END IF;
  END LOOP;
  IF NOT has_function_privilege('service_role', 'public.consume_rate_limit(uuid, text, integer, integer)', 'EXECUTE') THEN
    v_bad := v_bad || 'service_role:EXECUTE 없음'::TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'api_rate_limits') THEN
    v_bad := v_bad || 'api_rate_limits 정책'::TEXT;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.api_rate_limits'::regclass) THEN
    v_bad := v_bad || 'api_rate_limits RLS 꺼짐'::TEXT;
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00016] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00016] api_rate_limits·consume_rate_limit: service_role 전용 (anon/authenticated 접근 불가)';
END $$;
