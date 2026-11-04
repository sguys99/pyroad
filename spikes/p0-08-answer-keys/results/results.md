# P0-08 접근 점검 결과

생성: 2026-11-03T10:10:23.628Z

## prod_baseline (48/48)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| ENV-1 | postgres | public 스키마 새 테이블의 anon 기본 권한 (legacy 자동 노출 여부) | on | on | PASS | 참고 | postgres 기본 ACL(테이블) anon=arwdDxtm |
| ENV-3 | postgres | public 스키마 새 함수의 anon EXECUTE 기본 권한 | on | on | PASS | 참고 | postgres 기본 ACL(함수) postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres |
| ENV-2 | postgres | anon 의 quests SELECT 권한 (00001 에 GRANT 가 없음) | true | true | PASS | 참고 | has_table_privilege=t |
| B03-1 | anon | GET /user_profiles_public?select=* | allowed | allowed | PASS | 현재 취약 | 200 rows=4 |
| B03-2 | anon(psql) | SET ROLE anon; SELECT count(*) FROM user_profiles_public | allowed | allowed | PASS | 현재 취약 | 4 |
| B03-3 | authenticated | GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐 | allowed | allowed | PASS | 보안 | rows=4 (전체 사용자), cols=avatar_url,display_name,id |
| B03-4 | authenticated | GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼) | no-column | no-column | PASS | 보안 | 400 42703 column user_profiles_public.total_xp does not exist |
| B03-5 | authenticated | PATCH /user_profiles_public?id=eq.<다른 사용자> display_name | written | written | PASS | 현재 취약 | 204 |
| B03-6 | anon | PATCH /user_profiles_public?id=eq.<사용자> display_name | written | written | PASS | 현재 취약 | 204 |
| B03-7 | authenticated | DELETE /user_profiles_public?id=eq.<다른 사용자> (public.users 행 삭제 → 진행·뱃지 연쇄 삭제) | written | written | PASS | 현재 취약 | 204 |
| B03-7b | anon | DELETE /user_profiles_public?id=eq.<사용자> (비로그인 삭제) | written | written | PASS | 현재 취약 | 204 |
| B03-8 | postgres | user_profiles_public 에 대한 anon/authenticated 권한 목록 | anon+authenticated:ALL | anon+authenticated:ALL | PASS | 현재 취약 | anon:DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE authenticated:DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE |
| B03-9 | authenticated | GET /board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count) (게시판 목록) | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B03-10 | authenticated | GET /board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url) (게시글 상세) | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B03-11 | service_role | GET /user_profiles_public?select=* | allowed | allowed | PASS | 보안 | 200 rows=2 |
| B02-1 | anon | GET /notices?select=* (공지는 공개) | allowed | allowed | PASS | 참고 | 200 rows=2 |
| B02-2 | authenticated | POST /notices {user_id: 본인} | written | written | PASS | 현재 취약 | 201 |
| B02-3 | authenticated(psql) | SET ROLE authenticated; INSERT INTO notices (user_id=auth.uid()) | allowed | allowed | PASS | 현재 취약 |  |
| B02-4 | authenticated | PATCH /notices?id=eq.<본인 소유 공지> | written | written | PASS | 현재 취약 | 204 |
| B02-5 | authenticated | DELETE /notices?id=eq.<본인 소유 공지> | written | written | PASS | 현재 취약 | 204 |
| B02-6 | authenticated | PATCH /notices?id=eq.<다른 사람 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-7 | anon | POST /notices | denied | denied | PASS | 보안 | 401 42501 new row violates row-level security policy for table "notices" |
| B02-8 | service_role | POST /notices (관리자 API 경로) | written | written | PASS | 보안 | 201 |
| B02-9 | postgres | notices 정책 목록 | notices_delete_own,notices_insert_authenticated,notices_select_public,notices_update_own | notices_delete_own,notices_insert_authenticated,notices_select_public,notices_update_own | PASS | 현재 취약 | notices_delete_own,notices_insert_authenticated,notices_select_public,notices_update_own |
| B04-1 | authenticated | PATCH /users?id=eq.<본인> {total_xp: 999999, current_level: 5} | written | written | PASS | 현재 취약 | 204 |
| B04-2 | authenticated | PATCH /users?id=eq.<본인> {golden_keys: 99} | written | written | PASS | 현재 취약 | 204 |
| B04-3 | authenticated | PATCH /users?id=eq.<다른 사용자> {total_xp: 1} | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B04-4 | authenticated | POST /user_progress (upsert) {quest: 7-1 최종 프로젝트, status: completed} | written | written | PASS | 현재 취약 | 201 |
| B04-5 | authenticated | POST /user_badges {badge_type: project_builder} | written | written | PASS | 현재 취약 | 201 |
| B04-6 | authenticated | POST /user_badges {user_id: 다른 사용자} | denied | denied | PASS | 보안 | 403 42501 new row violates row-level security policy for table "user_badges" |
| B04-7 | authenticated(psql) | SET ROLE authenticated; UPDATE users SET total_xp = 123456 WHERE id = auth.uid() | allowed | allowed | PASS | 현재 취약 | 123456 |
| B04-8 | authenticated | GET /users?select=custom_api_keys (본인 API 키 평문 조회, B13) | allowed | allowed | PASS | 현재 취약 | 200 rows=1 |
| B04-9 | authenticated | GET /users?select=* → 본인 행만 | own-only | own-only | PASS | 보안 | rows=1 |
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-4 | authenticated | GET /quests?select=* | allowed | allowed | PASS | 보안 | 200 rows=44 |
| B07-5 | authenticated | GET /quests?select=sol:prompt_skeleton->solution_code (운영과 같은 데이터: 황금키 정답 코드) | leaks | leaks | PASS | 현재 취약 | 43/44행에 정답 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,hints,learning_goals,solution_code,starter_code,story_conte |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B08-0 | postgres | 운영 재현 데이터: 00001 Section 6 를 seed 뒤에 재실행한 상태의 solution_code 수 | 44 | 44 | PASS | 참고 | quests with solution_code = 44 |

