# CLAUDE.md

pyRoad - AI 동물 마스코트 튜터와 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼

## 기술 스택

- **Frontend**: Next.js 15 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend (BaaS)**: Supabase (Auth, PostgreSQL, RLS, SSR)
- **AI/LLM**: 멀티 프로바이더 — Anthropic Claude, OpenAI, Google Gemini (Next.js API Routes에서 호출, `src/lib/tutor/providers/`에서 팩토리 패턴으로 관리)
- **Code Execution**: Pyodide 314.0.7 (브라우저 내 Python WASM, 자체 호스팅 `public/pyodide/<버전>/`은 빌드 전 npm 패키지에서 복사. module Worker `public/workers/pyodide-worker.mjs` + 브라우저·Node 공용 실행 코어 `public/workers/pyodide-core.mjs`)
- **Editor**: CodeMirror 6
- **Animation**: Framer Motion, Lottie (lottie-react), canvas-confetti
- **Markdown**: react-markdown, remark-gfm
- **Icons**: Lucide React
- **SVG Optimization**: SVGO
- **Package manager**: npm
- **Linter/Formatter**: ESLint (Flat Config), Prettier
- **Test**: Vitest (unit), Playwright (e2e)
- **Deploy**: Vercel

## 디렉토리 구조

```
.
├── src/
│   ├── app/
│   │   ├── (protected)/      # 인증 필요 페이지 (world, quest, profile, settings, board)
│   │   ├── api/              # API Routes (tutor, quest, board, account, settings)
│   │   └── auth/             # Auth 콜백
│   ├── components/
│   │   ├── board/            # 게시판 컴포넌트
│   │   ├── characters/       # 캐릭터 SVG, Lottie, 표정 시스템
│   │   ├── landing/          # 랜딩 페이지 컴포넌트
│   │   ├── providers/        # MotionProvider 등
│   │   ├── quest/            # 퀘스트 학습 UI (에디터, 대화, 축하 등)
│   │   ├── shared/           # 공통 컴포넌트 (BadgeIcon, XPProgressBar 등)
│   │   ├── ui/               # shadcn/ui 컴포넌트
│   │   └── world/            # 월드맵 관련 컴포넌트 (StageNode, illustrations)
│   └── lib/
│       ├── pyodide/          # Pyodide 훅, 타입, 상수
│       ├── quest/            # 퀘스트 검증, XP, 뱃지 로직
│       ├── supabase/         # Supabase 클라이언트 (client.ts, server.ts)
│       ├── tutor/            # AI 튜터 (멀티 프로바이더, 캐시, 타입)
│       └── world/            # 스테이지 상태 계산
├── public/
│   ├── characters/           # 캐릭터 에셋 (pybaem, bugbug, byeolttongi)
│   └── workers/              # Pyodide Web Worker
├── e2e/                      # Playwright E2E 테스트
├── docs/                     # PRD 및 문서
├── img/                      # 스크린샷 에셋
└── supabase/
    ├── migrations/           # DB 마이그레이션 SQL
    └── seed.sql              # 시드 데이터
```

## 개발 워크플로우

### 환경 설정

```bash
npm install

# .env.local 설정
cp .env.example .env.local
# 필수: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
# 선택: OPENAI_API_KEY, GEMINI_API_KEY (멀티 프로바이더 사용 시)
```

### 개발 서버

```bash
npm run dev          # Turbopack 사용
```

### 빌드

```bash
npm run build        # Turbopack 사용
```

### 린트/포맷

```bash
npm run lint         # ESLint (Flat Config)
npm run lint:fix     # ESLint 자동 수정
npx prettier --write .
```

### 테스트

```bash
npm test             # Vitest (unit)
npm run test:e2e     # Playwright (e2e)
```

### SVG 최적화

```bash
npm run optimize:svg  # public/characters 하위 SVG 최적화
```

## Claude 에이전트 목록

`.claude/agents/` 에 프리셋 에이전트가 준비되어 있습니다.

### Dev 에이전트

| 에이전트 | 용도 |
|---------|------|
| `development-planner` | ROADMAP.md 작성 및 개발 계획 수립 |
| `nextjs-app-developer` | Next.js App Router 구조 설계 및 구현 |
| `starter-cleaner` | 스타터킷 보일러플레이트 정리 |
| `ui-markup-specialist` | UI 컴포넌트 마크업 및 스타일링 |
| `code-reviewer` | 코드 리뷰 |

### Docs 에이전트

| 에이전트 | 용도 |
|---------|------|
| `prd-generator` | PRD 문서 생성 |
| `prd-validator` | PRD 기술적 타당성 검증 |

## 코딩 컨벤션

- TypeScript strict mode 사용
- 서버 컴포넌트 기본, 클라이언트 컴포넌트는 `'use client'` 명시
- Supabase 클라이언트는 `src/lib/supabase/`에서 관리 (client.ts: 브라우저용, server.ts: 서버용)
- 환경 변수: `.env.local` 사용, git에 커밋하지 않음
- API Routes에서 Supabase Auth JWT 검증 필수
- 인증 필요 페이지는 `(protected)` 라우트 그룹 사용 + `src/middleware.ts`로 보호
- AI 튜터 프로바이더는 팩토리 패턴(`src/lib/tutor/providers/factory.ts`)으로 관리
- 컴포넌트 파일명: PascalCase (e.g., `QuestCard.tsx`)
- 유틸리티 파일명: camelCase (e.g., `pyodideWorker.ts`)
- 테스트 파일: `__tests__/` 디렉토리에 위치 (e.g., `src/lib/quest/__tests__/validation.test.ts`)

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
- CI는 P1-15 전까지 없으므로 PR 전에 `npm run lint`, `npx tsc --noEmit`, `npm test`를 로컬에서 실행한다.

### 스파이크

- 코드는 `spikes/p0-XX-<주제>/`, 보고서는 `docs/spikes/P0-XX-<주제>.md`. 앱 빌드·lint·테스트에서 제외된다. 규칙은 [`spikes/README.md`](spikes/README.md) 참고.
