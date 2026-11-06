# design/

업그레이드 계획서 [Phase 2](../docs/4.upgrade-plan.md#phase-2-디자인-시안-3종--디자인-시스템-확정-v05)의 디자인 시안 프로토타입입니다. 무드보드 문서는 [`docs/design/P2-01-moodboard.md`](../docs/design/P2-01-moodboard.md).

- **앱 코드가 아닙니다.** `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierignore`에서 제외되어 빌드·lint·테스트에 영향을 주지 않습니다 (`spikes/`와 같은 방식).
- 의존성은 루트 `package.json`에 넣지 않고 `design/prototypes/package.json`에만 둡니다 (정확한 버전 고정). Playwright는 루트에 설치된 것을 재사용합니다.
- 확정된 시안은 Phase 2 후반(P2-09~)에 `src/`로 정식 구현합니다. 프로토타입 코드를 앱에서 import하지 않습니다.
- 커밋: 소스, `dist/*.html`(비공개 링크로 공유한 시안의 기록), `src/shared/content.gen.json`. 커밋 안 함: `node_modules/`, `shots/`, `.font-cache/`, `.build/`.

## 빠른 시작

```bash
cd design/prototypes
npm install
npm run build              # src/*/ 진입점 → dist/<이름>.html (폰트 원본은 처음에 .font-cache/로 받음)
npm run build -- a         # 진입점 하나만 (a | b | ab | moodboard)
node build.mjs --watch a   # 고칠 때마다 다시 빌드
npm run serve              # http://localhost:4317/ 미리보기 (Artifact 스켈레톤과 비슷하게 감쌈)
node shot.mjs a --hash quest --widths 360,768,1280 [--reduced] [--tier lite] [--frame mobile] [--full] [--fonts]
npm run contrast           # 시안별 대비 표 (마크다운). --check면 미달 시 실패
npm run typecheck
```

`shot.mjs`는 콘솔 오류를 모아 출력하고(목표 0), `--fonts`면 `document.fonts`로 실제 적용된 웹폰트를 보고합니다. `--full`은 화면이 아주 길면(높이 16,384px 넘음, 360폭 DPR 2) 아래쪽이 빈 그림이 되니, 긴 페이지는 `--hash`로 절마다 찍으세요.

## Artifact 페이지 계약 (dist HTML이 지켜야 할 것)

시안은 claude.ai Artifact(비공개 링크)로 공유하는 **단일 HTML 파일**입니다. `build.mjs`가 아래를 자동으로 지킵니다. 시안 코드에서는 굵게 표시한 항목만 신경 쓰면 됩니다.

- 출력에 `<!doctype>`·`<html>`·`<head>`·`<body>` 없음(게시할 때 감싸짐). 맨 위는 `<title>`(2~4단어, `entry.json`의 `title`) → `<meta name="claude:viewport-fit-sides" content="cover">` → `<style>`.
- 외부 스크립트는 cdnjs React 18.3.1 + ReactDOM 18.3.1 UMD 두 개만. 우리 코드는 esbuild로 묶어 인라인하고 `react`·`react-dom`·`react/jsx-runtime`은 전역(`React`, `ReactDOM`)으로 매핑됩니다. **다른 npm 패키지를 런타임에 쓰지 마세요**(Framer Motion 금지 — CSS + Web Animations API + 리그 엔진).
- 외부 스타일시트는 Google Fonts만(Jua, Gaegu, Gowun Dodum — `entry.json`의 `googleFonts`). Pretendard·D2Coding은 Google Fonts에 없어서 **번들에 실제로 들어간 글자만** fontTools로 서브셋해 base64 woff2로 인라인합니다(`inlineFonts: ["sans", "mono"]`). 글자는 빌드할 때 번들 문자열에서 모으므로 시안 코드에 문구를 넣기만 하면 됩니다. 사용자가 입력하는 글자(에디터 등)는 폴백 글꼴로 보일 수 있습니다.
  - 서브셋은 OFL 예약 이름 때문에 이름을 바꿨습니다: Pretendard → `pyRoad Sans`(가변 wght 45–920), D2Coding → `pyRoad Mono`. CSS는 `var(--font-body)`·`var(--font-mono)`를 쓰면 폴백 스택까지 들어 있습니다.
- **이미지·질감은 data: URI 또는 인라인 SVG/CSS만.** `fetch`·외부 이미지 금지. `alert/confirm/prompt` 금지. `localStorage`는 try/catch로 감싼 편의용만.
- **화면 이동은 맨 해시 토큰만**: `#landing`, `#world`, `#quest`, `#motion` (`#/path` 금지). 로드할 때 `location.hash`에 맞는 화면이 열립니다(`mountPrototype`이 처리).
- **단일 라이트 테마**: 다크 블록 없이 body 배경과 모든 색을 명시합니다(토큰 CSS 변수로).
- **첫 화면을 `opacity: 0`으로 시작하지 않기.** 등장 연출은 보이는 상태에서 transform으로(§2.10).
- 좌우 여백은 `padding-left: max(16px, env(safe-area-inset-left, 0px))`·`padding-right: max(16px, env(safe-area-inset-right, 0px))`. 가로 스크롤 없이.
- 파일 하나 **2MB 이하** 목표(빌드가 크기를 출력하고 넘으면 경고).

## 폴더

```
design/prototypes/
├── build.mjs  serve.mjs  shot.mjs
├── scripts/   fetch-fonts.mjs · gen-content.mjs · subset_font.py · contrast.mjs
├── src/
│   ├── shared/        ← 세 시안이 함께 쓰는 모듈 (아래 API). 고칠 때는 다른 시안에 영향이 없는지 확인
│   ├── moodboard/     ← P2-01 무드보드 → dist/moodboard.html
│   ├── a/             ← P2-02 시안 A 모험 섬 (시안 에이전트가 채울 곳)
│   ├── b/             ← P2-03 시안 B 마법 그림책
│   ├── ab/            ← P2-04 A×B 혼합
│   ├── rig-review/    ← P2-13 마스코트 리그 리뷰 (앱 src/components/characters/rig/를 상대 경로로 import, strips.mjs·bench.mjs)
│   └── sound-review/  ← P2-14 소리 청취 검수 (앱 src/lib/sound/ 엔진, `node src/sound-review/gen-audio.mjs` 뒤 빌드, 오디오 data URI 약 4.7MB)
└── dist/              ← 빌드 결과 (커밋)
```

### 시안 폴더 규칙 (`src/a`, `src/b`, `src/ab`)

- 진입점은 `main.tsx` + `entry.json`(`title`, `description`, `googleFonts`, `inlineFonts`). 지금은 `SkeletonScreen` 자리 표시만 있으니 지우고 채웁니다.
- **자기 폴더 안에서만 작업**합니다(세 시안이 동시에 작업). 공용으로 쓸 만한 것이 생기면 `shared/`를 고치지 말고 자기 폴더에 두고 보고에 적어 주세요. `shared/` 버그 수정은 최소로, API는 바꾸지 않습니다.
- CSS는 자기 폴더의 `.css`를 `main.tsx`에서 import(번들에 인라인). 클래스 이름은 시안 접두사(`a-`, `b-`, `ab-`)로 시작해 섞이지 않게 합니다.
- 반응형은 `@media` 대신 **`@container vp (min-width: …)`**를 씁니다. 검토 도구의 "모바일 390 / 태블릿 820" 프레임 보기에서도 맞게 바뀝니다. 화면 높이는 `100vh` 대신 `var(--vp-h)`.
- `position: fixed`(하단 내비·HUD)는 프레임 보기에서 프레임 안에 붙습니다(프레임이 transform 컨테이너). 스크롤 상자는 `getScroller()`.
- 화면마다 `<main>` 랜드마크 하나. 버튼·링크 이름, 터치 타겟 48px 이상, 본문 17px, 대비는 토큰 그대로 쓰면 AA.

## 공유 모듈 API (`src/shared/`)

시안 코드가 기대도 되는 안정 API입니다. 바꿔야 하면 세 시안을 함께 고칩니다.

### `app.tsx` — 마운트·화면 이동

```tsx
import { mountPrototype, goScreen, useHashScreen, getScroller, scrollToTop } from '../shared/app';

const SCREENS = [
  { id: 'landing', label: '랜딩' },
  { id: 'world', label: '월드맵' },
  { id: 'quest', label: '퀘스트' },
  { id: 'motion', label: '모션' },
] as const;
type Screen = (typeof SCREENS)[number]['id'];

mountPrototype<Screen>({
  concept: 'A',              // 'A' | 'B' | 'AB' → :root에 토큰 CSS 변수 + <html data-concept>
  name: 'pyRoad 모험 섬',     // 검토 도구 막대 제목
  screens: SCREENS,
  defaultScreen: 'landing',
  render: (screen) => <App screen={screen} />, // 해시가 바뀌면 다시 그림 + 맨 위로 스크롤
});
goScreen('quest');           // 화면 이동 = location.hash = 'quest'
```

`mode: 'scroll'`은 한 페이지에 모든 절을 그리고 해시로 절에 스크롤합니다(무드보드).

### `PrototypeChrome.tsx` — 검토 도구 막대

`mountPrototype`이 자동으로 붙입니다(오른쪽 아래, 접기 가능, 상태 기억). 화면 탭 · 보기(전체 폭 / 모바일 390 / 태블릿 820) · 연출 full/lite/minimal · 동작 줄이기. 아이가 아니라 검토자가 쓰는 도구라 시안 디자인과 무관한 중립 다크입니다.

### `motion.ts` — 연출 단계·동작 줄이기·스프링

```ts
import { useMotion, getMotion, pickMotion, tierDuration, springTiming, play, motionCssVars } from '../shared/motion';

const { tier, reduced } = useMotion();      // tier: 'full' | 'lite' | 'minimal', reduced: boolean (검토 도구가 바꿈)
el.animate([{ transform: 'scale(1.3)' }, { transform: 'none' }], springTiming('prop')); // 스프링 → CSS linear() easing + duration
play(el, keyframes, timing, { lite?, minimal? }); // 단계 자동 분기: reduced=마지막 프레임 즉시, minimal=페이드 150ms, lite=70% 길이
pickMotion({ full: 5, lite: 1, minimal: 0, reduced: 0 });
```

- CSS 분기는 `<html data-motion="full|lite|minimal" data-reduced="true|false">`. 유틸리티 클래스(`base.css`): `.m-loop`(대기 루프: minimal·동작 줄이기에서 멈춤), `.m-ambient`(구름·물결·패럴랙스: lite부터 멈춤), `.m-blur`(blur·backdrop-filter: lite부터 끔).
- `:root`에 CSS 변수가 들어 있습니다: `--spring-<이름>`(linear() easing)·`--spring-<이름>-dur`, `--dur-instant|fast|base|slow|page|celebrate`. 예: `animation: pop var(--spring-prop-dur) var(--spring-prop) both;`
- 스프링 이름: `face`(k420 c34) `body`(k200 c19) `envelope`(k60 c15) `prop`(k170 c13) `jellyA`(k520 c10) `jellyAB`(k500 c16) `jellyB`(k480 c24). 리그 `SPRING`과 같은 값이며 새 스프링을 만들지 않는 것이 원칙입니다(필요하면 보고).
- 반복 연출은 CSS transform·opacity만(SVG SMIL·무한 rAF 금지, 리그 엔진은 예외: 공유 rAF·화면 밖 정지).

### `tokens.ts` — 디자인 토큰

- `PALETTES[concept][token]`, `cssVars(concept)`. CSS에서는 **`var(--c-<토큰 케밥>)`**: `--c-bg --c-surface --c-surface2 --c-line --c-line-strong --c-text --c-text-muted --c-primary --c-on-primary --c-primary-lip --c-primary-text --c-primary-bright --c-secondary --c-on-secondary --c-secondary-lip --c-accent --c-accent-text --c-highlight --c-on-highlight --c-success(-soft) --c-warning(-soft) --c-error(-soft) --c-w1 --c-w1-ink --c-w1-soft (w2, w3 같음) --c-code-bg --c-code-text --c-code-comment --c-code-keyword --c-code-string --c-code-number --c-code-func`.
- 글자를 얹어도 되는 조합은 `PAIRS`에 있는 것뿐입니다(모두 AA). `primaryBright`·`accent`·`w1/w2/w3`·`*Lip`·`line`은 **장식 전용**(글자 얹지 않기).
- 글꼴: `--font-display`(A Jua 400 / B·AB Gaegu 700), `--font-body`(A·AB Pretendard / B Gowun Dodum), `--font-mono`(D2Coding), `--display-weight`, `--display-scale`(손글씨 1.15), `--body-lh`(1.7 / B 1.8). 크기 단계는 `TYPE_SCALE`(본문 17, 캡션 14 이상, 버튼 20, HUD 20, 코드 16).
- 코드 글자는 **짝수 px**(14·16·18·20)만. 15px처럼 홀수면 반각이 8px로 반올림되어 한글(15px)과 2칸 정렬이 깨집니다(무드보드에서 실측).
- B는 Gowun Dodum이 400 하나라 `<strong>`이 가짜 굵게가 됩니다 → 강조는 색·밑줄·손글씨로.
- HUD 숫자: Jua·Gaegu는 숫자 폭이 제각각이라 `min-width: 3.2ch; text-align: right` 상자에 넣습니다.

### `rig/` — 파이뱀 SVG 리그 (P0-07 스파이크 복사본)

```tsx
import { PybaemRig, PybaemStatic } from '../shared/rig/PybaemRig';
<PybaemRig style="A" state="happy" talking={false} size={200} />   // style: 'A' | 'B' | 'AB'
// state: idle talk think happy sad cheer dance. tier·reducedMotion을 안 주면 검토 도구를 따름
// lookAt(따라보기, 기본 true), framing 'stage'|'avatar', costume {hat, glasses, cape, bg}, ref.poke()
<PybaemStatic style="B" state="sad" size={64} />                  // 엔진 없는 정지 그림
```

A = 클레이(외곽선 없음·광택), B = 잉크 외곽선·선 떨림·12fps, AB = 남색 외곽선 + 광택 + 종이 결, 60fps. 화면 밖에서는 멈춥니다.

### `characters/Friends.tsx` — 버그버그·별똥이 (임시)

```tsx
import { BugBug, Byeolttongi } from '../shared/characters/Friends';
<BugBug style="A" mood="searching" size={96} motion="appear-bob" />   // mood: searching | found | fixed
<Byeolttongi style="B" mood="sparkling" motion="bob" />              // mood: flying | landing | sparkling
// motion: none | appear(팝 한 번) | bob(통통 반복) | appear-bob. 단계·동작 줄이기 자동 대응
```

### `icons.tsx` — 아이콘 (이모지 대신)

```tsx
import { Icon, RewardIcon } from '../shared/icons';
<Icon name="play" size={24} label="실행" />        // currentColor 선 아이콘. ICON_NAMES 참고. label 없으면 장식
<RewardIcon kind="coin" style="AB" size={28} />    // coin | star | starEmpty | key | heart | gem
```

### `content.ts` — 실제 퀘스트 문구

```ts
import { STAGES, WORLD1, quest, FUTURE_WORLDS, SAMPLE_PLAYER } from '../shared/content';
STAGES.map((s) => s.title);   // 1월드 7개 스테이지 이름
quest(2, 2).story;            // 퀘스트 2-2 스토리, .title .task .starter(시작 코드) .concept .xp .challenge
```

`content/worlds/` YAML에서 빌드할 때마다 다시 뽑습니다(`scripts/gen-content.mjs`). **정답·힌트·`solution_code`·`fallback_text`·`expected_output_hint`는 넣지 않습니다.** 2·3월드는 콘텐츠가 없어서 `FUTURE_WORLDS`(가제)만.

### `textures.ts` — 종이·수채 질감 (data: URI SVG)

`paperGrain()`, `paperFiber()`, `watercolorBlob(color)`, `notebookLines()`, `scribbleUnderline(color)`, `tornEdgeMask()` → CSS `background-image`/`mask-image` 값. 큰 면적 배경에만 쓰고 움직이는 요소 위에는 얹지 않습니다(매 프레임 다시 그림).
