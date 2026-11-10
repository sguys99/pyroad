# P6-16 퀘스트 화면 저사양·반응형 검수

> - 작성일: 2026-11-10 · 브랜치 `feat/phase6` · 전 = `80610e1`(P6-01~15 반영, P6-16 전) · 후 = 이 작업
> - 관련: [계획서](../4.upgrade-plan.md) §2.10 · P6-16 · 기준선 [P0-13](../spikes/P0-13-perf-baseline.md)(v0.3) · 저사양 감지 [P0-16](../spikes/P0-16-low-spec-detection.md) · 앞 측정 [P4-12](P4-12-landing.md)·[P5-14](P5-14-world-map.md) · 축하 오버레이 P6-13
> - 측정 스크립트: [`scripts/perf/quest-bench.ts`](../../scripts/perf/quest-bench.ts) (`npm run perf:quest`, 새로 추가) · [`quest-celebration-bench.ts`](../../scripts/perf/quest-celebration-bench.ts) (`npm run perf:celebration`, P6-13) · Lighthouse 13.6.0 모바일(P0-13 `lighthouse.mjs`와 같은 설정, 스크래치에 설치)
> - 회귀 e2e: `project-quest.spec.ts`(박자 중 실행 버튼·360 칸 막대), `motion-tiers.spec.ts`(단계별 컨페티 0), `code-keyboard.spec.ts`(360 툴바로 1·2스테이지 풀이) 외 전체

## 1. 결론

§2.10 퀘스트 예산을 모두 지킵니다. 퀘스트 라우트 JS는 **482KB → 280KB**(예산 350KB)로, CodeMirror·마크다운·Framer 기능 묶음을 첫 로드 JS에서 뺐습니다. LCP 요소는 서버가 그린 이야기 쪽 문단(`p.qs-story`)이고 튜터 응답을 기다리지 않습니다. 실행 버튼은 CPU 1배 첫 방문 1.1초, 다시 열기 1.0초에 켜집니다(예산 3초·2초). 축하 오버레이는 CPU 4배에서 rAF p95 17.5ms, 롱태스크 0입니다(예산 50ms·500ms). minimal과 동작 줄이기에서는 정답 컨페티를 포함해 컨페티가 0개입니다.

| 예산 (§2.10) | P0-13 기준선 (v0.3) | 전 (`80610e1`) | 후 | 예산 |
|---|---|---|---|---|
| 퀘스트 라우트 JS (gzip, 서버 HTML의 `<script src>`) | 503KB (전송 JS 전부) | **482.2KB** | **280.2KB** | 350KB 이하 |
| 참고: 실행 버튼 활성까지 받은 JS 전부 | (같음) | 498.5KB | 490.7KB | — |
| 참고: 활성 2초 뒤까지 (자동 저장 Supabase·축하 미리 받기 포함) | — | 557.7KB | 549.9KB | — |
| 모바일 TBT (Lighthouse, 3회 중앙값) | **2,437ms** | 84ms | 131ms | 800ms 이하 |
| TBT 관측값 (실제 Chrome CPU 4배, FCP~실행 버튼 활성) | — | 125ms | **57ms** | (800ms) |
| 모바일 LCP (Lighthouse) | 7.3초 (튜터 말풍선) | 1.35초 | 1.35초 | — |
| LCP 요소 | 튜터 말풍선 (API 응답 뒤) | `p.qs-story` 이야기 문단 | `p.qs-story` 이야기 문단 (서버 렌더) | 서버 렌더 미션 카드 |
| 모바일 Performance · Accessibility | 46 · 88 | 99 · 96 | **99 · 100** | 80 · 90 이상 |
| 실행 버튼 활성 CPU 1배 첫 방문 | 4.0초 | 1.17초 | **1.14초** | 3초 이하 |
| 실행 버튼 활성 다시 열기 | 3.0~3.6초 (init→ready) | 1.07초 | **1.01초** | 2초 이하 |
| 실행 버튼 활성 CPU 4배 (메인 스레드만) | 6.6초 | 1.54초 | 1.45초 | — |
| Slow 4G 첫 방문 | 34.4초, "준비 중..."과 팁만 | — | 38.2초, 준비 단계 `download → setup` 표시 | 진행률 표시 |
| 축하 오버레이 CPU 4배 rAF p95 (장면 A · B) | 117ms | 18.3 · 18.3ms (P6-13 전) | **17.5 · 17.5ms** (동작 줄이기 17.6 · 17.4) | 50ms 이하 |
| 축하 오버레이 CPU 4배 롱태스크 합 | 1.9초 | 0 · 0 | **0 · 0** | 500ms 이하 |
| 정답 컨페티 minimal · 동작 줄이기 | 있음 (B33) | 0 · 0 | **0 · 0** (full 80+40 · lite 24+12) | 0 |
| Pyodide 로딩·실행 중 연출 단계 바뀜 (CPU 4배, auto) | — | — | **없음** (`full` 그대로) | 없음 |

