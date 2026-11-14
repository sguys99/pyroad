# CI (GitHub Actions)

워크플로: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (P1-15). 배경은 `docs/4.upgrade-plan.md` §2.4·§2.7·§12-Q19·Q23.

- **언제**: `main` 대상 PR, `main`·`feat/**`·`hotfix/**` push, 수동 실행(Actions 탭 → CI → Run workflow). 같은 PR·브랜치의 이전 실행은 취소되고 `main`은 커밋마다 끝까지 돕니다.
- **비밀값 없음**: 포크 PR에서도 같은 job이 돕니다. DB는 러너 안의 임시 Docker 스택뿐이고 운영 DB에는 접속하지 않습니다.
- job 이름이 곧 상태 체크 이름입니다. 이름을 바꾸면 `main` 보호 규칙의 필수 체크도 함께 바꿉니다.

## Job과 로컬 재현

새 checkout과 같게 하려면 먼저 `npm ci`. 시간은 참고값(로컬, 부하 있음)입니다.

| Job | 하는 일 | 실패하면 로컬에서 | 시간 |
|---|---|---|---|
| `lint-typecheck` | ESLint, `prettier --check .`(제외 대상은 `.prettierignore`), **폰트 검사**(`npm run fonts:check`, P2-10: 아래 "폰트 검사"), **디자인 토큰 검사**(`npm run tokens:check`, P2-09: 아래 "디자인 토큰 검사"), **오픈소스 고지 검사**(`npm run licenses:check`, P3-14: 아래 "오픈소스 고지 검사"), `next typegen`(git에 없는 `next-env.d.ts` 생성) 뒤 `tsc --noEmit` | `npm run lint && npx prettier --check . && npm run fonts:check && npm run tokens:check && npm run licenses:check && npx next typegen && npx tsc --noEmit` (포맷이 틀리면 `npx prettier --write <파일>`) | 약 1.5분 |
| `unit` | Vitest 단위 테스트 (`npm test`와 같은 범위) | `npx vitest run` | 약 1분 |
| `content` | `seed.sql`이 `content/`와 같은지 + 모든 정답 코드를 Pyodide 314로 실행 (시드 0~9 + 무시드 1회). junit 결과를 아티팩트 `content-junit`으로 | `npm run content:build -- --check && npm run test:content` (드리프트면 `npm run content:build` 후 seed 커밋) | 약 20초 |
| `content-unseeded` | **main push·수동 실행만**. 무시드 20회 | `TEST_CONTENT_UNSEEDED_RUNS=20 npm run test:content` (실패 메시지의 시드로 재현) | 약 30초 |
| `pyodide` | 자체 호스팅 파일 복사·무결성 + 공용 실행 코어 테스트 | `npm run pyodide:copy && node scripts/pyodide/copy-assets.mjs --check && npm run test:pyodide` | 약 20초 |
| `rls` | 격리 스택(`pyroadci`, 5482x)으로 RLS·권한 회귀. PR·기능 브랜치는 운영 재현(릴리즈 붙여넣기 묶음을 CRLF로, `RLS_CRLF=1`) + legacy, main·수동 실행은 신규 기본값까지 3개 시나리오. 결과 표는 job 요약과 아티팩트 `rls-results`에 | `RLS_CRLF=1 RLS_SKIP_NEWDEFAULT=1 npm run test:rls:ci` (전체는 `RLS_CRLF=1`만). 켜 둔 개발 스택이면 `npm run test:rls` | 약 4~7분 |
| `build` | `npm run build` (env 없이 됨. Sentry는 DSN이 없으면 꺼짐. 폰트는 저장소에서 자체 호스팅이라 네트워크 불필요. prebuild가 폰트 검사, postbuild가 정적 페이지 CSP·라우트별 font preload·랜딩 폰트 예산·랜딩 JS·CSS 바이트 예산 확인) + 빌드에 들어간 Pyodide 파일 확인 | `npm run build && node scripts/pyodide/copy-assets.mjs --check` | 약 3분 |
| `e2e-smoke` | **에셋 검사**(`npm run assets:check`, P2-16: SVG 최적화·종이 결 타일·래스터 기록·Lottie 구조 + `lottie_light` 실제 렌더 + 라이선스 기록(P2-17), 아래 "에셋 검사") → 비로그인 e2e(`public` 프로젝트: 랜딩·반응형·reduced-motion·404·보안 헤더·CSP 위반 없음·보호 경로·코드 에디터 한글 주석 정렬 P2-18·컴포넌트 카탈로그와 연출 단계 대체 검사 `design-catalog.spec.ts` P2-12·소셜 로그인 실패 안내와 인앱 브라우저 `social-login.spec.ts` P3-17 — GoTrue authorize 이동을 가로채는 목업이라 provider·스택 없이 돎). Supabase 없이(`E2E_NO_STACK=1`) `npm run build` → `npm run start`. 실패하면 리포트·trace를 아티팩트 `e2e-smoke-report`로 | `npm run assets:check && E2E_NO_STACK=1 npx playwright test --project=public` (`e2e/README.md`) | 로컬 약 2분 (빌드 1.5분 포함, 에셋 검사 약 5초) |
| `e2e` | 로그인 e2e(`setup` → `chromium` → `teardown`). 저장소 `config.toml`로 Supabase 스택을 띄우고(npm ci·브라우저 설치와 겹치게 백그라운드로) 실행 전용 사용자를 service_role로 만들어 쿠키 주입. LLM 키 없음(저장된 답변). 월드맵·퀘스트의 연출 단계 대체 검사(`motion-tiers.spec.ts`, P2-12) 포함. 실패하면 아티팩트 `e2e-report` | `npm run db:start && npx playwright test --project=chromium` | 로컬 약 5분 + 빌드 |

