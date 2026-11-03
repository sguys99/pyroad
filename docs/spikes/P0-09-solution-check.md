# P0-09 Node Pyodide로 `solution_code` 자동 검증 CI 프로토타입

> - 작성일: 2026-11-03 · 브랜치 `feat/phase0`
> - 코드: [`spikes/p0-09-solution-check/`](../../spikes/p0-09-solution-check/)
> - 관련: [업그레이드 계획서](../4.upgrade-plan.md) §2.4, P1-11~13, P1-15, B08, B09, B15, B25, B26

## 1. 결론: **채택**

- 브라우저와 DB 없이 Node에서 44개 퀘스트(48개 검증 단위 = 일반 43 + 프로젝트 7-1의 5단계)의 정답을 모두 실행하고, 각 퀘스트의 검증 규칙으로 판정하는 프로토타입이 동작합니다. CI용 설정(단위당 무시드 1회 + 시드 0~9)으로 **약 18~25초**(Pyodide 로드 약 7초 포함), 메모리 약 200MB입니다.
- 방식
  - **추출**: 마이그레이션 + seed SQL을 **PGlite**(WASM Postgres, npm 패키지)에 메모리로 실행하고 `SELECT ... json_agg`로 JSON fixture를 만듭니다. 정규식 파싱은 하지 않습니다. docker `postgres:17`과 결과가 바이트 단위로 같습니다.
  - **실행**: `worker_threads` 안에서 Node Pyodide를 띄우고, **실제 `public/workers/pyodide-worker.js` 파일을 수정 없이** 실행합니다(`self`, `importScripts`, `loadPyodide`만 바꿔 끼움). 그래서 차단 모듈, stdout 캡처, 오류 처리가 운영과 같습니다. 이와 함께 B15 수정안(실행마다 새 namespace)도 같은 구조로 돌립니다.
  - **판정**: `src/lib/quest/validation.ts`의 `validateResult`를 **그대로 import**합니다. 앱과 같은 순서(stderr가 있거나 타임아웃이면 실패 → `validateResult`)로 판정합니다.
  - **무작위**: 단위마다 `random.seed(0..9)`로 고정 실행해 CI 결과가 매번 같게 하고, 무시드 실행으로 실제 학생 확률도 함께 봅니다.
- 결과: **47/48 통과**. 실패 1건은 B09(7-1 3단계)입니다. 이 밖에 실패는 아니지만 콘텐츠 버그 3건을 새로 찾았습니다: 7-1 2단계는 아무것도 안 해도 통과하고, 7-1 3단계 힌트 문구로는 절대 통과할 수 없고, 4-7 시작 코드는 무한 루프입니다. 수정 규칙 패치를 적용하면 48/48 통과입니다.
- Pyodide 0.27.5(워커 CDN)와 0.29.3(npm)에서 44개 퀘스트의 출력과 판정은 **완전히 같습니다**. 다만 0.29.3에서는 학생 코드가 오류를 내면 stderr에 `Error in sys.excepthook ... 이 모듈은 사용할 수 없어요: os`가 붙습니다. 버전을 올리기 전에 워커의 import 훅을 고쳐야 합니다(B26).

## 2. 검증한 질문

| # | 질문 | 답 |
|---|---|---|
| Q1 | SQL에서 퀘스트·정답·검증 규칙을 정확히 뽑을 수 있나 | 예. PGlite로 SQL을 그대로 실행. docker PG17과 결과 동일 (실측) |
| Q2 | 운영 검증 로직을 다시 짜지 않고 쓸 수 있나 | 예. `validation.ts`와 `pyodide/constants.ts`, `types.ts`는 순수 TS라 `tsx`·vitest에서 바로 import됨. `usePyodide.ts`는 React 훅이라 import 불가 → `truncateOutput`(4줄)만 복사 (실측) |
| Q3 | 워커의 샌드박스와 같은 조건으로 돌릴 수 있나 | 예. 워커 파일 자체를 Node에서 실행. 차단 모듈·상태 누수·우회 경로까지 브라우저와 같게 재현됨 (실측, §4.5) |
| Q4 | 모든 정답이 자기 검증을 통과하나 | 47/48. 7-1 3단계만 무작위로 실패 (실측) |
| Q5 | 실행마다 새 namespace로 바꾸면 깨지는 콘텐츠가 있나 | 없음. 공유 globals(현재)와 새 namespace의 판정이 48개 모두 같음 (실측) |
| Q6 | 0.27.5와 0.29.3에서 다르게 동작하는 정답이 있나 | 없음. 출력·판정·시드 고정 출력이 모두 같음. 오류 메시지 형식만 다름 (실측) |
| Q7 | 무작위로 흔들리는 퀘스트를 찾고 고칠 수 있나 | 예. 20회 반복 + 시드 고정으로 7-1 3단계를 검출. 시드 고정은 해결책이 아니고 검증 규칙 변경이 해결책 (실측, §4.3) |
| Q8 | CI 시간은 얼마나 걸리나 | 44퀘스트 약 20초, 150퀘스트 약 30~40초 추정 (실측 + 추정, §4.6) |

