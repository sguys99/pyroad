# P4-12 랜딩 성능 예산

> - 작성일: 2026-11-08 · 브랜치 `feat/phase4` · 전 = `3b1ddce`(랜딩 개편 P4-01~11 반영, P4-12 전) · 후 = 이 작업
> - 관련: [계획서](../4.upgrade-plan.md) §2.10 · P4-12 · 기준선 [P0-13](../spikes/P0-13-perf-baseline.md)(v0.3) · 폰트 [fonts.md](../design/fonts.md) §4
> - 측정: P0-13 하네스 `spikes/p0-13-perf-baseline/scripts/lighthouse.mjs`(Lighthouse 13.6.0, Chrome for Testing 156, 모바일 = 기본 시뮬레이션 RTT 150ms·1.6Mbps·CPU 4배), 격리 worktree에서 `npm run build` → `next start`, 3회 중앙값. 바이트는 postbuild `scripts/perf/check-landing-budget.mjs`(gzip -9)

## 1. 결론

랜딩 예산 네 가지를 모두 지킵니다. 렌더 차단 CSS는 **34.9KB → 13.6KB**(예산 15KB), 첫 JS는 **225.2KB → 168.8KB**(예산 250KB), 폰트는 그대로 106.1KB(예산 150KB), 모바일 LCP는 1.06초(예산 2.5초 미만)입니다. 완료 기준(모바일 Performance 80 이상, Accessibility 90 이상, 360px 가로 스크롤 없음)도 전후 모두 충족합니다. 바이트 예산은 이제 postbuild에서 **넘으면 빌드 실패**입니다(§2.10 "CI에서 바이트 예산은 차단").

| 예산 (§2.10) | P0-13 기준선 (v0.3) | 전 (`3b1ddce`) | 후 | 예산 |
|---|---|---|---|---|
| 모바일 LCP | 5.5초 | 1.06초 | **1.06초** | 2.5초 미만 |
| 랜딩 첫 JS (gzip) | 324KB (전송) | 225.2KB | **168.8KB** | 250KB 이하 |
| 렌더 차단 CSS (gzip) | 68KB (전송) | 34.9KB | **13.6KB** | 15KB 이하 |
| 폰트 전송 | 263KB | 106.1KB | 106.1KB | 150KB 이하 (preload 목표 100KB는 경고) |
| 첫 화면 글자 opacity 0 SSR | 15개 요소 | 없음 | 없음 (검사 추가) | 없음 |
| 랜딩 lottie-web | 있음 | 없음 | 없음 | 없음 |

JS·CSS는 HTML이 처음부터 거는 `<script src>`(noModule 폴리필 제외)·`<link rel="stylesheet">`를 파일마다 gzip -9로 잰 합입니다. Next 빌드 표의 `/` First Load JS는 234KB → 176KB.

## 2. Lighthouse (모바일·데스크톱, 3회 중앙값)

장비: i7-12700K 20스레드, WSL2, GPU 없음. **측정 내내 다른 프로젝트의 헤드리스 Chrome이 돌아 1분 부하가 2~49 사이를 오갔습니다**(아래 회차별 기록). 부하가 TBT·Performance를 크게 흔들어서(같은 빌드가 부하 40에서 73점, 부하 2에서 99점) 전후 비교는 부하가 낮고 비슷할 때 잰 회차만 씁니다.

**본 측정 (부하 1.9~2.8, 전·후 연달아)**

| | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | TTI | 전송 (JS · CSS · 폰트) | 요청 | 1분 부하 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 모바일 전 | **99** (99/99/100) | 100 | 100 | 100 | 1.06초 | **1.06초** | 96ms | 0 | 1.57초 | 3.70초 | 465KB (241.7 · 36.4 · 107.2) | 32 | 2.1~2.3 |
| 모바일 후 | **98** (96/98/98) | 100 | 100 | 100 | 1.06초 | **1.06초** | 170ms | 0 | 1.49초 | 3.43초 | 417KB (205.0 · 23.0 · 107.2) | 32 | 2.4~2.8 |
| 데스크톱 전 | 100 | 100 | 100 | 100 | 0.29초 | 0.29초 | 0 | 0 | 0.44초 | 0.29초 | 465KB | 32 | 1.9~2.1 |
| 데스크톱 후 | 100 | 100 | 100 | 100 | 0.29초 | 0.29초 | 0 | 0 | 0.40초 | 0.29초 | 417KB | 32 | 2.3~2.7 |

