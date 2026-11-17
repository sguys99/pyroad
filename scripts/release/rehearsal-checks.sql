-- ============================================================
-- v1.0 리허설 점검 (P12-07, scripts/release/rehearse-v1.0.sh checks) — v1.0 묶음을 적용한 리허설 DB 에서
-- 한 트랜잭션 안에서 시험하고 **모두 되돌림(ROLLBACK)**. 결과 줄: PASS|FAIL <id> <설명>
-- 계정 이름 → id 는 rehearsal-data.sql 과 같은 md5('reh:' || 이름)::uuid
-- ============================================================
\set ON_ERROR_STOP 1
BEGIN;
CREATE TEMP TABLE reh_result (n SERIAL, ok BOOLEAN, id TEXT, detail TEXT);
CREATE FUNCTION pg_temp.uid(p_label TEXT) RETURNS UUID LANGUAGE sql IMMUTABLE AS $$ SELECT md5('reh:' || p_label)::uuid $$;
CREATE FUNCTION pg_temp.ok(p_ok BOOLEAN, p_id TEXT, p_detail TEXT) RETURNS VOID LANGUAGE sql AS
  $$ INSERT INTO reh_result (ok, id, detail) VALUES (coalesce(p_ok, false), p_id, p_detail) $$;
CREATE FUNCTION pg_temp.labels(p_ids UUID[]) RETURNS TEXT LANGUAGE sql AS $$
  SELECT coalesce(string_agg(lbl, ',' ORDER BY lbl COLLATE "C"), '') FROM (SELECT coalesce(
           (SELECT l FROM unnest(ARRAY['ghost1','ghost2','ghost3','left3','left10','left40','left100','noage-empty','noage-study',
                                       'legacy1','legacy2','legacy3','legacy4','legacy5','legacy-poster','admin','longcode',
                                       'kid-wait1','kid-wait2','kid-wait3']) AS l WHERE pg_temp.uid(l) = x), x::text) AS lbl
    FROM unnest(p_ids) AS x) AS s $$;
CREATE FUNCTION pg_temp.fails(p_sql TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;

-- ── 00061 파기 대상 (B118): 유예 = max(가입일, 적용 시각) + 30일, 활동 있는 계정·온보딩 끝낸 계정은 아님 ─────────────
DO $$
DECLARE
  v_expect TEXT := 'ghost1,ghost2,ghost3,left10,left100,left3,left40,noage-empty';
  v_now TEXT := pg_temp.labels(ARRAY(SELECT public.list_expired_incomplete(500)));
  v_29 TEXT := pg_temp.labels(ARRAY(SELECT public.list_expired_incomplete(500, NULL, now() + interval '29 days')));
  v_31 TEXT := pg_temp.labels(ARRAY(SELECT public.list_expired_incomplete(500, NULL, now() + interval '31 days')));
  v_unc INTEGER := (SELECT count(*) FROM public.list_expired_unconsented(500));
BEGIN
  PERFORM pg_temp.ok(v_now = '', 'PURGE-1', '적용 직후 파기 대상 0 (지금: "' || v_now || '")');
  PERFORM pg_temp.ok(v_29 = '', 'PURGE-2', '29일 뒤에도 0 — 400일 된 계정도 적용 시각부터 30일 유예 ("' || v_29 || '")');
  PERFORM pg_temp.ok(v_31 = v_expect, 'PURGE-3', '31일 뒤 대상 = 무활동 미완료 계정만 (' || v_31 || ')');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.list_expired_incomplete(500, NULL, now() + interval '31 days') AS x(id)
                                 JOIN public.users AS u ON u.id = x.id WHERE u.onboarded_at IS NOT NULL AND u.age_band IS NOT NULL),
                     'PURGE-4', '31일 뒤 대상에 온보딩·나이 확인을 마친 계정 없음');
  PERFORM pg_temp.ok(v_unc = 1, 'PURGE-5', '기존 미동의 파기(00024) 대상은 그대로 ' || v_unc || '명 (kid-wait 기한 지남 1명, v1.0 과 무관)');
END $$;

-- ── 00060 크기 CHECK (B108): 넘는 행이 있는 제약만 NOT VALID ───────────────────────────────────────────────────
DO $$
DECLARE
  v TEXT := (SELECT string_agg(conname || '=' || convalidated, ',' ORDER BY conname) FROM pg_constraint
              WHERE conname IN ('user_progress_code_submitted_size', 'user_progress_step_submissions_size', 'users_preferred_provider_size'));
  v_user UUID := pg_temp.uid('longcode');
  v_over UUID := (SELECT quest_id FROM public.user_progress WHERE user_id = pg_temp.uid('longcode') AND char_length(code_submitted) = 50001);
  v_edge UUID := (SELECT quest_id FROM public.user_progress WHERE user_id = pg_temp.uid('longcode') AND char_length(code_submitted) = 50000);
  v_free UUID := (SELECT q.id FROM public.quests AS q WHERE q.quest_type = 'code'
                    AND NOT EXISTS (SELECT 1 FROM public.user_progress AS p WHERE p.user_id = pg_temp.uid('longcode') AND p.quest_id = q.id) LIMIT 1);