## 3. 방법 & 환경

| 항목 | 값 | 구분 |
|---|---|---|
| 머신 | i7-12700K 20코어, 64GB, WSL2. **다른 에이전트가 병렬로 돌아 load average 23~87** | 실측 |
| Node | v22.23.2 | 실측 |
| Pyodide | 0.29.3 (루트 `node_modules`, Python 3.13.2) / 0.27.5 (스파이크 로컬 npm alias `pyodide-0.27.5`, Python 3.12.7) | 실측 |
| 추출 DB | `@electric-sql/pglite` 0.5.14 (PostgreSQL 18.6 wasm) / 교차 확인 `postgres:17-alpine` (17.11) | 실측 |
| 실행기 | `tsx` 4.23.15 (CLI), 루트 `vitest` 4.1.2 + 스파이크 전용 config | 실측 |
| npm 최신 Pyodide | 0.29.5, 314.0.7 (2026-09), 315.0.0-alpha. 테스트는 0.27.5·0.29.3만 | 문서 확인(npm view) |

구성 (`spikes/p0-09-solution-check/`)

| 파일 | 역할 |
|---|---|
| `extract.mjs` | SQL → PGlite → `fixtures/quests.json`. `--docker`로 PG17과 비교 |
| `lib/host-worker.mjs` | worker_thread 안의 Pyodide. `prod` = 실제 워커 파일 실행, `fresh` = B15 수정안 |
| `lib/sandbox.ts` | `usePyodide`와 같은 5초 타임아웃·출력 5000자 자르기. 타임아웃은 interrupt buffer로 `KeyboardInterrupt`를 보내고, 2초 안에 안 끝나면 워커를 새로 띄움 |
| `lib/validators.ts` | 운영 `validateResult` 사용 + 제안 규칙(`contains_any`, `all`, 엄격 `code_check`) |
| `lib/content.ts` | 단위 펼치기(프로젝트는 단계별), 단위 검사 절차 |
| `check.ts` | CLI. 버전·모드 매트릭스, 반복·시드, 패치 적용, JSON 결과 |
| `content.test.ts`, `vitest.config.ts` | P1-13 형태의 Vitest 스위트 |
| `experiments/b09.ts`, `experiments/sandbox-selftest.ts` | B09 분석, 샌드박스 재현 확인 |
| `patches/proposed-content-fixes.json` | 7-1 2·3단계 검증 규칙 수정안 |
| `content-check.workflow.yml` | GitHub Actions 초안 (`.github/`에는 넣지 않음) |

단위 검사 절차 (`lib/content.ts`)
1. **시작 코드 실행**: 학생이 아무것도 고치지 않고 실행 버튼을 누른 경우입니다. 통과하면 경고, 타임아웃이면 경고. 프로젝트 k단계의 시작 코드는 `ProjectQuestShell`과 같게 "이전 단계 정답 + `\n` + k단계 starter"입니다.
2. **정답 무시드 N회**: 매번 `random.seed()`(엔트로피)로 다시 섞습니다. 새 namespace여도 `random` 같은 **모듈 상태는 남기 때문에**, 이렇게 하지 않으면 앞 단위의 시드가 이어져 무작위가 사라집니다(처음 구현에서 실제로 겪음).
3. **정답 시드 고정 S회**: `random.seed(0..S-1)`. 학생 코드 바깥에서 시드를 넣습니다.
4. code_check 규칙이면 엄격 판정(주석·문자열 제외)도 계산합니다(B25).
5. 프로젝트 마지막 단계는 퀘스트 전체 규칙(`contains "번 만에 맞췄어요"`)도 확인합니다.
6. 판정: 모두 통과 = PASS, 모두 실패 = FAIL, 섞임 = FLAKY, 정답 없음 = NO_SOLUTION. 하나라도 PASS가 아니면 종료 코드 1.

## 4. 결과

### 4.1 추출 (B08 재현)

| 상태 | 퀘스트 | `solution_code` 있음 | 프로젝트 단계 | 단계 정답 있음 |
|---|---|---|---|---|
| 새 DB (migration → seed) | 44 | **0** / 43 | 5 | **0** / 5 |
| migration을 한 번 더 실행 | 44 | 43 / 43 | 5 | 5 / 5 |

