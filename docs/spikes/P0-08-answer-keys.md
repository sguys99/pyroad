# P0-08 스파이크: 퀴즈·정답 분리 저장 (`quest_answer_keys` + service role 조회)

> - 작성일: 2026-11-03 · 브랜치 `feat/phase0`
> - 관련 작업: P1-01~P1-04, P1-07, P1-11·12, P1-20, P7-01, P7-02 · 버그 B02~B08, B12, B13, B28
> - 코드: [`spikes/p0-08-answer-keys/`](../../spikes/p0-08-answer-keys/) · 전체 점검 결과: [`results/results.md`](../../spikes/p0-08-answer-keys/results/results.md)
> - 환경: **로컬** Supabase만 사용 (운영 DB 접속 없음, 운영 키 미사용)

---

## 1. 결론: **채택**

정답·힌트·`solution_code`·퀴즈 정답을 **`quest_answer_keys` 별도 테이블**(RLS ON + 정책 없음 + `anon`/`authenticated` 권한 회수)로 옮기고, 퀴즈 채점은 **API Route → service_role 전용 `SECURITY DEFINER` 함수 `submit_quiz_answer` 한 트랜잭션**으로 처리합니다.

- 로컬 스택에서 8개 시나리오, **287개 점검 모두 기대값과 일치** (실측). `anon`·로그인 사용자는 정답 테이블에 대해 읽기·쓰기·임베딩 우회·OpenAPI·`SET ROLE` 어느 경로로도 `401/403 (42501 permission denied)`이고, service_role만 읽고 씁니다.
- 기존 44개 퀘스트의 정답이 옮겨지고(`expected_output` 44, `hints` 44, `solution_code` 43 + 프로젝트 단계 1), 현재 앱이 보내는 PostgREST 쿼리 9종은 그대로 동작합니다. 현재 `seed.sql`을 다시 실행해도 `quests`에 정답이 되살아나지 않습니다.
- 대안인 **`quests` 컬럼 권한 회수는 불채택**: 힌트·`solution_code`가 `prompt_skeleton`(jsonb) **안에** 있어서 컬럼 권한으로는 가릴 수 없고(실측: 44/44행 노출 그대로), `select=*`가 42501로 깨집니다.
- **클라이언트가 직접 부르는 채점 RPC는 불채택**: 순수 채점 함수는 보기 4개를 넣어 보면 흔적 없이 정답을 알려주는 "정답 오라클"이 됩니다(실측: 4번 호출, 기록 0건).
- **00002 핫픽스는 그대로 운영에 적용해도 안전합니다 (예).** 단, 공지 API를 service role로 바꾼 앱 코드(`main`)가 먼저 배포되어 있어야 합니다 (§7).

덤으로 확인한 중요한 사실

1. **운영의 현재 상태(핫픽스 전)는 계획서의 B03보다 심각합니다.** 핫픽스 전 스키마를 로컬에 재현하면 **로그인 없이 anon 키만으로** `user_profiles_public` 뷰를 통해 모든 사용자의 이름을 바꾸고(`PATCH`), 사용자 행을 **삭제**(`DELETE` → 진행·뱃지·게시글 연쇄 삭제)할 수 있습니다. anon 키는 브라우저 번들에 공개되어 있으므로 **00002를 바로 적용**하기를 권합니다.
2. **Supabase의 "새 테이블 자동 노출" 기본값이 바뀌었습니다.** CLI 2.115 기본 설정으로 새 DB를 만들면 현재 `00001`의 테이블은 `anon`·`authenticated`·**`service_role`까지** SELECT 권한이 없어 앱 전체가 403입니다 (실측). 앞으로 모든 마이그레이션은 `GRANT`/`REVOKE`를 명시해야 합니다 (P1-07).
3. **B08 확인**: 새 DB(마이그레이션 → seed 순서)에는 `solution_code`가 0/44개이고, Section 6을 수동 실행한 뒤 seed를 다시 돌리면 다시 0개로 덮어써집니다. 00003의 분리 트리거를 쓰면 Section 6을 seed 뒤로 옮기는 것만으로 해결됩니다 (실측 43+1).

---

## 2. 검증한 질문

1. `quest_answer_keys`를 RLS ON + 정책 없음 + `REVOKE ALL FROM anon, authenticated`로 만들면, PostgREST HTTP와 `SET ROLE` 양쪽에서 클라이언트가 정말 못 읽고 못 쓰는가? service role은 읽는가?
2. 임베딩(`quests?select=*,quest_answer_keys(*)`), 역방향 임베딩, OpenAPI 스키마, 뷰·SECURITY DEFINER 함수·Realtime 같은 우회 경로는 없는가?
3. 기존 데이터(`quests.expected_output`, `prompt_skeleton.hints`·`solution_code`, `steps[].expected_output`·`hints`·`solution_code`)를 손실 없이 옮기고, 원본을 지우고, 다시 생기지 않게 막을 수 있는가? 되돌릴 수 있는가?
4. 현재 앱 쿼리는 그대로 동작하는가? 어떤 앱 코드를 바꿔야 하는가?
5. 대안(컬럼 단위 SELECT 권한 회수)은 어떤가? `select=*` 함정은 실제로 무엇을 깨는가?
6. 채점 경로: API Route + service role vs. 클라이언트가 직접 부르는 `SECURITY DEFINER` 함수. 보기 4개 대입 공격, 첫 시도 판정(별), 동시 제출, rate limit, 지연은?
7. 아직 운영에 적용하지 않은 00002 핫픽스(B02·B03)는 운영에 그대로 적용해도 안전한가? B04는 00002 후에도 남는가?
8. B08(새 DB의 `solution_code` 0건)은 사실인가?

---

## 3. 방법 & 환경

