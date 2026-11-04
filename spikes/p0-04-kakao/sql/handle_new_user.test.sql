-- ============================================================
-- handle_new_user.draft.sql 검증 (로컬 Postgres 전용, 끝에서 ROLLBACK)
-- 실행: e2e/run.sh 가 00001 → 00002 → draft 적용 후 psql -v ON_ERROR_STOP=1 로 실행
-- auth.users INSERT/UPDATE 는 GoTrue 와 같은 역할(supabase_auth_admin)로 수행
-- ============================================================
\set QUIET on
BEGIN;

CREATE TEMP TABLE t_result (name TEXT, ok BOOLEAN, detail TEXT) ON COMMIT DROP;
GRANT ALL ON t_result TO supabase_auth_admin;

SET LOCAL ROLE supabase_auth_admin;

-- 1) Google (실명 full_name 포함)
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'minjun.parent@gmail.com',
  '{"provider":"google","providers":["google"]}',
  '{"iss":"https://accounts.google.com","sub":"1098","name":"김민준","full_name":"김민준","picture":"https://lh3.googleusercontent.com/a/x","avatar_url":"https://lh3.googleusercontent.com/a/x","provider_id":"1098","email":"minjun.parent@gmail.com","email_verified":true,"phone_verified":false}',
  now(), now());

-- 2) Kakao 내장 provider, 이메일 없음 (email NULL)
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', NULL,
  '{"provider":"kakao","providers":["kakao"]}',
  '{"iss":"https://kapi.kakao.com","sub":"4012345678","name":"이서연","full_name":"이서연","user_name":"이서연","preferred_username":"이서연","avatar_url":"http://k.kakaocdn.net/dn/x/img_640x640.jpg","provider_id":"4012345678","email_verified":false,"phone_verified":false}',
  now(), now());

-- 3) custom:kakao (OIDC), 이메일 없음
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', NULL,
  '{"provider":"custom:kakao","providers":["custom:kakao"]}',
  '{"iss":"https://kauth.kakao.com","sub":"4012345683","name":"coding_bear","preferred_username":"coding_bear","provider_id":"4012345683","email_verified":false,"phone_verified":false}',
  now(), now());

-- 4) custom:naver (P0-03), 식별자만
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', NULL,
  '{"provider":"custom:naver","providers":["custom:naver"]}',
  '{"iss":"https://nid.naver.com","sub":"Hc4r","provider_id":"Hc4r","email_verified":false,"phone_verified":false}',
  now(), now());

-- 5) 알 수 없는 provider (예: 브릿지가 admin API 로 만든 email 사용자) → 실패하지 않고 NULL
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', NULL,
  '{"provider":"email","providers":["email"]}', '{}', now(), now());

-- 6) 메타데이터가 아예 NULL 이어도 가입은 성공해야 함
INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', NULL, NULL, NULL, now(), now());

RESET ROLE;

INSERT INTO t_result
SELECT 'insert: 6명 모두 public.users 생성', count(*) = 6, count(*)::text
  FROM public.users WHERE id::text LIKE '00000000-0000-4000-8000-00000000000%';

INSERT INTO t_result
SELECT 'insert: display_name 은 모험가0000 형식 (실명·닉네임 복사 없음)',
       bool_and(display_name ~ '^모험가[0-9]{4}$'), string_agg(display_name, ',')
  FROM public.users WHERE id::text LIKE '00000000-0000-4000-8000-00000000000%';

INSERT INTO t_result
SELECT 'insert: 어떤 공개 컬럼에도 실명·provider 닉네임 없음',
       NOT bool_or(display_name IN ('김민준', '이서연', 'coding_bear') OR coalesce(nickname, '') <> ''),
       string_agg(coalesce(nickname, '∅'), ',')
  FROM public.users WHERE id::text LIKE '00000000-0000-4000-8000-00000000000%';

