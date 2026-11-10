/**
 * 디자인 토큰 원본 (P2-09, docs/design/tokens.md). 색·글자·반경·그림자·간격·선·모션 값은 이 파일 한 곳에서 정한다.
 *
 * - 기준은 사용자가 승인한 최종 시안(§12-Q31, `design/prototypes/src/final/tokens.ts`·`refine.css`): 단일 톤 바탕,
 *   테두리 없는 면 + 버튼 아랫면 3px, 색은 중립 + 주색 초록 하나 + 강조 금색 하나 + 의미색, 월드색은 옅은 틴트만
 * - 화면은 CSS 변수·Tailwind 클래스로 쓴다(`globals.css`의 `:root`·`@theme`). 이 파일과 값이 같은지는
 *   `__tests__/tokens.test.ts`가 globals.css를 읽어 검사한다 → 값을 바꾸면 두 곳을 같이 고친다
 * - CSS 변수를 못 쓰는 곳(공유 카드 satori, canvas 컨페티, 오류 화면 인라인 스타일)은 여기서 import한다.
 *   CodeMirror처럼 CSS 문자열을 받는 곳은 `cssVar()`로 변수를 가리켜 월드 테마·후속 변경을 따라가게 한다
 * - 모션 값은 `@/lib/motion/tokens`가 원본이다(리그 스프링과 공유). 여기서는 다시 내보내기만 한다
 */
import { DURATION, EASING, SPRINGS, springTiming } from '@/lib/motion/tokens';
import type { DurationName, EasingName, SpringName } from '@/lib/motion/tokens';

export {
  DURATION,
  EASE,
  EASING,
  SPRINGS,
  framerSpring,
  sec,
  springOrFade,
  springTiming,
  tierDuration,
} from '@/lib/motion/tokens';
export type { DurationName, EasingName, SpringName } from '@/lib/motion/tokens';

// ───────────────────────────── 색

/**
 * 색 토큰. 쓰임(role)은 docs/design/tokens.md 표와 `CONTRAST_PAIRS`를 본다.
 * - **장식 전용**(글자를 얹거나 글자색으로 쓰지 않음): `line`, `surfaceLip`, `primaryLip`, `primaryBright`, `accent`,
 *   `accentLip`, `accentLight`, `w1`·`w2`·`w3`
 * - 초록 글자는 `primaryText`(배경·면·보조 면 위 AA), 금색 계열 글자는 `accentText`
 */
export const COLOR = {
  // 중립
  /** 단색 바탕 (따뜻한 오프화이트, 종이 결 없음) */
  bg: '#F6F4EF',
  /** 카드·시트·입력 */
  surface: '#FFFFFF',
  /** 보조 면: 칩·결과 상자·눌린 탭·코드 줄 번호 */
  surface2: '#EFECE5',
  /** 흰 버튼 아랫면 (장식). 동작 줄이기에서는 눌린 흰 버튼의 면 (P2-11) */
  surfaceLip: '#DFDAD0',
  /** 장식 구분선 (글자·경계 의미 없음) */
  line: '#E5E1D9',
  /** 입력·코드 상자 경계 (UI 3:1) */
  lineStrong: '#8E877C',
  text: '#2E2A25',
  textMuted: '#6B645B',

  // 주색: 브랜드 초록 하나
  primary: '#3E7B3A',
  onPrimary: '#FFFFFF',
  /** 주 버튼 아랫면 (장식) */
  primaryLip: '#2F5F2C',
  /** 초록 글자·링크 (bg·surface·surface2·primarySoft 위 AA) */
  primaryText: '#3A7336',
  /** 장식 전용: 진행 막대 끝·지도 길·나뭇잎 */
  primaryBright: '#A9D38F',
  /** 초록 틴트 면: 해 볼 일·성공 말풍선 */
  primarySoft: '#E8F0E3',

  // 보조: 파랑 없음 → 짙은 중립 (포커스 링·어두운 버튼)
  secondary: '#2E2A25',
  onSecondary: '#FFFFFF',

  // 강조색: 따뜻한 금색 하나 (별·코인·도장·형광펜·"지금 여기")
  /** 장식 전용 면. 글자를 얹으면 `onAccent`만 */
  accent: '#F0B43C',
  onAccent: '#2E2A25',
  /** 금색 버튼 아랫면·별 외곽 (장식) */
  accentLip: '#C48A1A',
  /** 별·코인 밝은 쪽 (장식) */
  accentLight: '#FBE3A6',
  /** 금색 계열 글자: 도장 문구·보상 수치·경고 */
  accentText: '#8A5A00',
  accentSoft: '#FBF1DC',

  // 의미색 (성공 = 초록 글자, 경고 = 금색 글자: 색 수를 늘리지 않는다)
  success: '#3A7336',
  successSoft: '#E8F0E3',
  warning: '#8A5A00',
  warningSoft: '#FBF1DC',
  error: '#B3402F',
  onError: '#FFFFFF',
  errorSoft: '#FBEAE6',

  // 덮개 (축하·대화 상자 뒤). 위에 얹는 글자·점은 onScrim
  onScrim: '#FFFFFF',

  // 월드 틴트 (지도·표지 배경에만 아주 옅게). 글자는 ink (월드 2·3은 중립: 칩·배지마다 다른 색 금지)
  w1: '#A9CF94',
  w1Ink: '#3A7336',
  w1Soft: '#EDF3E8',
  w2: '#B4C8D2',
  w2Ink: '#6B645B',
  w2Soft: '#EDF1F3',
  w3: '#D9C3A3',
  w3Ink: '#6B645B',
  w3Soft: '#F4EEE5',

  // 코드: 키워드 초록 · 문자열 금색 글자 · 주석 회색, 나머지는 본문색
  codeBg: '#FFFFFF',
  codeText: '#2E2A25',
  codeComment: '#7A7268',
  codeKeyword: '#3A7336',
  codeString: '#8A5A00',
  codeNumber: '#2E2A25',
  codeFunc: '#2E2A25',
} as const;

