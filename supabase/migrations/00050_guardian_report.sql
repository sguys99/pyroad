-- ============================================================
-- 보호자 주간 리포트 링크 (Idempotent)   (P9-15, §12-Q67 ②, P0-10)
-- 릴리즈 단계: ① 추가형 (새 테이블 1개·새 함수 2개, 기존 객체는 건드리지 않음 — 이전 앱은 부르지 않음)
--
-- 왜: 공개 주간 카드(P9-07)는 합계만 담는다(활동한 요일이 드러나지 않게, §12-Q67 ②). 요일별 학습은 학생이 보호자에게만
--     건네는 비공개 링크에서 본다. 로그인 없이 열리므로 링크 자체가 열쇠 → 추측 불가 토큰, DB 에는 해시만
-- 하는 일
--   1. guardian_report_links: 학생마다 링크 0~1개. token_hash = sha256(토큰 22자) (토큰 원문은 저장하지 않음 — DB 가 새도 링크를
--      만들 수 없음. 그래서 학생도 나중에 링크를 다시 볼 수 없고 "다시 만들기"로 새 링크를 받음). service_role 전용(RLS ON, 정책 없음)
--   2. guardian_report_link(user, action) (service_role, /api/guardian-report 가 getUser() 로 확인한 id 만 넘김)
--        status → {active, created_at} · create → 새 토큰(128비트 난수 base64url 22자)으로 바꿔 씀(옛 링크는 바로 무효) + {token} ·
--        off → 행 삭제(링크 무효)
--   3. guardian_report(token, week) (service_role, /guardian/[token] 페이지): 토큰 해시 → 학생, 집계만 반환. week 0 = 이번 주,
--        1 = 지난 주(KST 월~일). 토큰 모양이 틀리거나 없으면 NULL (어느 경우든 같은 답 — 페이지는 똑같이 404)
--        반환: nickname(공개 이름)·skin · week{start,end,offset} · days[7]{date, quests(그날 푼 퀘스트 수 = 학습 달력과 같은
--        learning_day_quests), stamp(출석 도장), future} · totals{quests·xp·stars = 공유 주간 카드와 같은 "그 주에 처음 끝낸 퀘스트"
--        (황금키 완료 제외), active_days, stamps} · learned[≤12]{stage, title, concept}(그 주에 처음 끝낸 퀘스트, 보스 제외) ·
--        bosses[]{title, stars}(그 주에 처음 이긴 보스) · streak(지금 연속, 방패 날 포함 — 읽기만 하므로 방패 정산은 하지 않음) ·
--        level · next{stage, title}(아직 안 끝낸 첫 퀘스트, 퀴즈 제외)
--        학생 코드·질문·튜터 대화·실명·이메일·학년·시각은 없음
--   4. 권한 + 자기 검증
-- 적용 후 NOTICE `[00050] 보호자 리포트: guardian_report_links 잠김, guardian_report_link·guardian_report service_role 전용` 확인
-- 확인: supabase/tests GR-1·1b·1c(권한), GR-2(만들기·다시 만들기·끄기·요일별 집계·지난 주)
-- 되돌리기: supabase/rollback/00050_guardian_report.rollback.sql
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다 (supabase/README.md).
-- ============================================================

