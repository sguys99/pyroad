# Lighthouse CI (P12-03)

> - 관련: [계획서](../4.upgrade-plan.md) §2.10 · P12-03 · 기준선 [P0-13](../spikes/P0-13-perf-baseline.md)(v0.3, 하네스 원본은 `spikes/p0-13-perf-baseline/`) · CI [docs/ci.md](../ci.md)
> - 측정: [`scripts/perf/lighthouse.ts`](../../scripts/perf/lighthouse.ts) (`npm run perf:lighthouse`) · 판정·요약·기준 비교: [`scripts/perf/summarize.mjs`](../../scripts/perf/summarize.mjs) (단위 테스트 `scripts/perf/__tests__/lighthouse-summarize.test.ts`) · 기준: [`lighthouse-baseline.json`](lighthouse-baseline.json)

## 무엇을 재나

P0-13 하네스(로컬 Supabase + 시드 사용자 + `@supabase/ssr` 쿠키 주입 + `next start`)를 정식으로 옮겼습니다. 5화면 × Lighthouse 13.6.0 모바일 기본 설정(시뮬레이션 스로틀 RTT 150ms·1.6Mbps·CPU 4배, 412×823) × 3회, 값은 중앙값입니다. 회차마다 새 Chrome 프로필(캐시 없음)이고, Chrome은 Playwright가 받은 Chromium(새 헤드리스)입니다.

| 화면 | 주소 | 사용자 (실행마다 새로 만들고 끝나면 지움) |
|---|---|---|
| 랜딩 | `/` | 비로그인 |
| 월드맵 | `/world` | 진행 중 (1·2스테이지 + 3스테이지 앞 두 퀘스트 = P0-13 `perf`) |
| 퀘스트 1-1 | 1스테이지 첫 코드 퀘스트 | 첫 방문 (진행 없음 = P0-13 `newbie`) |
| 프로젝트 7-3 | 1월드 7스테이지 프로젝트 "숫자 맞추기 게임" | 코드 퀘스트를 다 깬 사용자 (스테이지가 열려 있어야 함) |
| 프로필 | `/profile` | 진행 중 |

P0-13 표의 "프로젝트 7-1"은 v0.3 번호이고 같은 퀘스트(`b1000000-…-0022`)가 지금은 7-3입니다.

## 판정

| | 기준 | 비고 |
|---|---|---|
| **차단** | 모바일 Accessibility 중앙값 90 이상 | §2.10, 모든 화면 |
| **차단** | 라우트 JS (gzip) | 서버 HTML이 처음부터 거는 `<script src>`를 빌드 파일 gzip -9로 센 합 (랜딩 postbuild·`perf:quest`와 같은 셈). 랜딩 250KB·퀘스트 350KB(§2.10), 월드맵·프로필 350KB(임시) |
| **차단** | 총 전송 (Pyodide·Worker 뺌) | Lighthouse 전송 바이트 합. 랜딩 500KB · 월드맵 1,100KB · 퀘스트·프로젝트 1,500KB · 프로필 1,100KB (임시: 첫 실측 + 약 15%) |
| **차단** | Pyodide 전송 | `/pyodide/**`·`/workers/**`. 퀘스트·프로젝트 6,350KB (§2.10 "자체 호스팅 코어 gzip 약 6.2MB") |
| **차단** | 서버 HTML에 opacity 0인 글자 | §2.10 규칙 (랜딩은 postbuild가 이미 봄, 앱 화면은 여기서, B102) |
| **차단** | 측정 실패 | 3회 모두 실패하거나 로그인·잠금으로 다른 주소로 이동 |
| 경고 | Performance 80 이상 · LCP 2.5초 · TBT 800ms | §2.10(랜딩 LCP·퀘스트 TBT 값을 모든 화면에). 러너 부하에 민감해 표시만 |
| 경고 | 기준보다 Performance 10점 이상 하락 | |

임시 예산(월드맵·프로필 JS, 모든 화면 총 전송)은 §2.10에 수치가 없어 정한 값입니다. 사용자가 확정하면 §2.10 표로 옮깁니다.

## 실행

```bash
npm run db:start                          # 로컬 Supabase (pyroad 스택, 5452x)
npm run perf:lighthouse -- --build        # e2e env로 빌드 + 5화면 × 3회 (측정만 로컬 3~12분, 기기 부하에 따라)
npm run perf:lighthouse                   # 이미 e2e env로 만든 .next 로 (npm run test:e2e 뒤 등)
npm run perf:lighthouse -- --runs 1 --routes landing,world --out build/perf/lh-try.json
```

