-- ============================================================
-- 익명 분석 이벤트 analytics_events + 보존 정리 함수 + 전역(사용자 없는) 요청 한도 (Idempotent)   (P1-17, §12-Q22)
-- 릴리즈 단계: ① 추가형 (앱 배포 전에 적용. 이전 앱은 이 테이블·함수를 쓰지 않으므로 그대로 동작)
--
-- 배경
--   §1 성공 지표(랜딩 → 로그인 전환율, 모바일 세션 비율, 세션당 완료 퀘스트 수 등)를 재려면 이벤트 기록이 필요합니다.
--   §12-Q22: 외부 서비스·국외 이전 없이 Supabase 자체 테이블 + API Route(/api/analytics) + track() 추상화.
--   아동 대상이라 익명 ID 만 저장하고 개인정보는 넣지 않습니다(§2.6). 이벤트 설계: docs/analytics.md
--
-- 하는 일
--   1. analytics_events: 이벤트 1건 = 1행. 쓰기·읽기 모두 service_role 전용 (RLS ON + 정책 없음 + anon·authenticated 권한 없음)
--      - anon_id: 로그인 사용자는 서버가 HMAC-SHA256(ANALYTICS_SALT, user id) 한 값(base64url 22자), 비로그인은 탭 세션마다
--        브라우저가 만든 128비트 난수(base64url 22자). user id·이메일·IP·User-Agent 원문·URL 쿼리는 저장하지 않음
--        (salt 는 서버 env 에만 있으므로 DB 만으로는 사용자와 이을 수 없음)
--      - actor: 'user'(로그인, HMAC) | 'visitor'(비로그인, 세션 난수)
--      - source: 'server'(로그인 성공·퀘스트 시작/완료·힌트: 서버가 직접 기록 → 클라이언트가 조작할 수 없음) | 'client'(랜딩 등 /api/analytics)
--      - name: 소문자 snake_case 48자 이하. 허용 목록·props 형식은 앱(src/lib/analytics/schema.ts, zod strict)이 정함
--        (새 이벤트마다 마이그레이션이 필요 없게 DB 는 형식만 검사. 쓰는 쪽은 service_role 뿐)
--      - props: jsonb 객체 512바이트 이하 (자유 문자열 없음: enum·UUID·정수·불리언만. 앱이 검사)
--      - device: 'mobile' | 'tablet' | 'desktop' | 'unknown' (서버가 User-Agent 로 거칠게 판별, 원문은 버림)
--      - path: 경로 템플릿만 (예: '/', '/quest/[id]'). 쿼리·해시 없음. 100자 이하
--      - dedupe_key: "처음 한 번"만 세는 이벤트용 (예: quest_start:<quest id>). (anon_id, dedupe_key) UNIQUE 라
--        앱은 ON CONFLICT DO NOTHING 으로 넣음. NULL 은 서로 겹치지 않음
--      - occurred_at: 서버가 받은 시각 (클라이언트 시계를 믿지 않음)
--      - 수정 없음: service_role 에도 UPDATE 권한을 주지 않음 (SELECT·INSERT·DELETE 만)
--      - users 를 참조하지 않음(anon_id 는 HMAC). 탈퇴 때는 /api/account/delete 가 HMAC 으로 그 사용자의 행을 지움
--   2. prune_analytics_events(p_retention, p_limit) → 지운 행 수 (SECURITY DEFINER, service_role 전용)
--      - 기본 보존 180일. pg_cron 이 없으므로 /api/analytics 가 인스턴스마다 1시간에 한 번 기회적으로 부르고(최대 5,000행),
--        밀렸으면 런북 SQL 로 직접 실행. 보존 기간은 1일 미만으로 줄일 수 없음 (실수로 다 지우지 않게)
--   3. api_global_rate_limits + consume_global_rate_limit(p_bucket, p_per_minute, p_per_day) → jsonb (service_role 전용)
--      - 00016 consume_rate_limit 은 users FK 가 있어 비로그인 요청에 쓸 수 없음 → 사용자 없는 버킷 하나(행 1개)로 셈
--      - 지금 쓰는 곳: 'analytics:visitor' (비로그인 /api/analytics 전체 합계. 봇이 테이블을 무한히 키우지 못하게)
--      - 반환·창 규칙은 consume_rate_limit 과 같음 (분 창·KST 하루 창, FOR UPDATE, clock_timestamp, 창은 앞으로만)
--      - 전체가 행 하나를 잠그므로 초당 수십 건 이상이 몰리는 경로에는 쓰지 않음 (지금은 랜딩 이벤트 정도)
--      - 나중에 서버 무료 티어 LLM 전역 일일 예산(P1-22 제안)도 같은 함수의 버킷으로 쓸 수 있음
--   4. 자기 검증: anon·authenticated 가 테이블·함수에 접근할 수 없음, service_role 은 UPDATE 불가
--
-- 앱: src/app/api/analytics/route.ts (클라이언트 이벤트), src/lib/analytics/server.ts (서버 이벤트·익명화·정리)
--   ANALYTICS_SALT 가 없으면 앱은 아무것도 기록하지 않음. 이 파일이 빠졌으면 기록만 실패하고(로그 `[analytics] … 실패`) 화면은 그대로
-- 확인: supabase/tests AN-1~8
-- 되돌리기: supabase/rollback/00017_analytics_events.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00017] analytics_events·prune_analytics_events·consume_global_rate_limit: service_role 전용 (anon/authenticated 접근 불가)` 확인
-- ============================================================

-- ------------------------------------------------------------
-- 1. 이벤트 테이블
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL CONSTRAINT analytics_events_name_check CHECK (name ~ '^[a-z][a-z0-9_]{1,47}$'),
  actor       TEXT NOT NULL CONSTRAINT analytics_events_actor_check CHECK (actor IN ('user', 'visitor')),
  anon_id     TEXT NOT NULL CONSTRAINT analytics_events_anon_id_check CHECK (anon_id ~ '^[A-Za-z0-9_-]{22}$'),
  source      TEXT NOT NULL CONSTRAINT analytics_events_source_check CHECK (source IN ('client', 'server')),
  props       JSONB NOT NULL DEFAULT '{}'::jsonb
              CONSTRAINT analytics_events_props_check
              CHECK (jsonb_typeof(props) = 'object' AND octet_length(props::text) <= 512),
  device      TEXT NOT NULL DEFAULT 'unknown'
              CONSTRAINT analytics_events_device_check CHECK (device IN ('mobile', 'tablet', 'desktop', 'unknown')),
  path        TEXT CONSTRAINT analytics_events_path_check
              CHECK (path IS NULL OR (char_length(path) <= 100 AND path ~ '^/[A-Za-z0-9/_.\[\]-]*$')),
  dedupe_key  TEXT CONSTRAINT analytics_events_dedupe_key_check
              CHECK (dedupe_key IS NULL OR dedupe_key ~ '^[a-z0-9_:-]{1,100}$'),
  CONSTRAINT analytics_events_dedupe_unique UNIQUE (anon_id, dedupe_key)
);

-- 퍼널·이벤트별 집계 (name + 기간), 보존 정리·일별 활성 (기간). (anon_id, …) 는 위 UNIQUE 인덱스가 겸함 (탈퇴 삭제·사용자별 첫 이벤트)
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_occurred ON public.analytics_events (name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred ON public.analytics_events (occurred_at);

COMMENT ON TABLE public.analytics_events IS
  '익명 분석 이벤트 (P1-17). anon_id = HMAC(user id) 또는 세션 난수, 개인정보·IP·UA 원문·URL 쿼리 없음. service_role 전용, 보존 180일 (docs/analytics.md)';
COMMENT ON COLUMN public.analytics_events.anon_id IS
  'actor=user: base64url(HMAC-SHA256(ANALYTICS_SALT, user id)) 앞 22자, actor=visitor: 탭 세션 128비트 난수';

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.analytics_events TO service_role;

-- ------------------------------------------------------------
-- 2. 보존 정리
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_analytics_events(
  p_retention INTERVAL DEFAULT interval '180 days',
  p_limit     INTEGER DEFAULT 5000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER   -- FOR UPDATE SKIP LOCKED 는 UPDATE 권한이 필요한데 service_role 에는 UPDATE 를 주지 않으므로 (이벤트는 고치지 않음)
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_retention IS NULL OR p_retention < interval '1 day' OR p_limit IS NULL OR p_limit < 1 OR p_limit > 100000 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  -- 오래된 것부터 최대 p_limit 행. 정리가 여러 인스턴스에서 겹쳐도 같은 행을 기다리지 않게 SKIP LOCKED
  DELETE FROM public.analytics_events
   WHERE id IN (SELECT id
                  FROM public.analytics_events
                 WHERE occurred_at < pg_catalog.now() - p_retention
                 ORDER BY occurred_at
                 LIMIT p_limit
                   FOR UPDATE SKIP LOCKED);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.prune_analytics_events(INTERVAL, INTEGER) IS
  '보존 기간(기본 180일)이 지난 분석 이벤트를 최대 p_limit 행 삭제 (P1-17). service_role 전용: /api/analytics 기회적 호출 + 런북';

REVOKE ALL ON FUNCTION public.prune_analytics_events(INTERVAL, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_analytics_events(INTERVAL, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 3. 전역 요청 한도 (사용자 없는 버킷)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_global_rate_limits (
  bucket        TEXT PRIMARY KEY CONSTRAINT api_global_rate_limits_bucket_check CHECK (bucket ~ '^[a-z][a-z0-9_:]{0,47}$'),
  minute_start  TIMESTAMPTZ NOT NULL,
  minute_count  INTEGER NOT NULL DEFAULT 0,
  minute_denied INTEGER NOT NULL DEFAULT 0,
  day           DATE NOT NULL,
  day_count     INTEGER NOT NULL DEFAULT 0,
  day_denied    INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.api_global_rate_limits IS
  '사용자 없는 전역 요청 한도 카운터 (P1-17). 버킷 1행, 분·하루(KST) 창. service_role 전용: consume_global_rate_limit 로만 씀';

ALTER TABLE public.api_global_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_global_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.api_global_rate_limits TO service_role;

-- 반환: consume_rate_limit(00016)과 같은 { allowed, retry_after, remaining, scope, denied_minute, denied_today }
CREATE OR REPLACE FUNCTION public.consume_global_rate_limit(
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
  v_now     TIMESTAMPTZ;
  v_minute  TIMESTAMPTZ;
  v_today   DATE;
  v_row     public.api_global_rate_limits;
  v_allowed BOOLEAN;
  v_scope   TEXT;
  v_retry   INTEGER := 0;
BEGIN
  IF p_bucket IS NULL OR p_bucket !~ '^[a-z][a-z0-9_:]{0,47}$'
     OR p_per_minute IS NULL OR p_per_minute < 1 OR p_per_day IS NULL OR p_per_day < 1 THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;

  INSERT INTO public.api_global_rate_limits (bucket, minute_start, day)
  VALUES (p_bucket, '-infinity', '-infinity')
  ON CONFLICT (bucket) DO NOTHING;

  SELECT * INTO v_row
    FROM public.api_global_rate_limits
   WHERE bucket = p_bucket
     FOR UPDATE;

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
  END IF;

  IF v_row.day_count >= p_per_day THEN
    v_allowed := false;
    v_scope   := 'day';
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

  UPDATE public.api_global_rate_limits
     SET minute_start  = v_row.minute_start,
         minute_count  = v_row.minute_count,
         minute_denied = v_row.minute_denied,
         day           = v_row.day,
         day_count     = v_row.day_count,
         day_denied    = v_row.day_denied,
         updated_at    = v_now
   WHERE bucket = p_bucket;

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

COMMENT ON FUNCTION public.consume_global_rate_limit(TEXT, INTEGER, INTEGER) IS
  '사용자 없는 전역 버킷의 요청 한도 1 차감 (P1-17). 규칙은 consume_rate_limit 과 같음. service_role 전용: /api/analytics 비로그인';

REVOKE ALL ON FUNCTION public.consume_global_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_global_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ------------------------------------------------------------
-- 4. 자기 검증
-- ------------------------------------------------------------
DO $$
DECLARE
  v_bad  TEXT[] := '{}';
  v_role TEXT;
  v_tbl  TEXT;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOREACH v_tbl IN ARRAY ARRAY['public.analytics_events', 'public.api_global_rate_limits'] LOOP
      IF has_table_privilege(v_role, v_tbl, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        v_bad := v_bad || (v_role || ':' || v_tbl);
      END IF;
    END LOOP;
    IF has_function_privilege(v_role, 'public.prune_analytics_events(interval, integer)', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':prune EXECUTE');
    END IF;
    IF has_function_privilege(v_role, 'public.consume_global_rate_limit(text, integer, integer)', 'EXECUTE') THEN
      v_bad := v_bad || (v_role || ':consume_global EXECUTE');
    END IF;
  END LOOP;
  IF NOT has_table_privilege('service_role', 'public.analytics_events', 'SELECT, INSERT, DELETE')
     OR has_table_privilege('service_role', 'public.analytics_events', 'UPDATE') THEN
    v_bad := v_bad || 'service_role:analytics_events 권한(SELECT·INSERT·DELETE 만)'::TEXT;
  END IF;
  IF NOT has_function_privilege('service_role', 'public.prune_analytics_events(interval, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.consume_global_rate_limit(text, integer, integer)', 'EXECUTE') THEN
    v_bad := v_bad || 'service_role:EXECUTE 없음'::TEXT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename IN ('analytics_events', 'api_global_rate_limits')) THEN
    v_bad := v_bad || '정책이 있음'::TEXT;
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.analytics_events'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.api_global_rate_limits'::regclass) THEN
    v_bad := v_bad || 'RLS 꺼짐'::TEXT;
  END IF;

  IF cardinality(v_bad) > 0 THEN
    RAISE EXCEPTION '[00017] 기대와 다름: %', array_to_string(v_bad, ', ');
  END IF;
  RAISE NOTICE '[00017] analytics_events·prune_analytics_events·consume_global_rate_limit: service_role 전용 (anon/authenticated 접근 불가)';
END $$;