- 마이그레이션 Section 6은 `starter_code`와 `hints.level_3`도 고치지만, seed에 이미 같은 값이 들어 있어서 차이가 나는 것은 `solution_code`뿐입니다.
- PGlite 결과와 docker `postgres:17` 결과(두 상태 모두)가 **바이트 단위로 같습니다**. `extract.mjs`를 다시 돌려도 fixture가 바이트 단위로 같습니다(CI에서 `git diff --exit-code`로 확인 가능).
- 시간: PGlite 초기화 7.2~8.3초, 전체 8~9.4초, 최대 RSS 약 740MB. docker는 컨테이너 기동 포함 16.6초.
- fixture에는 검사에 필요한 값만 담았습니다(33KB). `meta`에 원본 SQL의 sha256을 넣어, SQL이 바뀌었는데 fixture를 다시 만들지 않으면 `check.ts`가 경고합니다.

### 4.2 퀘스트별 결과

전체 매트릭스: 2개 버전 × 2개 모드 × 48단위 × (무시드 20회 + 시드 20개) = 7,680회 실행

| 스테이지 | 단위 | 검증 유형 | 0.29.3 fresh | 0.29.3 prod | 0.27.5 fresh | 0.27.5 prod | 비고 |
|---|---|---|---|---|---|---|---|
| 1 파이썬 마을 입구 | 1-1 ~ 1-7 (7) | output_match 7 | PASS | PASS | PASS | PASS | |
| 2 변수의 숲 | 2-1 ~ 2-7 (7) | output_match 5, contains 2 | PASS | PASS | PASS | PASS | |
| 3 조건의 갈림길 | 3-1 ~ 3-7 (7) | output_match 6, contains 1 | PASS | PASS | PASS | PASS | |
| 4 반복의 동굴 | 4-1 ~ 4-8 (8) | output_match 6, contains 2 | PASS | PASS | PASS | PASS | **4-7 시작 코드가 무한 루프** |
| 5 리스트 호수 | 5-1 ~ 5-7 (7) | output_match 5, contains 2 | PASS | PASS | PASS | PASS | |
| 6 함수의 탑 | 6-1 ~ 6-7 (7) | output_match 7 | PASS | PASS | PASS | PASS | |
| 7 프로젝트 | 7-1#1 | code_check `random.randint` | PASS | PASS | PASS | PASS | |
| | 7-1#2 | code_check `int(` | PASS | PASS | PASS | PASS | **시작 코드 그대로 통과** |
| | 7-1#3 | contains `보다 커요` | **FLAKY** 17/40 | **FLAKY** 18/40 | **FLAKY** 20/40 | **FLAKY** 19/40 | **B09** |
| | 7-1#4 | code_check `while` | PASS | PASS | PASS | PASS | |
| | 7-1#5 | contains `번 만에 맞췄어요` | PASS | PASS | PASS | PASS | 퀘스트 전체 규칙도 통과 |

- `prod` = 실제 워커 파일(공유 globals, 지금 운영 그대로), `fresh` = 실행마다 새 globals + `js`·`pyodide`·`micropip` 차단(B15 수정안)
- 버전 간, 모드 간 차이: **없음** (결정적인 출력은 같은 문자열, 시드 고정 출력 20개도 같음, 판정도 같음)
- 정답이 없는 퀘스트: 0 (migration 재실행 상태 기준). 정답 실행 중 stderr를 쓰는 것: 0

### 4.3 실패·콘텐츠 버그 목록

| 단위 | 문제 | 근거 | 수정안 |
|---|---|---|---|
| **7-1#3** (B09) | 정답이 무작위로 불합격. `contains "보다 커요"`는 `guess < secret`일 때만 나옴 | 실제 워커로 무시드 200회씩 2번: 88회(44.0%), 96회(48.0%) → **합계 184/400 = 46.0%** (이론 45%). 출력 분포(1차): 작아요 84 / 커요 88 / 정답! 28. 시드 0~99 중 40개만 통과 | `all[code_check "elif", contains_any ["커요","작아요","정답"]]` |
| **7-1#3** 힌트 | 힌트 level_3 틀(`print("더 ___!")`)대로 쓰면 `더 커요!`가 되어 **절대 통과 못 함** (`보다 커요`와 문구가 다름) | 힌트 문구 변형: 시드 0~99 중 **0/100** | 위 수정안이면 100/100. 또는 힌트 문구를 정답 출력과 맞춤 |
| **7-1#2** | 아무것도 안 해도 통과. `code_check "int("`가 1단계 코드의 `random.rand`**`int(`**`1, 10)`에 이미 들어 있음 | 이전 단계 정답을 그대로 실행 → 통과. 엄격 검사(주석·문자열 제외)로도 못 막음 | `all[code_check "guess", contains "추측"]` → 정답 통과, 이전 코드 불합격 |
| **4-7** | 시작 코드가 무한 루프(`while count >= 1: print(count)`, 감소 줄은 주석). 그대로 실행하면 5초 멈춤 → 브라우저는 워커를 죽이고 Pyodide를 다시 로드(B14 누수 경로) | 시작 코드 실행 → 타임아웃 | `count = count - 1` 줄을 빈칸 형태로 넣거나(`count = count - ___`) 루프 조건을 for로 |