- `rls`의 운영 재현은 과거 커밋(`git show e800386:…`)을 읽어서 전체 히스토리로 checkout합니다(`fetch-depth: 0`). 얕은 clone이면 `run.sh`가 조용히 건너뛰므로 CI는 결과 표에 `prod_replay`가 있는지 따로 확인합니다.
- `rls`는 **`RLS_CRLF=1`** 로 돕니다(B76). 이 값이 없으면 운영 재현이 마이그레이션 파일을 하나씩 적용하고 seed를 맨 끝에 넣어, 실제 운영 경로인 릴리즈 묶음(`scripts/release/build-release-sql.mjs`)의 순서·seed 위치 문제를 못 봅니다. 묶음은 `supabase/seed.sql`(지금 콘텐츠의 생성물)을 **seed가 있는 마지막 묶음에만** 넣고, 이미 운영에 적용한 앞 묶음의 seed 자리는 안내 주석입니다. `run.sh`는 FAIL이면 1, 환경·적용 실패면 2로 끝나니 `| tail` 같은 파이프로 볼 때는 `set -o pipefail` 또는 `${PIPESTATUS[0]}`로 종료 코드를 확인합니다.
- Supabase CLI는 **2.115.0** 고정(`supabase/README.md`). 로컬에서 격리 모드를 다른 작업과 동시에 돌릴 때는 `RLS_PROJECT_ID`·`RLS_PORT_BASE`를 바꿉니다.
- `prettier --check .`는 P1-21에서 `lint-typecheck`에 넣었습니다(기존 파일은 P1-15 마무리 커밋에서 일괄 정리). 스파이크·생성물·문서(`*.md`)·`supabase/`는 `.prettierignore`로 제외합니다.
- e2e 재시도는 0입니다(흔들림을 재시도로 가리지 않음). 실패하면 아티팩트의 `test-results/*/trace.zip`을 `npx playwright show-trace`로 봅니다.
- `e2e-smoke` 제한 시간은 **30분**입니다(B78). GitHub 러너에서 비로그인 e2e 182개가 빌드 포함 약 19분(main도 18분)이라 20분이면 정상 실행도 취소됩니다. 1회성 연출 중 상태(축하 카드 등장·보상 날아감)를 확인하는 스펙은 시간에 기대지 않게 `page.clock`으로 시계를 세운 뒤 확인합니다(느린 러너에선 클릭과 확인 사이에 1.3초가 다 지나감).