INSERT INTO t_result
SELECT 'insert: provider 사진 복사 없음 (avatar_url = '''')',
       bool_and(avatar_url = ''), string_agg(avatar_url, ',')
  FROM public.users WHERE id::text LIKE '00000000-0000-4000-8000-00000000000%';

INSERT INTO t_result
SELECT 'insert: last_login_provider 정규화 (google,kakao,kakao,naver,∅,∅)',
       string_agg(coalesce(last_login_provider, '∅'), ',' ORDER BY id) = 'google,kakao,kakao,naver,∅,∅',
       string_agg(coalesce(last_login_provider, '∅'), ',' ORDER BY id)
  FROM public.users WHERE id::text LIKE '00000000-0000-4000-8000-00000000000%';

INSERT INTO t_result
SELECT 'insert: 자리표시자는 user id 기준 결정적',
       public.pyroad_placeholder_name('00000000-0000-4000-8000-000000000001')
         = (SELECT display_name FROM public.users WHERE id = '00000000-0000-4000-8000-000000000001'),
       public.pyroad_placeholder_name('00000000-0000-4000-8000-000000000001');

-- 7) Google 사용자가 Kakao 를 연결한 뒤 Kakao 로 로그인: GoTrue 는 identity_data 를 덮어쓰고 last_sign_in_at 갱신
SET LOCAL ROLE supabase_auth_admin;
UPDATE auth.users
   SET raw_user_meta_data = raw_user_meta_data
         || '{"iss":"https://kauth.kakao.com","sub":"4012345699","name":"coding_bear","provider_id":"4012345699"}'
 WHERE id = '00000000-0000-4000-8000-000000000001';
UPDATE auth.users SET last_sign_in_at = now() + interval '1 hour'
 WHERE id = '00000000-0000-4000-8000-000000000001';
RESET ROLE;

INSERT INTO t_result
SELECT 'login: 연결된 Kakao 로 로그인하면 last_login_provider = kakao, last_login_at 갱신',
       u.last_login_provider = 'kakao' AND u.last_login_at = a.last_sign_in_at,
       u.last_login_provider || ' / ' || u.last_login_at::text
  FROM public.users u JOIN auth.users a USING (id)
 WHERE id = '00000000-0000-4000-8000-000000000001';

-- 8) 메타데이터만 바뀌고 last_sign_in_at 은 그대로 (예: updateUser({ data })) → 변화 없음
SET LOCAL ROLE supabase_auth_admin;
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"iss":"https://accounts.google.com"}'
 WHERE id = '00000000-0000-4000-8000-000000000001';
RESET ROLE;

INSERT INTO t_result
SELECT 'login: last_sign_in_at 변화 없으면 트리거 무시',
       last_login_provider = 'kakao', last_login_provider
  FROM public.users WHERE id = '00000000-0000-4000-8000-000000000001';

-- 9) iss 를 알 수 없으면 기존 값 유지
SET LOCAL ROLE supabase_auth_admin;
UPDATE auth.users SET raw_user_meta_data = '{"iss":"https://unknown.example"}', last_sign_in_at = now() + interval '2 hour'
 WHERE id = '00000000-0000-4000-8000-000000000004';
RESET ROLE;

INSERT INTO t_result
SELECT 'login: 알 수 없는 iss 면 last_login_provider 유지',
       last_login_provider = 'naver', last_login_provider
  FROM public.users WHERE id = '00000000-0000-4000-8000-000000000004';

-- 10) B24: search_path 고정, SECURITY DEFINER
INSERT INTO t_result
SELECT 'b24: ' || p.proname || ' search_path="" + definer',
       p.proconfig @> ARRAY['search_path=""'] AND (p.prosecdef OR p.proname LIKE 'pyroad_%'),
       array_to_string(p.proconfig, ';') || ' secdef=' || p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('handle_new_user', 'handle_user_signed_in', 'pyroad_social_provider', 'pyroad_placeholder_name');

-- 11) RPC 노출 차단
INSERT INTO t_result
SELECT 'grant: authenticated/anon 은 ' || f || ' 실행 불가',
       NOT has_function_privilege('authenticated', f, 'EXECUTE')
         AND NOT has_function_privilege('anon', f, 'EXECUTE'),
       f
  FROM unnest(ARRAY['public.handle_new_user()', 'public.handle_user_signed_in()',
                    'public.pyroad_social_provider(text,text)', 'public.pyroad_placeholder_name(uuid)']) AS f;

\set QUIET off
\pset footer off
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM t_result;

DO $$
DECLARE n_fail INT;
BEGIN
  SELECT count(*) INTO n_fail FROM t_result WHERE NOT coalesce(ok, false);
  IF n_fail > 0 THEN
    RAISE EXCEPTION 'handle_new_user.test.sql: % 개 실패', n_fail;
  END IF;
  RAISE NOTICE 'handle_new_user.test.sql: 모두 통과';
END $$;

ROLLBACK;