| 항목 | 내용 | 구분 |
|---|---|---|
| 스택 | Supabase CLI 2.115.0, Postgres 17.6, PostgREST v16.1, GoTrue v2.195.0, Kong 2.8.1. realtime·storage·studio·edge-runtime·logflare 등은 끔 | 실측 |
| 포트 | **5462x** (api 54621, db 54622). 기본 포트 54321~54327은 다른 로컬 프로젝트(`pangyo-valley`, 11-02 생성)가 이미 사용 중이라 건드리지 않고 비켜 감. `P008_PORT_BASE`로 바꿀 수 있음 | 실측 |
| 운영 재현 | 운영에 적용된 `00001` = 핫픽스 직전 커밋(`2f0a8f3^`)의 파일이라고 가정. seed 후 Section 6(`solution_code` UPDATE)을 다시 실행해 운영처럼 `solution_code` 44개가 있는 상태를 만듦 | 추정(운영 동일성) + 실측 |
| 권한 기본값 | 운영 재현 시나리오는 `auto_expose_new_tables = true`(legacy: public 의 새 테이블·함수를 anon/authenticated/service_role에 자동 부여). 근거: 운영에서 anon 키로 뷰가 읽혔던 B03 재현 기록. 운영 실제 값은 `prod_readonly_checks.sql` 4번으로 확인 필요 | 추정 + 실측 |
| 사용자 | GoTrue admin API로 시나리오마다 새 사용자 생성 → 비밀번호 로그인으로 실제 JWT 발급 | 실측 |
| HTTP 점검 | `fetch`로 PostgREST 직접 호출: anon 키 / 사용자 JWT / service_role 키 | 실측 |
| SQL 점검 | `docker exec psql` → `BEGIN; SET LOCAL ROLE …; SET LOCAL request.jwt.claims = '{"sub":…}'; …; ROLLBACK` | 실측 |
| 쓰기 판정 | HTTP 상태가 아니라 **DB에 실제로 반영됐는지**를 다시 조회해 `written / no-op / denied`로 판정 (RLS는 204를 주고 0행만 바꾸기 때문) | 실측 |
| 정적 점검 | RLS·정책 수, 테이블 권한, 정답 테이블을 참조하는 뷰, publication, anon/authenticated가 실행 가능한 SECURITY DEFINER 함수 목록 | 실측 |
| lint/advisors | `supabase db lint --local`, `supabase db advisors --local --type all` | 실측 |
| GraphQL | 로컬 이미지에는 `pg_graphql`이 설치되어 있지 않아 실측 못 함. pg_graphql은 테이블 권한을 따르므로 같은 REVOKE로 막힘 | 문서 확인 |

### 시나리오

| ID | 이름 | 마이그레이션 | 목적 |
|---|---|---|---|
| S0 | `prod_baseline` | 핫픽스 전 00001 → seed → Section 6 | 운영 현재 상태 재현 |
| S1 | `prod_plus_00002` | S0 + 00002 (2회 실행) | 핫픽스 검증·멱등성 |
| S2 | `prod_plus_00003` | S1 + 00003 초안 (기존 데이터가 있는 DB에 적용) → 되돌리기 → 재적용 | 운영 적용 경로 |
| S3 | `fresh_repo` | 현재 00001 + 00002 → seed | 새 DB (B08) |
| S4 | `alt_column_privs` | S3 + 컬럼 권한 대안 | 대안 비교 |
| S5 | `fresh_with_00003` | 00001 + 00002 + 00003 → seed | 새 DB에서 00003이 seed보다 먼저 도는 경로 |
| S6 | `quiz_rpc` | S5 + 퀴즈 픽스처 + 채점 RPC 초안 + 노출형 대안 | 채점 경로 비교·동시성·지연 |
| S7 | `new_default_privs` | S5와 같음, 자동 노출 꺼짐(신규 기본값) | 환경 독립성 |

---

## 4. 결과

**합계 287/287 PASS** (실측, `verify.sh` 전체 실행 7~9분, 2회 실행 모두 종료 코드 0). "현재 취약"은 아직 고치지 않은 구멍을 그대로 기록한 점검으로, 해당 작업에서 기대값을 뒤집습니다. 시나리오별 전체 표는 [`results/results.md`](../../spikes/p0-08-answer-keys/results/results.md).

### 4.1 정답 테이블 접근 (`quest_answer_keys`)

| ID | 역할 | 동작 | 기대 | S2 운영+00003 | S5 새 DB+00003 | S7 신규 기본값 |
|---|---|---|---|---|---|---|
| AK-1 | anon | `GET /quest_answer_keys?select=*` | 거부 | 401 42501 | 401 42501 | 401 42501 |
| AK-2 | authenticated | `GET /quest_answer_keys?select=*` | 거부 | 403 42501 | 403 42501 | 403 42501 |
| AK-3 | authenticated | `GET …?select=quest_id&quest_id=eq.<id>` | 거부 | 403 | 403 | 403 |
| AK-4 | authenticated | `GET /quests?select=id,quest_answer_keys(*)` (임베딩 우회) | 거부 | 403 42501 | 403 | 403 |
| AK-5 | authenticated | `GET /quest_answer_keys?select=quest_id,quests(id)` (역방향) | 거부 | 403 | 403 | 403 |
| AK-6 | authenticated | `POST` (upsert) | 거부 | 403 | 403 | - |
| AK-7 | authenticated | `PATCH` | 거부 | 403 | 403 | - |
| AK-8 | authenticated | `DELETE` | 거부 | 403 | 403 | - |
| AK-9 | anon | `POST` | 거부 | 401 | 401 | - |
| AK-10 | service_role | `GET …?select=*&quest_id=eq.<id>` | 허용 | 200 1행 | 200 1행 | 200 1행 |
| AK-11 | service_role | `PATCH` (콘텐츠 도구 경로) | 반영 | 반영 | 반영 | 반영 |
| AK-12 | anon (psql) | `SET ROLE anon; SELECT count(*) …` | 거부 | permission denied | 〃 | 〃 |
| AK-13 | authenticated (psql) | `SET ROLE authenticated` + JWT claims, `SELECT *` | 거부 | permission denied | 〃 | 〃 |
| AK-14 | service_role (psql) | `SET ROLE service_role; SELECT count(*)` | 허용 | 44 | 44 | 44 |
| AK-15·16 | anon / authenticated | `GET /rest/v1/` OpenAPI에 테이블 노출 | 숨김 | 숨김 | 숨김 | 숨김 |
| AK-17 | postgres | `quests`에 남은 정답 행 / 정답 테이블 행 | 0/44 | 0/44 | 0/44 | 0/44 |
| AK-18 | postgres | 트리거를 끄고 `quests.expected_output`에 정답 쓰기 | 차단 | CHECK 위반 | CHECK 위반 | - |
| AK-19 | postgres | 퀴즈 보기에 `is_correct` 넣기 | 차단 | CHECK 위반 | CHECK 위반 | - |
| RS-1 | postgres | 현재 `seed.sql` 재실행 | 정답 재유입 없음, `solution_code` 유지 | 0행, 43→43 | 0행, 0→0 | - |
| RB-1 | postgres | 되돌리기 후 `quests` 전체 md5 = seed+Section6 원본 | 동일 | 동일 | - | - |
| ST-1 | postgres | RLS ON + 정책 0개 | 맞음 | 맞음 | 맞음 | - |
| ST-2 | postgres | anon/authenticated/PUBLIC 테이블 권한 | 없음 | 없음 | 없음 | - |
| ST-3 | postgres | 정답 테이블을 참조하는 뷰 | 없음 | 없음 | 없음 | - |
| ST-4 | postgres | Realtime publication 포함 | 없음 | 없음 | 없음 | - |
| ST-5 | postgres | anon/authenticated가 실행 가능한 SECURITY DEFINER 함수 | 없음 | 없음 | 없음 (S6: 노출형 대안 2개만) | - |