## prod_plus_00002 (44/44)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| B03-1 | anon | GET /user_profiles_public?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-2 | anon(psql) | SET ROLE anon; SELECT count(*) FROM user_profiles_public | denied | denied | PASS | 보안 | ERROR:  permission denied for view user_profiles_public |
| B03-3 | authenticated | GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐 | allowed | allowed | PASS | 보안 | rows=6 (전체 사용자), cols=avatar_url,display_name,id |
| B03-4 | authenticated | GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼) | no-column | no-column | PASS | 보안 | 400 42703 column user_profiles_public.total_xp does not exist |
| B03-5 | authenticated | PATCH /user_profiles_public?id=eq.<다른 사용자> display_name | denied | denied | PASS | 보안 | 403 42501 permission denied for view user_profiles_public |
| B03-6 | anon | PATCH /user_profiles_public?id=eq.<사용자> display_name | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-7 | authenticated | DELETE /user_profiles_public?id=eq.<다른 사용자> (public.users 행 삭제 → 진행·뱃지 연쇄 삭제) | denied | denied | PASS | 보안 | 403 42501 permission denied for view user_profiles_public |
| B03-7b | anon | DELETE /user_profiles_public?id=eq.<사용자> (비로그인 삭제) | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-8 | postgres | user_profiles_public 에 대한 anon/authenticated 권한 목록 | authenticated:SELECT | authenticated:SELECT | PASS | 보안 | authenticated:SELECT |
| B03-9 | authenticated | GET /board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count) (게시판 목록) | allowed | allowed | PASS | 보안 | 200 rows=2 |
| B03-10 | authenticated | GET /board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url) (게시글 상세) | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B03-11 | service_role | GET /user_profiles_public?select=* | allowed | allowed | PASS | 보안 | 200 rows=6 |
| B02-1 | anon | GET /notices?select=* (공지는 공개) | allowed | allowed | PASS | 참고 | 200 rows=5 |
| B02-2 | authenticated | POST /notices {user_id: 본인} | denied | denied | PASS | 보안 | 403 42501 new row violates row-level security policy for table "notices" |
| B02-3 | authenticated(psql) | SET ROLE authenticated; INSERT INTO notices (user_id=auth.uid()) | denied | denied | PASS | 보안 | ERROR:  new row violates row-level security policy for table "notices" |
| B02-4 | authenticated | PATCH /notices?id=eq.<본인 소유 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-5 | authenticated | DELETE /notices?id=eq.<본인 소유 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-6 | authenticated | PATCH /notices?id=eq.<다른 사람 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-7 | anon | POST /notices | denied | denied | PASS | 보안 | 401 42501 new row violates row-level security policy for table "notices" |
| B02-8 | service_role | POST /notices (관리자 API 경로) | written | written | PASS | 보안 | 201 |
| B02-9 | postgres | notices 정책 목록 | notices_select_public | notices_select_public | PASS | 보안 | notices_select_public |
| B04-1 | authenticated | PATCH /users?id=eq.<본인> {total_xp: 999999, current_level: 5} | written | written | PASS | 현재 취약 | 204 |
| B04-2 | authenticated | PATCH /users?id=eq.<본인> {golden_keys: 99} | written | written | PASS | 현재 취약 | 204 |
| B04-3 | authenticated | PATCH /users?id=eq.<다른 사용자> {total_xp: 1} | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B04-4 | authenticated | POST /user_progress (upsert) {quest: 7-1 최종 프로젝트, status: completed} | written | written | PASS | 현재 취약 | 201 |
| B04-5 | authenticated | POST /user_badges {badge_type: project_builder} | written | written | PASS | 현재 취약 | 201 |
| B04-6 | authenticated | POST /user_badges {user_id: 다른 사용자} | denied | denied | PASS | 보안 | 403 42501 new row violates row-level security policy for table "user_badges" |
| B04-7 | authenticated(psql) | SET ROLE authenticated; UPDATE users SET total_xp = 123456 WHERE id = auth.uid() | allowed | allowed | PASS | 현재 취약 | 123456 |
| B04-8 | authenticated | GET /users?select=custom_api_keys (본인 API 키 평문 조회, B13) | allowed | allowed | PASS | 현재 취약 | 200 rows=1 |
| B04-9 | authenticated | GET /users?select=* → 본인 행만 | own-only | own-only | PASS | 보안 | rows=1 |
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-4 | authenticated | GET /quests?select=* | allowed | allowed | PASS | 보안 | 200 rows=44 |
| B07-5 | authenticated | GET /quests?select=sol:prompt_skeleton->solution_code (운영과 같은 데이터: 황금키 정답 코드) | leaks | leaks | PASS | 현재 취약 | 43/44행에 정답 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,hints,learning_goals,solution_code,starter_code,story_conte |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |

## prod_plus_00003 (43/43)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| AK-1 | anon | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for table quest_answer_keys |
| AK-2 | authenticated | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-3 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id&quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-4 | authenticated | GET /quests?select=id,quest_answer_keys(*) (임베딩 우회) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-5 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id,quests(id) (역방향 임베딩) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-6 | authenticated | POST /rest/v1/quest_answer_keys {quest_id: 1-1, expected_output: 'x'} | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-7 | authenticated | PATCH /rest/v1/quest_answer_keys?quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-8 | authenticated | DELETE /rest/v1/quest_answer_keys?quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-9 | anon | POST /rest/v1/quest_answer_keys | denied | denied | PASS | 보안 | 401 42501 permission denied for table quest_answer_keys |
| AK-10 | service_role | GET /rest/v1/quest_answer_keys?select=*&quest_id=eq.<1-1> | allowed | allowed | PASS | 보안 | 200 rows=1 |
| AK-11 | service_role | PATCH /rest/v1/quest_answer_keys?quest_id=eq.<1-1> (콘텐츠 도구 경로) | written | written | PASS | 보안 | 204 |
| AK-12 | anon(psql) | SET ROLE anon; SELECT count(*) FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-13 | authenticated(psql) | SET ROLE authenticated (+jwt claims); SELECT * FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-14 | service_role(psql) | SET ROLE service_role; SELECT count(*) FROM quest_answer_keys | allowed | allowed | PASS | 보안 | 44 |
| AK-15 | anon | GET /rest/v1/ (OpenAPI 스키마에 quest_answer_keys 노출 여부) | hidden\|denied | hidden | PASS | 보안 | 200 paths=9 |
| AK-16 | authenticated | GET /rest/v1/ (OpenAPI, 로그인 사용자) | hidden\|denied | hidden | PASS | 보안 | 200 paths=10 |
| AK-17 | postgres | quests 에 남은 정답 행 수 / quest_answer_keys 행 수 | 0/44 | 0/44 | PASS | 보안 | expected_output 44, hints 44, solution_code 43, steps 1 |
| AK-18 | postgres | 백스톱: 트리거를 끄고 quests.expected_output 에 정답을 쓰면 | blocked | blocked | PASS | 보안 | ERROR:  new row for relation "quests" violates check constraint "quests_no_answer_fields" |
| AK-19 | postgres | 백스톱: 퀴즈 보기에 is_correct 를 넣으면 | blocked | blocked | PASS | 보안 | ERROR:  new row for relation "quests" violates check constraint "quests_no_answer_fields" |
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | no-answers | no-answers | PASS | 보안 | rows=44 |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | no-answers | no-answers | PASS | 보안 | rows=44 |
| B07-4 | authenticated | GET /quests?select=* | allowed | allowed | PASS | 보안 | 200 rows=44 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,learning_goals,starter_code,story_context,topic |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| LEG-1 | service_role | validate/route.ts 가 읽는 quests.expected_output (00003 이후) | empty-string | empty-string | PASS | 참고 | {"expected_output":""} |
| LEG-2 | service_role | golden-key·tutor 가 읽는 prompt_skeleton.solution_code / hints (00003 이후) | absent | absent | PASS | 참고 | exercise_description,expected_output_hint,fallback_text,learning_goals,starter_code,story_context,topic |
| LEG-3 | service_role | 대체 경로: GET /quest_answer_keys?select=expected_output,hints,solution_code,steps&quest_id=eq.<1-1> | allowed | allowed | PASS | 보안 | 200 rows=1 |
| RS-1 | postgres | seed.sql 재실행 → quests 에 정답이 다시 생기는지 / solution_code 유지되는지 | no-leak+kept | no-leak+kept | PASS | 보안 | quests 잔여 정답 0, solution_code 43→43, hints 44 |
| ST-1 | postgres | quest_answer_keys: RLS 켜짐 + 정책 0개 | rls=on,policies=0 | rls=on,policies=0 | PASS | 보안 | rls=on,policies=0 |
| ST-2 | postgres | quest_answer_keys 테이블 권한 (anon/authenticated/PUBLIC) | none | none | PASS | 보안 | (없음) |
| ST-3 | postgres | quest_answer_keys 를 참조하는 뷰 | none | none | PASS | 보안 | (없음) |
| ST-4 | postgres | Realtime publication 에 quest_answer_keys 포함 여부 | none | none | PASS | 보안 | (없음) |
| ST-5 | postgres | anon/authenticated 가 실행할 수 있는 public SECURITY DEFINER 함수 (트리거 함수 제외) | none | none | PASS | 보안 | (없음) |
| ST-6 | postgres | anon/authenticated 가 EXECUTE 가능한 SECURITY DEFINER 트리거 함수 (RPC 로는 호출 불가, 참고) | handle_new_user\|none | handle_new_user | PASS | 참고 | handle_new_user |
| RB-1 | postgres | rollback 후 quests 전체 md5 = seed+Section6 원본 md5 | identical | identical | PASS | 보안 | b119369187c1270517d88fc710379bbd |

