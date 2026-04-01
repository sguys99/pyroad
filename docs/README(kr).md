# pyRoad

pyRoad는 초등학생이 브라우저에서 바로 파이썬을 배우도록 설계한 인터랙티브 학습 플랫폼입니다. AI 동물 마스코트 튜터와 대화하며 퀘스트를 진행하고, 직접 코드를 실행하면서 파이썬 기초를 익히는 것을 목표로 합니다.

현재 이 저장소는 MVP를 개발 중인 상태이며, `Next.js + Supabase + Anthropic + Pyodide`를 중심으로 핵심 학습 흐름을 구현하고 있습니다.

## 핵심 아이디어

- 초등학생 눈높이에 맞춘 한국어 기반 파이썬 입문 경험
- 브라우저에서 바로 실행되는 Python 학습 환경
- 스테이지와 퀘스트를 따라가는 월드맵형 학습 구조
- AI 튜터가 도입 설명과 단계별 힌트를 제공하는 학습 보조 경험

## 구현 상태

- [x] Phase 0: 프로젝트 부트스트랩 및 인프라
- [x] Phase 1: Google 로그인과 기본 보호 라우트
- [x] Phase 2: 커리큘럼 시드 데이터와 월드맵
- [x] Phase 3: 퀘스트 화면 골격과 Pyodide 코드 실행
- [x] Phase 4: AI 튜터 API와 퀘스트 도입/힌트
- [x] Phase 5: 코드 검증과 퀘스트 완료 처리
- [x] Phase 6: 게이미피케이션
- [x] Phase 7: 최종 프로젝트 가이드
- [x] Phase 8: 반응형 UI 폴리싱 및 애니메이션
- [x] Phase 9: 통합 테스트 및 배포

## 기술 스택

- Framework: `Next.js 15`, `React 19`, `TypeScript`
- Styling: `Tailwind CSS v4`
- Auth / Database: `Supabase`
- AI Tutor: `Anthropic SDK`
- Python Runtime: `Pyodide`
- Editor: `CodeMirror 6`
- Tooling: `ESLint`, `Vitest`, `Playwright`

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

- `supabase/migrations/00001_create_initial_schema.sql`
- `supabase/migrations/00002_handle_new_user_trigger.sql`
- `supabase/seed.sql`

로컬 또는 원격 Supabase 프로젝트에 migration과 seed를 적용해 `users`, `stages`, `quests`, `user_progress`, `user_badges` 테이블을 준비해야 합니다.

### 5. 개발 서버 실행

```bash
npm run dev
```

기본 개발 서버 주소는 `http://localhost:3000`입니다.

## 프로젝트 방향

pyRoad의 목표는 초등학생이 설치나 복잡한 설정 없이 "코드를 쓰고 바로 결과를 보는 첫 파이썬 경험"을 재미있게 시작하도록 만드는 것입니다. 현재 저장소는 그 목표를 위한 MVP 기반을 구축하는 단계이며, 인증, 월드맵, 퀘스트 UI, AI 튜터, 브라우저 실행기의 핵심 뼈대가 먼저 갖춰진 상태입니다.