패치(`patches/proposed-content-fixes.json`) 적용 결과: 48/48 PASS, 경고 없음(4-7 제외). Vitest도 144/144 통과.

**무작위 대응 방식 비교** (`experiments/b09.ts`, 실측)

| 방식 | 결과 | 판단 |
|---|---|---|
| 운영에서 퀘스트별 `random.seed` 고정 | 정답이 통과하는 시드 40개에서, 난수 뽑는 순서만 바꾼 **똑같이 맞는 답이 40/40 실패**. 힌트 문구 답도 40/40 실패 | 채택 안 함 |
| 검증 규칙을 무작위에 강하게 (`contains_any` + `all`) | 정답·순서 바꾼 답·힌트 문구 답 모두 시드 100/100, 무시드 50/50. 이전 단계 코드는 불합격 | **채택** (P1-11 스키마) |
| CI는 시드 0~9 고정 실행 | 위 문제를 매번 같은 결과로 검출. 0.27.5와 0.29.3의 시드 출력도 같음 | **채택** (P1-13) |

### 4.4 무작위(flaky) 검출

- 무시드 20회 반복: 48단위 중 흔들린 것은 7-1#3 하나 (최종 매트릭스 조합별 9/20, 10/20, 12/20, 11/20 통과. 이전 매트릭스는 5/20, 9/20, 10/20, 8/20). 7-1의 1·2·4·5단계도 random을 쓰지만 검증이 결과값에 의존하지 않아 항상 통과합니다.
- 시드 0~19: 7-1#3이 시드 `0,1,2,3,4,8,9,11,13,14,16,19`에서 실패. **4개 조합 모두 같은 시드에서 실패**하므로 버전과 상관없이 재현됩니다.
- 시드를 10개만 써도 7-1#3은 7개 시드에서 실패해 확실히 잡힙니다. 통과 확률 p인 단위를 시드 10개로 놓칠 확률은 p¹⁰(p=0.9면 35%, 0.7이면 3%)이므로, 드물게 흔들리는 콘텐츠까지 잡으려면 main 브랜치에서 무시드 20회 job을 따로 돌립니다(워크플로 초안의 `student-like`).

### 4.5 샌드박스 재현 확인 (`experiments/sandbox-selftest.ts`, 실측)

| 항목 | prod (실제 워커, 0.27.5·0.29.3) | fresh (B15 수정안) |
|---|---|---|
| `import os` | 차단 | 차단 |
| 이전 실행의 변수 사용 (B15) | **누수** (`42` 출력) | 차단 (`NameError`) |
| `__original_import("os")` 우회 (B15) | **우회됨** (`posix`) | 차단 (이름 없음) |
| `__import__.__globals__["_original_import"]("os")` | **우회됨** | **우회됨** |
| `import js` (B15) | **가능** (`JsProxy`) | 차단 |
| `while True: pass` | 타임아웃, 인스턴스 유지 | 같음 |
| 런타임 오류 메시지 | 0.29.3만 `Error in sys.excepthook` 잡음 | 같음 |

