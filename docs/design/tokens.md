# 디자인 토큰 (P2-09)

> - 기준: 사용자가 승인한 최종 시안(§12-Q31, `design/prototypes/src/final/tokens.ts`·`refine.css`). 단일 톤 바탕 `#F6F4EF`, 테두리 없는 면 + 버튼 아랫면 3px, 색은 **중립 + 주색 초록 하나 + 강조 금색 하나 + 의미색**, 월드색은 지도·표지의 옅은 틴트만, 제목 Jua · 본문 Pretendard(pyRoad Sans)
> - 원본: **`src/lib/design/tokens.ts`** (TS 상수). 화면은 `src/app/globals.css`의 `:root` 변수와 Tailwind `@theme inline`으로 쓴다. 두 곳이 같은지는 `src/lib/design/__tests__/tokens.test.ts`가 globals.css를 읽어 양방향으로 비교한다(빠진 변수·남는 변수·다른 값 모두 실패)
> - 모션 값의 원본은 `src/lib/motion/tokens.ts`(리그 스프링과 공유, [motion-guidelines](motion-guidelines.md)). 디자인 토큰은 다시 내보내기만 하고 CSS 변수 `--dur-*`·`--easing-*`·`--spring-*`로 옮긴다
> - 글꼴 파일·스택은 [fonts.md](fonts.md)(P2-10). 여기서는 이름(`FONT_FAMILY`)과 크기 단계만 정한다
> - 토큰으로 만든 공통 컴포넌트(게임 버튼·카드·모달·시트·토스트·탭·진행바·HUD·말풍선)는 [components.md](components.md)(P2-11)

## 1. 색

쓰임은 다섯 가지: **bg**(글자를 얹는 바탕), **text**(글자), **fill**(글자를 얹는 채움 — 버튼·배지), **ui**(경계·포커스 3:1), **decor**(장식 전용, 글자를 얹거나 글자색으로 쓰지 않음).

