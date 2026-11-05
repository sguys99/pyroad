# CLAUDE.md

pyRoad - AI 동물 마스코트 튜터와 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼. 계획·설계 결정·진행 현황은 [`docs/4.upgrade-plan.md`](docs/4.upgrade-plan.md) (§2가 공통 기준).

## 기술 스택

- **Frontend**: Next.js 15 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend (BaaS)**: Supabase (Auth, PostgreSQL, RLS, SSR). 로컬 Supabase CLI는 2.115.0 고정
- **AI/LLM**: 멀티 프로바이더 (`src/lib/tutor/providers/`, 팩토리). 서버 키는 Gemini 무료 티어만, Anthropic·OpenAI는 학생 본인 키(암호화 저장)로만
- **Code Execution**: Pyodide 314.0.7 자체 호스팅(`public/pyodide/`, predev·prebuild가 복사) + module Worker `public/workers/pyodide-worker.mjs`. 실행 로직은 공용 코어 `pyodide-core.mjs`(브라우저·Node 테스트 공용)
- **Editor**: CodeMirror 6
- **Animation**: Framer Motion, CSS keyframes, canvas-confetti. Lottie는 안 씀(B32, `lottie-react`는 미사용 의존성, Phase 6에서 `lottie_light`로 재도입 예정)
- **Validation**: zod / **Markdown**: react-markdown, remark-gfm / **Icons**: Lucide React / **SVG**: SVGO
- **관측·분석**: Sentry(DSN 없으면 꺼짐, 지연 로드, 최소 수집), 자체 분석 `track()` + `analytics_events` ([docs/analytics.md](docs/analytics.md))
- **Tooling**: npm, ESLint (Flat Config), Prettier, Vitest, Playwright, PGlite·tsx(스크립트)
- **Deploy**: Vercel / **CI**: GitHub Actions ([docs/ci.md](docs/ci.md))

## 디렉토리 구조

```
.
├── content/worlds/           # 퀘스트 콘텐츠 원본 YAML (content/README.md)
├── src/
│   ├── app/
│   │   ├── (protected)/      # 인증 필요 페이지 (world, quest, profile, settings, board)
│   │   ├── api/              # API Routes (tutor, quest, board, notice, account, settings, analytics)
│   │   ├── auth/             # Auth 콜백
│   │   └── notice/           # 공지 (비로그인 열람)
│   ├── components/           # quest/(렌더러·celebrations), characters/, ui/(shadcn), board, landing, world …
│   └── lib/
│       ├── quest/            # useQuestSession, answerKeys(서버 전용), rewardRpc, validation
│       ├── content/          # 콘텐츠 zod 스키마·빌드
│       ├── pyodide/ tutor/ celebration/ motion/ supabase/ security/ analytics/ observability/
│       └── moderation/ time/ crypto/ env/ api/ auth/ board/ notice/ world/ types/
├── public/                   # characters/, workers/, pyodide/(복사본, git 제외)
├── scripts/                  # content, pyodide, fonts, security, api-keys
├── supabase/                 # migrations/, rollback/, tests/(RLS 회귀), seed.sql(생성물)
├── e2e/                      # Playwright (e2e/README.md)
├── docs/                     # 계획서, ci.md, analytics.md, release/(런북), spikes/
├── spikes/                   # Phase 0 스파이크 코드
└── img/                      # 스크린샷 에셋
```

## 개발 워크플로우

### 환경 설정

```bash
npm install
cp .env.example .env.local
# 필수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# 권장: GEMINI_API_KEY (없으면 튜터가 저장된 답변만). 서버 ANTHROPIC·OPENAI 키는 쓰지 않음. 나머지는 .env.example
```

### 로컬 Supabase ([supabase/README.md](supabase/README.md))

```bash
npm run db:start | db:status | db:reset | db:types | db:stop   # Docker, 포트 5452x
```

다른 프로젝트의 스택(포트 54321~54327·54421~54424)·컨테이너는 건드리지 않는다.

### 개발 서버 / 빌드

```bash
npm run dev          # Turbopack (predev: Pyodide 복사)
npm run build        # prebuild: Pyodide 복사, postbuild: 정적 페이지 CSP 검사
```

### 콘텐츠 ([content/README.md](content/README.md))

```bash
npm run content:build             # content/ → supabase/seed.sql (YAML과 같은 커밋에)
npm run content:build -- --check  # seed.sql 드리프트 검사 (CI)
```

### 린트/포맷/타입

```bash
npm run lint                          # lint:fix로 자동 수정
npx prettier --check .                # 제외 대상은 .prettierignore (*.md 포함)
npx next typegen && npx tsc --noEmit  # 새 clone은 next-env.d.ts가 없어 typegen 먼저
```

### 테스트