TBT는 Lighthouse 시뮬레이션에서 84 → 131ms로 조금 늘었습니다. 하이드레이션 뒤 CodeMirror(143KB)가 따로 도착해 에디터를 만드는 일이 별도 작업으로 잡히기 때문입니다. 실제 Chrome CPU 4배 관측값은 125 → 57ms로 줄었고(하이드레이션 한 덩어리가 작아짐) 둘 다 예산의 6분의 1 아래입니다. "실행 버튼 활성까지 받은 JS 전부"는 거의 그대로입니다(498 → 491KB). 이 화면은 에디터가 필수라 CodeMirror를 늦게 받을 뿐 안 받을 수는 없기 때문입니다. 대신 서버 HTML이 하이드레이션 전에 받아 실행해야 하는 양이 202KB 줄어 첫 화면이 그만큼 빨리 살아납니다. 예산 "라우트 JS"는 랜딩 예산(P4-12)·Next "First Load JS"와 같은 범위(HTML이 처음부터 거는 스크립트)로 정했습니다. P0-13의 503KB는 그때 한 덩어리였던 첫 로드 JS 전송량이라 같은 범위입니다.

## 2. 방법

장비: Apple Silicon Mac(macOS 26), Playwright Chromium 헤드리스(Chrome for Testing 156), 로컬 Supabase, 측정 중 1분 부하 2.2~4.9. 앱은 e2e와 같은 env로 만든 프로덕션 빌드(`next start`, 로컬 HTTP/1.1 + gzip). 전 값은 `80610e1`을 따로 worktree에 빌드해 같은 스크립트로 쟀습니다.

`npm run perf:quest`(옵션 `--build`·`--base <주소>`·`--runs 3`·`--slow4g`·`--out build/perf/quest.json`):

1. 매 회 새 사용자(온보딩 끝, 진행 없음 = P0-13 `newbie`)·새 컨텍스트(HTTP 캐시 없음)로 1스테이지 첫 퀘스트를 Lighthouse 모바일과 같은 412×823 DPR 1.75 터치로 엽니다.
2. **JS 바이트**: 페이지가 받은 `/_next/static/**.js`를 `.next`의 파일로 gzip -9 한 합(랜딩 예산 검사와 같은 셈). "라우트 JS" = 서버가 보낸 HTML의 `<script src>`(noModule 제외). DOM으로 세면 `next/dynamic`이 붙인 지연 chunk까지 섞이므로 응답 HTML을 그대로 읽습니다.
3. **실행 버튼 활성** = 내비게이션 시작부터 `data-runner-state="ready"`까지. 첫 방문과 같은 컨텍스트 다시 열기(HTTP 캐시, Pyodide immutable)를 잽니다.
4. **TBT 관측값**: CPU 4배(`Emulation.setCPUThrottlingRate`, 메인 스레드만)에서 FCP부터 활성까지 롱태스크의 50ms 넘는 부분 합. 그 뒤 시작 코드를 한 번 실행하고 3초 동안 `<html data-motion>` 변화를 기록합니다. 하나라도 바뀌면 실패입니다(`pauseSampling` 확인).
5. **LCP 요소**: 마지막 `largest-contentful-paint` 항목의 요소.
6. `--slow4g`: 150ms·1.6Mbps(Worker 요청에도 걸림) 첫 방문에서 `data-load-stage`가 보였는지와 활성 시각.
7. 라우트 JS 350KB·TBT 관측값 800ms·활성 3초/2초를 넘거나 단계가 바뀌면 종료 코드 1.