| 토큰 (TS) | CSS 변수 · Tailwind | 값 | 쓰임 |
|---|---|---|---|
| `bg` | `--bg` · `bg-background` | `#F6F4EF` | 단색 바탕 (종이 결 없음) |
| `surface` | `--surface` · `bg-card` · `bg-surface` | `#FFFFFF` | 카드·시트·입력 |
| `surface2` | `--surface-2` · `bg-muted` · `bg-surface-2` | `#EFECE5` | 보조 면: 칩·결과 상자·눌린 탭·줄 번호 |
| `surfaceLip` | `--surface-lip` | `#DFDAD0` | decor: 흰 버튼 아랫면 |
| `line` | `--line` · `border-border` · `border-line` | `#E5E1D9` | decor: 구분선 |
| `lineStrong` | `--line-strong` · `border-input` · `border-line-strong` | `#8E877C` | ui: 입력·코드 상자 경계 (3:1) |
| `text` | `--text` · `text-foreground` | `#2E2A25` | 본문 |
| `textMuted` | `--text-muted` · `text-muted-foreground` | `#6B645B` | 보조 글자 |
| `primary` | `--primary` · `bg-primary` | `#3E7B3A` | fill: 주 버튼 |
| `onPrimary` | `--on-primary` · `text-primary-foreground` | `#FFFFFF` | 주 버튼 글자 |
| `primaryLip` | `--primary-lip` · `bg-primary-lip` | `#2F5F2C` | decor: 주 버튼 아랫면, 눌림·hover 면 |
| `primaryText` | `--primary-text` · **`text-primary-text`** | `#3A7336` | 초록 글자·링크 (`text-primary` 금지) |
| `primaryBright` | `--primary-bright` | `#A9D38F` | decor: 진행 막대 끝·지도 길·나뭇잎 |
| `primarySoft` | `--primary-soft` · `bg-primary-soft` | `#E8F0E3` | 초록 틴트 면 (해 볼 일·성공 말풍선) |
| `secondary` | `--secondary` · `ring-ring` | `#2E2A25` | 파랑 없음 → 짙은 중립: 포커스 링·어두운 버튼 |
| `accent` | `--accent` · `bg-accent` | `#F0B43C` | 금색 하나: 별·코인·도장·"지금 여기". 글자는 `onAccent`만 얹는다 |
| `onAccent` | `--on-accent` · `text-accent-foreground` | `#2E2A25` | 금색 면 위 글자 |
| `accentLip` · `accentLight` | `--accent-lip` · `--accent-light` | `#C48A1A` · `#FBE3A6` | decor: 금색 버튼 아랫면·별 외곽 / 별·코인 밝은 쪽 |
| `accentText` | `--accent-text` · **`text-accent-text`** | `#8A5A00` | 금색 계열 글자: 보상 수치·도장 문구 (`text-accent` 금지) |
| `accentSoft` | `--accent-soft` · `bg-accent-soft` | `#FBF1DC` | 금색 틴트 면 |
| `success` · `successSoft` | `--success` · `--success-soft` | `#3A7336` · `#E8F0E3` | 성공 = 초록 글자 (새 색 없음) |
| `warning` · `warningSoft` | `--warning` · `--warning-soft` · `text-warning` · `bg-warning-soft` | `#8A5A00` · `#FBF1DC` | 경고 = 금색 글자 (예전 amber 대체) |
| `error` · `onError` · `errorSoft` | `--error` · `text-destructive` · `bg-error-soft` | `#B3402F` · `#FFFFFF` · `#FBEAE6` | 오류 |
| `onScrim` · 덮개 | `--on-scrim` · `--scrim` · `bg-scrim` · `text-on-scrim` | `#FFFFFF` · `rgb(46 42 37 / 0.65)` | 축하·대화 상자 뒤 덮개와 그 위 글자 |
| `w1`·`w2`·`w3` | `--w1` … · `bg-w2-soft` … | `#A9CF94` · `#B4C8D2` · `#D9C3A3` | decor: 월드 틴트 (§3) |
| `w1Ink`·`w2Ink`·`w3Ink` | `--w1-ink` … | `#3A7336` · `#6B645B` · `#6B645B` | 월드 표지 글자 (2·3은 중립: 칩마다 다른 색 금지) |
| `w1Soft`·`w2Soft`·`w3Soft` | `--w1-soft` … | `#EDF3E8` · `#EDF1F3` · `#F4EEE5` | 월드 바탕 |
| `code*` | `--code-bg` · `--code-keyword` … · `text-code-keyword` | 바탕 `#FFFFFF`, 글자·숫자·함수 `#2E2A25`, 키워드 `#3A7336`, 문자열 `#8A5A00`, 주석 `#7A7268` | CodeMirror 키즈 테마 ([editor.md](editor.md), 틴트 면 위 대비 포함) |

shadcn/ui 이름(`--background`·`--card`·`--muted`·`--accent-foreground`·`--destructive`·`--border`·`--input`·`--ring` …)은 그대로 두고 위 토큰을 가리킨다. 쓰지 않던 `--chart-*`·`--sidebar-*`는 지웠다.

### 1.1 대비 (WCAG AA, 자동 검사)

`CONTRAST_PAIRS`(52쌍, P2-11에서 흰 버튼 눌림·위험 버튼·토스트 틴트 5쌍 추가)를 `tokens.test.ts`가 계산해 기준 미달이면 실패한다. 반투명 면(`bg-primary/10` 등)은 아래 색과 합성해 잰다. 새 배경 위 글자·새 버튼을 만들면 표에 먼저 추가한다. 글자 조합 최저 **4.58:1**(초록 글자 on `bg-primary/10`).

