-- ============================================================
-- [P0-08] 운영 DB 읽기 전용 점검 쿼리 (SELECT 만 있음, 아무것도 바꾸지 않음)
-- Supabase SQL Editor 또는 읽기 전용 Supabase MCP 로 실행합니다.
-- 1~3: 00002 적용 "후" 확인 / 4~6: P1-02·P1-07 설계 전 운영 상태 확인
-- ============================================================

-- 1. user_profiles_public 권한: 기대값 → authenticated 의 SELECT 한 줄만 (anon 없음)
SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'user_profiles_public'
   AND grantee IN ('PUBLIC', 'anon', 'authenticated')
 GROUP BY grantee;

-- 2. notices 정책: 기대값 → notices_select_public 하나만
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notices' ORDER BY 1;

-- 3. 한 번에 보는 요약: 기대값 → anon_view_select=false, auth_view_update=false, notice_write_policies=0
SELECT has_table_privilege('anon', 'public.user_profiles_public', 'SELECT')          AS anon_view_select,
       has_table_privilege('authenticated', 'public.user_profiles_public', 'UPDATE') AS auth_view_update,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'notices' AND cmd <> 'SELECT') AS notice_write_policies;

-- 4. 새 테이블·함수 자동 노출 여부 (postgres 역할 기본 ACL)
--    테이블 anon=arwdDxtm → legacy(자동 노출) / anon=Dxtm 또는 없음 → 신규 기본값(GRANT 필수)
SELECT defaclobjtype AS type, defaclacl
  FROM pg_default_acl
 WHERE defaclrole = 'postgres'::regrole AND defaclnamespace = 'public'::regnamespace;

-- 5. pg_graphql 사용 여부 (켜져 있으면 /graphql/v1 도 같은 GRANT 를 따름)
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_graphql', 'pg_net', 'pg_cron');

-- 6. 운영 퀘스트의 정답 데이터 현황 (00003 자기 검증 NOTICE 와 비교할 기준값)
SELECT count(*)                                                                  AS quests,
       count(*) FILTER (WHERE expected_output <> '')                             AS with_expected_output,
       count(*) FILTER (WHERE prompt_skeleton ? 'hints')                         AS with_hints,
       count(*) FILTER (WHERE prompt_skeleton ? 'solution_code')                 AS with_solution_code,
       count(*) FILTER (WHERE jsonb_path_exists(prompt_skeleton, '$.steps[*].solution_code')) AS projects_with_step_solutions
  FROM public.quests;