- 전송 JS·CSS에는 첫 로드 뒤 받는 것(라이브 리그·미니 해석기 prefetch·아래쪽 섹션 CSS 8.2KB)이 들어 있습니다. HTML 문서는 39.5KB → 40.8KB(서버가 그린 마스코트 정지 그림이 RSC 데이터에 들어감)
- LCP 요소는 전후 모두 히어로 제목 `h1#hero-title` 글자(서버 HTML에 처음부터 보임, 랜딩 서브셋 preload). 히어로 그림은 인라인 SVG라 따로 preload할 에셋이 없습니다
- **번갈아 4쌍** (부하 1.9~3.1): 전 Perf 100/99/99/99 · TBT 92~123ms · SI 1.43~1.62초 · TTI 3.69~3.73초, 후 98/98/98/98 · TBT 160~173ms · SI 1.23~1.56초 · TTI 3.40~3.43초. 후가 SI·TTI·바이트는 낫고 TBT는 약 60ms(시뮬레이션) 늘었습니다 — §5 참고
- 실제 Chrome에서 CPU 4배(Playwright, 412px, 로컬 서버): FCP 316~384ms → 192~276ms

**부하가 높을 때 (참고, 전만)**: 부하 37~49에서 모바일 73/73/68(TBT 1.5~2.8초), 부하 11~17에서 83/88/97(TBT 0.2~0.7초), 같은 부하에서 동작 줄이기면 95/89/91(SI 1.08초 — 등장 연출이 끝나야 화면이 다 차므로 SI는 연출이 있으면 늘어남). P0-13 기준선(64점)은 부하 7.8에서 잰 값입니다.

## 3. 무엇을 바꿨나

### 렌더 차단 CSS 34.9KB → 13.6KB

처음 `<link rel="stylesheet">` 두 개에 전역 CSS(Tailwind가 저장소 전체를 훑은 유틸리티 72KB 원본·game-ui·소셜 로그인)와 랜딩 섹션 CSS 전부가 들어 있었습니다.

| 덩어리 | 전 | 후 | 방법 |
|---|---|---|---|
| Tailwind 유틸리티 | 앱 전체 (gzip 약 11KB) | 랜딩이 닿는 소스만 (약 2KB) | `globals.css` `@import 'tailwindcss' source(none)` + `@source` 목록. 앱 화면은 `src/app/app.css`(`@reference './globals.css'` + `src/` 전체 유틸리티, utilities 층)를 앱 화면 틀이 import — 겹치는 규칙은 같은 내용이고 app.css가 늘 뒤라 Tailwind 순서가 지켜짐. 목록 누락은 `src/app/__tests__/tailwind-sources.test.ts`가 잡음 |
| 앱 전용 반복 연출 (월드맵·퀘스트·축하·에디터 커서) | globals.css | app.css | 랜딩에서 안 씀 |
| game-ui.css | 전부 | 버튼·아이콘 버튼·말풍선만 | 카드·툴팁·덮개/모달/시트·토스트·탭·진행바·HUD를 `ui/*.css`로 나눠 그 컴포넌트가 import (로그인 시트·쇼케이스와 함께 늦게 옴) |
| social-login.css | globals.css | 버튼 컴포넌트가 import | 로그인 시트와 함께 늦게 옴 |
| 아래쪽 섹션 CSS (세계관·쇼케이스·친구·보호자·FAQ) + 히어로 앰비언트·반짝이 | 처음부터 | **늦게** | `src/components/landing/deferredStyles.ts`를 하이드레이션 직후 동적 import(`LandingDeferredCss`) → Turbopack이 따로 묶은 CSS를 `<link>`로 붙임. 첫 화면(헤더·히어로·30초 체험)은 그대로 처음부터 |

**깨진 모습(FOUC) 막기**: 늦게 오는 섹션은 `<LandingSection deferredCss="이름">`이고, 그 CSS가 오기 전에는 섹션 본문(머리글 밖)을 `visibility: hidden`으로 둡니다(`landing.css`, `:where()`로 명시도 0). 각 섹션 CSS 맨 앞의 `[data-deferred-css='이름'] { --ld-css: visible }`가 도착하면서 드러냅니다 → 그 전에 스크롤해 와도 머리글 + 빈 자리만 보이고, 레이아웃이 깨진 모습은 보이지 않습니다(스크린샷 `pending-*`). 머리글(눈썹·제목·설명)은 처음부터 보입니다. 아래쪽이라 CSS가 붙으며 높이가 바뀌어도 화면 밖이면 CLS가 아닙니다(전후 CLS 0).
- 바로가기(헤더·히어로 `ScrollLink`)는 CSS가 아직이면 기다렸다가 스크롤·제목 포커스 (높이가 바뀌기 전에 가면 엉뚱한 곳에 멈춤)
- 주소에 `#faq`처럼 아래쪽 섹션을 달고 들어오면 CSS가 붙은 뒤 (그동안 아이가 스크롤하지 않았으면) 그 섹션으로 다시 맞춤
- 자바스크립트가 없으면 `<noscript>`가 본문을 보이게 함(CSS 없이라도 글은 읽힘)
- 걸리는 시간: 시뮬레이션 모바일에서 HTML 뒤 약 0.2초에 요청(관측), 실제 Chrome CPU 4배에서 0.7~0.8초에 붙음