| 쓰임 | 글자·전경 | 배경 | 대비 | 기준 |
|---|---|---|---:|---:|
| 본문 | `text` #2E2A25 | `bg` #F6F4EF | 12.96 | 4.5 |
| 카드 본문 | `text` | `surface` #FFFFFF | 14.24 | 4.5 |
| 보조 면 글자 | `text` | `surface2` #EFECE5 | 12.07 | 4.5 |
| 보조 글자 | `textMuted` #6B645B | `bg` / `surface` / `surface2` | 5.30 / 5.83 / 4.94 | 4.5 |
| 초록 글자·링크 | `primaryText` #3A7336 | `bg` / `surface` / `surface2` | 5.18 / 5.69 / 4.82 | 4.5 |
| 초록 틴트 면 글자 | `primaryText` | `primarySoft` #E8F0E3 | 4.88 | 4.5 |
| 초록 10% 면 글자 | `primaryText` | `primary` 10% over `bg` #E4E8DD | 4.58 | 4.5 |
| 주 버튼 글자 | `onPrimary` #FFFFFF | `primary` #3E7B3A | 5.12 | 4.5 |
| 주 버튼 눌림·hover | `onPrimary` | `primaryLip` #2F5F2C | 7.51 | 4.5 |
| 주 버튼 면 | `primary` | `bg` / `surface` | 4.66 / 5.12 | 3 |
| 어두운 버튼 글자 | `onSecondary` #FFFFFF | `secondary` #2E2A25 | 14.24 | 4.5 |
| 포커스 링 | `secondary` | `bg` / `surface` | 12.96 / 14.24 | 3 |
| 금색 버튼·배지 글자 | `onAccent` #2E2A25 | `accent` #F0B43C | 7.66 | 4.5 |
| 금색 버튼 눌림 | `onAccent` | `accentLip` #C48A1A | 4.74 | 4.5 |
| 금색 글자 | `accentText` #8A5A00 | `bg` / `surface` / `accentSoft` | 5.39 / 5.92 / 5.28 | 4.5 |
| 금색 20% 배지 글자 | `onAccent` | `accent` 20% over `surface` | 12.61 | 4.5 |
| 성공 · 경고 글자 | `success` / `warning` | `successSoft` / `warningSoft` | 4.88 / 5.28 | 4.5 |
| 오류 글자 | `error` #B3402F | `bg` / `surface` / `errorSoft` | 5.17 / 5.68 / 4.88 | 4.5 |
| 위험 버튼 글자 | `onError` #FFFFFF | `error` | 5.68 | 4.5 |
| 입력 경계 | `lineStrong` #8E877C | `surface` / `bg` | 3.55 / 3.23 | 3 |
| 덮개 위 글자 (흰 화면 위, 가장 나쁜 경우) | `onScrim` #FFFFFF | 덮개 65% over `surface` #777571 | 4.59 | 4.5 |
| 월드 1·2·3 표지 글자 | `w1Ink` / `w2Ink` / `w3Ink` | `w1Soft` / `w2Soft` / `w3Soft` | 5.04 / 5.13 / 5.05 | 4.5 |
| 월드 바탕 본문 | `text` | `w1Soft` / `w2Soft` / `w3Soft` | 12.60 / 12.53 / 12.35 | 4.5 |
| 코드 글자·주석·키워드·문자열 | `codeText` / `codeComment` / `codeKeyword` / `codeString` | `codeBg` #FFFFFF | 14.24 / 4.73 / 5.69 / 5.92 | 4.5 |
| 코드 줄 번호 | `textMuted` | `surface2` | 4.94 | 4.5 |

(표시값은 소수 둘째 자리에서 내림. 전체 47쌍은 `npx vitest run src/lib/design`)

**P0-13 미달 해소**: 예전 브랜드 초록 `#31983d`는 흰 글자 3.69:1, 앱 배경 위 글자 3.39~3.59:1로 미달이었다. 같은 색상 계열에서 명도를 낮춘 `primary` `#3E7B3A`(흰 글자 5.12)와 글자 전용 `primaryText` `#3A7336`(배경 5.18)으로 나눴고, 앱의 `text-primary` 61곳을 모두 `text-primary-text`로 바꿨다. API 키 안내의 `amber-600` on `amber-50`(3.08:1)은 `text-warning` on `bg-warning-soft`(5.28)로, 프로필 `destructive`(3.43)는 `error` `#B3402F`(배경 5.17)로 바뀌었다. `bg-destructive/10` 위 오류 글자는 배경 위에서 4.49로 아슬아슬해 `bg-error-soft`(4.88)로 바꿨고, `hover:bg-primary/90`·`/80`(흰 글자 4.28)은 `hover:bg-primary-lip`(7.51)로 바꿨다.

## 2. 글자·모양·간격·선·모션

### 2.1 타이포 스케일 (`TYPE`, Tailwind `text-<이름>`)

