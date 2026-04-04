# CLAUDE.md

pyRoad - AI 동물 마스코트 튜터와 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼

## 기술 스택

- **Frontend**: Next.js 15 (App Router, Turbopack), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend (BaaS)**: Supabase (Auth, PostgreSQL, RLS, SSR)
- **AI/LLM**: 멀티 프로바이더 — Anthropic Claude, OpenAI, Google Gemini (Next.js API Routes에서 호출, `src/lib/tutor/providers/`에서 팩토리 패턴으로 관리)
- **Code Execution**: Pyodide (브라우저 내 Python WASM, Web Worker — `public/workers/pyodide-worker.js`)
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