BEGIN
  PERFORM pg_temp.ok(v = 'user_progress_code_submitted_size=false,user_progress_step_submissions_size=false,users_preferred_provider_size=true',
                     'SIZE-1', '넘는 행이 있는 code·steps 만 NOT VALID, provider 는 VALID (' || v || ')');
  PERFORM pg_temp.ok(pg_temp.fails(format('UPDATE public.user_progress SET current_step = 2 WHERE user_id = %L AND quest_id = %L', v_user, v_over)) = '23514',
                     'SIZE-2', '⚠️ 넘는 기존 행은 코드를 줄이지 않는 갱신(자동 저장의 단계만·힌트·완료 RPC)이 CHECK 위반 → 런북 정리 대상');
  PERFORM pg_temp.ok(pg_temp.fails(format('UPDATE public.user_progress SET code_submitted = left(code_submitted, 50000) WHERE user_id = %L AND quest_id = %L', v_user, v_over)) IS NULL,
                     'SIZE-3', '그 행도 50,000자 이하로 고쳐 쓰는 갱신은 됨 (런북 정리 SQL)');
  PERFORM pg_temp.ok(pg_temp.fails(format('UPDATE public.user_progress SET current_step = 2 WHERE user_id = %L AND quest_id = %L', v_user, v_edge)) IS NULL,
                     'SIZE-4', '경계(정확히 50,000자) 행은 그대로 갱신됨');
  PERFORM pg_temp.ok(pg_temp.fails(format('INSERT INTO public.user_progress (user_id, quest_id, status, code_submitted) VALUES (%L, %L, %L, repeat(%L, 50001))', v_user, v_free, 'in_progress', 'x')) = '23514',
                     'SIZE-5', '새로 50,001자 쓰기는 거부');
  PERFORM pg_temp.ok(pg_temp.fails(format('UPDATE public.users SET preferred_provider = repeat(%L, 33) WHERE id = %L', 'p', v_user)) = '23514',
                     'SIZE-6', 'preferred_provider 33자 거부');
END $$;

-- ── 00059 Google 이름·사진 (B115): 다시 로그인해도 안 쌓임 / 새 가입도 / Kakao·Naver 는 그대로 ──────────────────────
DO $$
DECLARE
  k TEXT[] := ARRAY['name', 'full_name', 'given_name', 'family_name', 'picture', 'avatar_url'];
  v_g UUID := pg_temp.uid('pro3');   -- prov[1 + 3 % 3] = google
  v_k UUID := pg_temp.uid('left3');  -- kakao
  v_new UUID := gen_random_uuid();
  v_relogin JSONB := '{"iss":"https://accounts.google.com","name":"김다시","full_name":"김다시","given_name":"다시","family_name":"김","picture":"https://lh3.googleusercontent.com/a/x","avatar_url":"https://lh3.googleusercontent.com/a/x","email_verified":true}';
BEGIN
  -- GoTrue 가 로그인할 때 하는 것과 같은 병합
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || v_relogin, last_sign_in_at = now() WHERE id = v_g;
  UPDATE auth.identities SET identity_data = identity_data || (v_relogin - 'iss'), last_sign_in_at = now() WHERE user_id = v_g AND provider = 'google';
  PERFORM pg_temp.ok(NOT (SELECT raw_user_meta_data ?| k FROM auth.users WHERE id = v_g)
                     AND NOT (SELECT identity_data ?| k FROM auth.identities WHERE user_id = v_g AND provider = 'google'),
                     'G-1', 'Google 다시 로그인: users·identities 에 이름·사진 키가 다시 안 쌓임');
  PERFORM pg_temp.ok((SELECT raw_user_meta_data ->> 'iss' = 'https://accounts.google.com' AND raw_user_meta_data ? 'sub' AND raw_user_meta_data ? 'email'
                        FROM auth.users WHERE id = v_g)
                     AND (SELECT last_login_provider = 'google' FROM public.users WHERE id = v_g),
                     'G-2', 'iss·sub·email 은 남고 최근 로그인 provider(00013 트리거)도 google');
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_new, 'authenticated', 'authenticated', 'new@gmail.test',
          '{"provider":"google","providers":["google"]}', v_relogin || '{"sub":"999","email":"new@gmail.test"}', now(), now());
  PERFORM pg_temp.ok(NOT (SELECT raw_user_meta_data ?| k FROM auth.users WHERE id = v_new)
                     AND EXISTS (SELECT 1 FROM public.users WHERE id = v_new), 'G-3', '새 Google 가입도 이름·사진 없이 저장, public.users 행 생김');
  UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"name":"카카오닉네임"}' WHERE id = v_k;
  PERFORM pg_temp.ok((SELECT raw_user_meta_data ->> 'name' = '카카오닉네임' FROM auth.users WHERE id = v_k), 'G-4', 'Kakao 메타데이터는 트리거가 건드리지 않음');