| 이름 | 크기 / 행간 | 글꼴 | 쓰임 |
|---|---|---|---|
| `hero` · `hero-wide` | 34 / 1.22 · 42 / 1.22 (600px 이상), 자간 -0.01em | Jua | 랜딩 큰 제목 |
| `h1` · `h2` · `h3` | 28 / 1.25 · 24 / 1.3 · 19 / 1.35 | Jua | 화면 제목 · 절 제목 · 카드 제목 |
| `button` · `button-lg` | 18 / 1 · 20 / 1 | Jua | 버튼 글자 |
| `body` | **17 / 1.7** | pyRoad Sans | 본문 (body 기본값, 자간 0, `word-break: keep-all`) |
| `small` | 15 / 1.6 | pyRoad Sans | 보조 문단·말풍선 이름 |
| `caption` | **14 / 1.5 (최소)** | pyRoad Sans | 캡션 |
| `kicker` | 14 / 1.5, 650, 자간 0.02em | pyRoad Sans | 눈썹 글자 (주색 글자와 함께) |
| `code` | 16 / 1.6 | pyRoad Mono | 코드 (D2Coding은 짝수 px만 한글 2칸 정확) |

- 크기는 rem이라 브라우저 글자 크기 설정을 따른다. **14px 미만 금지**(P0-14). Tailwind 기본 `text-xs`(12px)·`text-[11px]` 같은 지금 코드는 레거시 96곳(35파일)이라 기준표로 묶어 늘지 못하게 하고 Phase 4~6 화면 개편에서 없앤다(§5).
- Jua는 제목·버튼·큰 숫자만. 작은 이름표·눈썹 글자는 본문 글꼴. Gaegu를 쓰지 않으므로(§12-Q28) 손글씨 1.15배 보정은 없다.
- **HUD 숫자는 고정 폭**: Jua에는 `tnum`이 없어 카운트업 때 흔들린다 → `hud-num` 유틸리티(`tabular-nums` + `min-width: 3.2ch` + 오른쪽 정렬). 숫자를 Jua로 쓰면 최소 폭 상자가, 본문 글꼴로 쓰면 고정 폭 숫자까지 효과가 난다.

### 2.2 반경·그림자·선·간격

| 토큰 | CSS · Tailwind | 값 |
|---|---|---|
| `RADIUS.s/m/l/pill` | `--round-s/m/l/pill` · `rounded-sm`·`rounded-md`(10) · `rounded-lg`·`rounded-xl`(14) · `rounded-2xl` 이상(20) · `rounded-full` | 10 · 14 · 20 · 원형 (`--radius` = 14, shadcn 기준) |
| `SHADOW.card` | `--elev-card` · `shadow-card` (`shadow-sm`·`shadow-md`도 같은 값) | `0 1px 2px rgb(46 42 37 / .06), 0 4px 14px rgb(46 42 37 / .06)` — 기본 한 종류 |
| `SHADOW.pop` | `--elev-pop` · `shadow-pop` (`shadow-lg`·`shadow-xl`) | `0 12px 32px rgb(46 42 37 / .14)` — 떠 있는 층(시트·토스트·오버레이)만 |
| `LINE.ui` | `--line-w` | 1px: 테두리는 입력·코드 상자만. 버튼·카드·칩은 테두리 없음 |
| `LINE.lip` | `--lip-h` | 3px: 버튼 아랫면, 눌리면 이만큼 내려감 |
| `LINE.focus` · `focusOffset` | `--focus-w` · `--focus-offset` · `focus-ring` 유틸리티 | 2px · 2px, 색 `--ring`(짙은 중립) |
| `SPACE` | `--spacing: 0.25rem` · `min-h-touch`·`size-touch`(48px) · `px-gutter`(16px) | 4px 단위, 터치 타겟 48px |

일러스트·캐릭터 선은 "면 색의 진한 톤 1px 안팎"(리그 B `outline: 1.1`, `tonal`)이라 토큰 색이 아니다(§6).

### 2.3 모션

| 원본 (`@/lib/motion/tokens`) | CSS 변수 | Tailwind |
|---|---|---|
| `DURATION` instant 80 · fast 140 · fade 150 · base 220 · slow 360 · page 700 · progress 700 · draw 1500 · celebrate 1200 (ms) | `--dur-<이름>` | `duration-(--dur-fast)` |
| `EASING` out · inOut · press · backOut · stampIn · ink · page | `--easing-<이름>` | `ease-out` · `ease-in-out` · `ease-press` · `ease-back-out` · `ease-ink` · `ease-page` (기본 이름도 토큰 곡선) |
| `SPRINGS` face · body · envelope · prop · jellyA · jellyAB · jellyB | `--spring-<이름>`(`linear()`) · `--spring-<이름>-dur` | `ease-(--spring-prop) duration-(--spring-prop-dur)` |

