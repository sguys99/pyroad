-- ============================================================
-- e2e 사후 검증: GoTrue(supabase_auth_admin)가 실제로 만든 auth.users 행에 대해
-- handle_new_user.draft.sql 트리거 결과를 확인한다. e2e/run.sh 가 gotrue-flow.mjs 다음에 실행
-- Kakao 회원번호(목업): 4012345678 kid / 4012345679 kid-default / 4012345680 kid-noconsent
--                       4012345682 parent-email(자동 연결) / 4012345690 kid-link(수동 연결)
-- ============================================================
\set QUIET on
CREATE TEMP TABLE r (name TEXT, ok BOOLEAN, detail TEXT);

INSERT INTO r
SELECT 'e2e: 이메일 없는 Kakao 가입자 3명 (auth.users.email IS NULL)',
       count(*) = 3 AND bool_and(a.email IS NULL),
       string_agg(i.provider_id || '=' || coalesce(a.email, 'NULL'), ', ')
  FROM auth.identities i JOIN auth.users a ON a.id = i.user_id
 WHERE i.provider = 'kakao' AND i.provider_id IN ('4012345678', '4012345679', '4012345680');

INSERT INTO r
SELECT 'e2e: GoTrue 가입 → handle_new_user (자리표시자, 사진·닉네임 미복사, last_login_provider=kakao)',
       count(*) = 3 AND bool_and(u.display_name ~ '^모험가[0-9]{4}$' AND u.avatar_url = ''
                                 AND u.nickname IS NULL AND u.last_login_provider = 'kakao'),
       string_agg(u.display_name || '/' || coalesce(u.last_login_provider, '∅'), ', ')
  FROM auth.identities i JOIN public.users u ON u.id = i.user_id
 WHERE i.provider = 'kakao' AND i.provider_id IN ('4012345678', '4012345679', '4012345680');

INSERT INTO r
SELECT 'e2e: email_optional=false 서버에서 실패한 시도는 사용자를 만들지 않음 (4012345679 identity 1개)',
       count(*) = 1, count(*)::text
  FROM auth.identities WHERE provider = 'kakao' AND provider_id = '4012345679';

INSERT INTO r
SELECT 'e2e: 재로그인(S7) 후 last_login_at = auth.users.last_sign_in_at',
       u.last_login_at = a.last_sign_in_at AND a.last_sign_in_at > a.created_at,
       u.last_login_at::text || ' / ' || a.last_sign_in_at::text
  FROM auth.identities i JOIN auth.users a ON a.id = i.user_id JOIN public.users u ON u.id = a.id
 WHERE i.provider = 'kakao' AND i.provider_id = '4012345678';

INSERT INTO r
SELECT 'e2e: 수동 연결 사용자는 app_metadata.provider=email 그대로, Kakao 로그인 후 last_login_provider=kakao',
       u.last_login_provider = 'kakao' AND a.raw_app_meta_data ->> 'provider' = 'email',
       coalesce(u.last_login_provider, '∅') || ' / app_metadata.provider=' || (a.raw_app_meta_data ->> 'provider')
  FROM auth.users a JOIN public.users u ON u.id = a.id
 WHERE a.email = 'google.kid@example.com';

INSERT INTO r
SELECT 'e2e: 수동 연결 사용자 identities = email + kakao',
       string_agg(i.provider, ',' ORDER BY i.provider) = 'email,kakao',
       string_agg(i.provider || ':' || i.provider_id, ',' ORDER BY i.provider)
  FROM auth.users a JOIN auth.identities i ON i.user_id = a.id
 WHERE a.email = 'google.kid@example.com';

INSERT INTO r
SELECT 'e2e: (비교) 비즈앱 이메일 자동 연결 사용자 identities = email + kakao',
       string_agg(i.provider, ',' ORDER BY i.provider) = 'email,kakao',
       string_agg(i.provider || ':' || i.provider_id, ',' ORDER BY i.provider)
  FROM auth.users a JOIN auth.identities i ON i.user_id = a.id
 WHERE a.email = 'kid.parent@kakao.com';

INSERT INTO r
SELECT 'e2e: 이메일 없는 Kakao 사용자는 어떤 기존 사용자와도 자동 연결되지 않음 (identity 1개씩)',
       bool_and(n = 1), string_agg(n::text, ',')
  FROM (SELECT count(*) AS n FROM auth.identities i2
         WHERE i2.user_id IN (SELECT user_id FROM auth.identities
                               WHERE provider = 'kakao' AND provider_id IN ('4012345678', '4012345679', '4012345680'))
         GROUP BY i2.user_id) t;

INSERT INTO r
SELECT 'e2e: 이메일 없는 사용자는 email_confirmed_at 도 NULL (세션 발급에는 문제 없음)',
       bool_and(a.email_confirmed_at IS NULL), string_agg(coalesce(a.email_confirmed_at::text, 'NULL'), ',')
  FROM auth.identities i JOIN auth.users a ON a.id = i.user_id
 WHERE i.provider = 'kakao' AND i.provider_id IN ('4012345678', '4012345679', '4012345680');

INSERT INTO r
SELECT 'e2e: custom:kakao(OIDC) 가입자도 iss 로 last_login_provider=kakao, 이메일 NULL, 내장 kakao 와 별개 사용자',
       u.last_login_provider = 'kakao' AND a.email IS NULL
         AND a.id <> (SELECT user_id FROM auth.identities WHERE provider = 'kakao' AND provider_id = '4012345678'),
       coalesce(u.last_login_provider, '∅') || ' / ' || (a.raw_user_meta_data ->> 'iss')
  FROM auth.identities i JOIN auth.users a ON a.id = i.user_id JOIN public.users u ON u.id = a.id
 WHERE i.provider = 'custom:kakao-mock' AND i.provider_id = '4012345678';

\set QUIET off
\pset footer off
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name, detail FROM r;

DO $$
DECLARE n_fail INT;
BEGIN
  SELECT count(*) INTO n_fail FROM r WHERE NOT coalesce(ok, false);
  IF n_fail > 0 THEN RAISE EXCEPTION 'e2e_check.sql: % 개 실패', n_fail; END IF;
  RAISE NOTICE 'e2e_check.sql: 모두 통과';
END $$;
