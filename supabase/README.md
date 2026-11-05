# supabase/

pyRoad 데이터베이스 스키마와 로컬 Supabase 설정입니다. 배경과 결정은 `docs/4.upgrade-plan.md` §2.2 "권한 원칙", P1-07과 `docs/spikes/P0-08-answer-keys.md`를 참고하세요.

| 경로 | 내용 |
|---|---|
| `config.toml` | 로컬 스택 설정 (project_id `pyroad`, 포트 5452x, 필요 없는 서비스 끔) |
| `migrations/000NN_<설명>.sql` | 스키마 변경. 번호 순서대로 적용 |
| `seed.sql` | 스테이지·퀘스트 데이터. `db reset` 때 마이그레이션 **다음에** 실행. **생성물**(P1-12): `content/`를 고치고 `npm run content:build`로 다시 만듦. 직접 고치지 않음(`content/README.md`) |
| `rollback/` | 마이그레이션을 되돌리는 SQL. **실행 대상이 아님**(CLI·`run.sh`가 읽지 않는 위치). 문제가 생겼을 때 사용자가 직접 실행 |
| `snippets/` | Studio 스니펫 (git 제외) |

## 1. 로컬 스택

필요: Docker, **Supabase CLI 2.115.0** (버전 고정. v3에서는 권한 기본값 관련 설정이 바뀔 수 있음, `supabase --version`으로 확인)

```bash
npm run db:start     # 스택 시작 (처음이면 migrations + seed.sql 적용)
npm run db:status    # 접속 정보 (API URL, DB URL, 키)
npm run db:reset     # DB를 지우고 migrations + seed.sql 다시 적용
npm run db:types     # src/lib/types/database.generated.ts 재생성 (스택이 켜져 있어야 함)
npm run db:stop      # 스택 중지 (데이터는 Docker 볼륨에 남음)
```

| 서비스 | 주소 |
|---|---|
| API (PostgREST·Auth) | `http://127.0.0.1:54521` |
| DB | `postgresql://postgres:postgres@127.0.0.1:54522/postgres` |
| psql | `docker exec -it supabase_db_pyroad psql -U postgres` |

- 같은 PC의 다른 로컬 스택(54321~54327, 54421~54424)과 겹치지 않도록 5452x 대역을 씁니다. 컨테이너 이름은 `supabase_*_pyroad`이고, 다른 프로젝트의 컨테이너는 건드리지 않습니다.
- 켜 두는 서비스는 Postgres, PostgREST, Auth(GoTrue)뿐입니다. Studio·Realtime·Storage·Edge Functions·메일(mailpit)·Analytics는 꺼 두었습니다.
- 키는 `supabase status -o env`의 `ANON_KEY`, `SERVICE_ROLE_KEY`입니다. 로컬 스택에 앱을 붙이려면 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>`, `SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>`로 바꿉니다.
- Email provider는 **로컬에서만** 켜 둡니다 (운영은 꺼짐, B34). e2e가 이메일·비밀번호 테스트 계정으로 로그인하기 때문이며, 테스트 계정은 service_role의 `auth.admin.createUser`로 만듭니다. Google 로그인은 로컬에 설정하지 않았습니다.

## 2. 마이그레이션 작성 규칙

### 파일 이름

- `supabase/migrations/000NN_<설명>.sql` — 5자리 순번 + 소문자 snake_case 설명 (예: `00004_quest_answer_keys.sql`). 순번은 겹치지 않게 다음 번호를 씁니다.
- 운영에 적용한 파일은 고치지 않습니다. 고칠 것이 있으면 새 파일을 추가합니다.
- 가능한 한 다시 실행해도 안전하게(idempotent) 씁니다: `CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`, `GRANT`/`REVOKE`(원래 멱등).

### 파일 머리 주석

```sql
-- ============================================================
-- <무엇을 하는지 한 줄>                                       (<작업 ID>)
-- 릴리즈 단계: ① 추가형 | ③ 권한 회수형
-- 배경: <왜 필요한지, 운영 적용 전 확인할 점>
-- 운영 SQL Editor 로 적용할 때는 BEGIN; … COMMIT; 으로 감싸서 실행합니다.
-- ============================================================
```

### 릴리즈 단계 ①/③ 분리

운영 적용 순서는 **① 추가형 마이그레이션 → ② 앱 배포 → ③ 권한 회수 마이그레이션**입니다.

| 단계 | 넣는 것 | 조건 |
|---|---|---|
| ① 추가형 | 새 테이블·컬럼·함수·인덱스, 새 객체의 GRANT/REVOKE, 데이터 이전 | 지금 운영 중인 **이전 앱**이 그대로 동작해야 함 |
| ③ 회수형 | 기존 객체의 `REVOKE`, 정책 삭제, 컬럼·폴백 삭제, 제약 강화 | **새 앱**이 배포된 뒤에만 적용 |

- 한 파일에 ①과 ③을 섞지 않습니다. 새 앱 코드는 ①만 적용된 DB와 ①+③이 적용된 DB 모두에서 동작해야 합니다.
- **새로 만드는 객체**의 권한 설정은 회수(REVOKE)라도 ①에 함께 넣습니다. 운영은 새 객체를 만들자마자 anon에게 열기 때문입니다(아래 "권한").

### 권한: 모든 테이블·뷰·함수에 GRANT/REVOKE 명시

Supabase의 "새 테이블 자동 노출" 기본값이 환경마다 다릅니다.

| 환경 | `public`에 postgres가 만든 새 객체 |
|---|---|
| 운영 (legacy, 2026-11-04 확인) | 테이블 `anon/authenticated/service_role = arwdDxtm`(ALL), 함수 `EXECUTE`, 시퀀스 `rwU` 자동 부여 → **만들자마자 anon에게 열림** |
| 로컬·CI (CLI 2.115 신규 기본값) | 테이블 `Dxtm`만 (SELECT·INSERT·UPDATE·DELETE 없음) → GRANT가 없으면 **service_role까지 403** |

그래서 모든 마이그레이션은 기본값에 기대지 않고 권한을 명시합니다. `00003_explicit_grants.sql`은 00001·00002로 만든 기존 객체에 운영 현재 권한을 그대로 적어 두 환경을 맞춘 파일입니다(운영에서는 no-op).

```sql
-- 로그인 사용자가 읽는 테이블 (행 범위는 RLS 정책이 결정)
ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worlds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.worlds TO authenticated;
GRANT ALL ON public.worlds TO service_role;

