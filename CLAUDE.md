# CLAUDE.md

AI Agent 프로젝트를 빠르게 시작하기 위한 템플릿입니다.
FastAPI 백엔드 + Next.js 프론트엔드 + LangGraph 에이전트 구조를 기본으로 합니다.

## 기술 스택

- **Backend**: FastAPI, LangGraph, LangChain, Pydantic, uvicorn
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS
- **AI/LLM**: Anthropic Claude, OpenAI (langchain-anthropic, langchain-openai)
- **Package manager**: uv (Python), npm (Node)
- **Linter/Formatter**: ruff
- **Test**: pytest

## 디렉토리 구조

```
.
├── backend/app/          # FastAPI 앱
│   ├── main.py           # 앱 진입점 (CORS, /health)
│   ├── agents/           # LangGraph 에이전트
│   ├── api/              # API 라우터
│   └── utils/
│       ├── config_loader.py  # YAML 설정 로더
│       └── path.py           # 프로젝트 경로 상수
├── frontend/             # Next.js 앱
├── configs/
│   └── prompts/          # 프롬프트 템플릿
├── data/
│   ├── raw/
│   ├── intermediate/
│   └── processed/
├── notebooks/            # Jupyter 실험 노트북
├── docs/                 # 문서 및 PRD 템플릿
└── tests/                # pytest 테스트
```

## 개발 워크플로우

### 환경 설정

```bash
# Python 환경 (uv)
uv sync --extra dev

# 환경 변수
cp backend/.env.example backend/.env
# backend/.env에 API 키 입력
```

### 백엔드 실행

```bash
uvicorn backend.app.main:app --reload
```

### 프론트엔드 실행

```bash
cd frontend && npm install && npm run dev
```

### 테스트

```bash
pytest tests/ -v
```

### 린트/포맷

```bash
ruff check .
ruff format .
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

- Python: ruff 설정 준수 (line-length=105, target=py312)
- 비동기: FastAPI 엔드포인트는 `async def` 사용
- 설정: YAML 파일은 `configs/`에, 경로 상수는 `backend/app/utils/path.py`에서 관리
- 환경 변수: `python-dotenv` 사용, `.env` 파일은 git에 커밋하지 않음