- 결과: `build/perf/lighthouse.json`(화면별 중앙값·범위·회차 값·실패 감사), `build/perf/lighthouse.md`(요약 표), `build/perf/lighthouse-raw/<화면>-<회차>.json`(Lighthouse 원본 — [Lighthouse Viewer](https://googlechrome.github.io/lighthouse/viewer/)에 끌어다 놓으면 보고서). 요약은 stdout과 GitHub job 요약에도 나옵니다.
- 차단이면 종료 코드 1. CI는 `e2e` job 끝 단계(같은 빌드·스택), 아티팩트 `lighthouse` ([docs/ci.md](../ci.md)).
- 긴 측정은 `caffeinate -i`로 감싸 기기가 잠들지 않게 합니다(macOS).

## 기준 파일 갱신

요약 표의 괄호 값은 커밋된 `docs/perf/lighthouse-baseline.json` 대비 증감입니다. 의도한 변화(예산 안에서 바이트가 늘어난 기능 추가, 최적화)를 반영할 때만 갱신합니다.

```bash
npm run perf:lighthouse -- --build
node scripts/perf/summarize.mjs build/perf/lighthouse.json --update-baseline   # 기준을 이 결과로
node scripts/perf/summarize.mjs build/perf/lighthouse.json                     # 다시 비교 (괄호가 0)
```

CI 결과로 갱신하려면 아티팩트 `lighthouse`의 `lighthouse.json`을 받아 같은 명령에 넘깁니다. 바이트·Accessibility는 기기와 상관없이 같지만 Performance·LCP·TBT는 기기 부하에 따라 달라서, 기준 파일의 그 값은 참고용입니다.

## 실측 (2026-11-17, 로컬 macOS arm64, 부하 있음)

같은 빌드(`4759e42`와 같은 앱 코드, e2e env)로 `npm run perf:lighthouse`를 두 번 연달아 돌린 중앙값입니다. 앞 값이 1번째 실행(= 기준 파일), 괄호가 2번째 실행입니다. 바이트는 KB(gzip 전송).

| 화면 | Perf | A11y | LCP | TBT | 라우트 JS / 예산 | 총 전송(Pyodide 뺌) / 예산 | Pyodide / 예산 |
|---|---|---|---|---|---|---|---|
| 랜딩 | 100 (100) | 100 (100) | 1.06초 (1.06) | 0ms (2) | 172.1 (172.1) / 250 | 426 (426) / 500 | — |
| 월드맵 | **77 (77)** ⚠ | 100 (100) | **6.47초 (6.47)** ⚠ | 33ms (32) | 293.0 (293.0) / 350 | 958 (958) / 1,100 | — |
| 퀘스트 1-1 | 99 (98) | 96 (96) | 1.67초 (1.66) | 87ms (95) | 340.3 (340.3) / 350 | 1,341 (1,342) / 1,500 | 6,347 (6,347) / 6,350 |
| 프로젝트 7-3 | 98 (98) | 100 (100) | 1.66초 (1.81) | 117ms (92) | 340.3 (340.3) / 350 | 1,302 (1,302) / 1,500 | 6,347 (6,347) / 6,350 |
| 프로필 | 100 (100) | 100 (100) | 1.21초 (1.06) | 4ms (5) | 245.2 (245.2) / 350 | 941 (941) / 1,100 | — |

- **흔들림**: Accessibility·라우트 JS·Pyodide는 두 실행·여섯 회차가 모두 같음. 총 전송은 화면마다 회차 간 최대 ±5KB(프로젝트는 쉬는 틈에 받는 chunk가 측정 창 안에 드느냐에 따라 앞선 측정의 한 회차에서 1,241KB — 약 60KB 차이라 총 전송 예산에 여유를 둠). Performance는 ±2점, LCP는 프로젝트·프로필에서 회차 간 최대 0.46초, TBT는 수십 ms. → 차단(바이트·Accessibility)은 기기 부하에 흔들리지 않음, 경고만 흔들림.
- **이번에 고친 것**: 처음 실측에서 퀘스트·프로젝트 라우트 JS 350.5KB로 예산 초과(B104), 프로필 Accessibility 96(글자 대비, B103), 앱 화면 서버 HTML의 opacity 0 글자(화면 틀·월드맵 노드, B102).
- **예산 여유**: 퀘스트 라우트 JS 9.7KB(2.8%)로 가장 빠듯함. Pyodide는 6,347 / 6,350KB로 사실상 §2.10 "약 6.2MB" 그대로(Pyodide 버전 고정이라 바뀌지 않음, 패키지를 더하면 바로 걸림).
- **월드맵 Performance 77·LCP 6.5초(경고)**: 관측 LCP는 약 0.33초(FCP 0.32초)인데 시뮬레이션 LCP가 6.5초. LCP 요소는 지도 상자(`div.world-map`)이고, Lighthouse(lantern)가 관측 LCP 전에 시작한 요청 약 920KB(글꼴 조각 약 460KB·JS 약 330KB)를 LCP에 걸린 것으로 계산해 1.6Mbps로 늘린 값. B102(노드 opacity 0)를 고쳐도 같음. 월드맵에 앱 글꼴 조각이 많이 실리는 것(지도·HUD·시트 문구) 또는 LCP 후보를 다른 요소로 두는 것을 따로 볼 일(P12-03 범위 밖, 계획서 결과에 기록).
- **남은 접근성 감사(점수 90 이상 화면)**: `target-size` — 퀘스트 1-1 머리 진행 점(`.sp-dot`)이 점 9개 이상인 스테이지의 폰 폭에서 13×44px(P10-12에서 11점이 한 줄에 들도록 정한 값, 1스테이지는 퀴즈·보스 포함 11점이라 해당). `label-content-name-mismatch`(Lighthouse 가중치 0, axe 실험 규칙) — 월드맵 HUD 칩·스테이지 노드 버튼·"이어서 하기", 퀘스트 "힌트 받기"·"황금키 쓰기", 프로필의 카드 링크: 보이는 글자와 `aria-label`이 다름(음성 제어로 누를 때 보이는 글자를 말해도 안 될 수 있음). 둘 다 디자인 판단이 필요해 고치지 않고 기록.