검토했지만 쓰지 않은 것: Next `experimental.inlineCss`(바이트는 그대로 HTML 안에서 렌더를 막고, 모든 페이지에 적용되며 CSS 캐시를 잃음), `cssChunking`(묶는 방식만 바뀌고 차단 여부는 그대로), `next/dynamic` SSR(CSS를 `precedence`로 head에 올려 결국 차단), 본문 안 `<link>`(해시 붙은 CSS 주소를 알 수 없음), 섹션마다 `<Suspense>`로 하이드레이션 나누기(측정상 이득 없음).

### 첫 JS 225.2KB → 168.8KB

| 빠진 것 | 크기 (gzip, 대략) | 방법 |
|---|---|---|
| Framer Motion LazyMotion + domAnimation | 약 25KB | 루트 레이아웃이 아니라 Framer `m.*`을 쓰는 화면 틀(`LoggedInShell`·공지 레이아웃)에서만 `MotionProvider`. 랜딩은 Framer를 안 씀(`MotionConfig`만 약 1KB 남음) |
| 캐릭터 리그 (파이뱀·버그버그·별똥이 정지 그림 코드) | 약 20KB | 히어로·체험 공책의 첫 화면 정지 그림을 서버 컴포넌트(HeroSection·TrialSection)가 그려 `still`로 넘김. 리그 코드는 한가할 때 라이브 리그와 함께. 라이브가 오기 전에 누르면 말풍선·효과음은 바로, 표정은 리그가 온 뒤. 버그버그는 정지 그림 없이 리그가 오면 등장(첫 주문 뒤라 거의 늘 와 있음) |
| 디자인 토큰 원본 (`cn()` → tokens.ts, B44) | 약 4KB | 이름 목록만 `src/lib/design/themeNames.ts`로 (원본과 같은지 `utils.test.ts`가 확인). `global-error.tsx`가 아직 tokens.ts를 import해 약 2.7KB 남음 (§5) |
| 미니 해석기 (`lib/landing/miniPython`) | 약 5.5KB | 입력 상한·자동 교정만 `input.ts`로 떼고, 해석기는 공책 줄이 화면에 들어오거나 처음 만질 때 받음(처음 주문 걸 때 아직이면 받은 뒤 실행) |

lottie-web·canvas-confetti·로그인 시트·쇼케이스 장면은 이미 첫 JS 밖이었습니다(확인).

### 그 밖에

- 안드로이드 Chrome 자동 설치 띠: 랜딩 HTML 인라인 스크립트(약 90바이트, `src/lib/pwa/landingInstallGuard.ts`)가 `beforeinstallprompt` 기본 동작만 막음. 로그인 화면은 OAuth를 거쳐 새로 불러오므로 기존 `InstallPromptCatcher`가 그대로 잡음
- 랜딩 문구 서브셋 스캐너(`scripts/fonts/landing-text.mjs`): 글자로 그려지지 않는 모듈(`NON_TEXT_MODULES`)을 제목 자리 추적에서도 뺌 (`THEME_NAMES.text` 이름이 `{text}`로 따라가 Jua 서브셋에 영문을 늘리던 것). 서브셋 파일은 바뀌지 않음

## 4. 회귀 방지