### 에셋 검사 (`e2e-smoke`)

`npm run assets:check`(`scripts/assets/check.mjs`)가 SVG(`public/**/*.svg`가 SVGO 결과와 같은지·`<text>`·래스터·SMIL 금지·크기), 종이 결 타일(`public/textures`가 생성기와 같은 그림인지), 래스터 정지 그림(`raster.lock.json`과 원본·출력 해시·예산), Lottie(`public/animations` 구조 검사 + Chromium에서 `lottie_light`로 6프레임 렌더해 빈 화면이면 실패, B32), 라이선스 기록(배포하는 사운드·텍스처·이미지·폰트 폴더·public 파일이 모두 [docs/assets-license.md](assets-license.md)에 있는지와 문서에만 남은 오래된 기록, P2-17)을 한 번에 봅니다. Lottie 렌더는 매번 검사기 자체 시험(정상 파일은 그려지고 B32 파일은 비어야 함)을 먼저 돌려 lottie-web·Chromium을 올려도 검사기가 망가지지 않았는지 확인합니다. Chromium이 필요해서 별도 job 대신 이미 Chromium을 설치하는 `e2e-smoke`에 단계로 넣었습니다(체크 이름은 그대로). 실패하면 로컬에서 `npm run assets:check`(브라우저 없이 `-- --no-render`), 고치는 법은 [docs/design/assets.md](design/assets.md). 사운드 검사(`bash scripts/build-sounds.sh check`)는 ffmpeg가 필요해 CI에 넣지 않습니다.

### 폰트 검사 (`lint-typecheck`, prebuild·postbuild)

