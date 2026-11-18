-- ============================================================
-- 운영 지표 집계 함수 (Idempotent)   (P12-09, docs/monitoring.md)
-- 릴리즈 단계: ① 추가형 (새 함수 하나. 표·권한·다른 함수는 건드리지 않음 — 이전 앱은 부르지 않으므로 그대로 동작)
--
-- 배경
--   관리자 화면 /admin(운영 지표)이 출시 뒤 매일 볼 숫자(사용·퍼널·§1 성공 지표·튜터·건강)를 한 번에 읽는다.
--   analytics_events 의 count(DISTINCT anon_id)·세션·재방문은 PostgREST 로는 못 세고(행을 다 받아야 함, max-rows),
--   서버가 행을 받아 세면 28일치가 수만 행이라 함수 하나로 DB 안에서 센다. 인덱스는 00017 의
--   (name, occurred_at)·(occurred_at) 로 충분 — 기간 조건이 늘 occurred_at 범위라 새 인덱스 없음.
--
-- 하는 일
--   monitoring_summary(p_days) → jsonb   (p_days = 1 오늘 · 7 · 28, KST 날짜 기준 오늘 포함)
--     개인 단위 값(익명 ID·user id·닉네임)은 내보내지 않고 **합계만**. 정의·분모·주의점은 docs/monitoring.md 표.
--   SECURITY INVOKER + service_role 전용(앱은 /admin 서버 컴포넌트가 isAdminUser 확인 뒤 service_role 로 부름).
--   읽기만 함(STABLE). 운영 SQL Editor 에서도: select jsonb_pretty(public.monitoring_summary(7));
--
-- 확인: supabase/tests MON-1·MON-2
-- 되돌리기: supabase/rollback/00062_monitoring_summary.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- 적용 후 NOTICE `[00062] monitoring_summary: service_role 전용 (읽기만, 합계만)` 확인
-- ============================================================