- 운영 워커의 B15 허점 3가지가 Node에서도 그대로 재현됩니다. 즉 이 하네스는 운영과 같은 조건입니다.
- **추가 발견(B15)**: import 훅을 숨겨도 훅 함수의 `__globals__`로 원래 `__import__`를 꺼낼 수 있습니다. Python 안에서 하는 차단은 "아이를 위한 안내 장치"일 뿐이고, 보안 경계는 JS 쪽(`js` 모듈을 등록하지 않거나 막기, 워커에서 `fetch`·`XMLHttpRequest` 제거, 쿠키 없는 출처)에서 잡아야 합니다.
- **추가 발견(B26)**: Python 3.13의 `linecache`가 `import os`를 함수 안으로 옮겼습니다(3.12는 모듈 맨 위). 그래서 0.29.3에서는 traceback을 만드는 도중 워커의 import 훅이 `os`를 막아 `Error in sys.excepthook: ... ImportError: 이 모듈은 사용할 수 없어요: os`가 학생 오류 메시지 앞에 붙습니다. 판정에는 영향이 없지만(오류면 어차피 실패) 학생과 AI 튜터가 보는 stderr가 지저분해집니다. 훅이 표준 라이브러리(`/lib/python3*.zip/`) 안에서 일어나는 import는 통과시키거나, 오류 문자열을 만들기 전에 훅을 풀어야 합니다.
- **B25**: `# while 쓰면 돼요`, `print("while")`, `"""while"""`은 지금 `code_check "while"`을 통과합니다. 엄격 검사(`blankCommentsAndStrings`, TS 상태 기계라 서버 API에서 Python 없이 동작)는 셋 다 막고, 진짜 `while` 문은 통과시킵니다. 기존 code_check 3개(7-1 1·2·4단계)의 정답은 엄격 검사에서도 모두 통과합니다.
- 무한 출력 루프에 대비해 fresh 모드는 캡처 버퍼를 `MAX_OUTPUT_LENGTH + 1000`자로 제한합니다. prod 모드(제한 없음)는 4-7 시작 코드를 실행하면 5초 동안 쌓인 출력을 넘기느라 2초 유예를 넘겨 워커를 새로 띄웠고, RSS가 약 350MB까지 올랐습니다. 제한을 둔 뒤에는 약 200MB입니다. 워커에도 같은 제한을 두면 브라우저 메모리를 아낄 수 있습니다.

### 4.6 시간·메모리

| 항목 | 값 (load average 23~87 상태) |
|---|---|
| Pyodide 로드 (`loadPyodide`, Node) | 0.29.3: 4.3~17.6초 / 0.27.5: 6.8~22초 (혼잡도에 따라 크게 흔들림, 대부분 7~10초) |
| 정답 1회 실행 | 중앙값 6.7~9.5ms, p95 18~25ms, 최대 약 60ms (CI 설정 기준) |
| CI 설정 1회 (fresh, 0.29.3, 무시드 1 + 시드 10, 48단위 = 528회 + 시작 코드 48회) | **wall 18~25초** (로드 7~9초 + 검사 11~16초), CPU 19~21초, 최대 RSS 200~350MB, wasm 힙 21~36MB |
| 단위당 비용 (CI 설정) | 130~150ms (4-7 시작 코드 타임아웃 5초 제외) |
| Vitest 스위트 (144개 테스트) | 25~35초 |
| 전체 매트릭스 (7,680회) | 218초 (load 32 → 48, 최종 코드) / 419초 (load 39 → 87, 이전 실행) |
| 추출 (PGlite) | 8~9초 |

CI 시간 추정 (GitHub `ubuntu-latest`, 4 vCPU, 혼잡 없음, 추정)
- 44퀘스트(48단위): 검사 단계 20~30초. `npm ci`(캐시 사용) 20~40초를 더해 job 전체 1~2분.
- 150퀘스트(약 160단위): 로드 7초 + 160 × 0.15초 ≈ **30~40초**. 퀘스트 수에 비례합니다. 시작 코드가 무한 루프인 퀘스트마다 5초씩 더 들므로, 그런 콘텐츠는 경고로 고치게 하거나 시작 코드 검사만 타임아웃을 1~2초로 줄입니다.
- 더 빨라야 하면 Vitest 파일을 월드별로 나눠 병렬로 돌립니다(파일마다 Pyodide 1개, 약 200MB).

## 5. 선택지 비교

**SQL 추출**

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| 정규식으로 SQL 파싱 | 의존성 없음 | 중첩 `jsonb_set`, `''` 이스케이프, 순서 의존(B08)을 따라가기 어려움 | 시도 안 함 |
| docker `postgres:17` | 운영과 같은 엔진 | docker 필요, 16.6초 | 교차 확인용 (`--docker`) |
| **PGlite** | npm만으로 동작, 프로세스 안, docker와 결과 동일 | 초기화 7~8초, PG 18 엔진 | **채택** (P1-12 비교용) |
| Supabase CLI 로컬 | 실제 Supabase | 스택 전체가 무거움 | 불필요 |

P1-11 이후에는 `content/`가 원본이 되어 SQL 추출이 CI에서 빠집니다. PGlite는 P1-12에서 "새로 생성한 seed = 기존 상태"를 비교할 때 씁니다.

**실행기**

