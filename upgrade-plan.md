# Agent Project Template — Upgrade Plan

전체 코드베이스 리뷰 결과를 기반으로 한 개선 항목 목록입니다.
항목 완료 시 체크박스를 표시하세요.

---

## 1단계: Critical Bugs

- [x] **BUG-01** `backend/app/utils/path.py` — `SOURCE_PATH = REPO_ROOT / "src"` 및 `PACKAGE_PATH = SOURCE_PATH / "kep_eval"` 삭제 (이전 프로젝트 kep_eval 잔재)
- [x] **BUG-02** `backend/app/utils/config_loader.py` — `yaml.load(..., yaml.FullLoader)` → `yaml.safe_load()` 교체 및 `load_all_configs(data_type="HPMC")` 레거시 함수 제거
- [x] **BUG-03** `data/procecssed/` → `data/processed/` 디렉터리 이름 오타 수정
- [x] **BUG-04** `backend/app/main.py` 생성 — 최소 FastAPI 앱 (CORS, `/health` 엔드포인트)
- [x] **BUG-05** `.env.example` — `ANTHROPIC_MODEL=claude-sonnet-4-5-20250929` → `claude-sonnet-4-6` 수정

---

## 2단계: Missing Essentials

- [x] **ESS-01** Docker 파일 구현 — `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yaml`, `docker-compose.prod.yaml` (모두 현재 0바이트) *(스킵: 프로젝트 방향 결정 후 작성)*
- [x] **ESS-02** `CLAUDE.md` 생성 — 프로젝트 개요, 기술 스택, 디렉터리 구조, 개발 워크플로우, 코딩 컨벤션, 에이전트 목록
- [x] **ESS-03** Config YAML stubs 생성 — `configs/data.yaml`, `configs/feature.yaml`, `configs/model.yaml` *(스킵: 내용은 프로젝트 의존적, 임포트 시 자동 로드 없음)*
- [x] **ESS-04** pytest 설정 추가 — `pyproject.toml`에 `[tool.pytest.ini_options]`, `[tool.coverage.run]` 추가 + `tests/` 구조 생성 (`conftest.py`, `test_health.py`)

---

## 3단계: Code Quality

- [x] **CQ-01** `pyproject.toml` — `[tool.pytest.ini_options]`, `[tool.coverage.run]`, `[tool.coverage.report]` 섹션 추가
- [ ] **CQ-02** `.pre-commit-config.yaml` — 파일 크기 제한 `--maxkb=30000` (30MB) → `--maxkb=500` (500KB) 축소 *(스킵: docs/ 대용량 문서 수용 필요)*
- [x] **CQ-03** `.pre-commit-config.yaml` — ruff 버전 `v0.8.4` → `v0.15.8` 업데이트

---

## 4단계: Developer Experience

- [ ] **DX-01** `Makefile` 확장 — `run`, `run-frontend`, `test`, `test-cov`, `lint`, `format`, `docker-up`, `docker-down`, `docker-build`, `clean` 타겟 추가 *(스킵: 프로젝트 방향 결정 후 추가)*
- [x] **DX-02** `.claude/settings.local.json` — `Edit`, `Write` 권한 추가 / 위험 명령(`rm -rf`, `git push --force`, `git reset --hard`) `deny`에 추가 + `.claude/settings.json` 신규 생성 (팀 공유용 deny 기본값)
- [ ] **DX-03** `frontend/.env.local` — git 추적에서 제거 (`git rm --cached`) + `.gitignore`에 추가 *(스킵: 보류)*

---

## 5단계: Agent/AI Workflow

- [x] **AI-01** `.claude/agents/dev/backend-developer.md` 신규 생성 — FastAPI, LangGraph, LangChain, Pydantic, async 패턴 전문 에이전트
- [x] **AI-02** `.claude/agents/dev/code-reviewer.md` — Python 백엔드 리뷰 기준 섹션 추가 (현재 Next.js 중심)
- [x] **AI-03** `.claude/agents/docs/prd-generator.md` — 기본 스택 Supabase/Vercel → 이 템플릿 스택 (FastAPI + LangGraph)으로 수정
- [ ] **AI-04** `.claude/agents/dev/development-planner.md` — `model: opus` → `model: sonnet` 변경 (비용 최적화)
- [ ] **AI-05** `.claude/agents/docs/prd-validator.md` — `model: opus` → `model: sonnet` 변경 (비용 최적화)

---

## 6단계: Documentation

- [x] **DOC-01** `docs/PRD-template.md` — OathKeeper 완성 PRD를 `docs/examples/oathkeeper-prd.md`로 이동, 본 파일을 blank template으로 교체
- [x] **DOC-02** `docs/task-plan-template.md` — OathKeeper 구현 계획을 `docs/examples/oathkeeper-task-plan.md`로 이동, 본 파일을 generic template으로 교체
- [ ] **DOC-03** `README.md` — 현재 제목만 있음 → 프로젝트 설명, Quick Start, 디렉터리 구조, make 타겟, 에이전트 워크플로우 작성
- [ ] **DOC-04** `docs/agent-workflow.md` 신규 생성 — 에이전트 사용 순서 가이드 + Mermaid 플로우차트 (선택)

---

## 우선순위 요약

| 순서 | 항목 | 영향도 |
|------|------|--------|
| 1 | BUG-01~05 | 높음 |
| 2 | ESS-01~04 | 높음 |
| 3 | DX-01~03 | 높음 |
| 4 | AI-01~05 | 중간~높음 |
| 5 | CQ-01~03 | 중간 |
| 6 | DOC-01~04 | 중간~높음 |