00003 적용 로그 (S2, 운영 재현 DB):
`[00003] expected_output 44→44, hints 44→44, solution_code 43→43, steps 1→1, quests에 남은 정답 0` (재실행해도 같은 결과)

### 4.2 `quests` 정답 노출 (B07)

| ID | 역할 | 동작 | S0 운영 | S1 +00002 | S2 +00003 | S4 컬럼 권한 |
|---|---|---|---|---|---|---|
| B07-1 | anon | `GET /quests?select=id` | 빈 결과 | 빈 결과 | 빈 결과 | 빈 결과 |
| B07-2 | authenticated | `GET /quests?select=id,expected_output` | **44/44행 노출** | **44/44** | 정답 없음 | 403 |
| B07-3 | authenticated | `…?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps` | **44/44** | **44/44** | 정답 없음 | **44/44 노출** |
| B07-4 | authenticated | `GET /quests?select=*` | 200 | 200 | 200 | **403** |
| B07-5 | authenticated | `…?select=sol:prompt_skeleton->solution_code` (황금키 정답 코드) | **43/44** | **43/44** | - | - |

### 4.3 앱 쿼리 호환 (현재 `src/`가 실제로 보내는 쿼리)

| ID | 역할 | 위치 | S0~S2 | S3·S5 | S4 컬럼 권한 | S7 신규 기본값 |
|---|---|---|---|---|---|---|
| APP-1 | authenticated | `quest/[questId]/page.tsx:24` | 200 | 200 | 200 | **403** |
| APP-2 | authenticated | `world/page.tsx:22` (`stages … quests(id,order)`) | 200 | 200 | 200 | **403** |
| APP-3 | authenticated | `profile/page.tsx:22` | 200 | 200 | 200 | **403** |
| APP-4~6 | authenticated | `checkBadges.ts:46·53·77` | 200 | 200 | 200 | **403** |
| APP-7 | service_role | `tutor/helpers.ts:139` (`select('*, stage:…')`) | 200 | 200 | 200 | **403** |
| APP-8·9 | service_role | `quest/validate/route.ts:41`, `quest/golden-key/route.ts:45` | 200 | 200 | 200 | **403** |
| LEG-1·2 | service_role | 00003 후 서버 코드가 `quests`에서 읽는 `expected_output` / `prompt_skeleton.hints·solution_code` | S2: `''` / 키 없음 | - | - | - |

- LEG-1·2 (S2): 00003 이후 서버 코드가 `quests`에서 정답을 읽으면 `''`/없음 → **P1-02에서 앱 코드를 함께 바꿔야 함** (§6 목록). 대체 경로 `GET /quest_answer_keys`(service_role)는 200 (LEG-3).
- S7: 정답 테이블은 00003이 `GRANT`를 명시해서 정상(AK-10·14)이지만, 00001의 테이블은 GRANT가 없어 service_role까지 403. **00003은 두 환경에서 같은 결과**를 냅니다.

### 4.4 채점 RPC (S6)

| ID | 역할 | 동작 | 기대 | 실제 |
|---|---|---|---|---|
| RPC-1 | anon | `POST /rpc/submit_quiz_answer` | 거부 | 401 42501 |
| RPC-2 | authenticated | 본인 `p_user_id`로 직접 호출 | 거부 | 403 42501 |
| RPC-3 | authenticated | 다른 사용자 `p_user_id`로 호출 (사칭) | 거부 | 403 42501 |
| RPC-4 | service_role | 오답 제출 → 응답에 정답이 있는가 | 없음 | `{"correct":false,"attempt_no":1,"explanation":"…"}` |
| RPC-5 | service_role | 두 번째 시도에 정답 | 별 2, XP 30 | 별 2, XP 30 |
| RPC-6 | service_role | 완료 후 다시 정답 | 보상 없음 | `already_completed`, XP 0 |
| RPC-7 | service_role | **보기 4개 동시 제출** | 시도 번호 직렬화, 정답·XP 1회 | 시도 1·2·3·4, 정답 1개(별 1), total_xp 30 |
| RPC-8 | service_role | 같은 정답 5개 동시 제출 | XP 1회 | XP 지급 응답 1개, total_xp 30 |
| RPC-9 | service_role | 10초 안에 오답 7번 | 6번째부터 429 | `200×5, 429, 429` |
| RPC-10 | service_role | parsons 순서 뒤집기 / 맞는 순서 | 오답 / 정답 | 오답 / 정답 |
| RPC-11 | postgres | `'[["ln_m","ln_x"]]' @> '[["ln_x","ln_m"]]'` | (함정 확인) | **true** → `@>`로 채점하면 순서 맞추기가 무조건 정답 |
| RPC-12 | authenticated | 노출형 순수 `grade_quiz`에 보기 4개 대입 | (취약 확인) | 4번 호출로 정답 확인, **기록 0건** |
| RPC-13 | authenticated | 노출형 기록 함수 `submit_quiz_answer_self`로 대입 | (참고) | 시도 3건 기록, 별 1 |
| RPC-14 | authenticated | `GET /quiz_attempts` | 본인 것만 | 본인 3행 |
| RPC-15 | authenticated | `POST /quiz_attempts` (시도 위조) | 거부 | 403 42501 |
| RPC-16 | authenticated | `PATCH /user_progress {stars: 3}` | (현재 취약) | **반영됨** → P1-04 전에는 별을 직접 바꿀 수 있음 |