폰트는 `src/fonts/`에서 자체 호스팅합니다(P2-10, [docs/design/fonts.md](design/fonts.md)). 그래서 예전의 "Google Fonts 우회"(Next 15.5 Turbopack이 확장자 없는 Google Fonts 주소에서 깨지는 문제, vercel/next.js#99114를 피하려고 `scripts/fonts/google-fonts-mock.mjs`로 CSS를 미리 받던 단계)는 지웠습니다.

- `npm run fonts:check`(`scripts/fonts/check.mjs`, Node만): 랜딩 문구 글자가 모두 랜딩 텍스트 서브셋에 있는지, 폰트 파일이 `src/fonts/manifest.json`과 같은지, 이름을 바꾼 글꼴(`pyRoad Sans`·`pyRoad Mono`)에 예약 이름이 남지 않았는지, 폴더마다 `OFL.txt`가 있는지, 앱 코드에 외부 폰트(`next/font/google`·Google Fonts·jsDelivr)가 없는지. `lint-typecheck`의 단계이자 `prebuild`라 Vercel 빌드에서도 돕니다. **랜딩 문구를 바꿔 실패하면** 로컬에서 `npm run fonts:build -- --landing`(Python fontTools 필요) 후 `src/fonts/` 변경을 같은 커밋에 넣습니다.
- `scripts/fonts/check-build.mjs`(postbuild): 랜딩이 아닌 라우트에 font preload가 붙으면(Turbopack 누수), 랜딩 preload가 2개를 넘으면, 랜딩 CSS에 앱 조각이 실리면, 랜딩 폰트가 150KB를 넘으면, 코드 글꼴 조각이 퀘스트 밖에 실리면, 앱 화면 CSS(`src/app/app.css`)가 앱 라우트에 없거나 랜딩에 실리면 실패.

### 랜딩 바이트 예산 (postbuild, P4-12)

`scripts/perf/check-landing-budget.mjs`(`build` job·Vercel 빌드): 랜딩 첫 JS(gzip) 250KB·렌더 차단 CSS(gzip) 15KB를 넘거나, 글자가 든 요소를 인라인 `opacity:0`으로 서버 렌더하면 실패(§2.10 "바이트 예산은 차단"), 95%를 넘으면 경고. 넘었을 때 고치는 법은 [perf/P4-12-landing.md](perf/P4-12-landing.md) §4. 다른 빌드 폴더는 `BUDGET_CHECK_NEXT_DIR=<경로>/.next`.


### 디자인 토큰 검사 (`lint-typecheck`)

- `npm run tokens:check`(`scripts/design/check-tokens.mjs`, Node + TypeScript AST): `src/`의 색 리터럴(hex·rgb·oklch)·Tailwind 고정 팔레트 클래스(`text-green-600`·`bg-white`), 장식 전용 토큰을 글자색으로 쓴 것(`text-primary` → `text-primary-text`), `font-family` 직접 지정, 컴포넌트의 Framer `duration`·`stiffness` 숫자와 Tailwind `duration-300`을 찾습니다. 14px 미만 글자(`text-xs` 등)는 레거시 기준표(`scripts/design/tokens-baseline.json`)보다 늘면 실패합니다. 예외 목록과 고치는 법은 [design/tokens.md](design/tokens.md) §5.
- 토큰 값 자체(TS 원본 ↔ `globals.css`)와 WCAG 대비는 `unit` job의 `src/lib/design/__tests__/tokens.test.ts`가 검사합니다.

### 오픈소스 고지 검사 (`lint-typecheck`)

- `npm run licenses:check`(`scripts/licenses/build-licenses.mjs --check`, Node만, 1초 안): `/licenses` 화면 데이터 `src/lib/legal/licenses.generated.json`(커밋하는 생성물)이 지금 `node_modules`(= `package-lock.json`)의 운영 의존성 라이선스·저작권 줄과 `scripts/licenses/notices.mjs`(Pyodide·글꼴·사운드)로 다시 만든 것과 같은지 봅니다. `dependencies`만 따라가고 플랫폼별 optional 패키지는 보지 않으므로 운영체제와 상관없이 결과가 같습니다.
- **의존성을 바꿔(npm install·업데이트) 실패하면** 로컬에서 `npm run licenses:build` 후 생성물을 같은 커밋에 넣습니다. Pyodide 판을 올리면 생성기가 멈추고 `scripts/licenses/texts/`의 MPL·CPython·Emscripten 전문을 새 판으로 바꾸라고 알려 줍니다.
- 같은 비교를 `unit` job의 `scripts/licenses/__tests__/licenses.test.ts`도 합니다(로컬 `npx vitest run`에서 먼저 보이게).
## 필수 체크 (main 보호 규칙)

`lint-typecheck`, `unit`, `content`, `pyodide`, `rls`, `build` + **`e2e-smoke`**(P1-21, 2026-11-05 첫 통과 뒤 추가). `content-unseeded`는 main 전용이라 넣지 않습니다. `e2e`(로그인)는 PR에서도 돌지만 시간(예상 10분 안팎: 스택 시작 + 빌드 + 테스트 약 5분)과 안정성을 몇 번 지켜본 뒤 필수 체크로 올릴지 정합니다. 너무 느리면 `if:`로 main·수동 실행 전용으로 돌립니다. 보호 규칙은 CI가 PR에서 한 번 통과한 뒤 설정합니다(§12-Q23).

## Action 고정

서드파티 action은 커밋 SHA로 고정하고 버전을 주석으로 적습니다(태그는 옮겨질 수 있음). 올릴 때는 릴리즈 후 2주 이상 지난 버전의 SHA를 `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`로 확인하고(annotated tag면 한 번 더 `git/tags/<sha>`), 바꾼 뒤 [actionlint](https://github.com/rhysd/actionlint)로 검사합니다.