export type ColorName = keyof typeof COLOR;

/** 덮개: 글자색(text)을 반투명으로. CSS `--scrim`. 위에 얹는 흰 글자가 흰 화면 위에서도 4.5:1이 되는 최소 진하기 (0.65 → 4.60) */
export const SCRIM = { color: COLOR.text, alpha: 0.65 } as const;

export type WorldId = 1 | 2 | 3;

/**
 * 월드 테마. `[data-world="1|2|3"]`이 `--world`·`--world-ink`·`--world-soft`만 바꾼다
 * (§6 "같은 디자인 시스템 위에서 배경·지도만 교체"). 속성이 없으면 월드 1
 */
export const WORLD_THEMES: Record<
  WorldId,
  { tint: ColorName; ink: ColorName; soft: ColorName }
> = {
  1: { tint: 'w1', ink: 'w1Ink', soft: 'w1Soft' },
  2: { tint: 'w2', ink: 'w2Ink', soft: 'w2Soft' },
  3: { tint: 'w3', ink: 'w3Ink', soft: 'w3Soft' },
};

// ───────────────────────────── 글자

/** 글꼴 이름 (P2-10, docs/design/fonts.md). 폴백까지 포함한 스택은 globals.css의 `--font-display/sans/mono` */
export const FONT_FAMILY = {
  /** 제목·버튼·큰 숫자. 굵기 400 하나 */
  display: 'Jua',
  /** 본문 (Pretendard를 이름 바꾼 것) */
  sans: 'pyRoad Sans',
  /** 코드 (D2Coding을 이름 바꾼 것, 퀘스트 화면만) */
  mono: 'pyRoad Mono',
} as const;

/** 웹폰트가 없을 수 있는 곳(루트 오류 화면)의 시스템 글꼴 스택 */
export const SYSTEM_FONT_STACK =
  'system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

export interface TypeStep {
  /** px. CSS에는 rem(÷16)으로 쓴다 → 브라우저 글자 크기 설정을 따른다 */
  size: number;
  lineHeight: number;
  font: keyof typeof FONT_FAMILY;
  weight?: number;
  letterSpacing?: string;
}

/**
 * 타이포 스케일 (P0-14 §4.7 · 최종 시안 refine.css). Tailwind `text-<이름>`.
 * - 본문 17px · 행간 1.7 · 자간 0 · `word-break: keep-all` (globals.css body 기본값)
 * - 글자는 **14px(caption) 미만 금지**. Tailwind 기본 `text-xs`(12px)·`text-[10px]` 같은 값은 레거시라 `tokens:check`가 늘지 못하게 막는다
 * - Jua는 제목·버튼·큰 숫자만. 작은 이름표·눈썹 글자(kicker)는 본문 글꼴. Gaegu를 쓰지 않으므로 손글씨 1.15배 보정 없음
 * - HUD 숫자는 고정 폭: Jua에는 tnum이 없어 카운트업 때 흔들리므로 `.hud-num`(본문 글꼴 tabular-nums + min-width 3.2ch, 오른쪽 정렬)
 */