### 4.5 지연 (로컬, Kong 경유, WSL2)

| ID | 호출 | p50 | p95 | n |
|---|---|---|---|---|
| LAT-1 | authenticated `GET /quests` 1행 (기준) | 18.1ms | 36.1ms | 40 |
| LAT-2 | service_role `GET /quest_answer_keys` 1행 | 18.3ms | 30.5ms | 40 |
| LAT-3 | service_role `rpc/submit_quiz_answer` (잠금+채점+기록+보상) | 29.2ms | 48.8ms | 30 |
| LAT-4 | authenticated `rpc/grade_quiz` (순수 채점) | 19.8ms | 56.9ms | 40 |

로컬 수치는 서버 내부 비용만 보여 줍니다. 운영에서는 **왕복 수 × (Vercel 함수 ↔ Supabase 거리)**가 지배합니다. 같은 리전이면 왕복당 수 ms, 다른 대륙이면 150ms 이상입니다(문서 확인). 그래서 "키 조회 + 기록 RPC"(2왕복)보다 "RPC 하나"(1왕복)가 낫습니다.

### 4.6 B04 (00002 후에도 남는 구멍)

| ID | 역할 | 동작 | S0 | S1 +00002 |
|---|---|---|---|---|
| B04-1 | authenticated | `PATCH /users?id=eq.<본인> {total_xp: 999999, current_level: 5}` | **반영** | **반영** |
| B04-2 | authenticated | `PATCH /users?id=eq.<본인> {golden_keys: 99}` | **반영** | **반영** |
| B04-3 | authenticated | `PATCH /users?id=eq.<다른 사용자>` | 0행 | 0행 |
| B04-4 | authenticated | `POST /user_progress` upsert `{quest: 7-1, status: completed}` | **반영** | **반영** |
| B04-5 | authenticated | `POST /user_badges {badge_type: project_builder}` | **반영** | **반영** |
| B04-6 | authenticated | `POST /user_badges {user_id: 다른 사용자}` | 403 | 403 |
| B04-7 | authenticated (psql) | `UPDATE users SET total_xp = 123456 WHERE id = auth.uid()` | 허용 | 허용 |
| B04-8 | authenticated | `GET /users?select=custom_api_keys` (B13) | 200 | 200 |
| B04-9 | authenticated | `GET /users?select=id` | 본인 1행 | 본인 1행 |

B04는 00002와 무관하며 그대로 남습니다 (P1-01·P1-03·P1-04에서 처리).

### 4.7 lint / advisors (S6 상태, 실측)

| 수준 | 항목 | 대상 | 판단 |
|---|---|---|---|
| ERROR | `security_definer_view` | `user_profiles_public` | 00002 후에도 남음. 권한 회수로 위험은 막았지만 대시보드 경고는 계속 뜸 → P3-13(닉네임 전용)에서 `security_invoker` 뷰나 공개 프로필 테이블로 교체 |
| WARN | `function_search_path_mutable` | `handle_new_user`, `prevent_status_downgrade` | B24. `SET search_path = ''` 추가 |
| WARN | `auth_rls_initplan` | users·stages·quests·user_progress·user_badges·board_* 정책 | `auth.uid()` → `(select auth.uid())` (성능) |
| INFO | `rls_enabled_no_policy` | `quest_answer_keys` | **의도한 설정** |
| INFO | `unindexed_foreign_keys` | `notices.user_id`, `quiz_attempts.quest_id`(스파이크용) | 필요 시 인덱스 |
| - | `db lint` | - | 오류 없음 |

advisors는 "anon/authenticated가 실행할 수 있는 SECURITY DEFINER 함수"를 잡아내지 못했습니다(노출형 `grade_quiz`가 있는데도 경고 없음). 그래서 `verify.sh`의 ST-5 점검이 따로 필요합니다.

---

## 5. 선택지 비교

### 5.1 저장 방식: 별도 테이블 vs. `quests` 컬럼 권한

| 기준 | **별도 테이블 `quest_answer_keys`** (채택) | 컬럼 단위 SELECT 권한 회수 |
|---|---|---|
| `prompt_skeleton` 안의 힌트·`solution_code` | 옮겨서 가림 | **못 가림** (CP-5: 44/44행 노출). 가리려면 jsonb를 공개·비공개 컬럼으로 쪼개야 함 = 사실상 별도 저장소 |
| 퀴즈 정답(jsonb) | `quiz_answer` 컬럼에 자연스럽게 들어감 | 비공개 컬럼을 또 만들어야 함 |
| `select=*` | 영향 없음 | `quests?select=*` 42501 (CP-2), `stages?select=*,quests(*)` 42501 (CP-4), `HEAD …select=*&count=exact` 403 (CP-3) |
| 현재 앱 코드 | 사용자 클라이언트 쿼리는 그대로 동작 (서버 정답 경로 3곳만 변경) | 현재 사용자 쿼리는 컬럼을 지정해서 동작하지만, 앞으로 누가 `.select('*')`를 쓰면 바로 깨짐 |
| 새 컬럼 추가 | 공개 테이블은 평소대로 | 새 컬럼마다 GRANT 필요 (CP-7: 기본은 숨김). 안전한 방향이지만 잊기 쉬움 |
| 실수에 대한 강도 | RLS ON(정책 0) + 권한 회수 + `quests` CHECK 제약 3중 | 컬럼 권한 하나. RLS로는 컬럼을 못 가림 |
| 회귀 테스트 | "테이블 접근 = 거부" 한 줄로 명확 | 컬럼별로 확인 필요 |
| 비용 | 조인 1회 (서버 전용 경로라 무시할 수준), 콘텐츠 빌드가 두 테이블에 씀 | 마이그레이션은 짧음 |

### 5.2 채점 경로

