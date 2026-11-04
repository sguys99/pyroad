# CI (GitHub Actions)

워크플로: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (P1-15). 배경은 `docs/4.upgrade-plan.md` §2.4·§2.7·§12-Q19·Q23.

- **언제**: `main` 대상 PR, `main`·`feat/**`·`hotfix/**` push, 수동 실행(Actions 탭 → CI → Run workflow). 같은 PR·브랜치의 이전 실행은 취소되고 `main`은 커밋마다 끝까지 돕니다.
- **비밀값 없음**: 포크 PR에서도 같은 job이 돕니다. DB는 러너 안의 임시 Docker 스택뿐이고 운영 DB에는 접속하지 않습니다.
- job 이름이 곧 상태 체크 이름입니다. 이름을 바꾸면 `main` 보호 규칙의 필수 체크도 함께 바꿉니다.

## Job과 로컬 재현

새 checkout과 같게 하려면 먼저 `npm ci`. 시간은 참고값(로컬, 부하 있음)입니다.

| Job | 하는 일 | 실패하면 로컬에서 | 시간 |
|---|---|---|---|
| `lint-typecheck` | ESLint, `prettier --check .`(제외 대상은 `.prettierignore`), `next typegen`(git에 없는 `next-env.d.ts` 생성) 뒤 `tsc --noEmit` | `npm run lint && npx prettier --check . && npx next typegen && npx tsc --noEmit` (포맷이 틀리면 `npx prettier --write <파일>`) | 약 1.5분 |
| `unit` | Vitest 단위 테스트 (`npm test`와 같은 범위) | `npx vitest run` | 약 1분 |
| `content` | `seed.sql`이 `content/`와 같은지 + 모든 정답 코드를 Pyodide 314로 실행 (시드 0~9 + 무시드 1회). junit 결과를 아티팩트 `content-junit`으로 | `npm run content:build -- --check && npm run test:content` (드리프트면 `npm run content:build` 후 seed 커밋) | 약 20초 |
| `content-unseeded` | **main push·수동 실행만**. 무시드 20회 | `TEST_CONTENT_UNSEEDED_RUNS=20 npm run test:content` (실패 메시지의 시드로 재현) | 약 30초 |
| `pyodide` | 자체 호스팅 파일 복사·무결성 + 공용 실행 코어 테스트 | `npm run pyodide:copy && node scripts/pyodide/copy-assets.mjs --check && npm run test:pyodide` | 약 20초 |
| `rls` | 격리 스택(`pyroadci`, 5482x)으로 RLS·권한 회귀. PR·기능 브랜치는 운영 재현 + legacy, main·수동 실행은 신규 기본값까지 3개 시나리오. 결과 표는 job 요약과 아티팩트 `rls-results`에 | `RLS_SKIP_NEWDEFAULT=1 npm run test:rls:ci` (전체는 변수 없이). 켜 둔 개발 스택이면 `npm run test:rls` | 약 4~7분 |
| `build` | Google Fonts CSS 미리 받기(아래 "Google Fonts 우회") → `npm run build` (env 없이 됨. Sentry는 DSN이 없으면 꺼짐) + 빌드에 들어간 Pyodide 파일 확인 | `npm run build && node scripts/pyodide/copy-assets.mjs --check` (러너와 같게: `node scripts/fonts/google-fonts-mock.mjs`가 알려 주는 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES=…`를 붙여 빌드) | 약 3분 |
| `e2e-smoke` | 비로그인 e2e(`public` 프로젝트: 랜딩·반응형·reduced-motion·404·보안 헤더·CSP 위반 없음·보호 경로). Supabase 없이(`E2E_NO_STACK=1`) Google Fonts 우회 → `npm run build` → `npm run start`. 실패하면 리포트·trace를 아티팩트 `e2e-smoke-report`로 | `E2E_NO_STACK=1 npx playwright test --project=public` (`e2e/README.md`) | 로컬 약 2분 (빌드 1.5분 포함) |
| `e2e` | 로그인 e2e(`setup` → `chromium` → `teardown`). 저장소 `config.toml`로 Supabase 스택을 띄우고(npm ci·브라우저 설치와 겹치게 백그라운드로) 실행 전용 사용자를 service_role로 만들어 쿠키 주입. LLM 키 없음(저장된 답변). 실패하면 아티팩트 `e2e-report` | `npm run db:start && npx playwright test --project=chromium` | 로컬 약 5분 + 빌드 |

- `rls`의 운영 재현은 과거 커밋(`git show e800386:…`)을 읽어서 전체 히스토리로 checkout합니다(`fetch-depth: 0`). 얕은 clone이면 `run.sh`가 조용히 건너뛰므로 CI는 결과 표에 `prod_replay`가 있는지 따로 확인합니다.
- Supabase CLI는 **2.115.0** 고정(`supabase/README.md`). 로컬에서 격리 모드를 다른 작업과 동시에 돌릴 때는 `RLS_PROJECT_ID`·`RLS_PORT_BASE`를 바꿉니다.
- `prettier --check .`는 P1-21에서 `lint-typecheck`에 넣었습니다(기존 파일은 P1-15 마무리 커밋에서 일괄 정리). 스파이크·생성물·문서(`*.md`)·`supabase/`는 `.prettierignore`로 제외합니다.
- e2e 재시도는 0입니다(흔들림을 재시도로 가리지 않음). 실패하면 아티팩트의 `test-results/*/trace.zip`을 `npx playwright show-trace`로 봅니다.

### Google Fonts 우회 (`build`)

GitHub 러너에서는 Google Fonts가 `Noto Sans KR`의 글꼴 주소를 `https://fonts.gstatic.com/l/font?kit=…&skey=…&v=v40`처럼 **확장자 없이** 줍니다(다른 곳에서도 가끔 그럼). Next 15.5의 Turbopack은 이 주소의 `&`에서 글꼴 옵션을 잘라 `next/font/google queries have exactly one entry`로 빌드가 깨집니다(웹팩도 확장자가 없어 깨짐). [vercel/next.js#99114](https://github.com/vercel/next.js/issues/99114), 수정([#100158](https://github.com/vercel/next.js/pull/100158))은 **16.4.3 이후에만** 있고 15.5.x에는 백포트가 없습니다.

그래서 `build` job은 빌드 전에 `scripts/fonts/google-fonts-mock.mjs`로 Next와 같은 주소·User-Agent로 CSS를 받아, 확장자 없는 주소만 Turbopack 15.5가 원래 주소로 풀어 받도록 감싼 뒤 Next의 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로 넘깁니다. 번들러(Turbopack)와 글꼴 파일(빌드 때 gstatic에서 받음)은 Vercel과 같습니다. 글꼴 호출은 `src/`의 `next/font/google` import에서 자동으로 찾으므로 글꼴을 바꿔도 스크립트는 고칠 필요가 없습니다.

- 로컬·Vercel 빌드는 지금처럼 Next가 직접 받습니다. Vercel에서도 같은 에러가 나면(드물게 흔들림) 재배포하거나 이 우회를 `prebuild`로 넓히는 것을 검토합니다.
- **Next를 16.4.3 이상으로 올리면** `ci.yml`의 "Google Fonts CSS 미리 받기" 단계와 스크립트를 지웁니다(15.x가 아니면 스크립트는 경고만 남기고 아무것도 하지 않음). `next/font/local` 자체 호스팅(P2-10)으로 바꿔도 필요 없어집니다.

## 필수 체크 (main 보호 규칙)

`lint-typecheck`, `unit`, `content`, `pyodide`, `rls`, `build` + **`e2e-smoke`**(P1-21, GitHub에서 PR로 한 번 통과한 뒤 추가). `content-unseeded`는 main 전용이라 넣지 않습니다. `e2e`(로그인)는 PR에서도 돌지만 시간(예상 10분 안팎: 스택 시작 + 빌드 + 테스트 약 5분)과 안정성을 몇 번 지켜본 뒤 필수 체크로 올릴지 정합니다. 너무 느리면 `if:`로 main·수동 실행 전용으로 돌립니다. 보호 규칙은 CI가 PR에서 한 번 통과한 뒤 설정합니다(§12-Q23).

## Action 고정

서드파티 action은 커밋 SHA로 고정하고 버전을 주석으로 적습니다(태그는 옮겨질 수 있음). 올릴 때는 릴리즈 후 2주 이상 지난 버전의 SHA를 `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`로 확인하고(annotated tag면 한 번 더 `git/tags/<sha>`), 바꾼 뒤 [actionlint](https://github.com/rhysd/actionlint)로 검사합니다.