export const TYPE = {
  /** 랜딩 큰 제목. 600px 이상에서 `heroWide` */
  hero: {
    size: 34,
    lineHeight: 1.22,
    font: 'display',
    letterSpacing: '-0.01em',
  },
  heroWide: {
    size: 42,
    lineHeight: 1.22,
    font: 'display',
    letterSpacing: '-0.01em',
  },
  h1: { size: 28, lineHeight: 1.25, font: 'display' },
  h2: { size: 24, lineHeight: 1.3, font: 'display' },
  h3: { size: 19, lineHeight: 1.35, font: 'display' },
  /** 버튼 글자 (Jua) */
  button: { size: 18, lineHeight: 1, font: 'display' },
  buttonLg: { size: 20, lineHeight: 1, font: 'display' },
  body: { size: 17, lineHeight: 1.7, font: 'sans' },
  /** 보조 문단·말풍선 이름 */
  small: { size: 15, lineHeight: 1.6, font: 'sans' },
  /** 캡션·눈썹 글자 최소 크기 */
  caption: { size: 14, lineHeight: 1.5, font: 'sans' },
  /** 눈썹 글자: 본문 글꼴 650 굵기, 주색 글자 */
  kicker: {
    size: 14,
    lineHeight: 1.5,
    font: 'sans',
    weight: 650,
    letterSpacing: '0.02em',
  },
  /** 코드: D2Coding은 짝수 px에서만 한글 2칸이 정확히 맞는다 (P2-01) */
  code: { size: 16, lineHeight: 1.6, font: 'mono' },
} as const satisfies Record<string, TypeStep>;

export type TypeName = keyof typeof TYPE;

/** 글자 최소 크기 (px). 이보다 작은 글자는 금지 */
export const MIN_TEXT_PX = 14;

// ───────────────────────────── 모양

/** 반경 (px). 작은 칩·입력 10 · 카드·버튼 14 · 시트·큰 카드 20 · 원형 */
export const RADIUS = { s: 10, m: 14, l: 20, pill: 9999 } as const;

/** 그림자: 기본 한 종류(카드) + 떠 있는 층(시트·토스트·오버레이)만 */
export const SHADOW = {
  card: '0 1px 2px rgb(46 42 37 / 0.06), 0 4px 14px rgb(46 42 37 / 0.06)',
  pop: '0 12px 32px rgb(46 42 37 / 0.14)',
} as const;

/**
 * 선 (px). 버튼·카드·칩은 테두리 없음(면 + 아랫면 또는 그림자). 테두리는 입력·코드 상자 1px `lineStrong`만.
 * 일러스트·캐릭터 선은 면 색의 진한 톤 1px 안팎(리그 B `outline: 1.1`)
 */
export const LINE = {
  /** 입력·코드 상자 테두리, 구분선 */
  ui: 1,
  /** 버튼 아랫면 깊이 (눌리면 이만큼 내려감) */
  lip: 3,
  /** 키보드 포커스 링 두께와 간격 (색은 `secondary`) */
  focus: 2,
  focusOffset: 2,
} as const;

/** 간격 (px, 4px 단위). Tailwind `--spacing: 0.25rem`이라 `p-4` = 16px */
export const SPACE = {
  unit: 4,
  /** 쓰는 단계: 0.5·1·2·3·4·5·6·8·10·12·16 (×4px) */
  scale: [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64],
  /** 터치 타겟 최소 (Tailwind `min-h-touch`·`size-touch`) */
  touch: 48,
  /** 모바일 좌우 여백 (Tailwind `px-gutter`) */
  gutter: 16,
} as const;

// ───────────────────────────── CSS 변수 (globals.css와 같아야 함)

const kebab = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-z])([0-9])/g, '$1-$2')
    .toLowerCase();

/** 색 토큰의 CSS 변수 이름: `surface2` → `--surface-2`, `primaryText` → `--primary-text`, `w1Ink` → `--w1-ink` */
export function colorVarName(name: ColorName): string {
  return `--${kebab(name).replace(/^w-(\d)/, 'w$1')}`;
}