| 방식 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **Vitest** | `npm test`와 통합, 퀘스트별 테스트 이름, junit 리포트 | 반복 통계·매트릭스 표현이 불편. `testTimeout`이 동기 Python을 끊지 못함(어차피 worker_thread + interrupt 필요) | **채택** (P1-13 게이트) |
| plain Node CLI (`tsx check.ts`) | N회 반복, 버전·모드 매트릭스, JSON 결과 | 테스트 러너 기능 없음 | 분석·flaky 조사용으로 유지 |

**샌드박스 코드**

| 방식 | 판단 |
|---|---|
| 워커의 Python 전처리를 테스트에 복사 | 시간이 지나면 어긋남 |
| **실제 워커 파일을 Node에서 실행** (`prod` 모드) | 지금 바로 가능, 어긋남 0. 스파이크에서 검증 |
| 워커의 실행 로직을 공용 모듈로 분리 → 브라우저 워커와 테스트가 같이 import | **P1-13 권장**. B15 수정(새 namespace)을 한 곳에서 하면 테스트도 따라옴 |

**Pyodide 버전**

| 버전 | 콘텐츠 결과 | 기타 |
|---|---|---|
| 0.27.5 (Python 3.12.7, 워커 CDN) | 47/48 (B09) | wasm 10.1MB |
| 0.29.3 (Python 3.13.2, package.json) | 47/48 (B09), 출력 완전히 같음 | wasm 8.6MB(gzip 2.8MB), 오류 메시지에 excepthook 잡음 → 워커 import 훅 수정 필요 |

권장: 워커와 CI가 **한 곳에서 버전을 읽게** 합니다. 가장 간단한 방법은 B26의 자체 호스팅을 npm 패키지에서 복사하는 것입니다(`node_modules/pyodide/*` → `public/pyodide/`, 빌드 스크립트). 그러면 `package.json` 버전이 곧 브라우저 버전이고, CDN 의존도 사라집니다.

## 6. 이후 Phase 영향 (계획서 수정 제안)

아래는 `docs/4.upgrade-plan.md`에 그대로 넣을 수 있는 문안입니다. 이 스파이크에서는 계획서를 고치지 않았습니다(P0-11에서 반영).

**§2.4 세 번째 항목 교체**
> - CI에서 모든 `solution_code`(프로젝트는 단계별)를 Node용 Pyodide로 실행해 **자기 검증을 통과하는지** 자동으로 확인합니다. 브라우저 워커와 같은 실행 코드(차단 모듈, stdout 캡처, 5초 타임아웃, stderr가 있으면 실패)를 쓰고, 실행마다 새 namespace, `random`은 고정 시드 0~9로 돌려 결과가 매번 같습니다. 판정은 `src/lib/quest/validation.ts`를 그대로 씁니다. 시작 코드(프로젝트는 이전 단계 코드 + 시작 코드)는 **통과하지 않아야** 하고 무한 루프가 아니어야 합니다. (P0-09 채택: 44퀘스트 약 20초)

**P1-11 교체**
> - [ ] **P1-11** Content as Code: `content/` 디렉토리, zod 스키마, `npm run content:build`(시드 생성·업서트). `solution_code`는 퀘스트 파일 안에 둡니다(B08). 검증 규칙 스키마에 무작위 출력용 `contains_any`(여러 문자열 중 하나)와 `all`(여러 규칙 AND)을 추가합니다(B09, P0-09). 빌드는 검증용 JSON(`id, key, validation_type, expected_output, starter_code, solution_code, steps[]`, P0-09 fixture와 같은 형태)도 내보냅니다

**P1-12 교체**
> - [ ] **P1-12** 기존 44 퀘스트를 `content/` 형식으로 이관하고 seed.sql과 결과가 같은지 검증. 비교 기준은 `migration → seed → migration 재실행` 상태(정답 43개 + 프로젝트 단계 5개)이고, PGlite로 SQL을 메모리에서 실행해 JSON으로 비교합니다(docker 불필요, `spikes/p0-09-solution-check/extract.mjs`). 이관하면서 P0-09에서 찾은 콘텐츠 버그(B09, B30, B31)를 고칩니다

**P1-13 교체**
> - [ ] **P1-13** `solution_code` 자동 실행 검증 테스트 (Vitest + Node Pyodide, `npm run test:content`). P0-09 프로토타입을 옮깁니다. 검사: ① 모든 퀘스트·단계에 정답이 있다 ② 정답이 시드 0~9와 무시드 1회에서 모두 통과 ③ 시작 코드는 불합격 ④ 시작 코드가 무한 루프가 아니다 ⑤ 프로젝트 마지막 단계 정답이 퀘스트 전체 규칙도 통과. 워커의 실행 로직(전처리 Python, import 훅, 캡처)은 공용 모듈로 분리해 브라우저 워커와 테스트가 같이 씁니다. Pyodide는 worker_thread에서 띄우고 타임아웃은 interrupt buffer로 끊습니다. `random` 등 모듈 상태는 새 namespace에서도 남으므로 실행마다 시드를 명시합니다