```bash
npm test               # Vitest 단위 (watch, 1회는 npx vitest run)
npm run test:pyodide   # 공용 실행 코어 (실제 Pyodide)
npm run test:content   # 모든 정답 코드 실행 검증
npm run test:rls       # 켜진 로컬 스택 db reset 후 RLS·권한 회귀
npm run test:rls:ci    # 격리 임시 스택, 3개 시나리오 (3~4분)
npm run test:e2e       # Playwright (PORT 3100, 로그인 스펙은 db:start 필요)
npm run optimize:svg   # public/characters SVG 최적화
```

## Claude 에이전트 목록

`.claude/agents/` 에 프리셋 에이전트가 준비되어 있습니다.

| 에이전트 | 용도 |
|---------|------|
| `dev/development-planner` | ROADMAP.md 작성 및 개발 계획 수립 |
| `dev/nextjs-app-developer` | Next.js App Router 구조 설계 및 구현 |
| `dev/starter-cleaner` | 스타터킷 보일러플레이트 정리 |
| `dev/ui-markup-specialist` | UI 컴포넌트 마크업 및 스타일링 |
| `dev/code-reviewer` | 코드 리뷰 |
| `docs/prd-generator` | PRD 문서 생성 |
| `docs/prd-validator` | PRD 기술적 타당성 검증 |

## 코딩 컨벤션

- TypeScript strict mode. 서버 컴포넌트 기본, 클라이언트 컴포넌트는 `'use client'` 명시
- 파일명: 컴포넌트 PascalCase (`QuestCard.tsx`), 유틸리티 camelCase (`pyodideWorker.ts`), 테스트는 `__tests__/` (`src/lib/quest/__tests__/validation.test.ts`)
- 환경 변수는 `.env.local`(커밋 금지). 새 env는 `.env.example`에 공개/서버·필수/선택과 함께
- 화면 문구는 초등학생용 쉬운 한국어. 공개 정보는 닉네임 + 아바타만, 분석·Sentry에 개인정보·학생 코드 금지 (§2.6)

### Supabase·API

- 클라이언트는 `src/lib/supabase/`: `server.ts`(서버), `admin.ts`(service_role, 서버 전용), 클라이언트 컴포넌트는 `client.ts` 정적 import 대신 `loadBrowserClient()`(B33)
- 인증 필요 페이지는 `(protected)` + `src/middleware.ts`. API Routes는 `auth.getUser()`로 확인한 id만 씀
- 응답에 DB 오류 메시지 금지: `reportServerError`(`src/lib/api/serverError.ts`)로 로그·Sentry, 응답은 일반 문구
- 관리자 판별은 `isAdminUser`(`src/lib/admin.ts`, `app_metadata.role`, B37). 이메일·`user_metadata` 비교 금지
- **정답·힌트·`solution_code`는 `quest_answer_keys`(service_role 전용)에만**, 읽기는 `src/lib/quest/answerKeys.ts`(서버 전용). 클라이언트로 내려보내지 않음
- **보상·채점·힌트 기록은 service_role RPC만**(`complete_quest`·`use_golden_key`·`reset_progress`는 `rewardRpc.ts`, `record_hint`). 완료 API는 서버에서 재채점. 클라이언트 쓰기 경로·클라이언트용 채점 RPC 금지 (§2.3)
- **운영 DB는 읽기 전용**(Supabase MCP). 적용은 사용자가 Phase 끝에 런북([docs/release/](docs/release/))대로. `supabase db push`·`link` 금지

### 마이그레이션 (세부: [supabase/README.md](supabase/README.md))

- `supabase/migrations/000NN_<설명>.sql` 다음 번호, 멱등하게. 적용한 파일은 고치지 않고 새 파일. 되돌리기는 `supabase/rollback/`
- 머리 주석에 **릴리즈 단계 ①(추가형)/③(권한 회수형)** — 한 파일에 섞지 않음. 새 앱은 ①만 적용된 DB와 ①+③ DB 모두에서 동작해야 함. 새 객체의 REVOKE는 ①에
- 모든 테이블·뷰·함수에 GRANT/REVOKE 명시(운영은 새 객체를 anon에 자동 노출, 로컬은 자동 부여 없음). SELECT 컬럼 권한은 회수하지 않음. 뷰는 `security_invoker = true`
- `SECURITY DEFINER`는 `SET search_path = ''` + `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`(인자 타입까지)
- RLS 정책은 `(select auth.uid())` + `TO authenticated`. 사용자 테이블은 `REFERENCES public.users(id) ON DELETE CASCADE` (B28)
- 스키마 변경 후 `db:reset` → `db:types` → tsc. 권한 변경은 `test:rls`로 확인하고 `supabase/tests/expectations.mjs` 기대값·스냅샷을 같은 커밋에서 갱신

### 콘텐츠·퀘스트 엔진·화면