/** CSS 문자열을 받는 곳(CodeMirror 테마·인라인 style)에서 토큰 변수를 가리킨다: `cssVar('primary')` → `var(--primary)` */
export function cssVar(name: ColorName): string {
  return `var(${colorVarName(name)})`;
}

const rem = (px: number) => `${px / 16}rem`;

/** 연출 duration 변수: `--dur-fast` */
export const durVarName = (name: DurationName) => `--dur-${kebab(name)}`;
/** easing 변수: `--easing-in-out` (Tailwind `ease-*`는 @theme에서 이 변수를 가리킨다) */
export const easingVarName = (name: EasingName) => `--easing-${kebab(name)}`;
/** 스프링 `linear()` 변수: `--spring-jelly-b`, 길이는 `--spring-jelly-b-dur` */
export const springVarName = (name: SpringName) => `--spring-${kebab(name)}`;

/** shadcn/ui 변수 이름 → 새 토큰 (이름은 유지하고 값만 매핑) */
const SHADCN_ALIASES: Record<string, ColorName> = {
  '--background': 'bg',
  '--foreground': 'text',
  '--card': 'surface',
  '--card-foreground': 'text',
  '--popover': 'surface',
  '--popover-foreground': 'text',
  '--primary-foreground': 'onPrimary',
  '--secondary-foreground': 'onSecondary',
  '--muted': 'surface2',
  '--muted-foreground': 'textMuted',
  '--accent-foreground': 'onAccent',
  '--destructive': 'error',
  '--destructive-foreground': 'onError',
  '--success-foreground': 'onPrimary',
  '--border': 'line',
  '--input': 'lineStrong',
  '--ring': 'secondary',
};

/**
 * globals.css `:root`에 있어야 하는 변수 전부 (이름 → 값). 테스트가 양방향으로 비교한다:
 * `:root`에 여기 없는 변수가 있거나 값이 다르면 실패
 */
export function rootCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(COLOR)) {
    vars[colorVarName(name as ColorName)] = value;
  }
  for (const [alias, token] of Object.entries(SHADCN_ALIASES)) {
    vars[alias] = cssVar(token);
  }
  vars['--scrim'] = `rgb(46 42 37 / ${SCRIM.alpha})`;
  // 지금 월드 (속성이 없으면 1)
  vars['--world'] = cssVar(WORLD_THEMES[1].tint);
  vars['--world-ink'] = cssVar(WORLD_THEMES[1].ink);
  vars['--world-soft'] = cssVar(WORLD_THEMES[1].soft);
  // 모양
  vars['--round-s'] = `${RADIUS.s}px`;
  vars['--round-m'] = `${RADIUS.m}px`;
  vars['--round-l'] = `${RADIUS.l}px`;
  vars['--round-pill'] = `${RADIUS.pill}px`;
  vars['--radius'] = 'var(--round-m)';
  vars['--elev-card'] = SHADOW.card;
  vars['--elev-pop'] = SHADOW.pop;
  vars['--line-w'] = `${LINE.ui}px`;
  vars['--lip-h'] = `${LINE.lip}px`;
  vars['--focus-w'] = `${LINE.focus}px`;
  vars['--focus-offset'] = `${LINE.focusOffset}px`;
  // 모션
  for (const [name, ms] of Object.entries(DURATION)) {
    vars[durVarName(name as DurationName)] = `${ms}ms`;
  }
  for (const [name, css] of Object.entries(EASING)) {
    vars[easingVarName(name as EasingName)] = css;
  }
  for (const name of Object.keys(SPRINGS) as SpringName[]) {
    const t = springTiming(name);
    vars[springVarName(name)] = t.easing;
    vars[`${springVarName(name)}-dur`] = `${t.duration}ms`;
  }
  return vars;
}

/** `[data-world="N"]` 블록 (월드 2·3만 따로 둔다. 1은 :root 기본값과 같다) */
export function worldCssVars(id: WorldId): Record<string, string> {
  const t = WORLD_THEMES[id];
  return {
    '--world': cssVar(t.tint),
    '--world-ink': cssVar(t.ink),
    '--world-soft': cssVar(t.soft),
  };
}

/**
 * globals.css `@theme inline`에 있어야 하는 Tailwind 테마 변수 (글꼴 `--font-*`은 P2-10 소관이라 제외).
 * 모든 색 토큰은 `--color-<이름>`으로 Tailwind 클래스(`bg-surface-2`, `text-primary-text` …)가 된다
 */