Lighthouse: P0-13 `lighthouse.mjs`와 같은 기본 모바일 설정(시뮬레이션 RTT 150ms·1.6Mbps·CPU 4배)으로 새 사용자 쿠키를 넣고 3회 중앙값을 냅니다.

## 3. 무엇을 바꿨나

### 라우트 JS 482 → 280KB

먼저 소스맵을 켠 빌드(`productionBrowserSourceMaps`, 측정용으로만 켜고 되돌림)로 chunk마다 어느 패키지가 몇 KB인지 나눴습니다. 첫 로드 482KB 중 Next+React 121KB, CodeMirror 약 150KB, 마크다운(react-markdown·remark-gfm·micromark) 약 46KB, Framer 기능 묶음 약 25KB, 리그·앱 코드가 나머지였습니다.

| 뺀 것 | 크기 (gzip) | 방법 |
|---|---|---|
| CodeMirror (view·state·language·lezer-python·autocomplete·commands·search) | 약 143KB | 구성을 `src/lib/editor/createEditor.ts`로 옮기고 `CodeEditor`가 마운트한 뒤 `import()`로 받습니다. 받기 전(서버 HTML·하이드레이션 직후)에는 같은 코드를 같은 글꼴·크기·면·테두리·높이의 글자(`.ce-static`)로 보여 줘 자리가 바뀌지 않습니다(CLS 0). 그 사이 바뀐 값·글자 크기·오류 줄은 에디터가 올 때 그대로 시작합니다. 손잡이(`CodeEditorHandle`)는 같고, 오기 전에 누른 코드 키보드는 아무 일도 하지 않습니다(실측 첫 방문 약 0.3초) |
| 오류 줄 찾기의 CodeMirror 의존 | (위에 포함) | `errorLineFromStderr`를 CodeMirror 없는 `src/lib/editor/stderrLine.ts`로 나눠, 결과 쪽지·대사가 에디터 확장을 끌고 오지 않게 했습니다(`errorLine.ts`는 다시 내보내기만) |
| 마크다운 | 약 46KB | 힌트 쪽지 본문이 정적 import하고 있었습니다. `HintMarkdown`(React `lazy`)으로 바꿔 받은 힌트가 있을 때만 받고, 오기 전에는 같은 글자를 그대로 보여 줍니다. 대화(`ConversationPanel`)는 이미 지연 로드였고, 축하 오버레이의 스테이지 정리 쪽지는 오버레이 chunk(실행기 준비 뒤 쉬는 틈에 미리 받음, P6-13)와 함께 옵니다 |
| Framer `domAnimation` 기능 묶음 | 약 15KB | `MotionProvider`가 `LazyMotion features={() => import(...)}`로 기능 묶음을 따로 받습니다. 오기 전 `m.*`은 처음 모습으로 그려지고, 오면 움직입니다. 첫 화면에는 Framer로 움직이는 글자가 없습니다(첫 화면 글자 opacity 0 SSR 금지 규칙은 그대로) |

남은 280KB 가운데 Next+React가 121KB이고, 나머지는 Base UI(탭·시트·확인 창) 27KB, 리그 정지 그림 20KB, 퀘스트 셸·세션·사운드·연출 단계 코드입니다. 더 줄일 여지(쓰지 않는 캐릭터 정지 그림 분리 약 8KB, 전역 오류 화면의 토큰 원본 약 3KB)는 예산 안이라 남겼습니다.

### 누적 정리 (Phase 6 앞 항목에서 넘어온 것)