-- 서버 전용 테이블: RLS ON + 정책 없음 + anon·authenticated 권한 없음
ALTER TABLE public.quest_answer_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quest_answer_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quest_answer_keys TO service_role;

-- 쓰기를 컬럼 단위로 제한 (INSERT·UPDATE에만 사용)
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;     -- 00008 (P1-01)
GRANT SELECT ON public.users TO anon, authenticated;
GRANT UPDATE (preferred_provider) ON public.users TO authenticated;
```

- `config.toml`에 `auto_expose_new_tables`를 켜거나 `ALTER DEFAULT PRIVILEGES`로 기본값을 바꾸지 않습니다. 빠뜨린 GRANT가 로컬에서 드러나지 않게 됩니다.
- **SELECT 컬럼 권한은 회수하지 않습니다.** PostgREST의 `select=*`가 42501로 깨집니다. 숨길 데이터는 별도 테이블로 분리합니다.
- 뷰는 `WITH (security_invoker = true)`로 만들어 기반 테이블의 RLS를 따르게 하고, 뷰에도 GRANT/REVOKE를 따로 적습니다. 다른 사용자의 값을 보여 줘야 하는 뷰는 RLS를 우회하는 대신 **보여도 되는 값만 담은 테이블**(+ SELECT 정책)을 읽게 합니다(예: `00018` `user_public_profiles`, Advisors `security_definer_view`, B34). 회귀 `VIEW-2`가 security_invoker가 아닌 뷰를 FAIL로 알려 줍니다.
- 시퀀스를 쓰는 컬럼(`identity`/`serial`)에 클라이언트가 INSERT하면 `GRANT USAGE ON SEQUENCE …`도 필요합니다. 지금 `public`의 PK는 모두 `gen_random_uuid()`입니다.

### 함수와 SECURITY DEFINER

새 함수는 PostgreSQL 기본값으로 `PUBLIC`에 EXECUTE가 있습니다(운영은 anon·authenticated에도 직접 부여).

```sql
CREATE OR REPLACE FUNCTION public.complete_quest(p_user_id uuid, p_quest_id uuid, p_submission jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- 함수 안에서는 public.users 처럼 스키마를 모두 적음
AS $$ … $$;

REVOKE EXECUTE ON FUNCTION public.complete_quest(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(uuid, uuid, jsonb) TO service_role;
```

- `SECURITY DEFINER`는 RLS를 우회하므로 꼭 필요할 때만 씁니다. 쓰면 `SET search_path = ''` + `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`를 빠뜨리지 않습니다.
- 사용자 id를 인자로 받는 함수는 service_role 전용으로 두고, API Route가 `getUser()`로 확인한 id만 넘깁니다. authenticated에게 열어야 한다면 인자 대신 `(select auth.uid())`를 씁니다.
- `REVOKE`/`GRANT`에는 인자 타입까지 적습니다(오버로드 구분).

### 사용자 데이터와 탈퇴 (B28)

- 사용자 데이터가 들어가는 새 테이블은 `user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`로 만듭니다. 탈퇴는 `/api/account/delete`가 `auth.admin.deleteUser`로 `auth.users`를 지우는 것뿐이고, public의 행은 이 cascade로만 지워집니다. 클라이언트에는 `users` DELETE 권한·정책이 없습니다(`00008`).
- 다른 사용자의 기록에 남는 참조만 `ON DELETE SET NULL`로 둡니다(지금은 `board_reports.target_user_id` 하나: 다른 아이가 한 신고는 남기되 탈퇴한 아이를 가리키지 않음).
- `users`를 참조할 수 없는 기록(`analytics_events`의 HMAC 익명 ID)은 탈퇴 API가 따로 지웁니다(P1-17 `deleteUserAnalytics`).
- 회귀 `B28-1`(FK 삭제 규칙 + FK 없는 `*user_id` 열)과 `B28-2`(실제 탈퇴 후 public·auth의 모든 uuid 열과 HMAC 기록에 그 사용자 값 0)가 빠뜨린 테이블을 FAIL로 알려 줍니다.

### RLS 정책

- `auth.uid()`는 `(select auth.uid())`로 씁니다. 행마다 다시 계산하지 않습니다 (B34 `auth_rls_initplan`).
- 정책은 명령(SELECT/INSERT/UPDATE/DELETE)별로 따로 만들고 대상 역할을 `TO authenticated`처럼 적습니다.

## 3. 로컬 검증

```bash
npm run db:reset                                   # migrations + seed가 오류 없이 끝나는지
npm run db:types && npx tsc --noEmit               # 스키마를 바꿨다면 타입 재생성 후 타입 검사

# 한 파일을 직접 적용 (두 번 실행해 멱등성 확인)
docker exec -i supabase_db_pyroad psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/000NN_….sql

# 객체 권한 확인
docker exec -i supabase_db_pyroad psql -U postgres -c "\dp public.*"
docker exec -i supabase_db_pyroad psql -U postgres -c "\df+ public.*"

# Supabase Advisors 와 같은 규칙 (B34). 로컬 DB 는 SSL 이 없어 sslmode=disable 필요. --local/--linked 는 쓰지 않음
supabase db advisors --db-url "postgresql://postgres:postgres@127.0.0.1:54522/postgres?sslmode=disable" --type all --level info
```

- Advisors 기준(B34, 00018 이후): **ERROR 0**, WARN은 `function_search_path_mutable`(`kst_date`, 의도) 1건, INFO는 `rls_enabled_no_policy`(서버 전용 테이블 6개, 의도)·`unused_index`(사용량이 적어 생기는 정상 신호). 운영 Advisors는 Auth 설정 경고(`auth_leaked_password_protection` 등)도 내지만 대시보드 설정이라 로컬에서는 나오지 않습니다. 회귀 ST-7~9가 같은 명령으로 확인합니다

- 권한·RLS 회귀 점검: `npm run test:rls` (아래 "4. RLS·권한 회귀 테스트")
- 운영과 같은 legacy 기본값에서도 확인하려면 `npm run test:rls:ci`를 씁니다. 임시 작업 디렉토리에 `config.toml`을 복사해 `project_id`·포트를 바꾸고 `auto_expose_new_tables = true`를 켠 스택을 따로 띄웁니다.
- 정답 데이터(P1-02): 정답·힌트·`solution_code`는 `quest_answer_keys`(service_role 전용)에 있습니다. 생성 seed(P1-12)는 `quests`에 공개 부분만, `quest_answer_keys`에 정답을 따로 씁니다. 예전 seed처럼 `quests`에 정답이 들어오면 분리 트리거가 옮기고, 00005 이후에는 `quests`에서 지웁니다. `db reset` 후 기준값은 퀘스트 44 · `expected_output` 44 · 힌트 44 · `solution_code` 43 + 프로젝트 단계 정답 5(회귀 테스트 `AK-17`). 앱은 `src/lib/quest/answerKeys.ts`로만 읽습니다.
- 보상(P1-03): 퀘스트 완료·황금키·리셋은 `00006`의 `complete_quest`·`use_golden_key`·`reset_progress`(service_role 전용)가 한 트랜잭션으로 처리합니다. 잠금 순서는 `users` → `user_progress`. 앱은 `src/lib/quest/rewardRpc.ts`로만 부르고, 규칙을 바꾸면 SQL 함수·`src/lib/quest/xp.ts`·`checkBadges.ts`·`tests/fixtures/reward-rules.json`을 함께 고칩니다. 뱃지 규칙 `decide_new_badges`와 `complete_quest`의 현재 정의는 `00019`(①, Q25)입니다: 황금키로 완료한 퀘스트(`used_golden_key`, 프로젝트는 한 단계라도)는 뱃지를 주지 않고, `first_code`·`streak_3`은 직접 푼 완료만 셉니다(스테이지 클리어는 황금키 퀘스트도 완료로 셈). 이 함수를 다시 고칠 때는 `00019` 본문에서 출발합니다.
- 사용자 권한(P1-01): 클라이언트는 `users`에서 `preferred_provider`만 UPDATE할 수 있고(`00008`, 컬럼 권한) INSERT·DELETE는 없습니다(가입은 `handle_new_user` 트리거). 새 프로필 컬럼을 클라이언트가 고치게 하려면 그 컬럼을 만드는 마이그레이션에서 `GRANT UPDATE (<컬럼>) ON public.users TO authenticated`를 추가하고 회귀 테스트 `B04-19`를 참고합니다.
- 진행·뱃지 권한(P1-04): 클라이언트는 `user_progress`에 진행 저장 컬럼(`code_submitted`·`current_step`·`step_submissions` + upsert용 `user_id`·`quest_id`)만 INSERT·UPDATE하고(`00011`, 컬럼 권한) DELETE는 없습니다. `user_id`·`quest_id`는 키 고정 트리거(`user_progress_lock_keys`)가 바꾸지 못하게 막습니다. 새 행의 `status`는 기본값 `in_progress`(`00010`). 상태·힌트 수·황금키·`earned_xp`(이후 `stars`·`attempts`)는 RPC 전용이며, 힌트 수는 튜터 API가 `record_hint`(service_role 전용)로 기록합니다. `user_badges`는 SELECT만(지급 `complete_quest`, 삭제 `reset_progress`·탈퇴 cascade). 클라이언트가 쓸 새 진행 컬럼은 그 컬럼을 만드는 마이그레이션에서 `GRANT INSERT (…), UPDATE (…)`를 함께 추가합니다
- 월드·퀘스트 유형·별(P1-08, `00012`): `worlds`(로그인 사용자 읽기 전용, 1월드 `python-island`는 고정 id `c1000000-0000-0000-0000-000000000001`)와 `stages.world_id`. `stages."order"`는 **월드 안에서만** 유일(`UNIQUE(world_id, "order")`)이므로 스테이지는 (월드 `order`, 스테이지 `order`)로 정렬합니다(SQL `is_stage_unlocked`·`reset_progress`, TS `src/lib/world/stageOrder.ts`). `quests.quest_type`(code/project/quiz/boss)·`quiz_kind`(퀴즈만)·`is_mobile_friendly`, `quests.validation_type`은 `contains_any`·`all`도 받음. `user_progress.stars`·`best_stars`·`attempts`·`stars_judged_on`(마지막 별 판정일, KST)과 `quiz_attempts`(퀴즈 제출 기록, 본인 SELECT만)는 서버 값입니다(클라이언트 쓰기 권한 없음 + ①만 적용된 동안은 보호 트리거가 버림).
- 사용자 프로필 컬럼(P1-08): `users.nickname`(2~10자, KS X 1001 완성형 한글 2,350자·영문·숫자 — CHECK `users_nickname_chars`에 2,350자를 그대로 나열, 대소문자 무시 유일 인덱스 `users_nickname_lower_key`), `grade`(1~6), `avatar_config`, `settings`(§2.2 기본값), `last_login_provider`. 클라이언트 UPDATE 권한은 **아직 없습니다**. 화면을 만드는 작업(P3-11 닉네임·캐릭터·학년, P2-15 설정)에서 `00008` 뒤에 적용되는 ③ 마이그레이션으로 `GRANT UPDATE (<컬럼>) ON public.users TO authenticated`를 추가하고 회귀 테스트 `PF-1~3`을 allow로 바꿉니다(①에 넣으면 운영 순서상 ③ `00008`의 `REVOKE ALL`이 지움).
- KST 날짜(P1-08): `public.kst_date(timestamptz)`(IMMUTABLE, 인라인되도록 `SET search_path` 없이 `pg_catalog.` 명시 — Advisors `function_search_path_mutable` 경고 1건은 의도한 것)와 `public.kst_today()`. 날짜 컬럼은 `DEFAULT public.kst_today()`, TS는 `src/lib/time/kst.ts`.
- 가입·로그인 트리거(B24·B16, `00013`): `handle_new_user`는 `display_name`에 자리표시자 `모험가NNNN`(`placeholder_display_name`)을, `avatar_url`에 `''`를 넣고 provider 이름·사진은 복사하지 않습니다(§2.8). 로그인 때 `handle_user_signed_in`(`auth.users.last_sign_in_at` 갱신 트리거)이 `last_login_at`과 `last_login_provider`(`user_metadata.iss`로 판별, `social_login_provider`)를 씁니다. 트리거 함수는 모두 `SET search_path = ''` + anon·authenticated EXECUTE 없음(트리거는 실행 권한 없이도 동작).
- 사용자 API 키(B13): `user_api_keys`(service_role 전용, `00007`)에 AES-256-GCM 암호문만 있습니다. 앱은 `src/lib/tutor/apiKeys.ts`로만 읽고 쓰며, 서버 env `API_KEY_ENCRYPTION_KEY`(`openssl rand -base64 32`)가 없으면 "내 API 키" 기능만 꺼집니다. 로컬에서 이 기능을 쓰려면 `.env.local`에 아무 테스트 키나 넣습니다(운영 키를 쓰지 않음). `users.custom_api_keys`(평문)는 `00009`(③)가 지웁니다.
- 게시판 안전장치(P1-18·B19, `00014` ①·`00015` ③): 길이·빈 값은 DB CHECK(`board_posts_title_check` 제목 1~100자, `board_posts_content_check` 내용 1~2,000자, `board_comments_content_check` 댓글 1~500자, 글자 수는 `char_length`, 공백만 있으면 거부). 운영에 위반 행이 있으면 `00014`가 NOT VALID로 추가하므로 런북 "00014 확인"으로 정리 후 VALIDATE. 금칙어·개인정보 필터는 DB가 아니라 서버 모듈(`src/lib/moderation/`, 목록은 `data/*.json`)이라 **쓰기는 API Route(service_role)로만**: `00015`가 `board_posts`·`board_comments`의 anon·authenticated 쓰기 권한과 INSERT·UPDATE·DELETE 정책을 지웁니다(SELECT만). 신고는 `board_reports`(service_role 전용, `UNIQUE(reporter_id, target_type, target_id)`) + `report_board_content`(service_role 전용, 대상 행을 잠그고 서로 다른 신고자 3명이면 `is_hidden`). 숨긴 글·댓글은 SELECT 정책으로 작성자만 보고(숨긴 글의 댓글은 아무도), `is_hidden`·`hidden_at`은 보호 트리거 `board_protect_moderation`이 클라이언트 값을 버립니다. 운영 순서상 ③ `00011`이 board SELECT 정책을 `USING (true)`로 다시 쓰므로 `00015`가 숨김 정책을 다시 만듭니다. 해제·삭제는 런북 "게시판 신고 처리"의 SQL
- 공개 이름(P1-18, X1): `user_profiles_public.display_name`은 `coalesce(nickname, '모험가NNNN')`(자리표시자는 `placeholder_display_name`과 같은 식을 뷰에 그대로 씀 — `00014`가 `00013`(③)보다 먼저 적용되고, 함수를 부르면 authenticated EXECUTE가 필요하기 때문. 회귀 `VIEW-3`이 대조), `avatar_url`은 NULL입니다. 기존 Google 사용자의 실명(`users.display_name`)은 본인 화면용으로 그대로 두고 뷰로는 나가지 않습니다. 계산 컬럼이라 뷰를 통한 UPDATE는 `0A000`으로 거부됩니다(B03-5·6). `00018`(①, B34)부터 이 값은 `user_public_profiles`(아래)에서 읽습니다
- 공개 프로필(B34, `00018` ①): `user_profiles_public`은 `security_invoker = true` 뷰로 `user_public_profiles(user_id, public_name, updated_at)`를 읽습니다(Advisors ERROR `security_definer_view` 제거). 테이블은 users 1행 = 1행이고 `public_name = coalesce(nickname, 모험가NNNN)`을 동기화 트리거 `sync_user_public_profile`(`AFTER INSERT OR UPDATE OF nickname ON users`, SECURITY DEFINER·`SET search_path = ''`·EXECUTE 없음)이 씁니다. 자리표시자 식은 `placeholder_display_name`과 같은 식을 트리거에 복사(`00018`(①)이 `00013`(③)보다 먼저 적용되기 때문, 회귀 `PP-3`·`PP-4`·`VIEW-3`가 대조). 권한은 authenticated SELECT(정책 `USING (true)` — 게시판에서 원래 모두에게 보이는 이름뿐) + service_role, anon 없음, 클라이언트 쓰기 없음. PostgREST는 뷰의 관계를 원본 테이블 컬럼의 FK로 찾으므로 게시판 FK `board_posts_user_id_fkey`·`board_comments_user_id_fkey`가 이름은 그대로 `user_public_profiles(user_id)`를 가리킵니다(앱의 `user_profiles_public!board_posts_user_id_fkey(display_name)` 임베딩 유지, 탈퇴는 users → user_public_profiles → 게시판 cascade). 다른 테이블(진행·공지 등)에서 `user_profiles_public`을 임베딩할 수는 없습니다. 캐릭터 아바타 등 공개 값을 늘릴 때(P3-13)는 이 테이블에 컬럼을 더하고 트리거·뷰를 함께 고칩니다. **실명·이메일·XP처럼 다른 아이에게 보이면 안 되는 값은 넣지 않습니다**
- 요청 한도(P1-19, `00016` ①): `api_rate_limits`(service_role 전용, `(user_id, bucket)` 1행에 분 창·하루(KST) 창 카운트) + `consume_rate_limit(p_user_id, p_bucket, p_per_minute, p_per_day)`(service_role 전용 SECURITY DEFINER, `{allowed, retry_after, remaining, scope, denied_minute, denied_today}`). 행을 `FOR UPDATE`로 잠가 동시 요청에도 한도가 정확하고(RL-6), 시각은 잠금 뒤 `clock_timestamp()`로 재며 창은 앞으로만 갑니다. 한도 값은 앱이 넘기므로(env `TUTOR_LIMIT_*`, `src/lib/tutor/rateLimit.ts`) 값을 바꿀 때 마이그레이션이 필요 없습니다. 행이 요청마다 쌓이지 않고(사용자 × 버킷), pg_cron이 없어 그날 첫 요청 때 2일 넘게 안 쓴 행을 최대 200개 지웁니다(SKIP LOCKED). 탈퇴는 cascade. 버킷은 `tutor:<요청 유형>`이고 퀴즈 채점 API(P7-02)도 `quiz:answer`처럼 같은 함수를 씁니다(`^[a-z][a-z0-9_:]{0,47}$`)
- 분석 이벤트(P1-17, `00017` ①, §12-Q22): `analytics_events`(service_role 전용 SELECT·INSERT·DELETE, **UPDATE 없음** = 기록은 고치지 않음). 익명 ID `anon_id`는 로그인 사용자면 서버가 `HMAC-SHA256(ANALYTICS_SALT, user id)` 앞 22자, 비로그인이면 탭 세션 난수(둘 다 base64url 22자 CHECK)라 `users`를 참조하지 않습니다(탈퇴 삭제는 앱이 HMAC으로). 이름은 형식만(`^[a-z][a-z0-9_]{1,47}$`), 허용 목록·속성 형식은 앱 zod(`src/lib/analytics/schema.ts`)가 정하므로 이벤트를 더할 때 마이그레이션이 필요 없습니다. props 512바이트, `path`는 쿼리 없는 템플릿(CHECK가 `?`·공백 거부), `device`는 4가지 값(UA 원문 거부). "처음 한 번" 이벤트는 `UNIQUE (anon_id, dedupe_key)` + `ON CONFLICT DO NOTHING`. 보존 180일은 `prune_analytics_events(p_retention, p_limit)`(SECURITY DEFINER — `FOR UPDATE SKIP LOCKED`에 UPDATE 권한이 필요해서, service_role 전용, 1일 미만 거부)를 앱이 인스턴스마다 1시간에 한 번 부르고 런북 SQL로도 실행. 비로그인 요청 한도는 users FK가 있는 `consume_rate_limit`을 쓸 수 없어 `api_global_rate_limits` + `consume_global_rate_limit(p_bucket, p_per_minute, p_per_day)`(사용자 없는 버킷 1행, 반환·창 규칙은 `consume_rate_limit`과 같음, service_role 전용). 전체가 행 하나를 잠그므로 초당 수십 건 넘게 몰리는 경로에는 쓰지 않습니다. 설계: [docs/analytics.md](../docs/analytics.md)
- B08(해결): `00001` Section 6의 `solution_code` UPDATE는 seed보다 먼저 실행되어 새 DB에서 0건이었습니다. 00001은 운영에 적용한 파일이라 고치지 않습니다. P1-02에서 같은 내용을 `seed.sql` 끝에 두었고, P1-12부터는 정답이 `content/`에 있어 생성 seed가 `quest_answer_keys`에 직접 씁니다.

## 4. RLS·권한 회귀 테스트 (P1-20)

저장소 마이그레이션과 seed를 적용한 **로컬** DB에 PostgREST(HTTP)와 psql(`SET ROLE anon/authenticated`)로 권한 조작을 시도하고, 기대값과 비교합니다. 운영 DB에는 접속하지 않습니다(API 주소가 `127.0.0.1`/`localhost`가 아니면 중단). 출발점은 P0-08 스파이크(`spikes/p0-08-answer-keys/verify.sh`, 기록용으로 그대로 둠)입니다.

```bash
npm run test:rls       # 빠른 모드: 켜져 있는 pyroad 스택에 db reset 후 점검 (약 30초)
npm run test:rls:ci    # 격리 모드: 임시 스택(pyroadrls, 5462x)으로 3개 시나리오 (약 3~4분)

# CI 에서 빠르게 (legacy 시나리오 1개만, 스택 시작 1회)
RLS_SKIP_PROD=1 RLS_SKIP_NEWDEFAULT=1 npm run test:rls:ci
```

| 모드 | 대상 | 시나리오 |
|---|---|---|
| 빠른 (`fast`) | 켜져 있는 `supabase_*_pyroad` 스택. 먼저 `npm run db:start`. **DB를 reset하므로 로컬 데이터가 지워짐** | `local`: 저장소 migrations + seed (신규 기본값) |
| 격리 (`ci`) | 새 임시 스택 `supabase_*_pyroadrls`(포트 54620~)를 띄우고 끝나면 내림. 켜진 pyroad 스택은 건드리지 않음 | `prod_replay`: 핫픽스 전 00001(`git show 2f0a8f3^`) + 운영 seed(`git show e800386`, 손으로 쓴 예전 seed) + Section 6 → `00002~`를 `psql -1`로 릴리즈 순서(① 파일 → ③ 파일)대로 적용 → 콘텐츠 seed(`seed.sql`) (운영 적용 리허설, legacy)<br>`fresh_legacy`: 새 DB, 새 테이블 자동 노출 켜짐 (운영과 같은 기본값)<br>`fresh_newdefault`: 새 DB, 자동 노출 꺼짐 (스택 재시작 1회) |

환경 변수: `RLS_NO_RESET=1`(fast, reset 생략) · `RLS_SKIP_PROD=1` · `RLS_SKIP_NEWDEFAULT=1` · `RLS_PROJECT_ID`·`RLS_PORT_BASE`(ci 임시 스택 이름·포트) · `RLS_KEEP=1`(ci 스택 남기기) · `RLS_UPDATE_SNAPSHOTS=1`(스냅샷 갱신). 종료 코드는 FAIL이 없으면 0, 있으면 1, 환경 문제면 2입니다.

### 파일

| 경로 | 내용 |
|---|---|
| `tests/run.sh` | 스택 준비 → 시나리오별 `checks.mjs` 실행 → 요약 |
| `tests/checks.mjs` | 점검 동작 (무엇을 요청하고 결과를 어떻게 분류하는지) |
| `tests/expectations.mjs` | **점검별 기대값.** 권한 작업은 보통 여기 한 줄만 바꿈 |
| `tests/fixtures/reward-rules.json` | XP·레벨·3일 연속·뱃지 규칙 대조표. SQL(`reward` RW-1)과 TS(vitest `rewardRules.test.ts`)가 같은 표를 씀 |
| `tests/snapshots/*.txt` | 카탈로그 스냅샷: SECURITY DEFINER 함수(anon/authenticated 실행 가능), 테이블·뷰·컬럼 권한, RLS 정책 |
| `tests/summarize.mjs` | 결과 표 출력, `tests/.results/results.md` 작성 (git 제외) |

### 범위

| 그룹 | 점검 |
|---|---|
| `view` | `user_profiles_public` 비로그인 조회·뷰를 통한 수정/삭제 거부(B03), 모든 뷰의 쓰기 권한 없음, `security_invoker` 아닌 뷰 없음(VIEW-2, B34), `user_public_profiles` 비로그인 조회·사칭 수정·삭제·끼워 넣기 거부(PP-1·2)·동기화 트리거(PP-3: 가입·닉네임 변경·P3-11처럼 UPDATE (nickname)을 준 authenticated)·users와 행 일치(PP-4) (공개 이름 규칙은 `board`의 VIEW-3) |
| `notice` | 공지 쓰기(본인 INSERT·UPDATE·DELETE, psql) 거부, 비로그인 목록·service_role 작성 허용(B02) |
| `write` | XP·레벨·황금키·코인(P8, PENDING)·별·시도·`earned_xp`·뱃지·진행 상태·`hints_used`·`used_golden_key` 직접 쓰기, 다른 사용자 행 쓰기, 권한 없는 프로필 컬럼·`users` INSERT, `custom_api_keys` 조회, 이전 auto-save payload, 완료 행의 `quest_id` 바꾸기, 진행 행 삭제·상태 되돌리기 뒤 재완료로 XP 반복 획득(B04·B05·B13·P1-01·P1-04) |
| `apikey` | `user_api_keys` 접근 거부(anon/authenticated 조회·임베딩·쓰기·OpenAPI 노출), service_role 조회·저장, 탈퇴 시 삭제(B13) |
| `answer` | `quests`의 정답 노출(B07), 새 DB의 `solution_code`(B08), `quest_answer_keys` 접근 거부(P1-02 이후 자동 활성화) |
| `rpc` | 보상 RPC(`complete_quest`·`use_golden_key`·`reset_progress`·`record_hint`)와 규칙 함수를 anon/authenticated가 부를 수 없음 (P1-03·P1-04) |
| `reward` | 보상 RPC 동작: TS↔SQL 규칙 대조표(`fixtures/reward-rules.json`), 동시 완료 8회·동시 황금키 5회에 1회만 지급, 힌트·황금키는 DB 값(B05·B11), 스테이지 잠금·채점 미통과 거부, 스테이지 클리어, 리셋 XP 재계산·뱃지(B12), `earned_xp` 클라이언트 쓰기 무시, 00006 백필 재실행, `record_hint` 규칙(P1-04), 황금키 완료 뱃지 없음·직접 푼 완료 기준 `first_code`·`streak_3`(Q25, RW-4·12·13) |
| `app` | 앱이 실제로 보내는 조회·쓰기(월드·프로필·퀘스트 페이지, 뱃지 확인, auto-save, 설정, 게시판, 리셋)와 service_role 경로가 깨지지 않음. 게시판 작성자는 `모험가NNNN`(APP-13·14), 게시판 쓰기는 service_role(APP-W4~W8, P1-18) |
| `schema` | P1-08(`00012`): `worlds` 비로그인 거부·로그인 조회·쓰기 거부, 백필(월드·`quest_type`), 2월드 스테이지 잠금·리셋 순서, `quiz_attempts` 쓰기 거부·본인 행만 조회, 프로필 컬럼 클라이언트 UPDATE 거부(PF-1~4), `settings` 기본 형태, 닉네임 글자 규칙(EUC-KR 변환과 2,350자 전수 비교)·유일, KST 함수 경계값·인라인 |
| `auth` | B24·B16(`00013`): 가입 트리거가 provider 이름·사진을 복사하지 않음(B16-1·2), 로그인 뒤 `last_login_at` = `last_sign_in_at`, `iss`로 `last_login_provider` |
| `board` | P1-18·B19(`00014`·`00015`): 길이·빈 값 CHECK(service_role도 거부 B19-1~5, 경계 B19-6, 브라우저 직접 INSERT B19-7, VALID B19-8), 클라이언트 글·댓글 쓰기 거부(BW-1~6), 숨긴 글·댓글 조회(BH-1~3)·보호 트리거(BH-4, ① 상태 재현), `board_reports`·`report_board_content` 접근 거부(BR-1~4·7)·서버 경로(BR-5)·규칙(BR-6: 중복·본인·3명 숨김), 공개 이름에 실명·사진 없음(VIEW-3) |
| `ratelimit` | P1-19(`00016`): `api_rate_limits` 조회·카운터 되돌리기·삭제 거부(RL-1~4), `consume_rate_limit` 직접 호출 거부(RL-5·5b, 남의 한도 소진), 동시 20회에 한도 5 정확·하루 한도 정확(RL-6), 분 창 경과 재허용·KST 하루 창·버킷 독립·창을 되돌리지 않음·인자 검증·오래된 행 정리·탈퇴 cascade(RL-7), anon/authenticated 접근 없음(RL-8) |
| `analytics` | P1-17(`00017`): `analytics_events` 조회 거부(AN-1·2, 다른 아이의 이용 기록)·직접 쓰기 거부(AN-3·4, 지표 부풀리기)·삭제 거부(AN-5), `prune_analytics_events`·`consume_global_rate_limit` 직접 호출 거부(AN-6), 서버 경로: upsert dedupe·CHECK(이름·익명 ID·경로 쿼리·props 크기·기기)·service_role UPDATE 불가·180일 정리·전역 한도(AN-7), anon/authenticated 접근 없음(AN-8) |
| `account` | B28: 사용자를 가리키는 FK가 모두 ON DELETE CASCADE(`board_reports.target_user_id` SET NULL만 예외)·FK 없는 사용자 열 없음(B28-1), 탈퇴(`auth.admin.deleteUser` + HMAC 분석 기록 삭제) 뒤 public·auth의 모든 uuid 열에 그 사용자 값 0(B28-2), 클라이언트 `users` DELETE 거부(B28-3) |
| `static` | RLS 꺼진 테이블 없음, RPC로 부를 수 있는 SECURITY DEFINER 없음, `search_path` 미설정(SECURITY DEFINER ST-4, 전체 함수 ST-6 — `kst_date`만 예외), `auth.uid()`를 감싸지 않은 정책 0(ST-5, B34), Supabase Advisors(`supabase db advisors`, CLI 내장 규칙) ERROR 0(ST-7)·의도한 WARN(`kst_date`)만(ST-8)·INFO 기록(ST-9), 스냅샷 3종 |

GraphQL(`pg_graphql`)은 운영·로컬 모두 없어서 대상이 아닙니다.

### 결과 읽기

| 결과 | 뜻 |
|---|---|
| `PASS` | 기대대로 (`deny`는 막힘, `allow`는 동작, `snapshot`은 일치) |
| `GAP` | `known-gap`: 알려진 구멍이 아직 열려 있음. 통과로 집계하고 `flipIn` 작업 ID별로 따로 보여 줌 |
| `PENDING` | `requires` 객체(테이블·컬럼·함수)가 아직 없어 건너뜀. 생기면 자동으로 점검 시작 |
| `INFO` | 참고 기록 |
| `FAIL` | 기대와 다름. **`known-gap`이 막혀도 FAIL**입니다 (막힌 줄 모르고 지나가지 않게) |

### 권한을 바꾸는 작업을 할 때

1. 마이그레이션을 고치고 `npm run test:rls`를 돌립니다.
2. 의도대로 막은 점검은 `FAIL … 구멍이 막힘 → 'deny' 로 바꾸세요`로 나옵니다. `expectations.mjs`에서 그 ID의 `expect: 'known-gap'`을 `'deny'`로 바꿉니다. 지금 걸려 있는 작업은 없습니다. (P1-02의 B07-2·3, B08-1, P1-01의 B04-1·2·7·8, P1-04의 B04-4·4b·5·5b·11·12·APP-W10, B24의 ST-3·4, B34의 VIEW-2는 뒤집음)
3. 앱 쿼리를 바꿨다면 `checks.mjs`의 `app` 그룹 요청도 같이 바꿉니다(예: P1-04에서 auto-save payload가 바뀌어 APP-W1을 새 payload로, 이전 payload는 B04-22 deny로).
4. 권한·정책·SECURITY DEFINER 함수가 바뀌면 스냅샷이 `diff`로 FAIL합니다. 의도한 변경이면 `RLS_UPDATE_SNAPSHOTS=1 npm run test:rls`로 다시 만들고 `git diff supabase/tests/snapshots/`를 리뷰해 같은 커밋에 넣습니다.
5. 새 테이블·함수를 만들면 대응하는 점검을 `checks.mjs`에 추가하고 기대값을 `expectations.mjs`에 적습니다(기대값이 없으면 FAIL).
6. PR 전에 `npm run test:rls:ci`로 legacy 기본값·운영 재현에서도 같은지 확인합니다.

- 점검마다 테스트 사용자를 새로 만들고, 로그인은 1명만 합니다(Auth 로그인 rate limit: 5분에 30회).
- 격리 모드가 중간에 멈춰 임시 스택이 남았다면 `docker ps --filter name=pyroadrls`로 확인하고, `RLS_KEEP=1`로 돌렸던 경우의 작업 디렉토리에서 `supabase stop --no-backup --workdir <dir>`로 내립니다.

## 5. 운영 적용 (사용자 작업)

- 운영 DB에는 **사용자가 직접** Phase 끝에 한 번에 적용합니다. 에이전트·CI는 운영에 쓰지 않습니다(Supabase MCP는 읽기 전용).
- Supabase Dashboard → SQL Editor에서 파일 내용을 `BEGIN;` … `COMMIT;`으로 감싸 실행합니다. 오류가 나면 전체가 롤백됩니다.
- 순서: ① 파일들 → 앱 배포(Vercel) → 동작 확인 → ③ 파일들. 각 파일 머리 주석의 "릴리즈 단계"를 따르며, 번호 순서와 단계 순서가 다르면 단계가 우선입니다(`test:rls:ci`의 운영 재현도 같은 순서로 적용). 적용 전후에 `spikes/p0-08-answer-keys/prod_readonly_checks.sql`(SELECT만 있음)로 상태를 확인합니다.
- 되돌리기는 `rollback/`의 파일을 역순으로(예: 00005 → 00004) 같은 방식(`BEGIN; … COMMIT;`)으로 실행합니다.
- 운영은 SQL Editor로 적용하므로 `supabase_migrations` 이력이 없습니다. `supabase db push`·`supabase link`로 운영에 적용하지 않습니다.

## 6. 타입 생성

- `src/lib/types/database.generated.ts`: `npm run db:types`가 만드는 파일입니다. 직접 고치지 않습니다.
- `src/lib/types/database.ts`: 생성 타입 위의 얇은 래퍼입니다. CHECK 제약 컬럼(문자열 유니온)과 JSONB 컬럼 구조처럼 생성 타입이 표현하지 못하는 부분만 좁히고, 앱 코드는 여기서 import합니다.
- Supabase 클라이언트(`src/lib/supabase/client.ts`·`server.ts`·`admin.ts`)는 `Database` 타입을 받으므로, 테이블·컬럼·RPC를 추가하면 마이그레이션 → `npm run db:reset` → `npm run db:types` 순서로 타입을 갱신해야 `tsc`가 통과합니다.