| 기준 | (i) API Route + service role 키 조회, **TS에서 채점** → 기록 RPC | **(i′) API Route → service_role 전용 RPC가 채점까지** (추천) | (ii-a) 클라이언트가 직접 부르는 순수 `grade_quiz` | (ii-b) 클라이언트가 직접 부르는 기록형 RPC |
|---|---|---|---|---|
| 정답 오라클 | 없음 | 없음 | **있음** (RPC-12: 4번에 정답, 기록 0) | 없음 (시도가 기록되어 별이 깎임) |
| 첫 시도·별 정확성 | 기록 RPC가 잠금 아래 시도 번호를 매기면 안전 | 안전 (RPC-7) | 판정 불가 | 안전 |
| 사용자 사칭 | API Route가 `getUser()`로 확인한 id만 넘김 | 같음 (RPC-3: 직접 호출 403) | - | `auth.uid()` 사용 |
| rate limit·로깅·봇 차단 | API Route에서 (P1-19) | API Route + 함수 안 백스톱(RPC-9) | 없음 | 함수 안 백스톱만 |
| LLM 해설 (P7-08) | API Route에서 이어서 호출 | 같음 | 별도 호출 필요 | 별도 호출 필요 |
| 정답 키가 DB 밖으로 나감 | 나감 (Next.js 메모리·로그) | **안 나감** | 안 나감 | 안 나감 |
| 서버 ↔ DB 왕복 | 2회 (키 조회 18ms + RPC 29ms, 로컬) | **1회** (29ms) | 1회 (브라우저 → DB) | 1회 |
| `complete_quest`(P1-03)와 결합 | 채점 결과를 넘겨 받는 구조 | 같은 함수 패턴·같은 트랜잭션 | 별개 | 같은 패턴 |
| 채점 로직 테스트 | Vitest로 쉬움 | DB 테스트(verify 계열). 채점은 `accepted` 중 하나와 `jsonb =` 비교뿐이라 로직이 거의 없음 | - | - |

**추천: (i′).** 채점 자체는 "콘텐츠 빌드가 정규화해 둔 `accepted` 목록과 정확히 같은가"라는 비교 한 줄이라 SQL에 두어도 복잡하지 않고, 시도 기록·별·보상과 같은 트랜잭션에 묶여 경쟁 조건이 사라집니다. 입력 형식 검증(zod)과 정규화는 TS(API Route·콘텐츠 빌드)에서 하고 Vitest로 테스트합니다. 채점·시도 기록을 함수 하나로 묶을 수만 있다면 (i)도 안전하지만, 왕복이 하나 더 늘고 정답 키가 Node 프로세스를 거칩니다.

주의 사항 (실측으로 확인)
- **`@>`로 채점하면 안 됩니다.** jsonb 배열 포함 연산은 순서를 무시해서 `[["b","a"]] @> [["a","b"]]`가 참입니다 (RPC-11). `jsonb_array_elements(accepted) = p_answer`로 비교합니다.
- 새로 만든 함수는 기본으로 **PUBLIC에 EXECUTE**가 있고, 운영(legacy)에서는 anon·authenticated에도 자동 부여됩니다. `REVOKE … FROM PUBLIC, anon, authenticated`를 빠뜨리면 service_role 전용 함수가 공개됩니다.
- 클라이언트가 `user_progress`를 직접 쓸 수 있는 동안은 별·시도 같은 서버 값을 그 테이블에 두면 조작됩니다 (RPC-16). 시도 번호는 클라이언트가 못 쓰는 `quiz_attempts`에서 계산했고, `stars` 컬럼은 P1-04에서 쓰기 권한을 막아야 합니다.

---

## 6. 이후 Phase 영향 (계획서 교체 문안 제안)

> 아래는 [`docs/4.upgrade-plan.md`](../4.upgrade-plan.md)에 그대로 넣을 수 있게 쓴 문안입니다. 반영은 P0-11에서 합니다.

**§2.2 표의 `quest_answer_keys` 행**

> | `quest_answer_keys` (신규) | 퀘스트당 1행: `expected_output`, `hints`, `solution_code`, 프로젝트 단계별 정답 `steps`, 퀴즈 정답 `quiz_answer`(`accepted` 목록 + 보기별 해설). RLS ON + 정책 없음 + `anon`·`authenticated` 권한 회수로 **service_role 전용** (P0-08 실측). `quests.prompt_skeleton`에는 정답·힌트·`is_correct`를 두지 않으며 CHECK 제약으로 막음 |

**§2.2 표 아래에 추가**

> 권한 원칙 (P0-08): 모든 마이그레이션은 테이블·뷰·함수마다 `GRANT`/`REVOKE`를 명시합니다. Supabase의 "새 테이블 자동 노출" 기본값이 바뀌어, 명시하지 않으면 환경에 따라 앱 전체가 403이 되거나(신규 기본값) 의도치 않게 공개됩니다(legacy). 서버 전용 데이터는 별도 테이블 + RLS ON(정책 없음) + 권한 회수로 둡니다. 컬럼 단위 SELECT 회수는 PostgREST `select=*`를 깨뜨리므로 쓰지 않고, 컬럼 단위 권한은 UPDATE·INSERT 제한에만 씁니다.

**§2.3 교체**

> - XP·코인·별·업적·아이템 지급과 퀴즈 채점은 **API Route → Postgres 함수(`SECURITY DEFINER`, `SET search_path = ''`) 한 트랜잭션**으로만 처리합니다. 예: `complete_quest(p_user_id, p_quest_id, p_submission)`, `submit_quiz_answer(p_user_id, p_quest_id, p_answer)`.
> - 이 함수들은 **service_role만 실행**합니다 (`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`). API Route는 `auth.getUser()`로 확인한 사용자 id만 넘깁니다. 클라이언트가 직접 부를 수 있으면 rate limit을 건너뛰고 다른 사용자를 사칭할 수 있습니다.
> - 같은 퀘스트를 중복으로 완료해도 보상은 한 번만 지급합니다. 진행 행을 `FOR UPDATE`로 잠그고 `completed`로 처음 바뀔 때만 지급합니다 (+ 원장 `ref_id` 유니크). 퀴즈 시도 번호도 같은 잠금 아래에서 매겨, 보기를 동시에 여러 개 보내도 "첫 시도"는 하나뿐입니다 (P0-08 실측).
> - 퀴즈 정답은 DB 안에서만 비교합니다 (`accepted` 중 하나와 `jsonb =`, `@>` 금지). 클라이언트로는 문제와 보기만 내려보내고, 오답 응답에는 정답을 넣지 않습니다.

**P1-01**