export function themeCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of Object.keys(COLOR) as ColorName[]) {
    vars[`--color-${colorVarName(name).slice(2)}`] = cssVar(name);
  }
  for (const alias of Object.keys(SHADCN_ALIASES)) {
    vars[`--color-${alias.slice(2)}`] = `var(${alias})`;
  }
  vars['--color-scrim'] = 'var(--scrim)';
  vars['--color-world'] = 'var(--world)';
  vars['--color-world-ink'] = 'var(--world-ink)';
  vars['--color-world-soft'] = 'var(--world-soft)';
  // 반경: Tailwind 이름을 세 단계로 모은다 (sm·md = 10, lg·xl = 14, 2xl 이상 = 20)
  vars['--radius-sm'] = 'var(--round-s)';
  vars['--radius-md'] = 'var(--round-s)';
  vars['--radius-lg'] = 'var(--round-m)';
  vars['--radius-xl'] = 'var(--round-m)';
  vars['--radius-2xl'] = 'var(--round-l)';
  vars['--radius-3xl'] = 'var(--round-l)';
  vars['--radius-4xl'] = 'var(--round-l)';
  // 그림자: 기본 한 종류 + 떠 있는 층
  vars['--shadow-card'] = 'var(--elev-card)';
  vars['--shadow-pop'] = 'var(--elev-pop)';
  for (const k of ['2xs', 'xs', 'sm', 'md']) {
    vars[`--shadow-${k}`] = 'var(--elev-card)';
  }
  for (const k of ['lg', 'xl', '2xl']) vars[`--shadow-${k}`] = 'var(--elev-pop)';
  // 글자
  for (const [name, step] of Object.entries(TYPE) as [TypeName, TypeStep][]) {
    // 숫자는 붙인다: h1 → --text-h1
    const key = `--text-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
    vars[key] = rem(step.size);
    vars[`${key}--line-height`] = String(step.lineHeight);
    if (step.letterSpacing) {
      vars[`${key}--letter-spacing`] = step.letterSpacing;
    }
    if (step.weight) vars[`${key}--font-weight`] = String(step.weight);
  }
  // 간격
  vars['--spacing'] = rem(SPACE.unit);
  vars['--spacing-touch'] = rem(SPACE.touch);
  vars['--spacing-gutter'] = rem(SPACE.gutter);
  // 모션: Tailwind ease-* · transition 기본값
  for (const name of Object.keys(EASING) as EasingName[]) {
    vars[`--ease-${kebab(name)}`] = `var(${easingVarName(name)})`;
  }
  vars['--default-transition-duration'] = `var(${durVarName('fast')})`;
  vars['--default-transition-timing-function'] = `var(${easingVarName('out')})`;
  return vars;
}

/**
 * `@theme` 변수 이름에서 Tailwind 유틸리티 값 이름을 뽑는다: `--text-small` → `small`, `--shadow-card` → `card`.
 * `--text-small--line-height`처럼 `--`가 한 번 더 붙은 하위 값은 뺀다. `cn()`이 쓰는 `THEME_NAMES`(`./themeNames`)가
 * 이것과 같은지 테스트가 확인한다 (B44, P4-12)
 */
export function themeScale(
  prefix: string,
  vars: Record<string, string> = themeCssVars(),
): string[] {
  const head = `--${prefix}-`;
  return Object.keys(vars)
    .filter((k) => k.startsWith(head) && !k.slice(head.length).includes('--'))
    .map((k) => k.slice(head.length));
}

// ───────────────────────────── 대비 (WCAG 2.x)

/** text = 본문 4.5:1, large = 큰 글자(24px 또는 18.66px 굵게) 3:1, ui = 경계·아이콘·포커스 3:1 */
export type PairKind = 'text' | 'large' | 'ui';
export const CONTRAST_MIN: Record<PairKind, number> = {
  text: 4.5,
  large: 3,
  ui: 3,
};

export interface ContrastPair {
  fg: ColorName;
  /** 배경 토큰. `over`가 있으면 `bg`를 `over` 위에 `alpha`로 겹친 색 (Tailwind `bg-x/10` 같은 반투명 면) */
  bg: ColorName | 'scrim';
  over?: ColorName;
  alpha?: number;
  kind: PairKind;
  use: string;
}

/**
 * 글자를 얹는 모든 조합. `tokens.test.ts`가 AA 미달이면 실패시킨다.
 * 새 조합(새 배경 위 글자, 새 버튼)을 만들면 여기에 먼저 추가한다
 */
export const CONTRAST_PAIRS: ContrastPair[] = [
  { fg: 'text', bg: 'bg', kind: 'text', use: '본문' },
  { fg: 'text', bg: 'surface', kind: 'text', use: '카드 본문' },
  { fg: 'text', bg: 'surface2', kind: 'text', use: '보조 면 글자' },
  { fg: 'textMuted', bg: 'bg', kind: 'text', use: '보조 글자' },
  { fg: 'textMuted', bg: 'surface', kind: 'text', use: '카드 보조 글자' },
  { fg: 'textMuted', bg: 'surface2', kind: 'text', use: '보조 면 보조 글자' },
  { fg: 'primaryText', bg: 'bg', kind: 'text', use: '초록 글자·링크' },
  { fg: 'primaryText', bg: 'surface', kind: 'text', use: '카드 초록 글자' },
  { fg: 'primaryText', bg: 'surface2', kind: 'text', use: '보조 면 초록 글자' },
  {
    fg: 'primaryText',
    bg: 'primarySoft',
    kind: 'text',
    use: '초록 틴트 면 글자',
  },
  {
    fg: 'primaryText',
    bg: 'primary',
    over: 'bg',
    alpha: 0.1,
    kind: 'text',
    use: '초록 10% 면 글자 (bg-primary/10)',
  },
  { fg: 'text', bg: 'primarySoft', kind: 'text', use: '초록 틴트 면 본문' },
  { fg: 'onPrimary', bg: 'primary', kind: 'text', use: '주 버튼 글자' },
  { fg: 'onPrimary', bg: 'primaryLip', kind: 'text', use: '주 버튼 눌림(동작 줄이기)' },
  { fg: 'primary', bg: 'bg', kind: 'ui', use: '주 버튼 면 (배경 대비)' },
  { fg: 'primary', bg: 'surface', kind: 'ui', use: '주 버튼 면 (카드 위)' },
  { fg: 'onSecondary', bg: 'secondary', kind: 'text', use: '어두운 버튼 글자' },
  { fg: 'secondary', bg: 'bg', kind: 'ui', use: '포커스 링 (배경 위)' },
  { fg: 'secondary', bg: 'surface', kind: 'ui', use: '포커스 링 (카드 위)' },
  { fg: 'onAccent', bg: 'accent', kind: 'text', use: '금색 버튼·배지 글자' },
  { fg: 'onAccent', bg: 'accentLip', kind: 'text', use: '금색 버튼 눌림(동작 줄이기)' },
  { fg: 'accentText', bg: 'bg', kind: 'text', use: '금색 글자 (보상 수치)' },
  { fg: 'accentText', bg: 'surface', kind: 'text', use: '카드 금색 글자' },
  { fg: 'accentText', bg: 'accentSoft', kind: 'text', use: '경고·도장 글자' },
  { fg: 'text', bg: 'accentSoft', kind: 'text', use: '금색 틴트 면 본문' },
  {
    fg: 'onAccent',
    bg: 'accent',
    over: 'surface',
    alpha: 0.2,
    kind: 'text',
    use: '금색 20% 배지 글자 (bg-accent/20)',
  },
  { fg: 'success', bg: 'successSoft', kind: 'text', use: '성공 글자' },
  { fg: 'warning', bg: 'warningSoft', kind: 'text', use: '경고 글자' },
  { fg: 'error', bg: 'bg', kind: 'text', use: '오류 글자' },
  { fg: 'error', bg: 'surface', kind: 'text', use: '카드 오류 글자' },
  { fg: 'error', bg: 'errorSoft', kind: 'text', use: '오류 상자 글자' },
  {
    fg: 'error',
    bg: 'error',
    over: 'surface',
    alpha: 0.1,
    kind: 'text',
    use: '오류 10% 면 글자 (bg-destructive/10)',
  },
  { fg: 'onError', bg: 'error', kind: 'text', use: '위험 버튼 글자' },
  // 공통 컴포넌트 (P2-11, docs/design/components.md)
  { fg: 'text', bg: 'surfaceLip', kind: 'text', use: '흰 버튼 눌림(동작 줄이기)' },
  { fg: 'error', bg: 'surface2', kind: 'text', use: '위험 버튼 글자 (흰 면 위 보조 면)' },
  { fg: 'text', bg: 'successSoft', kind: 'text', use: '토스트·말풍선 (좋아요)' },
  { fg: 'text', bg: 'warningSoft', kind: 'text', use: '토스트 (주의)' },
  { fg: 'text', bg: 'errorSoft', kind: 'text', use: '토스트·말풍선 (버그)' },
  { fg: 'lineStrong', bg: 'surface', kind: 'ui', use: '입력 경계' },
  { fg: 'lineStrong', bg: 'bg', kind: 'ui', use: '입력 경계 (배경 위)' },
  {
    fg: 'onScrim',
    bg: 'scrim',
    over: 'surface',
    kind: 'text',
    use: '덮개 위 글자 (흰 화면 위, 가장 나쁜 경우)',
  },
  { fg: 'w1Ink', bg: 'w1Soft', kind: 'text', use: '월드 1 표지 글자' },
  { fg: 'text', bg: 'w1Soft', kind: 'text', use: '월드 1 바탕 본문' },
  { fg: 'w2Ink', bg: 'w2Soft', kind: 'text', use: '월드 2 표지 글자' },
  { fg: 'text', bg: 'w2Soft', kind: 'text', use: '월드 2 바탕 본문' },
  { fg: 'w3Ink', bg: 'w3Soft', kind: 'text', use: '월드 3 표지 글자' },
  { fg: 'text', bg: 'w3Soft', kind: 'text', use: '월드 3 바탕 본문' },
  { fg: 'codeText', bg: 'codeBg', kind: 'text', use: '코드 글자' },
  { fg: 'codeComment', bg: 'codeBg', kind: 'text', use: '코드 주석' },
  { fg: 'codeKeyword', bg: 'codeBg', kind: 'text', use: '코드 키워드' },
  { fg: 'codeString', bg: 'codeBg', kind: 'text', use: '코드 문자열' },
  { fg: 'textMuted', bg: 'surface2', kind: 'text', use: '코드 줄 번호' },
  // 퀴즈 (P7-13): 흰 칩·빈칸·상태 면 위 코드 글자, 빈 빈칸 번호, 정답 동그라미
  { fg: 'codeText', bg: 'surface', kind: 'text', use: '퀴즈 낱말 칩·빈칸 코드' },
  { fg: 'codeString', bg: 'surface', kind: 'text', use: '퀴즈 보기 코드 문자열' },
  { fg: 'codeText', bg: 'successSoft', kind: 'text', use: '퀴즈 정답 빈칸·줄 코드' },
  { fg: 'codeText', bg: 'accentSoft', kind: 'text', use: '퀴즈 틀린 빈칸·줄 코드' },
  { fg: 'textMuted', bg: 'codeBg', kind: 'text', use: '퀴즈 빈 빈칸 번호' },
  { fg: 'onPrimary', bg: 'success', kind: 'ui', use: '퀴즈 정답 체크 동그라미' },
  { fg: 'success', bg: 'surface', kind: 'ui', use: '퀴즈 정답 테' },
];

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
};

const toHex = (rgb: number[]) =>
  '#' +
  rgb
    .map((c) =>
      Math.round(c)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase(),
    )
    .join('');

/** `top`을 `alpha` 불투명도로 `under` 위에 겹친 색 (sRGB 단순 합성) */
export function blend(top: string, under: string, alpha: number): string {
  const a = hexToRgb(top);
  const b = hexToRgb(under);
  return toHex(a.map((c, i) => c * alpha + b[i] * (1 - alpha)));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** 조합의 실제 배경색 (반투명 면은 아래 색과 합성) */
export function pairBackground(p: ContrastPair): string {
  if (p.bg === 'scrim') {
    return blend(SCRIM.color, COLOR[p.over ?? 'bg'], SCRIM.alpha);
  }
  if (p.over) return blend(COLOR[p.bg], COLOR[p.over], p.alpha ?? 1);
  return COLOR[p.bg];
}

export function pairContrast(p: ContrastPair): number {
  return contrastRatio(COLOR[p.fg], pairBackground(p));
}

/** 표시용: 소수 둘째 자리에서 내림 (반올림하면 4.496이 4.50으로 보여 통과처럼 읽힌다) */
export function fmtRatio(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}
