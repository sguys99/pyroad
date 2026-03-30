# [프로젝트명] 상세 개발 계획서

## Context

[프로젝트 배경 및 현재 상태를 간략히 설명합니다. 예: 어떤 PRD를 기반으로 하는지, 현재 구현 상태는 어떤지 등]

**현재 구현 상태:** [예: 디렉토리 스켈레톤만 존재, 핵심 로직 미구현]

---

## Phase 0: 인프라 및 개발 환경 구성

**목표:** 로컬 환경에서 서비스를 실행할 수 있는 기반 인프라 완성

### 0-1. 환경 설정
- [ ] `.env.example` 작성 (필요한 API 키, DB 연결 정보 등)
- [ ] `pyproject.toml` 의존성 정리

### 0-2. 앱 부트스트랩
- [ ] `backend/app/main.py` — FastAPI 앱 (CORS, `/health` 엔드포인트)
- [ ] `backend/app/utils/settings.py` — Pydantic `BaseSettings` 구현

### 0-3. (선택) Docker / DB 설정
- [ ] `docker-compose.yaml` — 필요한 서비스 정의
- [ ] DB 연결 및 마이그레이션 설정

---

## Phase 1: 데이터 모델 및 DB 계층

**목표:** 핵심 데이터 구조 구현
**의존성:** Phase 0

### 1-1. [모델/스키마]
- [ ] `backend/app/db/models/[entity].py` — [설명]

### 1-2. (선택) 마이그레이션 및 시드 데이터
- [ ] 초기 마이그레이션 생성/적용
- [ ] 시드 데이터 삽입 스크립트

### 1-3. CRUD 레포지토리
- [ ] `backend/app/db/repositories/[entity]_repo.py` — create, get, list, update, delete

### 1-4. 테스트
- [ ] `tests/unit/db/test_[entity].py` — 모델 및 레포지토리 단위 테스트

---

## Phase 2: API 엔드포인트

**목표:** 프론트엔드와 연동할 REST API 구현
**의존성:** Phase 1

### 2-1. Pydantic 스키마
- [ ] `backend/app/api/schemas/[resource].py` — Request/Response 스키마

### 2-2. API 라우터
- [ ] `backend/app/api/routers/[resource].py` — CRUD 엔드포인트

### 2-3. 에러 핸들링
- [ ] `backend/app/api/exceptions.py` — 커스텀 예외 정의

### 2-4. 테스트
- [ ] `tests/unit/api/test_[resource]_router.py` — API 엔드포인트 테스트

---

## Phase 3: 비즈니스 로직 / 에이전트

**목표:** 핵심 비즈니스 로직 구현
**의존성:** Phase 1 + Phase 2와 병렬 가능

### 3-1. [핵심 로직 1]
- [ ] `backend/app/[module]/[file].py` — [설명]

### 3-2. [핵심 로직 2]
- [ ] `backend/app/[module]/[file].py` — [설명]

### 3-3. 테스트
- [ ] `tests/unit/[module]/test_[logic].py` — 비즈니스 로직 테스트

---

## Phase 4: 외부 연동 (선택)

**목표:** 외부 서비스 연동
**의존성:** Phase 3

### 4-1. [외부 서비스]
- [ ] `backend/app/integrations/[service]_client.py` — API 클라이언트
- [ ] `backend/app/integrations/[service]_service.py` — 서비스 로직

### 4-2. 테스트
- [ ] `tests/unit/integrations/test_[service].py` — mock 기반 테스트
- [ ] `tests/integration/test_[service].py` — 실제 API 통합 테스트 (`@pytest.mark.integration`)

---

## Phase 5: 프론트엔드 (선택)

**목표:** Next.js UI 구현
**의존성:** Phase 2 API 스키마 확정 후 병렬 착수 가능

### 5-1. 초기화
- [ ] Next.js App Router 설정
- [ ] `frontend/lib/api.ts` — API 클라이언트

### 5-2. 공통 컴포넌트
- [ ] `frontend/components/[Component].tsx` — [설명]

### 5-3. 페이지
- [ ] `frontend/app/page.tsx` — [메인 페이지]
- [ ] `frontend/app/[route]/page.tsx` — [추가 페이지]

---

## Phase 6: 통합 테스트 및 배포 준비

**목표:** 전체 시스템 검증 및 배포 환경 구성
**의존성:** 모든 Phase 완료

### 6-1. 통합 테스트
- [ ] `tests/integration/test_[flow].py` — 주요 플로우 통합 테스트

### 6-2. 배포 설정
- [ ] `Dockerfile` (backend)
- [ ] `frontend/Dockerfile`
- [ ] `docker-compose.prod.yaml`

---

## Phase 의존성 다이어그램

```
Phase 0 (인프라)
    │
    ├── Phase 1 (DB 모델)
    │       │
    │       └── Phase 2 (API)
    │                   │
    ├── Phase 3 (비즈니스 로직) ←── Phase 1
    │           │
    │    Phase 4 (외부 연동)
    │           │
    │    Phase 5 (프론트엔드) ←── Phase 2 이후 병렬 가능
    │           │
    │    Phase 6 (통합 테스트 / 배포)
    └───────────────────────────────
```

---

## 검증 지표 (MVP 성공 기준)

| 항목 | 목표 |
|---|---|
| [지표 1] | [목표값] |
| [지표 2] | [목표값] |

## 주요 파일 참조

- [docs/PRD-template.md](PRD-template.md) — 요구사항 원천 문서
- [backend/app/main.py](../backend/app/main.py) — FastAPI 진입점
- [pyproject.toml](../pyproject.toml) — 의존성 관리