> - [ ] **P1-01** RLS 강화: `users_update_own`이 `total_xp`, `current_level`, `golden_keys`(이후 `coins`)까지 UPDATE를 허용하므로 **UPDATE 컬럼 권한**으로 제한 (`REVOKE UPDATE ON users FROM authenticated` → 프로필 컬럼만 `GRANT UPDATE (…)`). 먼저 사용자 클라이언트로 XP·황금키를 쓰는 곳을 P1-03 RPC로 옮김: `quest/complete/route.ts:99-105·172-175`, `quest/golden-key/route.ts:99-102`, `account/reset/route.ts:155·178·233`(B12). SELECT 컬럼 권한은 회수하지 않음 (`select=*` 42501). `custom_api_keys`(B13)는 컬럼 권한 대신 service_role 전용 별도 테이블로 분리 (`world/page.tsx:36`, `tutor/helpers.ts:145`, `settings/route.ts:25·77·100`이 사용자 클라이언트로 읽고 씀)

**P1-02**

> - [ ] **P1-02** 정답 데이터 분리 (B07): `spikes/p0-08-answer-keys/00003_quest_answer_keys.draft.sql`을 `supabase/migrations/00003_…sql`로 옮겨 적용. 순서: ① 앱이 `quest_answer_keys`를 먼저 읽고 없으면 `quests`로 폴백하도록 배포 (`quest/validate/route.ts:39-66`, `quest/golden-key/route.ts:42-80`, `tutor/helpers.ts:137-142·181-201·356-366`, 타입 `lib/types/database.ts:13-24·61-90·139-148`, 테스트 `tutor/__tests__/helpers.test.ts`) → ② 마이그레이션 적용 (자기 검증 NOTICE 확인, 실패 시 전체 롤백) → ③ 폴백 제거, `quest/[questId]/page.tsx:52-65`의 제거 코드 정리. B08도 함께 해결: 00001 Section 6의 `solution_code` UPDATE를 seed 뒤(`seed.sql` 끝 또는 두 번째 seed 파일)로 옮기면 분리 트리거가 정답 테이블에 넣음. 회귀: `verify.sh`의 AK·B07·APP 점검 통과

**P1-03**

> - [ ] **P1-03** 퀘스트 완료·보상을 `complete_quest(p_user_id, p_quest_id, p_submission)` 한 트랜잭션으로 이전하고 멱등성 보장 (중복 클릭, 동시 요청). `SECURITY DEFINER` + `SET search_path = ''` + **service_role만 EXECUTE**. 진행 행 `FOR UPDATE` 잠금 후 처음 완료될 때만 지급, 스테이지 잠금 확인(B05), 힌트 수·황금키 사용은 DB 값 사용(B05), `user_progress.earned_xp` 저장(B12). 패턴: `spikes/p0-08-answer-keys/grade_quiz_rpc.draft.sql`의 `submit_quiz_answer` (동시 제출 직렬화·1회 지급 실측)

**P1-04**

> - [ ] **P1-04** 클라이언트에서 `user_progress`로 직접 upsert하던 경로를 정리 (진행 저장만 허용, 상태를 `completed`로 바꾸는 것은 서버만). `INSERT`·`UPDATE` 컬럼 권한을 코드 저장 컬럼(`code_submitted`, `current_step`, `step_submissions` 등 auto-save가 쓰는 것)으로 제한하고 `status`·`completed_at`·`hints_used`·`used_golden_key`와 이후의 `stars`·`attempts`·`best_stars`는 RPC 전용 (P0-08: 지금은 `PATCH user_progress {stars: 3}`이 통과). `user_badges` INSERT·DELETE 정책 제거 (B04). SELECT는 건드리지 않음 (`quest/[questId]/page.tsx:37`, `checkBadges.ts`의 `select('*', {head: true})`)

**P1-07에 추가**

> 모든 마이그레이션에 `GRANT`/`REVOKE`를 명시 (P0-08: 신규 기본값에서는 현재 00001로 만든 DB가 service_role까지 403). `supabase/config.toml`을 저장소에 추가하고 CLI 버전을 고정. 운영의 기본 권한 상태는 `spikes/p0-08-answer-keys/prod_readonly_checks.sql` 4번으로 확인

**P1-11·P1-12에 추가**

> 콘텐츠 빌드는 `quests`(공개 부분)와 `quest_answer_keys`(정답 부분)에 나눠 씀. 전환이 끝나면 00003의 분리 트리거와 `quests.expected_output` 컬럼을 삭제하는 마이그레이션 추가

**P1-20**

> - [ ] **P1-20** 회귀 테스트: RLS·권한 조작 시도. `spikes/p0-08-answer-keys/verify.sh` + `checks.mjs`를 정식 위치(예: `supabase/tests/`)로 옮겨 CI(P1-15)에서 실행. 범위: 정답 테이블 접근 거부, XP·코인·별·뱃지·진행 상태 직접 쓰기 실패, 뷰를 통한 쓰기 실패, 공지 쓰기 실패, anon/authenticated가 실행 가능한 SECURITY DEFINER 함수 목록 고정, 앱 실제 쿼리 동작. `known-gap` 점검은 해당 작업(P1-01·P1-04)에서 기대값을 뒤집음

**P7-01**

> - [ ] **P7-01** 퀴즈 콘텐츠 스키마 (zod): 공개 부분(문제, 코드 스니펫, 보기, 토큰, 줄 목록)은 `quests.prompt_skeleton.quiz`, 정답 부분(`accepted` 목록, 보기별 해설)은 `quest_answer_keys.quiz_answer`로 나눠 빌드. 보기·토큰·줄 id는 정답 위치를 암시하지 않는 임의 문자열 (parsons 줄 id를 정답 순서대로 `l1, l2…`로 매기면 정답이 보임). 바꿔도 되는 줄처럼 정답이 여러 개면 `accepted`에 모두 나열. `is_correct`·`accepted`·`solution_code` 키는 `quests`에 둘 수 없음 (CHECK 제약)

**P7-02**

> - [ ] **P7-02** 채점 API `/api/quest/answer`: 로그인 확인 → rate limit(P1-19) → 입력 형식·크기 검증(zod) → service_role로 `rpc('submit_quiz_answer', { p_user_id, p_quest_id, p_answer })` 1회 (채점·시도 기록·별·보상이 한 트랜잭션). 응답은 `correct, attempt_no, stars, xp_awarded, explanation`만 내려보내고 오답이면 정답을 넣지 않음. 별: 첫 시도 3개, 두 번째 2개, 이후 1개 (재도전·정답 공개 정책은 §8 결정 필요)