END $$;

-- ── 이미 쌓인 Google 이름·사진 정리 SQL (런북 2-7 = docs/legal/v1.0-privacy-audit.md 7절 ②) ─────────────────────
CREATE TEMP TABLE before_u AS SELECT id, raw_user_meta_data AS m, raw_app_meta_data AS a, email FROM auth.users;
CREATE TEMP TABLE before_i AS SELECT id, user_id, provider, identity_data AS m FROM auth.identities;
DO $$ BEGIN PERFORM pg_temp.ok((SELECT count(*) FROM auth.users WHERE raw_user_meta_data ?| ARRAY['name','full_name','given_name','family_name','picture','avatar_url']) > 0,
                               'CLEAN-0', '정리 전: 이름·사진을 가진 계정 ' ||
                               (SELECT count(*) FROM auth.users WHERE raw_user_meta_data ?| ARRAY['name','full_name','given_name','family_name','picture','avatar_url']) || '개 (G-4 의 Kakao 1개 포함)'); END $$;
-- @runbook -- 정리 (Google identity
-- ↑ rehearse-v1.0.sh checks 가 런북 2-7 SQL 블록(begin/commit 뺌)으로 바꿔 넣음 — 런북 문장 그대로 시험
DO $$
DECLARE k TEXT[] := ARRAY['name', 'full_name', 'given_name', 'family_name', 'picture', 'avatar_url'];
BEGIN
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider = 'google' AND identity_data ?| k)
                     AND NOT EXISTS (SELECT 1 FROM auth.users AS u WHERE raw_user_meta_data ?| k
                                       AND EXISTS (SELECT 1 FROM auth.identities AS i WHERE i.user_id = u.id AND i.provider = 'google')),
                     'CLEAN-1', '정리 뒤 Google 계정의 이름·사진 키 0');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM auth.users AS u JOIN before_u AS b USING (id)
                                  WHERE u.raw_user_meta_data - k IS DISTINCT FROM b.m - k OR u.raw_app_meta_data IS DISTINCT FROM b.a OR u.email IS DISTINCT FROM b.email)
                     AND NOT EXISTS (SELECT 1 FROM auth.identities AS i JOIN before_i AS b USING (id) WHERE i.identity_data - k IS DISTINCT FROM b.m - k),
                     'CLEAN-2', '다른 키(iss·sub·email·provider_id·email_verified …)·app_metadata(role)·email 은 한 글자도 안 바뀜');
  PERFORM pg_temp.ok(NOT EXISTS (SELECT 1 FROM auth.users AS u JOIN before_u AS b USING (id)
                                  WHERE NOT EXISTS (SELECT 1 FROM auth.identities AS i WHERE i.user_id = u.id AND i.provider = 'google')
                                    AND u.raw_user_meta_data IS DISTINCT FROM b.m)
                     AND NOT EXISTS (SELECT 1 FROM auth.identities AS i JOIN before_i AS b USING (id) WHERE i.provider <> 'google' AND i.identity_data IS DISTINCT FROM b.m),
                     'CLEAN-3', 'Kakao·Naver 계정은 통째로 그대로 (Kakao 의 name 키도 남음)');
  PERFORM pg_temp.ok((SELECT count(*) FROM auth.users) = (SELECT count(*) FROM before_u), 'CLEAN-4', '계정 수 그대로');
END $$;

-- ── 그 밖 ─────────────────────────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM pg_temp.ok((SELECT count(*) FROM public.coin_balance_mismatches()) = 0, 'COIN-1', 'coin_balance_mismatches() 0');
  PERFORM pg_temp.ok((SELECT count(*) FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin') = 1, 'ADMIN-1', 'role=admin 계정 1 (런북 0절 ⛔ 확인 쿼리)');
END $$;

SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END || ' ' || id || ' ' || detail FROM reh_result ORDER BY n;
ROLLBACK;