| 검사 | 어디서 | 막는 것 |
|---|---|---|
| `scripts/perf/check-landing-budget.mjs` | postbuild (Vercel 빌드 포함) | 첫 JS 250KB·렌더 차단 CSS 15KB 초과 = **실패**, 95% 초과 = 경고, 글자가 든 요소의 인라인 `opacity:0` 서버 렌더 = 실패 |
| `scripts/fonts/check-build.mjs` | postbuild | 앱 라우트에 `app.css`가 없음 / 랜딩에 실림 = 실패 (표시 `--pyroad-app-css`) |
| `src/app/__tests__/tailwind-sources.test.ts` | unit | 랜딩 import 그래프(정적·동적) 파일이 globals.css `@source` 밖 |
| `src/components/ui/__tests__/game-ui-css.test.ts` | unit | 조각 CSS를 그 컴포넌트가 import하는지 |
| `e2e/public/landing-perf.spec.ts` | e2e-smoke | JS 없이도 첫 화면 글자가 보임(조상까지 opacity) · 차단 CSS 2개에 앱 CSS·아래쪽 섹션 CSS 없음 · 늦은 CSS 전에는 본문 숨김 → 오면 보임 · 바로가기가 CSS를 기다려 제목으로 · `/#faq` · 설치 띠 막기 |

**예산을 넘으면**: 렌더 차단 CSS는 ① 첫 화면 밖 섹션이면 `deferredStyles.ts`로 옮기고 `deferredCss` 표시 ② 특정 컴포넌트에서만 쓰는 공통 CSS는 그 컴포넌트가 import ③ 앱 화면만 쓰는 규칙은 `app.css`. 첫 JS는 화면에 들어올 때 받는 동적 import(`WhenVisible`·`useInView`)나 서버 컴포넌트로 그려 넘기기. 늦게 오는 CSS를 쓰는 섹션에서 새 요소가 `visibility`를 직접 다루면 가드(명시도 0)를 이기니 확인.

## 5. 남은 것·제안

- **TBT +60ms(시뮬레이션)**: 하이드레이션 롱태스크(react-dom)가 한 프레임으로 몰려 생긴 것으로 보입니다(실제 Chrome CPU 4배 LoAF: 전 113~139ms 두세 개 → 후 190~240ms 하나). 점수 영향은 1점, "좋음" 범위(200ms 미만). 줄이려면 하이드레이션할 DOM(약 1,180요소, 큰 SVG)을 줄이는 쪽 — 세계관 지도·쇼케이스 장면의 SVG를 화면에 들어올 때 그리기(P4-13 이후 검토)
- **browserslist가 없어 Next 기본(오래된 브라우저) 대상**: CSS에 `-webkit-any`·`-moz-any`·`@supports` 폴백, JS에 `Array.prototype.at` 등 폴리필(Lighthouse "legacy-javascript" 14KB)이 붙습니다. Tailwind v4가 이미 Safari 16.4+·Chrome 111+를 전제하므로 그에 맞추면 둘 다 더 줄지만, iPadOS 15 지원 범위(P0-15)와 겹쳐 **사용자 결정**이 필요합니다
- 앱 화면 CSS: 유틸리티가 globals.css와 일부 겹쳐 +1.5~2.3KB, 파일 수 3 → 6~10개(조각 CSS). 운영은 HTTP/2라 요청 수 영향은 작음
- `global-error.tsx`가 토큰 원본을 import해 모든 화면 첫 JS에 약 2.7KB — 값 몇 개만 쓰므로 나중에 작은 모듈로
- 랜딩 폰트 preload 106KB(목표 100KB, 경고) — [fonts.md](../design/fonts.md) §4 그대로
- 측정 장비 부하: 다른 프로젝트 작업이 계속 돌아 부하 2~49. P12-03 Lighthouse CI는 전용 러너에서

## 6. 재현

```bash
# 격리 worktree (공용 작업 트리의 .next·dev 서버와 섞지 않음)
git worktree add --detach ../.pyroad-perf HEAD && cp -al node_modules ../.pyroad-perf/ && cp .env ../.pyroad-perf/
(cd ../.pyroad-perf && npm run build && npx next start -p 3321)
# P0-13 하네스 (도구는 작업 디렉터리에 설치, spikes/p0-13-perf-baseline/README·§8). 랜딩만이면 로컬 Supabase 불필요(빈 supabase.env)
P013_WORK=<작업> P013_SPIKE=<작업> P013_APP=http://localhost:3321 P013_NO_WAIT=1 \
  node <작업>/h/scripts/lighthouse.mjs --runs 3 --routes landing --ff mobile,desktop --out <작업>/results/lh-after.json
# 바이트 예산만
BUDGET_CHECK_NEXT_DIR=../.pyroad-perf/.next node scripts/perf/check-landing-budget.mjs
```

스크린샷(전후 360·1280, full·동작 줄이기, 늦은 CSS 대기·도착)은 작업 스크래치 `shots/P4-12/`에 두었습니다(저장소에 넣지 않음). 360·1280 동작 줄이기 첫 화면은 전후 화소 차이 0, full은 앰비언트 시점 차이만.
