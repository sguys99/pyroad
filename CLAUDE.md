# CLAUDE.md

pyRoad - AI 동물 마스코트 튜터와 함께 퀘스트를 깨며 파이썬을 배우는 초등학생 전용 웹 학습 플랫폼

## 기술 스택

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend (BaaS)**: Supabase (Auth, PostgreSQL, RLS)
- **AI/LLM**: Anthropic Claude API (Next.js API Routes에서 호출)
- **Code Execution**: Pyodide (브라우저 내 Python WASM, Web Worker)
- **Editor**: CodeMirror 6
- **Animation**: Framer Motion, canvas-confetti
- **Package manager**: npm
- **Linter/Formatter**: ESLint, Prettier
- **Test**: Vitest, Playwright
- **Deploy**: Vercel

## 디렉토리 구조

```
.
├── src/
│   ├── app/              # Next.js App Router 페이지 및 API Routes
│   ├── components/       # 공통 UI 컴포넌트
│   └── lib/              # 유틸리티, Supabase 클라이언트, Pyodide 등
├── public/               # 정적 파일 (이미지, 폰트)
├── docs/                 # PRD 및 문서
├── img/                  # 디자인 에셋
└── supabase/             # Supabase 마이그레이션, 시드 데이터
```

## 개발 워크플로우

### 환경 설정

```bash
npm install

# .env.local 설정
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY 입력
```

### 개발 서버

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

### 린트/포맷

```bash
npx eslint .
npx prettier --write .
```

### 테스트

```bash
npx vitest
npx playwright test
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
- Supabase 클라이언트는 `src/lib/supabase/`에서 관리
- 환경 변수: `.env.local` 사용, git에 커밋하지 않음
- API Routes에서 Supabase Auth JWT 검증 필수
- 컴포넌트 파일명: PascalCase (e.g., `QuestCard.tsx`)
- 유틸리티 파일명: camelCase (e.g., `pyodideWorker.ts`)