**Phase 7 완료 기준에 추가**

> - [ ] `verify.sh`의 퀴즈 점검(직접 RPC 호출 거부, 동시 제출 직렬화, 오답 응답에 정답 없음)이 CI에서 통과한다

**버그 목록 메모**

> - B08: P0-08에서 확인 (새 DB 0/44, Section 6 후 seed 재실행 시 0으로 덮어씀). P1-02에서 Section 6을 seed 뒤로 옮겨 해결
> - B28: 핫픽스 전에는 `user_profiles_public` 뷰의 DELETE로 다른 사용자 행까지 지울 수 있었음 (P0-08 S0). 00002 후에는 뷰 DELETE 403

---

## 7. 00002 핫픽스 검증 결과

**판정: 그대로 운영에 적용해도 안전합니다 (예).** 수정본은 필요 없습니다.

| 점검 | 쿼리 / 요청 | 운영 재현 (적용 전) | 적용 후 | 결과 |
|---|---|---|---|---|
| B03-1 | anon `GET /rest/v1/user_profiles_public?select=*` | 200, 전체 행 | 401 42501 | PASS |
| B03-2 | `SET ROLE anon; SELECT count(*) FROM public.user_profiles_public;` | 허용 | permission denied | PASS |
| B03-3 | authenticated `GET …user_profiles_public?select=*` | 200, 컬럼 `id, display_name, avatar_url` | 같음 | PASS |
| B03-4 | authenticated `GET …user_profiles_public?select=total_xp` | 400 42703 | 400 42703 | PASS (뷰에 없는 컬럼) |
| B03-5 | authenticated `PATCH …user_profiles_public?id=eq.<다른 사용자> {display_name}` | **반영됨** | 403 42501 | PASS |
| B03-6 | anon `PATCH …user_profiles_public?id=eq.<사용자> {display_name}` | **반영됨** | 401 42501 | PASS |
| B03-7 | authenticated `DELETE …user_profiles_public?id=eq.<다른 사용자>` | **삭제됨** | 403 42501 | PASS |
| B03-7b | anon `DELETE …user_profiles_public?id=eq.<사용자>` | **삭제됨** | 401 42501 | PASS |
| B03-8 | `information_schema.role_table_grants` (anon/authenticated) | 둘 다 ALL | `authenticated:SELECT`만 | PASS |
| B03-9·10 | authenticated 게시판 임베딩 `board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count)` / 댓글 | 200 | 200 (작성자 이름 포함) | PASS (앱 동작 유지) |
| B03-11 | service_role `GET …user_profiles_public` | 200 | 200 | PASS |
| B02-1 | anon `GET /rest/v1/notices` | 200 | 200 | PASS (공지는 계속 공개) |
| B02-2 | authenticated `POST /rest/v1/notices {user_id: 본인}` | **작성됨** | 403 42501 | PASS |
| B02-3 | `SET ROLE authenticated; INSERT INTO notices (user_id, …) VALUES (auth.uid(), …)` | 허용 | RLS 위반 | PASS |
| B02-4·5 | authenticated 본인 공지 `PATCH` / `DELETE` | **반영됨** | 204, 0행 | PASS |
| B02-7 | anon `POST /notices` | 401 | 401 | PASS |
| B02-8 | service_role `POST /notices` (관리자 API 경로) | 201 | 201 | PASS |
| B02-9 | `pg_policies` (notices) | 정책 4개 | `notices_select_public`만 | PASS |
| 멱등성 | 00002를 두 번 실행 | - | 두 번째는 "does not exist, skipping" NOTICE만, 오류 없음 | PASS |
| 새 DB | 현재 00001(핫픽스 내용 포함) + 00002 | - | B02·B03 모두 같은 결과 (S3) | PASS |