| # | 문제 | 고친 것 |
|---|---|---|
| a | 프로젝트 단계 통과 박자(2.2초) 동안 실행 버튼이 "정답 확인 중..."에 머묾 (P6-12) | 실행 줄 상태에 `stepping` 추가: 잠금은 그대로라 누를 수 없고, 바쁨 표시 없이 "코드 돌려보기"로 쉼(`data-runner-state="stepping"`). 단위 `runnerState.test.ts`, e2e `project-quest` |
| b | "파이뱀에게 물어보기" 배지가 시스템 알림(단계 시작·황금키)까지 세어 단계마다 쌓임 (5단계면 15개 넘음) | 배지는 파이뱀의 새 답(`role: tutor`)만 셉니다. 미리 보기는 알림도 그대로. 단위 `QuestRenderers`(단계 알림 + 소개 = 1) |
| c | 360에서 박자 동안 단계 칸 막대가 거의 사라짐 ("N단계 통과!" + "다음 단계로" 버튼이 한 줄을 차지) | 쪽 안 폭 24rem 이하에서 건너뛰기는 화살표만(44px, 이름은 그대로 낭독). e2e: 360 박자 중 칸 막대 폭 100px 넘음 |
| d | 키 없는 아이의 실행 피드백 폴백이 오류 종류와 상관없이 "앗, 조금 고쳐볼까요?" | 서버 `buildFallbackMessage`가 stderr가 있으면 결과 쪽지와 같은 `explainError` 문장 + "고쳐서 다시 돌려 봐요!"를 돌려줌(Q56으로 실행 뒤 자동 호출은 없고 "파이뱀에게 더 물어보기"를 눌렀을 때만 씀). 단위 1개 |
| e | 프로젝트 단계를 통과하고 박자 중에 떠나면 그 단계 통과가 저장되지 않음 | 통과 순간 다음 단계 상태(코드·`current_step`·`step_submissions`)를 바로 저장하고 박자는 그림만. 박자 중에 남은 자동 저장 타이머가 예전 단계로 덮어쓰지 않게 막음. 마이그레이션 없음(클라이언트 진행 저장 그대로, 완료·보상은 여전히 서버 재채점). 단위 1개(가드를 빼면 실패 확인) |
| f | 하단 상태바(레벨·XP)가 책 펼침 화면에 남아 있음 | **유지로 결정**: 퀘스트 화면에서 레벨·누적 XP를 보여 주는 유일한 자리이고, 보상 띠의 +N과 같은 값이 여기 쌓입니다(e2e `quest-flow`가 확인). 책 펼침 헤더에는 HUD가 없습니다 |
| g | 360 뱃지 카드에서 뱃지 2~3개를 세 칸으로 놓아 이름이 글자마다 꺾임 | 30rem 미만에서 뱃지가 여러 개면 한 줄에 하나(메달 3rem + 이름·설명) |
| h | 쓰지 않는 의존성 `lottie-react` | 지움. `assets:check` Lottie 렌더 검사가 쓰는 `lottie-web` 5.13.0(같은 버전)을 devDependency로 직접 추가. 고지 생성기 제외 목록·테스트 갱신(`licenses:check` 같음), `optimizePackageImports`에서 뺌 |

그 밖에: Lighthouse Accessibility 96 → 100. 헤더 스테이지 진행 점의 누르는 폭이 18~20px이라 `target-size`(24px)에 걸렸습니다. 384px 이상에서는 24px로 넓혔고, 360~383px 폰은 8점 스테이지가 한 줄에 들도록 18px 그대로 둡니다(높이는 44px).

## 4. 반응형·연출 단계 전수 검수

일회성 스크립트로 7개 폭(320·360·390·768·1024·1280·1440, full)과 360·1280 × (lite·minimal·동작 줄이기)에서 처음 → 공책 → 오류 → (모바일) 오류 뒤 이야기 쪽 → 출력 다름 → 물어보기 열기 → 통과 → 축하 카드 → 다시 열기(복습)를 찍었습니다. 프로젝트 퀘스트 박자 → 2단계도 320·360·768·1280 full과 360 동작 줄이기에서 찍었습니다(약 140장). 장면마다 가로 넘침과 화면 밖으로 나간 버튼·링크를 셌습니다.