**P1-15 교체**
> - [ ] **P1-15** CI(GitHub Actions): lint, `tsc --noEmit`, vitest, 콘텐츠 검증, Playwright 스모크. 콘텐츠 검증 job 초안: `spikes/p0-09-solution-check/content-check.workflow.yml`. Node 22 + npm 캐시면 충분합니다(Pyodide wasm·stdlib가 npm 패키지에 들어 있어 CDN을 받지 않음). 검사 단계 약 20~30초. B26 해결 전에는 0.27.5·0.29.3 매트릭스, 해결 후에는 워커와 같은 버전 하나. main에서는 실제 워커 코드로 무시드 20회 job을 추가로 돌려 드물게 흔들리는 콘텐츠를 잡습니다

**B08 아래에 추가**
> - P0-09 실측: 새 DB(migration → seed)에서 `solution_code` 0/43, 프로젝트 단계 0/5. migration을 한 번 더 실행해야 43/43, 5/5. Section 6의 `starter_code`·힌트 수정은 seed와 이미 같아서 잃는 것은 정답 코드뿐

**B09 "수정" 줄 교체**
> - P0-09 실측: 실제 워커 코드로 무시드 400회 중 184회 통과(46.0%), 시드 0~99 중 40개 통과. 힌트 level_3 틀대로(`더 커요!`) 쓰면 0/100 (문구가 `보다 커요`와 다름)
> - 수정: random 시드 고정은 **하지 않음**(같은 답이라도 난수 뽑는 순서만 바꾸면 고정 시드에서 40/40 실패). 검증을 `all[code_check "elif", contains_any ["커요","작아요","정답"]]`로 변경 → 정답·변형 답 모두 100/100, 이전 단계 코드는 불합격 (P1-11 스키마 + P1-12 이관 때 적용. P11-15에서 `input()` 버전으로 재설계)

**새 버그 항목 (P1, P1-12에서 처리)**
> - [ ] **B30** 프로젝트 7-1 2단계 검증 `code_check "int("`가 1단계 코드의 `random.randint(`에 이미 들어 있어서 아무것도 안 해도 통과함 (P0-09)
>   - 수정: `all[code_check "guess", contains "추측"]`
> - [ ] **B31** 4-7 카운트다운 시작 코드가 무한 루프(`count`를 줄이는 줄이 주석). 그대로 실행하면 5초 멈춘 뒤 워커를 다시 띄움 (P0-09)
>   - 수정: `count = count - ___` 빈칸 형태로 시작 코드에 포함

**B15 아래에 추가**
> - P0-09: 실행마다 새 namespace로 바꿔도 44퀘스트 판정이 그대로임(공유 globals에 기대는 콘텐츠 없음). 단 import 훅을 숨겨도 `__import__.__globals__`로 우회되므로, Python 쪽 차단은 안내 장치로 보고 보안 경계는 JS 쪽(`js` 모듈 차단, 워커의 `fetch`·`XMLHttpRequest` 제거)에서 잡음. 출력 캡처는 최대 길이로 제한(무한 출력 루프 메모리)

**B25 아래에 추가**
> - P0-09: 주석·문자열 안의 글자를 지우고 비교하는 엄격 `code_check`(TS로 구현, Python 불필요)로 바꿔도 기존 code_check 3개의 정답은 모두 통과함. 짧은 문자열은 다른 코드에 섞여 걸리므로(`int(` ⊂ `randint(`, B30) 규칙 작성 시 주의. 44개 정답 중 stderr를 쓰는 것은 0개

**B26 아래에 추가**
> - P0-09 실측: 0.27.5와 0.29.3에서 44퀘스트 정답의 출력·판정이 완전히 같음. 차이는 0.29.3(Python 3.13)에서 학생 코드 오류 메시지 앞에 `Error in sys.excepthook ... 이 모듈은 사용할 수 없어요: os`가 붙는 것(3.13의 linecache가 `os`를 함수 안에서 import하는데 워커 import 훅이 막음). 0.29.x로 올릴 때 import 훅을 함께 고침
> - 권장: `node_modules/pyodide`를 `public/pyodide/`로 복사해 자체 호스팅 → npm 버전 = 브라우저 버전 = CI 버전