CREATE OR REPLACE FUNCTION public.monitoring_summary(p_days INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  v_to         DATE := public.kst_today();
  v_from       DATE;
  v_spark_from DATE;
  v_start      TIMESTAMPTZ;
  v_spark      TIMESTAMPTZ;
  v_events     JSONB;
  v_daily      JSONB;
  v_cohort     JSONB;
  v_accounts   JSONB;
  v_retention  JSONB;
  v_sessions   JSONB;
  v_mobile     JSONB;
  v_motion     JSONB;
  v_tutor      JSONB;
  v_health     JSONB;
BEGIN
  IF p_days IS NULL OR p_days NOT IN (1, 7, 28) THEN
    RAISE EXCEPTION 'monitoring_summary: p_days 는 1·7·28 중 하나' USING ERRCODE = '22023';
  END IF;
  v_from := v_to - (p_days - 1);
  -- 스파크라인은 "오늘"을 골라도 최근 14일
  v_spark_from := v_to - (greatest(p_days, 14) - 1);
  v_start := v_from::timestamp AT TIME ZONE 'Asia/Seoul';
  v_spark := v_spark_from::timestamp AT TIME ZONE 'Asia/Seoul';

  -- 1. 기간 안 이벤트 합계 (한 번 훑기)
  SELECT jsonb_build_object(
    'active_users',     count(DISTINCT e.anon_id) FILTER (WHERE e.actor = 'user'),
    'visitor_sessions', count(DISTINCT e.anon_id) FILTER (WHERE e.actor = 'visitor'),
    'all_ids',          count(DISTINCT e.anon_id),
    'mobile_ids',       count(DISTINCT e.anon_id) FILTER (WHERE e.device IN ('mobile', 'tablet')),
    'landing_sessions', count(DISTINCT e.anon_id) FILTER (WHERE e.name = 'landing_view'),
    'cta_sessions',     count(DISTINCT e.anon_id) FILTER (WHERE e.name = 'landing_cta_click'),
    'login_users',      count(DISTINCT e.anon_id) FILTER (WHERE e.name = 'login_success'),
    'signups',          count(DISTINCT e.anon_id) FILTER (WHERE e.name = 'login_success' AND (e.props->>'new_user')::boolean),
    'onboarding_done',  count(DISTINCT e.anon_id) FILTER (WHERE e.name = 'onboarding_complete'),
    'sharers',          count(DISTINCT e.anon_id) FILTER (WHERE e.actor = 'user' AND e.name IN ('share_open', 'share_channel')),
    'quest_starts',     count(*) FILTER (WHERE e.name = 'quest_start'),
    'quest_completes',  count(*) FILTER (WHERE e.name = 'quest_complete'),
    'hints',            count(*) FILTER (WHERE e.name = 'hint_used'),
    'hints_l1',         count(*) FILTER (WHERE e.name = 'hint_used' AND e.props->>'level' = '1'),
    'hints_l2',         count(*) FILTER (WHERE e.name = 'hint_used' AND e.props->>'level' = '2'),
    'hints_l3',         count(*) FILTER (WHERE e.name = 'hint_used' AND e.props->>'level' = '3'),
    'free_total',       count(*) FILTER (WHERE e.name = 'tutor_free_question'),
    'free_answered',    count(*) FILTER (WHERE e.name = 'tutor_free_question' AND e.props->>'result' = 'answered'),
    'free_fallback',    count(*) FILTER (WHERE e.name = 'tutor_free_question' AND e.props->>'result' = 'fallback'),
    'free_blocked',     count(*) FILTER (WHERE e.name = 'tutor_free_question' AND e.props->>'result' = 'blocked'),
    'free_answer_blocked', count(*) FILTER (WHERE e.name = 'tutor_free_question' AND e.props->>'result' = 'answer_blocked')
  ) INTO v_events
  FROM public.analytics_events AS e
  WHERE e.occurred_at >= v_start;

  -- 2. 날짜별 활동 (스파크라인): 로그인 학생·비로그인 탭 세션
  WITH agg AS (
    SELECT public.kst_date(e.occurred_at) AS d,
           count(DISTINCT e.anon_id) FILTER (WHERE e.actor = 'user')    AS u,
           count(DISTINCT e.anon_id) FILTER (WHERE e.actor = 'visitor') AS v
      FROM public.analytics_events AS e
     WHERE e.occurred_at >= v_spark
     GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object('day', g.d, 'users', coalesce(a.u, 0), 'visitors', coalesce(a.v, 0)) ORDER BY g.d)
    INTO v_daily
    FROM (SELECT generate_series(v_spark_from::timestamp, v_to::timestamp, interval '1 day')::date AS d) AS g
    LEFT JOIN agg AS a ON a.d = g.d;

  -- 3. 가입 코호트(기간 안 가입) → 첫 퀘스트 시작 → 첫 완료 → 스테이지 클리어 (사람 단위, 같은 익명 ID)
  WITH s AS (
    SELECT e.anon_id, min(e.occurred_at) AS at
      FROM public.analytics_events AS e
     WHERE e.name = 'login_success' AND (e.props->>'new_user')::boolean AND e.occurred_at >= v_start
     GROUP BY 1
  ), f AS (
    SELECT e.anon_id,
           bool_or(e.name = 'quest_start')    AS started,
           bool_or(e.name = 'quest_complete') AS completed,
           bool_or(e.name = 'quest_complete' AND (e.props->>'stage_cleared')::boolean) AS stage_cleared
      FROM public.analytics_events AS e
      JOIN s ON s.anon_id = e.anon_id AND e.occurred_at >= s.at
     WHERE e.name IN ('quest_start', 'quest_complete')
     GROUP BY 1
  )
  SELECT jsonb_build_object(
    'signups',       count(*),
    'started',       count(*) FILTER (WHERE f.started),
    'completed',     count(*) FILTER (WHERE f.completed),
    'stage_cleared', count(*) FILTER (WHERE f.stage_cleared)
  ) INTO v_cohort
  FROM s LEFT JOIN f ON f.anon_id = s.anon_id;

  -- 4. 계정 단계 (users 표, 기간 안 가입한 계정 — 파기·탈퇴한 계정은 빠짐)
  SELECT jsonb_build_object(
    'created',     count(*),
    'age_checked', count(*) FILTER (WHERE u.age_band IS NOT NULL),
    'under14',     count(*) FILTER (WHERE u.age_band = 'under14'),
    'guardian_ok', count(*) FILTER (WHERE u.age_band = 'under14' AND u.guardian_consented_at IS NOT NULL),
    'onboarded',   count(*) FILTER (WHERE u.onboarded_at IS NOT NULL)
  ) INTO v_accounts
  FROM public.users AS u
  WHERE u.created_at >= v_start;

  -- 5. D1·D7: 가입한 날(d0) 다음 날 / 7일째에 서버 이벤트가 있나. 돌아올 날(d0+1, d0+7)이 기간 안인 코호트만
  WITH s AS (
    SELECT e.anon_id, public.kst_date(min(e.occurred_at)) AS d0
      FROM public.analytics_events AS e
     WHERE e.name = 'login_success' AND (e.props->>'new_user')::boolean
       AND e.occurred_at >= (v_from - 7)::timestamp AT TIME ZONE 'Asia/Seoul'
     GROUP BY 1
  ), act AS (
    SELECT DISTINCT e.anon_id, public.kst_date(e.occurred_at) AS d
      FROM public.analytics_events AS e
     WHERE e.actor = 'user' AND e.occurred_at >= v_start
       AND e.anon_id IN (SELECT s.anon_id FROM s)
  )
  SELECT jsonb_build_object(
    'd1_cohort', count(*) FILTER (WHERE s.d0 BETWEEN v_from - 1 AND v_to - 1),
    'd1_back',   count(*) FILTER (WHERE s.d0 BETWEEN v_from - 1 AND v_to - 1
                                    AND EXISTS (SELECT 1 FROM act WHERE act.anon_id = s.anon_id AND act.d = s.d0 + 1)),
    'd7_cohort', count(*) FILTER (WHERE s.d0 BETWEEN v_from - 7 AND v_to - 7),
    'd7_back',   count(*) FILTER (WHERE s.d0 BETWEEN v_from - 7 AND v_to - 7
                                    AND EXISTS (SELECT 1 FROM act WHERE act.anon_id = s.anon_id AND act.d = s.d0 + 7))
  ) INTO v_retention
  FROM s;

  -- 6. 세션당 처음 완료한 퀘스트 (로그인 학생, 30분 넘게 이벤트가 없으면 새 세션 — analytics.md SQL 5)
  WITH e AS (
    SELECT x.anon_id, x.name, x.occurred_at,
           lag(x.occurred_at) OVER (PARTITION BY x.anon_id ORDER BY x.occurred_at) AS prev
      FROM public.analytics_events AS x
     WHERE x.actor = 'user' AND x.occurred_at >= v_start
  ), s AS (
    SELECT e.anon_id, e.name,
           sum(CASE WHEN e.prev IS NULL OR e.occurred_at - e.prev > interval '30 minutes' THEN 1 ELSE 0 END)
             OVER (PARTITION BY e.anon_id ORDER BY e.occurred_at) AS sn
      FROM e
  ), per AS (
    SELECT s.anon_id, s.sn, count(*) FILTER (WHERE s.name = 'quest_complete') AS c
      FROM s GROUP BY 1, 2
  )
  SELECT jsonb_build_object(
    'sessions',   count(*),
    'completes',  coalesce(sum(per.c), 0),
    'three_plus', count(*) FILTER (WHERE per.c >= 3)
  ) INTO v_sessions
  FROM per;

  -- 7. 휴대폰·태블릿에서 시작한 퀴즈 퀘스트 → 같은 익명 ID 가 완료 (기간 안)
  WITH st AS (
    SELECT DISTINCT e.anon_id, e.props->>'quest_id' AS q
      FROM public.analytics_events AS e
      JOIN public.quests AS qq ON qq.id::text = e.props->>'quest_id' AND qq.quest_type = 'quiz'
     WHERE e.name = 'quest_start' AND e.device IN ('mobile', 'tablet') AND e.occurred_at >= v_start
  ), done AS (
    SELECT DISTINCT e.anon_id, e.props->>'quest_id' AS q
      FROM public.analytics_events AS e
     WHERE e.name = 'quest_complete' AND e.occurred_at >= v_start
  )
  SELECT jsonb_build_object(
    'quiz_starts',    count(*),
    'quiz_completes', count(done.anon_id)
  ) INTO v_mobile
  FROM st LEFT JOIN done ON done.anon_id = st.anon_id AND done.q = st.q;

  -- 8. 연출 단계 자동 하향 (P12-04 §8 ①·②): 분모 = 브라우저 이벤트를 보낸 로그인 학생
  WITH m AS (
    SELECT e.anon_id, min(e.occurred_at) AS at
      FROM public.analytics_events AS e
     WHERE e.name = 'motion_tier_change' AND e.props->>'cause' = 'measured' AND e.actor = 'user'
       AND e.occurred_at >= v_start
     GROUP BY 1
  )
  SELECT jsonb_build_object(
    'client_users', (SELECT count(DISTINCT e.anon_id) FROM public.analytics_events AS e
                      WHERE e.source = 'client' AND e.actor = 'user' AND e.occurred_at >= v_start),
    'downgraded',   count(*),
    'back_to_full', count(*) FILTER (WHERE EXISTS (
                      SELECT 1 FROM public.analytics_events AS u
                       WHERE u.name = 'motion_tier_change' AND u.anon_id = m.anon_id
                         AND u.props->>'cause' = 'user' AND u.occurred_at > m.at
                         AND (u.props->>'setting' = 'full' OR u.props->>'to' = 'full')))
  ) INTO v_motion
  FROM m;

  -- 9. 오늘 튜터 요청 (요청 한도 카운터 api_rate_limits 의 오늘 창 합계 — 지난 날은 덮어써져 오늘만 있음)
  SELECT coalesce(jsonb_object_agg(t.kind, jsonb_build_object('allowed', t.a, 'denied', t.dn)), '{}'::jsonb)
    INTO v_tutor
    FROM (SELECT substr(r.bucket, 7) AS kind, sum(r.day_count) AS a, sum(r.day_denied) AS dn
            FROM public.api_rate_limits AS r
           WHERE r.bucket LIKE 'tutor:%' AND r.day = v_to
           GROUP BY 1) AS t;

  -- 10. 건강: 코인 불일치·파기 기한 지난 계정·숨김 대기·기간 안 신고
  SELECT jsonb_build_object(
    'coin_mismatches',   (SELECT count(*) FROM public.coin_balance_mismatches()),
    'purge_overdue',     (SELECT count(*) FROM (SELECT x FROM public.list_expired_unconsented(500) AS x
                                                UNION
                                                SELECT y FROM public.list_expired_incomplete(500) AS y) AS z),
    'hidden_posts',      (SELECT count(*) FROM public.board_posts WHERE is_hidden),
    'hidden_comments',   (SELECT count(*) FROM public.board_comments WHERE is_hidden),
    'hidden_creations',  (SELECT count(*) FROM public.creations WHERE hidden_at IS NOT NULL),
    'reports',           (SELECT count(*) FROM public.board_reports WHERE created_at >= v_start)
                         + (SELECT count(*) FROM public.creation_reports WHERE created_at >= v_start)
  ) INTO v_health;

  RETURN jsonb_build_object(
    'days', p_days,
    'from', v_from,
    'to', v_to,
    'generated_at', now(),
    'events', v_events,
    'daily', coalesce(v_daily, '[]'::jsonb),
    'cohort', v_cohort,
    'accounts', v_accounts,
    'retention', v_retention,
    'sessions', v_sessions,
    'mobile', v_mobile,
    'motion', v_motion,
    'tutor_today', v_tutor,
    'health', v_health
  );
END
$fn$;

COMMENT ON FUNCTION public.monitoring_summary(INTEGER) IS
  '운영 지표 합계 (P12-09, docs/monitoring.md). p_days 1·7·28(KST). 익명 ID·user id 를 내보내지 않음. service_role 전용: /admin';

REVOKE ALL ON FUNCTION public.monitoring_summary(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitoring_summary(INTEGER) TO service_role;

-- 자기 검증
DO $$
DECLARE
  v_fn TEXT := 'public.monitoring_summary(integer)';
BEGIN
  IF has_function_privilege('anon', v_fn, 'EXECUTE') OR has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION '[00062] anon/authenticated 가 % 를 실행할 수 있음', v_fn;
  END IF;
  IF NOT has_function_privilege('service_role', v_fn, 'EXECUTE') THEN
    RAISE EXCEPTION '[00062] service_role 이 % 를 실행할 수 없음', v_fn;
  END IF;
  -- 한 번 불러 봄 (읽기만): 참조하는 표·함수가 다 있는지
  PERFORM public.monitoring_summary(1);
  RAISE NOTICE '[00062] monitoring_summary: service_role 전용 (읽기만, 합계만)';
END $$;