- 퀘스트 원본은 `content/`. `supabase/seed.sql`은 생성물이라 직접 고치지 않음
- 퀘스트 화면은 `useQuestSession`(진행·저장·힌트·실행·채점·완료·축하) + `src/components/quest/questRenderers.ts`의 유형별 렌더러. 렌더러에 세션 로직을 복제하지 않음
- Worker 프로토콜 `run / stdout / stderr / input-request / answer / stop / done`, 실행 로직은 `pyodide-core.mjs`에만. 보안 경계는 JS 쪽 (§2.9)
- AI 튜터 프로바이더는 `src/lib/tutor/providers/factory.ts`로만 추가
- 축하는 `src/lib/celebration/` 시퀀서, 컨페티는 `src/lib/confetti.ts`의 `fireConfetti()`만
- 반복 연출은 CSS transform·opacity만(Framer `repeat: Infinity`·SMIL 금지), reduced-motion과 연출 단계(`src/lib/motion/`) 존중 (§2.10)
- 날짜·스트릭은 KST `src/lib/time/kst.ts` (SQL `public.kst_date()`). 실행 환경 TZ에 기대지 않음
- CSP(`src/lib/security/csp.ts`): `'unsafe-eval'` 금지. 새 페이지가 정적으로 굳으면 postbuild가 실패 → 동적 렌더로 하거나 공개 페이지만 `STATIC_PAGE_PATHS`에. 외부 출처 추가 시 CSP·테스트도 수정

## 브랜치 & 커밋 규칙

상세 배경은 `docs/4.upgrade-plan.md` §2.7, §10 참고.

### 브랜치

- **Phase당 브랜치 1개**: `feat/phaseN` (예: `feat/phase1`). 항상 최신 `main`에서 분기한다.
- **긴급 수정**: `main`에서 `hotfix/<주제>` (예: `hotfix/notice-auth`). 기존 `bugfix-<주제>`는 과거 이력이며, `.claude/commands/git/branch.md`의 `hotfix/` 프리픽스 및 `feat/phaseN`의 슬래시 형식과 맞추기 위해 `hotfix/`로 통일한다. 병합 후 `main`을 각 Phase 브랜치에 반영한다.
- 공유(푸시된) 브랜치에 `--force` 금지. rebase는 아직 푸시하지 않은 커밋에만, 이미 푸시했다면 `git merge main`을 쓴다. 불가피하면 `--force-with-lease`로 본인 브랜치에서만.
- Phase 2와 3은 병행 가능하므로 서로의 브랜치를 base로 삼지 않고 각자 `main`에서 분기한다. 한쪽이 `main`에 병합되면 다른 쪽에서 즉시 `git merge main`으로 반영한다.

### 커밋

- 형식: `<이모지> <타입>: <한글 요약> (<작업 ID>)` — 예: `✨ feat: 닉네임 설정 화면 추가 (P3-05)`, `🔒️ fix: 공지 쓰기 권한 우회 차단 (B02)`. 이모지 맵은 `.claude/commands/git/commit.md`를 따른다.
- **작업 항목 1개 = 커밋 1개**, 항목마다 즉시 `git push`. 작업 ID(`P1-03`, `B05`)를 제목에 넣는다.
- 같은 커밋에서 `docs/4.upgrade-plan.md`의 체크박스, 상단 상태표, §13 진행 기록을 함께 갱신한다.
- 계획서 충돌 시: 양쪽 변경을 모두 살리고(다른 항목 체크박스는 각자 유지), 상태표 수치는 체크박스를 다시 세어 재계산한다.

### Pull Request & 릴리즈

- Phase 종료 시 `feat/phaseN` → `main` PR 1개. 제목: `🎉 feat: Phase N <Phase명> 완료`. 본문은 `.github/pull_request_template.md`를 채운다 (완료한 P/B-ID 목록, DB 스키마·환경 변수 변경, UI 변경 시 360/768/1280 스크린샷).
- **병합 방식은 Merge commit** (squash 금지). 기존 이력이 PR 병합 커밋 방식이고, 작업별 커밋을 추적·revert하기 위해서다.
- 마일스톤 태그는 해당 Phase가 `main`에 병합된 뒤 `main`에서 부여: v0.4(Phase 1+3 완료 후, P1-24/P3-20), v0.5(2·4·5·6), v0.6(7·8), v0.7(9), v0.8(10), v0.9(11), v1.0(12). 예: `git tag -a v0.4 -m "..." && git push origin v0.4`.
- CI가 PR·푸시마다 돈다. `main`은 필수 체크(`lint-typecheck`·`unit`·`content`·`pyodide`·`rls`·`build`, 이후 `e2e-smoke` — 현재 목록은 [docs/ci.md](docs/ci.md))를 통과해야 병합된다. PR 전 로컬에서 `npm run lint`, `npx prettier --check .`, `npx tsc --noEmit`, `npx vitest run`(+ 해당되면 `test:content`·`test:rls:ci`·`test:e2e`).

### 스파이크

- 코드는 `spikes/p0-XX-<주제>/`, 보고서는 `docs/spikes/P0-XX-<주제>.md`. 앱 빌드·lint·테스트에서 제외된다. 규칙은 [`spikes/README.md`](spikes/README.md) 참고.