## fresh_repo (36/36)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| B08-1 | postgres | 새 DB (마이그레이션 → seed 순서) 의 solution_code 가 있는 퀘스트 수 | 0 | 0 | PASS | 현재 취약 | 44개 중 0개 |
| B08-2 | postgres | Section 6 수동 실행 후 seed 재실행 → solution_code 가 지워지는지 | overwritten | overwritten | PASS | 현재 취약 | seed 재실행 후 solution_code 0개 |
| B03-1 | anon | GET /user_profiles_public?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-2 | anon(psql) | SET ROLE anon; SELECT count(*) FROM user_profiles_public | denied | denied | PASS | 보안 | ERROR:  permission denied for view user_profiles_public |
| B03-3 | authenticated | GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐 | allowed | allowed | PASS | 보안 | rows=4 (전체 사용자), cols=avatar_url,display_name,id |
| B03-4 | authenticated | GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼) | no-column | no-column | PASS | 보안 | 400 42703 column user_profiles_public.total_xp does not exist |
| B03-5 | authenticated | PATCH /user_profiles_public?id=eq.<다른 사용자> display_name | denied | denied | PASS | 보안 | 403 42501 permission denied for view user_profiles_public |
| B03-6 | anon | PATCH /user_profiles_public?id=eq.<사용자> display_name | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-7 | authenticated | DELETE /user_profiles_public?id=eq.<다른 사용자> (public.users 행 삭제 → 진행·뱃지 연쇄 삭제) | denied | denied | PASS | 보안 | 403 42501 permission denied for view user_profiles_public |
| B03-7b | anon | DELETE /user_profiles_public?id=eq.<사용자> (비로그인 삭제) | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-8 | postgres | user_profiles_public 에 대한 anon/authenticated 권한 목록 | authenticated:SELECT | authenticated:SELECT | PASS | 보안 | authenticated:SELECT |
| B03-9 | authenticated | GET /board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count) (게시판 목록) | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B03-10 | authenticated | GET /board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url) (게시글 상세) | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B03-11 | service_role | GET /user_profiles_public?select=* | allowed | allowed | PASS | 보안 | 200 rows=4 |
| B02-1 | anon | GET /notices?select=* (공지는 공개) | allowed | allowed | PASS | 참고 | 200 rows=2 |
| B02-2 | authenticated | POST /notices {user_id: 본인} | denied | denied | PASS | 보안 | 403 42501 new row violates row-level security policy for table "notices" |
| B02-3 | authenticated(psql) | SET ROLE authenticated; INSERT INTO notices (user_id=auth.uid()) | denied | denied | PASS | 보안 | ERROR:  new row violates row-level security policy for table "notices" |
| B02-4 | authenticated | PATCH /notices?id=eq.<본인 소유 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-5 | authenticated | DELETE /notices?id=eq.<본인 소유 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-6 | authenticated | PATCH /notices?id=eq.<다른 사람 공지> | no-op | no-op | PASS | 보안 | 204 (RLS 로 0행) |
| B02-7 | anon | POST /notices | denied | denied | PASS | 보안 | 401 42501 new row violates row-level security policy for table "notices" |
| B02-8 | service_role | POST /notices (관리자 API 경로) | written | written | PASS | 보안 | 201 |
| B02-9 | postgres | notices 정책 목록 | notices_select_public | notices_select_public | PASS | 보안 | notices_select_public |
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-4 | authenticated | GET /quests?select=* | allowed | allowed | PASS | 보안 | 200 rows=44 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,hints,learning_goals,starter_code,story_context,topic |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |

## alt_column_privs (20/20)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | denied | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| B07-4 | authenticated | GET /quests?select=* | denied | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,hints,learning_goals,starter_code,story_context,topic |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| CP-1 | authenticated | GET /quests?select=expected_output (회수한 컬럼) | denied | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| CP-2 | authenticated | GET /quests?select=* (PostgREST 는 * 를 모든 컬럼으로 펼침 → 42501) | denied | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| CP-3 | authenticated | HEAD /quests?select=* + Prefer: count=exact (supabase-js .select("*", {count, head:true})) | denied\|allowed\|empty | denied | PASS | 참고 | 403 |
| CP-4 | authenticated | GET /stages?select=*,quests(*) (임베딩 * 도 실패) | denied | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| CP-5 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code (jsonb 안의 정답) | leaks | leaks | PASS | 현재 취약 | 44/44행에 정답 |
| CP-6 | authenticated | POST /quests?select=* 같은 representation 응답 (insert().select()) — quests 쓰기 정책이 없어 해당 없음 | n/a | n/a | PASS | 참고 | 클라이언트가 quests 를 쓰지 않음 |
| CP-7 | postgres | 컬럼을 새로 추가하면 클라이언트에 자동으로 보이는지 (ALTER TABLE quests ADD COLUMN x) | hidden | hidden | PASS | 참고 | has_column_privilege=f (새 컬럼마다 GRANT 필요) |

