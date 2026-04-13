# pyRoad

![Version](https://img.shields.io/badge/version-v0.3.0-blue)
![License](https://img.shields.io/badge/License-Apache_2.0-blue)

pyRoad는 초등학생이 브라우저에서 바로 파이썬을 배우도록 설계한 인터랙티브 학습 플랫폼입니다. AI 동물 마스코트 튜터와 대화하며 퀘스트를 진행하고, 직접 코드를 실행하면서 파이썬 기초를 익히는 것을 목표로 합니다.

## 개요

- 초등학생 눈높이에 맞춘 한국어 기반 파이썬 입문 경험
- 브라우저에서 바로 실행되는 Python 학습 환경
- 스테이지와 퀘스트를 따라가는 월드맵형 학습 구조
- AI 튜터가 도입 설명과 단계별 힌트를 제공하는 학습 보조 경험

## 스크린샷

### 랜딩 페이지
![랜딩 페이지](../img/1.landing-page.png)

### 월드맵
![월드맵](../img/2.world-map.png)

### 학습 페이지
![학습 페이지](../img/3.learning-page.png)

## 주요 기능

- **Google 로그인** — Supabase Auth를 통한 원클릭 인증
- **월드맵 진행** — 시각적 진행률 표시가 포함된 스테이지 기반 커리큘럼
- **퀘스트 시스템** — 명확한 목표가 있는 단계별 코딩 도전
- **AI 동물 튜터** — Claude 기반 튜터가 주제 소개와 힌트 제공
- **브라우저 내 Python** — Pyodide를 통한 설치 없는 코드 실행
- **코드 에디터** — Python 구문 강조가 지원되는 CodeMirror 6
- **게이미피케이션** — 뱃지, XP, 보상으로 학습 동기 부여
- **반응형 UI** — 데스크톱과 태블릿 화면에 최적화

## 기술 스택

- Framework: `Next.js 15`, `React 19`, `TypeScript`
- Styling: `Tailwind CSS v4`
- Auth / Database: `Supabase`
- AI Tutor: `Anthropic SDK`
- Python Runtime: `Pyodide`
- Editor: `CodeMirror 6`
- Animation: `Framer Motion`, `canvas-confetti`
- Tooling: `ESLint`, `Vitest`, `Playwright`

## 프로젝트 구조

```
src/
├── app/                  # Next.js App Router 페이지 및 API Routes
│   ├── (protected)/      # 인증 필요 라우트 (world, quest, profile, ...)
│   ├── api/              # API 엔드포인트 (AI 튜터, 진행률, ...)
│   └── auth/             # Auth 콜백
├── components/           # 공통 UI 컴포넌트
└── lib/                  # 유틸리티, Supabase 클라이언트, Pyodide 헬퍼
```

## 시작하기

### 1. 요구사항

- 최신 Node.js LTS 권장
- Supabase 프로젝트
- Google OAuth 설정이 연결된 Supabase Auth
- Anthropic API 키

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경변수 설정

`.env.example`를 참고해 `.env` 파일을 구성합니다.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

### 4. Supabase 스키마 및 시드 적용

이 저장소에는 다음 파일이 포함되어 있습니다.

- `supabase/migrations/00001_v0.1.0_initial_schema.sql`
- `supabase/seed.sql`

로컬 또는 원격 Supabase 프로젝트에 migration과 seed를 적용해 데이터베이스 테이블을 준비해야 합니다.

### 5. 개발 서버 실행

```bash
npm run dev
```

기본 개발 서버 주소는 `http://localhost:3000`입니다.

## 프로젝트 방향

pyRoad의 목표는 초등학생이 설치나 복잡한 설정 없이 "코드를 쓰고 바로 결과를 보는 첫 파이썬 경험"을 재미있게 시작하도록 만드는 것입니다. 현재 저장소는 그 목표를 위한 MVP 기반을 구축하는 단계이며, 인증, 월드맵, 퀘스트 UI, AI 튜터, 브라우저 실행기의 핵심 뼈대가 먼저 갖춰진 상태입니다.

## 기여하기

기여를 환영합니다! 변경하고 싶은 사항이 있으면 먼저 이슈를 열어 논의해 주세요. 큰 변경의 경우 기능 브랜치를 만들고 풀 리퀘스트를 제출해 주세요.

## 라이선스

이 프로젝트는 [Apache License 2.0](../LICENSE) 라이선스 하에 배포됩니다.
