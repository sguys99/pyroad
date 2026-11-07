# e2e (Playwright)

브라우저로 실제 화면을 눌러 보는 테스트입니다 (P1-21). 설정은 [`playwright.config.ts`](../playwright.config.ts), CI는 [`docs/ci.md`](../docs/ci.md)의 `e2e-smoke`·`e2e` job.

## 실행

```bash
npx playwright install chromium   # 처음 한 번 (Chromium만 씀)
npm run db:start                  # 로그인 스펙에 필요한 로컬 Supabase (supabase/README.md)

npm run test:e2e                  # 전부: public + setup → chromium → teardown (빌드 포함 약 7분)
npx playwright test --project=public     # 비로그인만 (스택 없어도 됨, 약 2분)
npx playwright test --project=chromium   # 로그인만 (setup·teardown은 자동으로 같이 돎)
npx playwright show-report               # 마지막 실행 결과 (실패하면 trace 포함)
```

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `PORT` | `3100` | 앱 서버 포트. 3000은 다른 프로젝트 dev 서버가 쓰는 일이 많아 피함 |
| `E2E_SERVER` | `prod` | `prod`: `npm run build` + `npm run start` (배포와 같은 CSP). `dev`: `npm run dev` (첫 요청마다 컴파일이라 느림) |
| `E2E_SKIP_BUILD=1` | - | 빌드를 건너뛰고 `npm run start`만. **직전 빌드가 e2e로 만든 것일 때만** (아래 "주의") |
| `E2E_REUSE_SERVER=1` | - | 이미 `PORT`에 떠 있는 서버를 씀. 그 서버도 e2e env로 떠 있어야 함 |
| `E2E_NO_STACK=1` | - | Supabase 스택을 찾지 않음 (CI `e2e-smoke`). 로그인 스펙은 실패함 |
| `E2E_SUPABASE_URL`·`E2E_SUPABASE_ANON_KEY`·`E2E_SUPABASE_SERVICE_ROLE_KEY` | `supabase status -o env` | 다른 로컬 스택을 쓸 때. `E2E_SUPABASE_WORKDIR`로 `supabase status`의 workdir만 바꿀 수도 있음 |
| `E2E_KEEP_USER=1` | - | 끝나도 테스트 사용자를 지우지 않음 (실패 화면을 손으로 다시 볼 때) |

## 구조

| 경로 | 내용 |
|---|---|
| `public/*.spec.ts` | 비로그인 (`public` 프로젝트): 랜딩 캐릭터·반응형·reduced-motion·404·보안 헤더·CSP 위반 없음·보호 경로 리다이렉트, 코드 에디터 한글 주석 정렬·글자 크기·오류 줄(`editor-alignment.spec.ts`, 테스트 전용 페이지 `/dev/editor` — 서버 env `PYROAD_TEST_PAGES=1`을 `support/env.ts`가 넣음, 운영 404), 컴포넌트 카탈로그 `/dev/design`과 연출 단계 대체 검사(`design-catalog.spec.ts`, P2-12: 단계마다 무한 반복 애니메이션 허용 목록·흐림·리그 DOM 쓰기·버튼 눌림·카운트업·시트·토스트) |
| `auth.setup.ts` / `auth.teardown.ts` | 이번 실행 전용 테스트 사용자를 service_role로 만들고 로그인 쿠키를 `e2e/.auth/`에 저장 / 끝나면 사용자 삭제 |
| `*.spec.ts` | 로그인 (`chromium` 프로젝트): 퀘스트 흐름·축하 시퀀서·잠긴 스테이지(B38)·실행기(멈추기·재준비)·힌트·LLM 폴백·황금키·캐릭터·움직임 설정(P2-15)·월드맵·퀘스트 연출 단계 대체(`motion-tiers.spec.ts`, P2-12) |
| `support/env.ts` | 로컬 스택 찾기, 앱 서버 env 만들기 |
| `support/admin.ts` | service_role 도우미 (진행 초기화, 앞 퀘스트 완료) |
| `support/test.ts` | 로그인 스펙의 `test`: 테스트마다 진행 초기화, 끝날 때 쓰기 요청 대기, CSP 위반 감시 |
| `support/motion.ts` | 연출 단계 대체 검사 공용: 돌고 있는 무한 반복 애니메이션 수집, minimal·동작 줄이기 허용 목록(근거 포함), 흐림 요소 수 (P2-12, [docs/design/catalog.md](../docs/design/catalog.md)) |
| `support/quest.ts` · `support/content.ts` | 퀘스트 화면 조작, `content/` YAML에서 퀘스트 id·정답·힌트 읽기 (하드코딩하지 않음) |

## 앱 서버 env

저장소의 `.env`·`.env.local`은 바꾸지 않습니다. Playwright가 서버를 띄울 때 env를 넣어 덮습니다 (`support/env.ts`).

- Supabase: 로컬 스택 주소·키만 (`127.0.0.1`/`localhost`가 아니면 중단 — 운영 DB에 붙지 않음)
- LLM 키(`ANTHROPIC_API_KEY` 등)·`API_KEY_ENCRYPTION_KEY`·Sentry DSN·`ANALYTICS_SALT`·`ADMIN_EMAIL`, 그리고 `.env*` 파일에 적힌 다른 키는 모두 빈 값 → 튜터는 외부 호출 없이 **저장된 답변**으로만 답함

## 주의

- **빌드 산출물(`.next/`)에 로컬 스택 주소가 들어갑니다** (`NEXT_PUBLIC_*`는 빌드 때 고정). e2e 뒤에 운영 env로 `npm run start`를 하려면 다시 빌드하세요. 반대로 `E2E_SKIP_BUILD=1`·`E2E_REUSE_SERVER=1`로 다른 env의 빌드·서버를 잡으면 setup이 CSP의 Supabase 주소를 보고 실패합니다.
- 같은 작업 트리에서 다른 `next build`/`next dev`와 동시에 돌리지 마세요 (`.next/`를 같이 씀).
- 로그인 스펙은 테스트 사용자 한 명을 테스트마다 초기화하며 쓰므로 `workers: 1`입니다. 재시도는 0 — 흔들리면 고칩니다.
- 로그인은 실행마다 한 번 (로컬 Auth 로그인 한도: 5분에 30회).