## fresh_with_00003 (41/41)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| AK-1 | anon | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for table quest_answer_keys |
| AK-2 | authenticated | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-3 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id&quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-4 | authenticated | GET /quests?select=id,quest_answer_keys(*) (임베딩 우회) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-5 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id,quests(id) (역방향 임베딩) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-6 | authenticated | POST /rest/v1/quest_answer_keys {quest_id: 1-1, expected_output: 'x'} | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-7 | authenticated | PATCH /rest/v1/quest_answer_keys?quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-8 | authenticated | DELETE /rest/v1/quest_answer_keys?quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-9 | anon | POST /rest/v1/quest_answer_keys | denied | denied | PASS | 보안 | 401 42501 permission denied for table quest_answer_keys |
| AK-10 | service_role | GET /rest/v1/quest_answer_keys?select=*&quest_id=eq.<1-1> | allowed | allowed | PASS | 보안 | 200 rows=1 |
| AK-11 | service_role | PATCH /rest/v1/quest_answer_keys?quest_id=eq.<1-1> (콘텐츠 도구 경로) | written | written | PASS | 보안 | 204 |
| AK-12 | anon(psql) | SET ROLE anon; SELECT count(*) FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-13 | authenticated(psql) | SET ROLE authenticated (+jwt claims); SELECT * FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-14 | service_role(psql) | SET ROLE service_role; SELECT count(*) FROM quest_answer_keys | allowed | allowed | PASS | 보안 | 44 |
| AK-15 | anon | GET /rest/v1/ (OpenAPI 스키마에 quest_answer_keys 노출 여부) | hidden\|denied | hidden | PASS | 보안 | 200 paths=9 |
| AK-16 | authenticated | GET /rest/v1/ (OpenAPI, 로그인 사용자) | hidden\|denied | hidden | PASS | 보안 | 200 paths=10 |
| AK-17 | postgres | quests 에 남은 정답 행 수 / quest_answer_keys 행 수 | 0/44 | 0/44 | PASS | 보안 | expected_output 44, hints 44, solution_code 0, steps 1 |
| AK-18 | postgres | 백스톱: 트리거를 끄고 quests.expected_output 에 정답을 쓰면 | blocked | blocked | PASS | 보안 | ERROR:  new row for relation "quests" violates check constraint "quests_no_answer_fields" |
| AK-19 | postgres | 백스톱: 퀴즈 보기에 is_correct 를 넣으면 | blocked | blocked | PASS | 보안 | ERROR:  new row for relation "quests" violates check constraint "quests_no_answer_fields" |
| B07-1 | anon | GET /quests?select=id (quests 는 로그인 사용자만) | empty | empty | PASS | 보안 | 200 rows=0 |
| B07-2 | authenticated | GET /quests?select=id,expected_output | no-answers | no-answers | PASS | 보안 | rows=44 |
| B07-3 | authenticated | GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps | no-answers | no-answers | PASS | 보안 | rows=44 |
| B07-4 | authenticated | GET /quests?select=* | allowed | allowed | PASS | 보안 | 200 rows=44 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | allowed | allowed | PASS | 보안 | 200 rows=1 skeleton keys=exercise_description,expected_output_hint,fallback_text,learning_goals,starter_code,story_context,topic |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | allowed | allowed | PASS | 보안 | 200 rows=7 |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | allowed | allowed | PASS | 보안 | 200 rows=1 |
| B08-3 | postgres | 00003 적용된 새 DB 의 solution_code 수 (seed 에 정답 코드가 없음) | 0 | 0 | PASS | 현재 취약 | quest_answer_keys 중 0개 |
| B08-4 | postgres | B08 해결안: 00001 Section 6 UPDATE 를 seed 뒤에 실행 → 분리 트리거가 정답 테이블로 옮김 | 43+1 | 43+1 | PASS | 보안 | 정답 테이블 top-level+프로젝트 = 43+1, quests 잔여 0 |
| RS-1 | postgres | seed.sql 재실행 → quests 에 정답이 다시 생기는지 / solution_code 유지되는지 | no-leak+kept | no-leak+kept | PASS | 보안 | quests 잔여 정답 0, solution_code 0→0, hints 44 |
| ST-1 | postgres | quest_answer_keys: RLS 켜짐 + 정책 0개 | rls=on,policies=0 | rls=on,policies=0 | PASS | 보안 | rls=on,policies=0 |
| ST-2 | postgres | quest_answer_keys 테이블 권한 (anon/authenticated/PUBLIC) | none | none | PASS | 보안 | (없음) |
| ST-3 | postgres | quest_answer_keys 를 참조하는 뷰 | none | none | PASS | 보안 | (없음) |
| ST-4 | postgres | Realtime publication 에 quest_answer_keys 포함 여부 | none | none | PASS | 보안 | (없음) |
| ST-5 | postgres | anon/authenticated 가 실행할 수 있는 public SECURITY DEFINER 함수 (트리거 함수 제외) | none | none | PASS | 보안 | (없음) |
| ST-6 | postgres | anon/authenticated 가 EXECUTE 가능한 SECURITY DEFINER 트리거 함수 (RPC 로는 호출 불가, 참고) | handle_new_user\|none | handle_new_user | PASS | 참고 | handle_new_user |