적용 조건과 순서
1. **앱 코드(`main`, PR #16 머지본)를 먼저 배포**해야 합니다. 핫픽스 전 공지 API(`api/notice/route.ts`, `api/notice/[noticeId]/route.ts`)는 사용자 클라이언트로 INSERT·UPDATE·DELETE를 했기 때문에, 옛 코드가 떠 있는 상태에서 00002를 적용하면 관리자 공지 작성은 RLS 오류, 수정·삭제는 **조용히 0행**이 됩니다. 새 코드는 service role을 쓰므로 00002 전후 모두 동작합니다.
2. SQL Editor에서 00002 실행 → [`prod_readonly_checks.sql`](../../spikes/p0-08-answer-keys/prod_readonly_checks.sql) 1~3번 실행. 기대값: 1번 `authenticated | SELECT` 한 줄, 2번 `notices_select_public` 한 줄, 3번 `f | f | 0` (로컬에서 같은 결과 확인).
3. 바깥에서 한 번 더: `curl "<SUPABASE_URL>/rest/v1/user_profiles_public?select=id&limit=1" -H "apikey: <anon 키>"` → `401`과 `permission denied for view user_profiles_public`.
4. 확인되면 계획서 B02·B03 체크.

남는 것 (00002의 결함이 아니라 범위 밖)
- 로그인 사용자는 여전히 **모든 사용자**의 `display_name`(Google 실명)과 아바타를 볼 수 있습니다 (B03-3). 게시판 때문에 의도된 동작이고, P3-13(닉네임)에서 해결합니다.
- advisors의 `security_definer_view` ERROR는 계속 뜹니다 (§4.7).
- B04(XP·진행·뱃지 직접 쓰기)는 그대로입니다 (§4.6).
- 계획서 B02 수정 항목의 "관리자 판별을 `app_metadata.role`로 변경"은 현재 코드에 반영되지 않았습니다 (`src/lib/admin.ts`는 여전히 `ADMIN_EMAIL` 비교). DB 핫픽스와는 무관합니다.

---

## 8. 남은 리스크 & 사용자 확인 필요 사항

사용자 확인 필요
1. **운영 기본 권한 상태**: `prod_readonly_checks.sql` 4·5·6번을 운영에서 읽기 전용으로 실행해 주세요 (자동 노출 legacy 여부, `pg_graphql` 사용 여부, 정답 데이터 개수). 00003 자기 검증 NOTICE와 비교할 기준값이 됩니다.
2. **00002 적용 전 `main` 배포 여부** (§7 순서 1).
3. **Vercel 함수 리전과 Supabase 리전**: 저장소에 `vercel.json`이 없어 함수 리전이 기본값일 수 있습니다. 두 리전이 멀면 API Route의 DB 왕복마다 큰 지연이 붙습니다. 현재 완료 API는 왕복이 여러 번이라 P1-03의 RPC 하나로 줄이는 효과가 큽니다.
4. **퀴즈 정책 결정** (§12에 추가 제안)
   - 몇 번 틀리면 정답을 보여줄지 (초안: 3번, `c_reveal_after`)
   - 재도전 별: 4지선다는 정답을 알고 다시 풀면 늘 첫 시도 정답이 됩니다. "첫 완료 때의 별만 인정"을 추천
5. **기존 콘텐츠의 정답 노출**: DB 권한과 별개로 일부 퀘스트는 공개 필드(`expected_output_hint`, `fallback_text`)에 사실상 정답이 들어 있습니다 (예: 1-1 `fallback_text`에 `print("안녕하세요!")`). 교육용으로 의도한 노출인지 확인해 주세요. 퀴즈(P7)에서는 해설을 정답 테이블에 둡니다.

남은 리스크
- **service_role 키 유출 = 모든 정답 유출.** 키는 서버 환경 변수에만 두고, `createAdminClient()` 사용처를 정답·관리자 경로로 계속 좁힙니다.
- **분리 트리거는 과도기 장치**입니다. P1-12에서 콘텐츠 빌드가 두 테이블에 직접 쓰게 되면 트리거와 `quests.expected_output` 컬럼을 지웁니다. FK를 `DEFERRABLE INITIALLY DEFERRED`로 둔 것도 트리거 때문입니다.
- **SQL Editor로 적용할 때의 트랜잭션**: 00003은 한 트랜잭션으로 실행해야 자기 검증 실패 시 전체가 롤백됩니다. CLI(`supabase db push`)나 `psql -1`은 확인했지만, SQL Editor가 여러 문장을 한 트랜잭션으로 묶는지는 확인하지 못했습니다. Editor를 쓴다면 `BEGIN; … COMMIT;`으로 감싸서 실행하세요.
- **CLI 버전**: `auto_expose_new_tables` 설정 주석에 "2026-10-30에 제거"라고 되어 있고 CLI v3.0.0이 나왔습니다. v3에서는 legacy 재현 모드가 동작하지 않을 수 있으니 CI는 CLI 2.115.0으로 고정하세요. 실제로 운영 기본 권한이 신규 기본값으로 바뀌면, GRANT를 명시하지 않은 새 테이블(`worlds` 등)은 앱에서 403이 됩니다.
- **`verify.sh` 실행 시간 7~9분** (스택 시작 2회 + db reset 2회). CI에서는 `P008_SKIP_PROD=1 P008_SKIP_NEWDEFAULT=1`로 줄이고, 운영 재현 시나리오는 00002 적용 후 정리합니다.
- **`submit_quiz_answer`·`quiz_attempts`·`user_progress.stars`는 스파이크용 초안**입니다. 컬럼 이름·별 규칙은 P1-08·P8-05에서 확정합니다.
- 로컬 지연 수치는 운영 지연을 대표하지 않습니다 (§4.5).

---

## 9. 재현 방법

```bash
# Docker, Supabase CLI 2.115.0, Node 22 필요. 운영 DB 에는 접속하지 않음
bash spikes/p0-08-answer-keys/verify.sh
# → 8개 시나리오 실행, 결과: spikes/p0-08-answer-keys/results/{results.md, results.jsonl, advisors.json}
# → 종료 코드 0 = 모든 기대값 일치. 끝나면 스택을 내림 (supabase stop --no-backup)

# 자주 쓰는 옵션
P008_PORT_BASE=54720 bash spikes/p0-08-answer-keys/verify.sh     # 다른 로컬 스택과 포트가 겹칠 때
P008_SKIP_PROD=1 P008_SKIP_NEWDEFAULT=1 bash …/verify.sh          # CI용 축소 실행
P008_KEEP=1 P008_WORKDIR=/tmp/p008 bash …/verify.sh               # 스택을 남겨 두고 디버깅
#   이어서 한 시나리오만: (cd /tmp/p008 && eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')")
#   P008_API_URL=… P008_ANON_KEY=… P008_SERVICE_ROLE_KEY=… P008_DB_CONTAINER=supabase_db_p008answers P008_REPO=$PWD \
#     node spikes/p0-08-answer-keys/checks.mjs fresh_with_00003
#   끝나면: supabase stop --no-backup --workdir /tmp/p008
```

| 파일 | 내용 |
|---|---|
| `00003_quest_answer_keys.draft.sql` | 정답 테이블 + 권한 + 분리 트리거 + 기존 데이터 이동 + 자기 검증 + CHECK 백스톱 (P1-02 초안) |
| `00003_quest_answer_keys.rollback.draft.sql` | 되돌리기 (원본과 md5 동일 확인) |
| `grade_quiz_rpc.draft.sql` | 추천 채점 함수 `submit_quiz_answer` (service_role 전용) + 스파이크용 `quiz_attempts`·`stars` |
| `alt_column_privileges.sql`, `alt_grade_quiz_exposed.sql` | 비교 실험용 대안 (운영 적용 금지) |
| `fixtures/quiz_fixture.sql` | 객관식·순서 맞추기 퀴즈 픽스처 |
| `prod_readonly_checks.sql` | 운영에서 실행할 읽기 전용 점검 쿼리 (00002 적용 확인 + 기본 권한 상태) |
| `verify.sh`, `checks.mjs`, `summarize.mjs` | 스택 구성·시나리오 실행·점검·결과 표 생성 (P1-20 씨앗) |

CI로 옮길 때의 골격 (P1-15): `ubuntu-latest` + `supabase/setup-cli`(version `2.115.0`) + `actions/setup-node`(22) → `P008_SKIP_NEWDEFAULT=1 bash spikes/p0-08-answer-keys/verify.sh`. 러너에는 다른 스택이 없으므로 포트는 기본값(5462x) 그대로 써도 됩니다. 운영 재현 시나리오는 `git` 히스토리(`fetch-depth: 0`)가 필요합니다.