## 7. 남은 리스크 & 사용자 확인 필요 사항

**리스크**
- 측정 머신이 다른 작업으로 매우 혼잡했습니다(load average 23~87, 20코어). 시간 수치는 실제보다 크게 나왔을 가능성이 높고, GitHub 러너 시간은 추정치입니다. P1-15에서 첫 실행 시간을 기록해 보정합니다.
- 운영 DB가 실제로 "migration 재실행" 상태인지는 확인하지 않았습니다(운영 Supabase에 접근하지 않음). 황금키가 동작하고 있다면 그 상태일 것입니다. P1-12 전에 Supabase MCP(읽기 전용)로 `prompt_skeleton ? 'solution_code'` 개수를 확인하세요.
- Node Pyodide와 브라우저 Pyodide의 차이: 파일 시스템, `time`, 스레드 등은 다를 수 있습니다. 현재 콘텐츠(print, 변수, 조건, 반복, 리스트, 함수, random)에서는 차이가 없을 것으로 보지만 브라우저와 직접 비교하지는 않았습니다. `input()`(P0-05), turtle(P0-06)이 들어오면 Node 쪽에도 같은 shim이 필요합니다.
- `output_match`·`contains`는 답을 그대로 `print`해도 통과합니다(예: 5-4 `contains "4"`는 `print(4)`로 통과). 출력 검사의 본질적 한계이므로, 중요한 퀘스트는 `all[code_check, output_match]`처럼 묶는 것을 P1-11 스키마에서 고려합니다.
- 시드 10개는 통과 확률 90% 정도의 드문 흔들림을 놓칠 수 있습니다(§4.4). main의 무시드 20회 job으로 보완합니다.
- Python 쪽 모듈 차단은 우회됩니다(§4.5). CI는 콘텐츠 품질 검사이지 보안 검사가 아닙니다.

**사용자 확인 필요**
1. B09 수정 방향: 검증 규칙을 `contains_any` + `all`로 넓히는 안(추천)과, 3단계를 고정 숫자(`secret = 7`, `guess = 3`)로 바꿔 무작위를 없애는 안 중 선택. 3단계 힌트 문구(`더 커요!` vs `비밀 숫자가 추측보다 커요!`)도 하나로 맞춰야 합니다.
2. B30(7-1 2단계), B31(4-7 시작 코드)을 버그 목록에 추가할지.
3. CI 콘텐츠 검증을 PR 필수 체크로 둘지(추천: 필수), 무시드 20회 job은 main에서만 돌릴지.
4. Pyodide 버전 통일(B26) 목표 버전: 0.29.x(지금 package.json) 또는 314.x. 어느 쪽이든 워커 import 훅 수정이 먼저입니다.

## 8. 재현 방법

```bash
cd spikes/p0-09-solution-check
npm install                       # pglite, tsx, pyodide-0.27.5 (루트 node_modules의 pyodide 0.29.3과 vitest도 사용)

# 1) SQL -> fixtures/quests.json (B08 수치 출력). --docker 는 postgres:17-alpine로 교차 확인 (포트 공개 없음, 끝나면 삭제)
node extract.mjs
node extract.mjs --docker

# 2) 전체 정답 검사 (기본: 0.29.3, fresh+prod, 무시드 3회 + 시드 20개)
npx tsx check.ts
npx tsx check.ts --pyodide 0.29.3,0.27.5 --mode fresh,prod --runs 20 --seeds 20   # 전체 매트릭스 (§4.2)
npx tsx check.ts --mode fresh --runs 1 --seeds 10                                 # CI 설정 (§4.6)
npx tsx check.ts --mode fresh --runs 20 --seeds 20 --patch patches/proposed-content-fixes.json   # 수정안 → 48/48
npx tsx check.ts --only 7-1                                                       # 퀘스트 하나

# 3) 실험
npx tsx experiments/b09.ts             # §4.3 무작위 대응 비교
npx tsx experiments/sandbox-selftest.ts   # §4.5 샌드박스 재현 확인

# 4) Vitest (P1-13 형태)
../../node_modules/.bin/vitest run --config vitest.config.ts                       # 2개 실패 (B09, B30)
CONTENT_PATCH=patches/proposed-content-fixes.json ../../node_modules/.bin/vitest run --config vitest.config.ts   # 144/144
PYODIDE_VERSION=0.27.5 ../../node_modules/.bin/vitest run --config vitest.config.ts
```

- 결과 JSON은 `results/`에 저장됩니다(git 제외).
- CI 초안: `content-check.workflow.yml` (활성화는 P1-15에서 `.github/workflows/`로 복사)