- 가로 넘침: **0** (모든 폭·장면). 화면 밖 버튼은 코드 키보드 띠(`.ck-strip`, 일부러 옆으로 넘기는 띠, P6-04)의 키뿐입니다.
- 축하 카드: 320·360에서 뱃지 2개 카드가 한 줄씩 놓임(위 g). 닫기·건너뛰기는 화면 안.
- 박자: 모든 폭에서 실행 버튼은 "코드 돌려보기"(비활성), 360 칸 막대가 그대로 보임(위 a·c).
- 컨페티(`pyroad:confetti` 이벤트의 fired 합): full 80 + 40 · lite 24 + 12 · minimal 0 · 동작 줄이기 0(요청 자체 없음). e2e `motion-tiers`가 같은 값을 계속 검사합니다.
- 동작 줄이기에서 결과는 색과 글자만으로 알 수 있습니다. 통과 = 초록 면 + "통과! 정답이에요!" 딱지 + 처음부터 찍힌 도장, 출력 다름 = 금색 면 + "조금 달라요" + 해 볼 일과 견줘 보기, 오류 = 옅은 빨강 면 + "여기를 한번 살펴볼까요?" + "N번째 줄" 딱지, 버그버그는 움직이지 않고 표정·후광 색만(P6-07). 소리만으로 주는 정보는 없습니다.
- `pauseSampling`: Pyodide 로딩·실행 중에는 `PyodideProvider`의 `useSamplingPause(status === 'loading' || isRunning)`가 실측 판정을 멈춥니다. CPU 4배 auto 단계에서 로딩 → 활성 → 실행 3초 동안 `<html data-motion>`은 `full` 그대로였습니다(`perf:quest`가 매번 검사).
- 성공·에러 연출의 단계별 대체 동작은 각 항목의 e2e(`design-catalog`·`motion-tiers`: 도장 full 쾅 · lite 짧게 · minimal 페이드 · 동작 줄이기 처음부터, 버그버그 full 등장 · lite 제자리 점프 · minimal·동작 줄이기 정지)가 검사하고, 이번 전수 스크린샷에서도 같았습니다.

## 5. 남은 것

- 절대값 판정은 실기기(P12-04): 이 장비는 P0-13 장비보다 훨씬 빨라 CPU 4배로도 v0.3의 TBT 2.4초·롱태스크 1.9초가 재현되지 않습니다. 전후 비교는 같은 장비·같은 스크립트 값입니다.
- Slow 4G 첫 방문 38초는 Pyodide 크기(자체 호스팅 코어, 별도 예산) 그대로입니다. 그 동안 실행 줄이 "파일 받는 중 → 파이썬 준비 중" 단계와 팁을 보여 주며, 바이트 진행률은 지어내지 않습니다(P6-05).
- `perf:quest`는 CI에 넣지 않았습니다(로컬 Supabase·빌드 필요, §2.10 "Performance·TBT는 경고"). P12-03 Lighthouse CI에서 같은 범위(라우트 JS)를 차단 예산으로 옮길 수 있습니다.
- 전체 e2e(프로덕션 빌드): 237 통과 · 3 건너뜀(스크린샷 전용) · 1 실패. 실패는 `design-catalog` "축하 오버레이 full: Esc 뒤 돌고 있는 CSS 애니메이션 0"이 한 번 1개로 나온 것이고, 같은 빌드로 그 묶음만 3번씩(15회) 돌리면 모두 통과합니다. 실패한 회차는 3.9초로 평소(6~7초)보다 빨라, Esc를 누른 뒤 늦게 붙은 장식 하나가 한 번 돈 경우로 보입니다(원인은 아직 확정 못 함). 다시 나오면 trace로 그 애니메이션 이름을 확인합니다.