- transition 기본값(`transition-colors` 등)은 `--dur-fast` + `--easing-out`.
- Framer: `transition={{ duration: sec('base'), ease: EASE.out }}`, 스프링은 `framerSpring('body')`, 버튼 눌림 복귀는 `framerSpring(jelly())`. 기본 젤리는 최종 시안 B라 **jellyB**(`DEFAULT_CONCEPT = 'b'`, 리그 B 스타일과 같음).
- P2-09에서 추가한 길이: `fade`(minimal 페이드, `springOrFade`가 쓰던 0.15초), `progress`(진행 막대·카운트업), `draw`(지도 길 그리기). 예전 컴포넌트 값은 가까운 토큰으로 옮겼다(0.5초 등장 → slow 0.36, 0.6~0.8초 막대 → progress 0.7, 스프링 400/17 → jellyB, 300/20·380/26 → body, 420/22·260/15 → prop).

## 3. 월드 테마

`[data-world="1|2|3"]`가 `--world`·`--world-ink`·`--world-soft` 세 변수만 바꾼다(§6 "같은 디자인 시스템 위에서 배경·지도만 교체"). 속성이 없으면 월드 1.

```tsx
<section data-world={2}>
  <div className="bg-world-soft">           {/* 월드 2 바탕 #EDF1F3 */}
    <h2 className="text-world-ink">…</h2>   {/* 월드 2 표지 글자 */}
    <div className="bg-world/40" />          {/* 장식 틴트 */}
  </div>
</section>
```

- 지금은 월드맵 바탕 `MapBackground world={1}`이 쓴다(격자·빗금을 걷어 낸 옅은 틴트 한 겹). Phase 5 월드맵 개편은 같은 변수로 지도·표지를 그린다.
- TS에서 월드별 값이 필요하면 `WORLD_THEMES[id]`(토큰 이름) → `COLOR[...]`.

## 4. 쓰는 법

| 어디서 | 어떻게 | 예 |
|---|---|---|
| 컴포넌트 (기본) | Tailwind 클래스 | `bg-card text-foreground`, `bg-primary text-primary-foreground hover:bg-primary-lip`, `text-primary-text`, `bg-warning-soft text-warning`, `rounded-xl shadow-card`, `text-caption` |
| CSS·인라인 style | CSS 변수 | `background: var(--world-soft)`, `color-mix(in srgb, var(--accent) 16%, transparent)` |
| CSS 문자열을 받는 라이브러리 (CodeMirror) | `cssVar('primary')` → `var(--primary)` | `src/lib/editor/kidsTheme.ts` ([editor.md](editor.md)) |
| CSS 변수를 못 쓰는 곳 (satori 공유 카드, canvas 컨페티, 루트 오류 화면) | `import { COLOR, RADIUS, FONT_FAMILY } from '@/lib/design/tokens'` | `confettiPresets.ts`, `global-error.tsx` |
| 모션 | `import { sec, EASE, framerSpring, jelly } from '@/lib/motion/tokens'` (또는 `@/lib/design/tokens`) | `transition={{ duration: sec('base') }}` |

## 5. 금지 규칙과 검사