## quiz_rpc (26/26)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| RPC-1 | anon | POST /rest/v1/rpc/submit_quiz_answer | denied | denied | PASS | 보안 | 401 42501 permission denied for function submit_quiz_answer |
| RPC-2 | authenticated | POST /rest/v1/rpc/submit_quiz_answer {p_user_id: 본인} | denied | denied | PASS | 보안 | 403 42501 permission denied for function submit_quiz_answer |
| RPC-3 | authenticated | POST /rest/v1/rpc/submit_quiz_answer {p_user_id: 다른 사용자} (사칭) | denied | denied | PASS | 보안 | 403 42501 permission denied for function submit_quiz_answer |
| RPC-4 | service_role | POST /rest/v1/rpc/submit_quiz_answer 오답 → 응답에 정답이 없는지 | no-leak | no-leak | PASS | 보안 | {"correct":false,"attempt_no":1,"xp_awarded":0,"explanation":"문자열이 아니라 숫자 덧셈이에요.","already_completed":false} |
| RPC-5 | service_role | POST /rest/v1/rpc/submit_quiz_answer 두 번째 시도에 정답 → 별 2개, XP 1회 | stars=2,xp=30 | stars=2,xp=30 | PASS | 보안 | {"stars":2,"answer":"opt_k2","correct":true,"attempt_no":2,"xp_awarded":30,"explanation":"1 + 2 를 계산해서 3 이 나와요.","already_completed":false} |
| RPC-6 | service_role | POST /rest/v1/rpc/submit_quiz_answer 완료 후 다시 정답 → 보상 없음 (멱등) | already,xp=0 | already,xp=0 | PASS | 보안 | {"answer":"opt_k2","correct":true,"attempt_no":3,"xp_awarded":0,"explanation":"1 + 2 를 계산해서 3 이 나와요.","already_completed":true} |
| RPC-7 | service_role | 보기 4개 동시 제출 → 시도 번호 1~4 직렬화, 정답 1회, XP 1회 | serialized | serialized | PASS | 보안 | attempt_no=1,2,3,4, 정답 응답 1개(stars=1), total_xp=30 |
| RPC-8 | service_role | 같은 정답 5개 동시 제출 → XP 1회만 | once | once | PASS | 보안 | xp 지급 응답 1개, total_xp=30, status=200,200,200,200,200 |
| RPC-9 | service_role | 10초 안에 7번 연속 오답 제출 → 6번째부터 429 | limited@6 | limited@6 | PASS | 보안 | 200,200,200,200,200,429,429 |
| RPC-10 | service_role | parsons: 순서를 뒤집으면 오답, 맞는 순서면 정답 (jsonb = 비교) | order-sensitive | order-sensitive | PASS | 보안 | {"correct":false,"attempt_no":1,"xp_awarded":0,"explanation":"for 줄이 먼저, 들여쓴 줄이 그 안에 와요.","already_completed":false} / {"stars":2,"answer":[ |
| RPC-11 | postgres | 함정 확인: '[["ln_m","ln_x"]]' @> '[["ln_x","ln_m"]]' (포함 연산자는 순서를 무시) | true | true | PASS | 참고 | @> 결과 t → 채점에 @> 쓰면 안 됨 |
| RPC-12 | authenticated | 노출형 (ii-a) grade_quiz 로 보기 4개 대입 → 흔적 없이 정답 확인 | oracle | oracle | PASS | 현재 취약 | 4번 호출로 opt_k2 확인, 기록된 시도 0→0 |
| RPC-13 | authenticated | 노출형 (ii-b) submit_quiz_answer_self 로 대입 → 시도는 기록되고 별이 깎임 | recorded | recorded | PASS | 참고 | 시도 3개 기록, 별 1 |
| RPC-14 | authenticated | GET /quiz_attempts → 본인 기록만 | own-only | own-only | PASS | 보안 | rows=3 |
| RPC-15 | authenticated | POST /quiz_attempts (시도 기록 위조) | denied | denied | PASS | 보안 | 403 42501 permission denied for table quiz_attempts |
| RPC-16 | authenticated | PATCH /user_progress?quest_id=eq.<퀴즈> {stars: 3} (P1-04 전 별 조작) | written | written | PASS | 현재 취약 | 204 |
| ST-1 | postgres | quest_answer_keys: RLS 켜짐 + 정책 0개 | rls=on,policies=0 | rls=on,policies=0 | PASS | 보안 | rls=on,policies=0 |
| ST-2 | postgres | quest_answer_keys 테이블 권한 (anon/authenticated/PUBLIC) | none | none | PASS | 보안 | (없음) |
| ST-3 | postgres | quest_answer_keys 를 참조하는 뷰 | none | none | PASS | 보안 | (없음) |
| ST-4 | postgres | Realtime publication 에 quest_answer_keys 포함 여부 | none | none | PASS | 보안 | (없음) |
| ST-5 | postgres | anon/authenticated 가 실행할 수 있는 public SECURITY DEFINER 함수 (트리거 함수 제외) | grade_quiz,submit_quiz_answer_self | grade_quiz,submit_quiz_answer_self | PASS | 참고 | grade_quiz,submit_quiz_answer_self |
| ST-6 | postgres | anon/authenticated 가 EXECUTE 가능한 SECURITY DEFINER 트리거 함수 (RPC 로는 호출 불가, 참고) | handle_new_user\|none | handle_new_user | PASS | 참고 | handle_new_user |
| LAT-1 | authenticated | GET quests 1행 (기준) | measured | measured | PASS | 참고 | p50=18.1ms p95=36.1ms n=40 |
| LAT-2 | service_role | GET quest_answer_keys 1행 (TS 채점안의 키 조회 1회) | measured | measured | PASS | 참고 | p50=18.3ms p95=30.5ms n=40 |
| LAT-3 | service_role | RPC submit_quiz_answer (잠금+채점+기록+보상, 1왕복) | measured | measured | PASS | 참고 | p50=29.2ms p95=48.8ms n=30 |
| LAT-4 | authenticated | RPC grade_quiz (순수 채점, 노출형) | measured | measured | PASS | 참고 | p50=19.8ms p95=56.9ms n=40 |

## new_default_privs (29/29)

| ID | 역할 | 동작 | 기대 | 실제 | 결과 | 구분 | 근거 |
|---|---|---|---|---|---|---|---|
| ENV-1 | postgres | public 스키마 새 테이블의 anon 기본 권한 (legacy 자동 노출 여부) | off | off | PASS | 참고 | postgres 기본 ACL(테이블) anon=Dxtm |
| ENV-3 | postgres | public 스키마 새 함수의 anon EXECUTE 기본 권한 | off | off | PASS | 참고 | postgres 기본 ACL(함수) postgres=X/postgres |
| ENV-2 | postgres | anon 의 quests SELECT 권한 (00001 에 GRANT 가 없음) | false | false | PASS | 참고 | has_table_privilege=f |
| AK-1 | anon | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for table quest_answer_keys |
| AK-2 | authenticated | GET /rest/v1/quest_answer_keys?select=* | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-3 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id&quest_id=eq.<1-1> | denied | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-4 | authenticated | GET /quests?select=id,quest_answer_keys(*) (임베딩 우회) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quests |
| AK-5 | authenticated | GET /rest/v1/quest_answer_keys?select=quest_id,quests(id) (역방향 임베딩) | denied\|error | denied | PASS | 보안 | 403 42501 permission denied for table quest_answer_keys |
| AK-10 | service_role | GET /rest/v1/quest_answer_keys?select=*&quest_id=eq.<1-1> | allowed | allowed | PASS | 보안 | 200 rows=1 |
| AK-11 | service_role | PATCH /rest/v1/quest_answer_keys?quest_id=eq.<1-1> (콘텐츠 도구 경로) | written | written | PASS | 보안 | 204 |
| AK-12 | anon(psql) | SET ROLE anon; SELECT count(*) FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-13 | authenticated(psql) | SET ROLE authenticated (+jwt claims); SELECT * FROM quest_answer_keys | denied | denied | PASS | 보안 | ERROR:  permission denied for table quest_answer_keys |
| AK-14 | service_role(psql) | SET ROLE service_role; SELECT count(*) FROM quest_answer_keys | allowed | allowed | PASS | 보안 | 44 |
| AK-15 | anon | GET /rest/v1/ (OpenAPI 스키마에 quest_answer_keys 노출 여부) | hidden\|denied | hidden | PASS | 보안 | 200 paths=9 |
| AK-16 | authenticated | GET /rest/v1/ (OpenAPI, 로그인 사용자) | hidden\|denied | hidden | PASS | 보안 | 200 paths=10 |
| AK-17 | postgres | quests 에 남은 정답 행 수 / quest_answer_keys 행 수 | 0/44 | 0/44 | PASS | 보안 | expected_output 44, hints 44, solution_code 0, steps 1 |
| APP-1 | authenticated | quest/[questId]/page.tsx:24 → GET /rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-2 | authenticated | world/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quest | denied | denied | PASS | 참고 | 403 42501 permission denied for table stages |
| APP-3 | authenticated | profile/page.tsx:22 → GET /rest/v1/stages?select=id,order,title,quests(id)&order=order.asc | denied | denied | PASS | 참고 | 403 42501 permission denied for table stages |
| APP-4 | authenticated | checkBadges.ts:46 → GET /rest/v1/quests?select=stage_id&id=eq.b1000000-0000-0000-0000-000000000001 | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-5 | authenticated | checkBadges.ts:53 → GET /rest/v1/quests?select=id&stage_id=eq.a1000000-0000-0000-0000-000000000001 | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-6 | authenticated | checkBadges.ts:77 → GET /rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.b1000000-0000-0000-0000-0 | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-7 | service_role | tutor/helpers.ts:139 (admin) → GET /rest/v1/quests | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-8 | service_role | quest/validate/route.ts:41 (admin) → GET /rest/v1/quests | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| APP-9 | service_role | quest/golden-key/route.ts:45 (admin) → GET /rest/v1/quests | denied | denied | PASS | 참고 | 403 42501 permission denied for table quests |
| B03-1 | anon | GET /user_profiles_public?select=* | denied | denied | PASS | 보안 | 401 42501 permission denied for view user_profiles_public |
| B03-2 | anon(psql) | SET ROLE anon; SELECT count(*) FROM user_profiles_public | denied | denied | PASS | 보안 | ERROR:  permission denied for view user_profiles_public |
| B03-3 | authenticated | GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐 | allowed | allowed | PASS | 보안 | rows=4 (전체 사용자), cols=avatar_url,display_name,id |
| B03-4 | authenticated | GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼) | no-column | no-column | PASS | 보안 | 400 42703 column user_profiles_public.total_xp does not exist |

합계: 287/287 PASS, FAIL 0
