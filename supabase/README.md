# supabase/

pyRoad 데이터베이스 스키마와 로컬 Supabase 설정입니다. 배경과 결정은 `docs/4.upgrade-plan.md` §2.2 "권한 원칙", P1-07과 `docs/spikes/P0-08-answer-keys.md`를 참고하세요.

| 경로 | 내용 |
|---|---|
| `config.toml` | 로컬 스택 설정 (project_id `pyroad`, 포트 5452x, 필요 없는 서비스 끔) |
| `migrations/000NN_<설명>.sql` | 스키마 변경. 번호 순서대로 적용 |
| `seed.sql` | 스테이지·퀘스트 데이터. `db reset` 때 마이그레이션 **다음에** 실행 |
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
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.users TO authenticated;
```

- `config.toml`에 `auto_expose_new_tables`를 켜거나 `ALTER DEFAULT PRIVILEGES`로 기본값을 바꾸지 않습니다. 빠뜨린 GRANT가 로컬에서 드러나지 않게 됩니다.
- **SELECT 컬럼 권한은 회수하지 않습니다.** PostgREST의 `select=*`가 42501로 깨집니다. 숨길 데이터는 별도 테이블로 분리합니다.
- 뷰는 `WITH (security_invoker = true)`로 만들어 기반 테이블의 RLS를 따르게 하고, 뷰에도 GRANT/REVOKE를 따로 적습니다.
- 시퀀스를 쓰는 컬럼(`identity`/`serial`)에 클라이언트가 INSERT하면 `GRANT USAGE ON SEQUENCE …`도 필요합니다. 지금 `public`의 PK는 모두 `gen_random_uuid()`입니다.

### 함수와 SECURITY DEFINER

새 함수는 PostgreSQL 기본값으로 `PUBLIC`에 EXECUTE가 있습니다(운영은 anon·authenticated에도 직접 부여).

```sql
CREATE OR REPLACE FUNCTION public.complete_quest(p_user_id uuid, p_quest_id uuid, p_submission text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- 함수 안에서는 public.users 처럼 스키마를 모두 적음
AS $$ … $$;

REVOKE EXECUTE ON FUNCTION public.complete_quest(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_quest(uuid, uuid, text) TO service_role;
```

- `SECURITY DEFINER`는 RLS를 우회하므로 꼭 필요할 때만 씁니다. 쓰면 `SET search_path = ''` + `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`를 빠뜨리지 않습니다.
- 사용자 id를 인자로 받는 함수는 service_role 전용으로 두고, API Route가 `getUser()`로 확인한 id만 넘깁니다. authenticated에게 열어야 한다면 인자 대신 `(select auth.uid())`를 씁니다.
- `REVOKE`/`GRANT`에는 인자 타입까지 적습니다(오버로드 구분).

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
```

- 권한·RLS 회귀 점검: `bash spikes/p0-08-answer-keys/verify.sh` (P1-20에서 `supabase/tests/`로 옮길 예정. 자체 임시 스택을 5462x 포트로 띄움)
- 운영과 같은 legacy 기본값에서도 확인하려면 임시 작업 디렉토리에 `config.toml`을 복사해 `project_id`·포트를 바꾸고 `auto_expose_new_tables = true`를 켠 뒤 `supabase db start --workdir <dir>`로 띄웁니다(위 verify.sh가 쓰는 방법).
- 알려진 차이(B08): `00001` Section 6의 `solution_code` UPDATE가 seed보다 먼저 실행되어, 새 DB에서는 `solution_code`가 0건입니다. P1-02에서 정답 테이블로 옮기며 해결합니다.

## 4. 운영 적용 (사용자 작업)

- 운영 DB에는 **사용자가 직접** Phase 끝에 한 번에 적용합니다. 에이전트·CI는 운영에 쓰지 않습니다(Supabase MCP는 읽기 전용).
- Supabase Dashboard → SQL Editor에서 파일 내용을 `BEGIN;` … `COMMIT;`으로 감싸 실행합니다. 오류가 나면 전체가 롤백됩니다.
- 순서: ① 파일들 → 앱 배포(Vercel) → 동작 확인 → ③ 파일들. 적용 전후에 `spikes/p0-08-answer-keys/prod_readonly_checks.sql`(SELECT만 있음)로 상태를 확인합니다.
- 운영은 SQL Editor로 적용하므로 `supabase_migrations` 이력이 없습니다. `supabase db push`·`supabase link`로 운영에 적용하지 않습니다.

## 5. 타입 생성

- `src/lib/types/database.generated.ts`: `npm run db:types`가 만드는 파일입니다. 직접 고치지 않습니다.
- `src/lib/types/database.ts`: 생성 타입 위의 얇은 래퍼입니다. CHECK 제약 컬럼(문자열 유니온)과 JSONB 컬럼 구조처럼 생성 타입이 표현하지 못하는 부분만 좁히고, 앱 코드는 여기서 import합니다.
- Supabase 클라이언트(`src/lib/supabase/client.ts`·`server.ts`·`admin.ts`)는 `Database` 타입을 받으므로, 테이블·컬럼·RPC를 추가하면 마이그레이션 → `npm run db:reset` → `npm run db:types` 순서로 타입을 갱신해야 `tsc`가 통과합니다.