- **`npm run tokens:check`** (`scripts/design/check-tokens.mjs`, CI `lint-typecheck`): TypeScript AST의 문자열·속성만 보고(주석·화면 글자는 안 봄) 아래를 찾는다.
  - `color`: 색 리터럴(hex·`rgb()`·`hsl()`·`oklch()`), Tailwind 고정 팔레트 클래스(`text-green-600`·`bg-amber-100`·`bg-white`·`bg-black/50`), 임의값 `bg-[#…]`
  - `misuse`: `text-primary`·`text-accent`(장식 전용 토큰을 글자색으로) → `text-primary-text`·`text-accent-text`
  - `font`: `fontFamily` 문자열(단 `var(--font-*)`는 허용), `font-[…]`, `font-family:` → `font-display`·`font-sans`·`font-mono`
  - `motion` (`src/components`·`src/app`): Framer `duration`·`delay`·`stiffness`·`damping`·`mass`의 0 아닌 숫자(`1.5 * k`도), `ease: '문자열'`, Tailwind `duration-300`·`delay-200`·`duration-[…]`·`ease-[…]`
  - `size`: 14px 미만 글자(`text-xs`·`text-[11px]`·`text-[0.8rem]`)가 `scripts/design/tokens-baseline.json`의 파일별 개수보다 늘면 실패. 줄이면 `npm run tokens:check -- --update-baseline`
  - CSS(`src/**/*.css`, `src/fonts` 제외): 사용자 정의 속성(`--x: …`) 밖의 색 리터럴과 `font-family`. 토큰 값은 globals.css `:root`에만
- 토큰 값 드리프트·대비는 `npx vitest run src/lib/design`(CI `unit`).
- 컴포넌트에 `dark:` 색 클래스를 쓰지 않는다(다크 모드 범위 밖, §7).

## 6. 예외 목록

| 경로 / 방법 | 허용 규칙 | 이유 |
|---|---|---|
| `src/lib/design/tokens.ts` | color · font | 토큰 원본 |
| `src/components/characters/**` | color · size | 캐릭터 고유색(리그 팔레트 `PYBAEM_PALETTES` 등, 레거시 캐릭터 SVG, 감정 후광 `PYBAEM_HALO`)과 그림 속 글자. 파이뱀 몸 `#9CCB80`·외곽선 `#5F804E`은 토큰과 별개. 리그 B 바닥 그림자만 `lineStrong`과 같은 값이고 테스트가 확인한다 |
| `src/components/world/illustrations/**` | color · size | 월드 일러스트 원화. Phase 5 월드맵 개편에서 월드 틴트 + 면 색의 진한 톤 선으로 다시 그린다 |
| `src/lib/motion/**` | motion | 모션 토큰 원본·연출 단계표 |
| `src/lib/celebration/**` | motion | 축하 시퀀서·컨페티 박자표(ms 타임라인). 색은 토큰 import |
| 줄 주석 `// tokens-allow: <이유>` (그 줄 또는 바로 윗줄) | 전부 | 브랜드 가이드 색·외부가 정한 색. 이유를 꼭 쓴다. 지금: 소셜 로그인 로고 SVG 색(`src/components/auth/brandMarks.tsx`: 카카오 심볼 `#000000`, 네이버 N `#FFFFFF`, Google G 4색, P3-05) |
| `src/components/auth/social-login.css`의 provider별 사용자 정의 속성(`--social-bg`·`--social-fg`·`--social-stroke`) | color | 소셜 로그인 버튼 면·글자·테두리 = 각 사 브랜드 가이드 값(카카오 `#FEE500`·레이블 검정 85%, 네이버 `#03A94D`(2025 갱신, 예전 `#03C75A`)·흰 글자, Google 흰 면·`#747775`·`#1F1F1F`). pyRoad 토큰으로 만들지 않는다(테마가 바뀌어도 그대로여야 함). CSS 검사는 사용자 정의 속성 값을 보지 않으므로 이 표와 `social-login-css.test.ts`가 기록·확인한다. 근거·어긋남은 [components.md](components.md) §12 |

공유 카드(P2-19)는 satori가 CSS 변수를 못 읽으므로 `COLOR`를 import해 리터럴 없이 쓴다(예외 불필요). 정지 그림 래스터(히어로·카드 배경 PNG, §12-Q28)는 이미지라 검사 대상이 아니다.

## 7. 다크 모드

범위 밖(MVP 제외)으로 판단해 `.dark` 변수를 두지 않았다(예전에도 정의가 없었고, 컴포넌트의 `dark:amber-*` 클래스는 이번에 지웠다). shadcn 컴포넌트에 남은 `dark:` 토큰 클래스는 `.dark`가 없어 동작하지 않는다. 다시 할 때는 `:root` 색 토큰만 `.dark`(또는 `[data-theme=dark]`)에서 덮고, `CONTRAST_PAIRS`를 다크 값으로 한 번 더 검사하도록 테스트를 늘린다.