-- ------------------------------------------------------------
-- 1. guardian_report_links
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guardian_report_links (
  user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.guardian_report_links IS
  '보호자 주간 리포트 비공개 링크 (P9-15). 학생마다 0~1개, 토큰은 sha256 해시만. service_role 전용(RLS ON, 정책 없음)';

ALTER TABLE public.guardian_report_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.guardian_report_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.guardian_report_links TO service_role;

-- ------------------------------------------------------------
-- 2. guardian_report_link
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardian_report_link(p_user_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
  v_at    TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_action IS NULL OR p_action NOT IN ('status', 'create', 'off') THEN
    RAISE EXCEPTION 'invalid_arguments' USING ERRCODE = 'PT400';
  END IF;
  -- 같은 사용자의 동시 요청을 줄 세움
  PERFORM 1 FROM public.users u WHERE u.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'PT404';
  END IF;

  IF p_action = 'create' THEN
    v_token := translate(rtrim(encode(extensions.gen_random_bytes(16), 'base64'), '='), '+/', '-_');
    INSERT INTO public.guardian_report_links (user_id, token_hash, created_at)
    VALUES (p_user_id, extensions.digest(v_token, 'sha256'), NOW())
    ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = EXCLUDED.created_at
    RETURNING created_at INTO v_at;
    RETURN jsonb_build_object('active', true, 'created_at', v_at, 'token', v_token);
  ELSIF p_action = 'off' THEN
    DELETE FROM public.guardian_report_links l WHERE l.user_id = p_user_id;
    RETURN jsonb_build_object('active', false, 'created_at', NULL);
  END IF;

  SELECT l.created_at INTO v_at FROM public.guardian_report_links l WHERE l.user_id = p_user_id;
  RETURN jsonb_build_object('active', v_at IS NOT NULL, 'created_at', v_at);
END;
$$;

COMMENT ON FUNCTION public.guardian_report_link(UUID, TEXT) IS
  '보호자 리포트 링크 상태·만들기(다시 만들기)·끄기 (P9-15). service_role 전용: /api/guardian-report. 토큰 원문은 create 응답에만';

-- ------------------------------------------------------------
-- 3. guardian_report
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardian_report(p_token TEXT, p_week INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user  UUID;
  v_today DATE := public.kst_today();
  v_mon   DATE;
  v_sun   DATE;
  v_days  DATE[];
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{22}$' OR p_week IS NULL OR p_week NOT IN (0, 1) THEN
    RETURN NULL;
  END IF;
  SELECT l.user_id INTO v_user FROM public.guardian_report_links l
   WHERE l.token_hash = extensions.digest(p_token, 'sha256');
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  v_mon := public.kst_week_start(v_today) - 7 * p_week;
  v_sun := v_mon + 6;
  v_days := ARRAY(
    SELECT d FROM public.streak_learning_days(v_user) d
    UNION
    SELECT sd.day FROM public.streak_shield_days sd WHERE sd.user_id = v_user);

  RETURN (
    WITH first_done AS (
      -- 그 주에 처음 끝낸 퀘스트 (공유 주간 카드와 같은 기준: 황금키 완료 제외)
      SELECT up.completed_at, up.earned_xp, up.best_stars, q.title, q.concept, q.quest_type, s.title AS stage
        FROM public.user_progress up
        JOIN public.quests q ON q.id = up.quest_id
        JOIN public.stages s ON s.id = q.stage_id
       WHERE up.user_id = v_user AND up.status = 'completed' AND NOT up.used_golden_key
         AND up.completed_at IS NOT NULL AND public.kst_date(up.completed_at) BETWEEN v_mon AND v_sun
    ),
    per_day AS (
      SELECT g.d::date AS d,
             (SELECT count(DISTINCT l.quest_id) FROM public.learning_day_quests(v_user) l WHERE l.day = g.d::date) AS n,
             EXISTS (SELECT 1 FROM public.coin_ledger c
                      WHERE c.user_id = v_user AND c.source = 'attendance' AND c.ref = to_char(g.d, 'YYYY-MM-DD')) AS stamp
        FROM generate_series(v_mon, v_sun, INTERVAL '1 day') g(d)
    )
    SELECT jsonb_build_object(
      'nickname', (SELECT p.public_name FROM public.user_public_profiles p WHERE p.user_id = v_user),
      'skin',     (SELECT p.avatar_skin FROM public.user_public_profiles p WHERE p.user_id = v_user),
      'level',    (SELECT u.current_level FROM public.users u WHERE u.id = v_user),
      'week',     jsonb_build_object('start', v_mon, 'end', v_sun, 'offset', p_week),
      'days',     (SELECT jsonb_agg(jsonb_build_object('date', d, 'quests', n, 'stamp', stamp, 'future', d > v_today) ORDER BY d)
                     FROM per_day),
      'totals',   jsonb_build_object(
                    'quests',      (SELECT count(*) FROM first_done),
                    'xp',          (SELECT coalesce(sum(earned_xp), 0) FROM first_done),
                    'stars',       (SELECT coalesce(sum(best_stars), 0) FROM first_done),
                    'active_days', (SELECT count(*) FROM per_day WHERE n > 0),
                    'stamps',      (SELECT count(*) FROM per_day WHERE stamp)),
      'learned',  coalesce((SELECT jsonb_agg(jsonb_build_object('stage', f.stage, 'title', f.title, 'concept', f.concept)
                                             ORDER BY f.completed_at)
                              FROM (SELECT * FROM first_done WHERE quest_type <> 'boss' ORDER BY completed_at LIMIT 12) f),
                           '[]'::jsonb),
      'bosses',   coalesce((SELECT jsonb_agg(jsonb_build_object('title', f.title, 'stars', f.best_stars) ORDER BY f.completed_at)
                              FROM first_done f WHERE f.quest_type = 'boss'), '[]'::jsonb),
      'streak',   public.current_streak(v_days, v_today),
      'next',     (SELECT jsonb_build_object('stage', s.title, 'title', q.title)
                     FROM public.quests q
                     JOIN public.stages s ON s.id = q.stage_id
                     JOIN public.worlds w ON w.id = s.world_id
                    WHERE q.quest_type <> 'quiz'
                      AND NOT EXISTS (SELECT 1 FROM public.user_progress up
                                       WHERE up.user_id = v_user AND up.quest_id = q.id AND up.status = 'completed')
                    ORDER BY w."order", s."order", q."order"
                    LIMIT 1)
    )
  );
END;
$$;

COMMENT ON FUNCTION public.guardian_report(TEXT, INTEGER) IS
  '보호자 주간 리포트 (P9-15). service_role 전용: /guardian/[token]. 토큰 해시로 학생을 찾아 집계만(요일별 학습·합계·배운 것·보스·연속·다음), 없으면 NULL';

-- ------------------------------------------------------------
-- 4. 권한 + 자기 검증
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.guardian_report_link(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardian_report(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_report_link(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.guardian_report(TEXT, INTEGER) TO service_role;

DO $$
DECLARE
  v_fn TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['public.guardian_report_link(uuid, text)', 'public.guardian_report(text, integer)'] LOOP
    IF has_function_privilege('anon', v_fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', v_fn::regprocedure, 'EXECUTE')
       OR NOT has_function_privilege('service_role', v_fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION '[00050] 검증 실패: % 실행 권한이 service_role 전용이 아님', v_fn;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.guardian_report_links', 'SELECT')
     OR has_table_privilege('authenticated', 'public.guardian_report_links', 'SELECT')
     OR has_table_privilege('authenticated', 'public.guardian_report_links', 'INSERT') THEN
    RAISE EXCEPTION '[00050] 검증 실패: guardian_report_links 가 클라이언트에 열려 있음';
  END IF;
  IF octet_length(extensions.digest('x', 'sha256')) <> 32 THEN
    RAISE EXCEPTION '[00050] 검증 실패: sha256 (pgcrypto)';
  END IF;
  IF public.guardian_report('AAAAAAAAAAAAAAAAAAAAAA', 0) IS NOT NULL OR public.guardian_report('bad', 0) IS NOT NULL THEN
    RAISE EXCEPTION '[00050] 검증 실패: 없는 토큰이 NULL 이 아님';
  END IF;
  RAISE NOTICE '[00050] 보호자 리포트: guardian_report_links 잠김, guardian_report_link·guardian_report service_role 전용';
END $$;
