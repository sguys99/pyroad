// 시안 A·B·A×B 디자인 토큰 초안 (P2-01 무드보드 → P2-09에서 확정)
// - 세 시안이 **같은 토큰 이름**을 쓰고 값만 다르다. 시안 코드는 hex를 직접 쓰지 말고 CSS 변수(--c-*)를 쓴다.
// - 대비 표는 `npm run contrast`(scripts/contrast.mjs)가 이 파일의 PAIRS로 계산한다.
import type { PairKind } from './contrast';

export type Concept = 'A' | 'B' | 'AB';
export const CONCEPTS: Concept[] = ['A', 'B', 'AB'];
export const CONCEPT_NAME: Record<Concept, string> = { A: '모험 섬', B: '마법 그림책', AB: '모험 그림책 (A×B)' };

export const TOKEN_NAMES = [
  'bg', 'surface', 'surface2', 'line', 'lineStrong', 'text', 'textMuted',
  'primary', 'onPrimary', 'primaryLip', 'primaryText', 'primaryBright',
  'secondary', 'onSecondary', 'secondaryLip',
  'accent', 'accentText', 'highlight', 'onHighlight',
  'success', 'successSoft', 'warning', 'warningSoft', 'error', 'errorSoft',
  'w1', 'w1Ink', 'w1Soft', 'w2', 'w2Ink', 'w2Soft', 'w3', 'w3Ink', 'w3Soft',
  'codeBg', 'codeText', 'codeComment', 'codeKeyword', 'codeString', 'codeNumber', 'codeFunc',
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

/** 토큰 쓰임: bg/text는 글자 조합, fill은 글자를 얹는 채움, decor는 글자를 얹지 않는 장식 전용 */
export const TOKEN_ROLE: Record<TokenName, { label: string; role: 'bg' | 'text' | 'fill' | 'decor' | 'ui' }> = {
  bg: { label: '배경', role: 'bg' },
  surface: { label: '표면 (카드)', role: 'bg' },
  surface2: { label: '표면 2 (칸·입력)', role: 'bg' },
  line: { label: '구분선 (장식)', role: 'decor' },
  lineStrong: { label: '경계선 (입력·탭)', role: 'ui' },
  text: { label: '글자', role: 'text' },
  textMuted: { label: '보조 글자', role: 'text' },
  primary: { label: '주색 (버튼)', role: 'fill' },
  onPrimary: { label: '주색 위 글자', role: 'text' },
  primaryLip: { label: '주색 버튼 아랫면', role: 'decor' },
  primaryText: { label: '주색 글자', role: 'text' },
  primaryBright: { label: '밝은 초록 (장식)', role: 'decor' },
  secondary: { label: '보조색 (버튼)', role: 'fill' },
  onSecondary: { label: '보조색 위 글자', role: 'text' },
  secondaryLip: { label: '보조색 버튼 아랫면', role: 'decor' },
  accent: { label: '포인트 (장식)', role: 'decor' },
  accentText: { label: '포인트 글자', role: 'text' },
  highlight: { label: '하이라이트 (별·코인)', role: 'fill' },
  onHighlight: { label: '하이라이트 위 글자', role: 'text' },
  success: { label: '성공', role: 'text' },
  successSoft: { label: '성공 바탕', role: 'bg' },
  warning: { label: '경고', role: 'text' },
  warningSoft: { label: '경고 바탕', role: 'bg' },
  error: { label: '오류', role: 'text' },
  errorSoft: { label: '오류 바탕', role: 'bg' },
  w1: { label: '월드 1 테마 (장식)', role: 'decor' },
  w1Ink: { label: '월드 1 진한색', role: 'fill' },
  w1Soft: { label: '월드 1 바탕', role: 'bg' },
  w2: { label: '월드 2 테마 (장식)', role: 'decor' },
  w2Ink: { label: '월드 2 진한색', role: 'fill' },
  w2Soft: { label: '월드 2 바탕', role: 'bg' },
  w3: { label: '월드 3 테마 (장식)', role: 'decor' },
  w3Ink: { label: '월드 3 진한색', role: 'fill' },
  w3Soft: { label: '월드 3 바탕', role: 'bg' },
  codeBg: { label: '코드 바탕', role: 'bg' },
  codeText: { label: '코드 글자', role: 'text' },
  codeComment: { label: '코드 주석', role: 'text' },
  codeKeyword: { label: '코드 키워드', role: 'text' },
  codeString: { label: '코드 문자열', role: 'text' },
  codeNumber: { label: '코드 숫자', role: 'text' },
  codeFunc: { label: '코드 함수', role: 'text' },
};

export type Palette = Record<TokenName, string>;

/** 이름 붙인 색 (팔레트 견본에 같이 보여 준다) */
export const COLOR_NAMES: Record<Concept, Partial<Record<TokenName, string>>> = {
  A: {
    bg: '하늘 안개', text: '밤바다 남색', primary: '섬 초록', primaryBright: '클레이 연두', secondary: '물보라 파랑',
    accent: '코랄', highlight: '레몬', w1: '초록 섬', w2: '바다·하늘 섬', w3: '메이커 시티',
  },
  B: {
    bg: '그림책 종이', surface: '새 종이', text: '잉크 갈색', primary: '올리브', primaryBright: '세이지',
    secondary: '물빛 파랑', accent: '테라코타', highlight: '겨자', w1: '숲 마을', w2: '바다 여행', w3: '발명가의 공방',
  },
  AB: {
    bg: '햇살 종이', text: '남색 잉크', primary: '모험 초록', primaryBright: '수채 연두', secondary: '하늘 파랑',
    accent: '과슈 코랄', highlight: '레몬', w1: '초록 섬', w2: '바다·하늘 섬', w3: '공방 섬',
  },
};

export const PALETTES: Record<Concept, Palette> = {
  // A 모험 섬: 비비드 파스텔(민트·코랄·레몬·스카이) + 흰 하이라이트, 차가운 하늘 바탕
  A: {
    bg: '#EEF8FF', surface: '#FFFFFF', surface2: '#DDF1FC', line: '#C6E2F3', lineStrong: '#5F86A3',
    text: '#1B2F45', textMuted: '#4A6179',
    primary: '#1B7F37', onPrimary: '#FFFFFF', primaryLip: '#0E5A25', primaryText: '#187A35', primaryBright: '#4CD07D',
    secondary: '#1F72B8', onSecondary: '#FFFFFF', secondaryLip: '#13508A',
    accent: '#FF7A6B', accentText: '#BE3A2B', highlight: '#FFD84D', onHighlight: '#1B2F45',
    success: '#0D7653', successSoft: '#D9F6EA', warning: '#935400', warningSoft: '#FFF0CC', error: '#C02E3A', errorSoft: '#FFE4E4',
    w1: '#4CC46E', w1Ink: '#1B7F37', w1Soft: '#E9F9EC',
    w2: '#4DB8F0', w2Ink: '#0B6CA3', w2Soft: '#DCF1FD',
    w3: '#FF9E3D', w3Ink: '#A84A00', w3Soft: '#FFEBD6',
    codeBg: '#F5FAFF', codeText: '#1B2F45', codeComment: '#56697D', codeKeyword: '#8A3FCF', codeString: '#B4432B',
    codeNumber: '#0B6CA3', codeFunc: '#187A35',
  },
  // B 마법 그림책: 크림·올리브·테라코타·물빛 블루, 종이 질감, 잉크 갈색 글자
  B: {
    bg: '#F8F1E3', surface: '#FFFBF2', surface2: '#F1E6CF', line: '#DDCCAA', lineStrong: '#8A7356',
    text: '#3B2F25', textMuted: '#67564A',
    primary: '#4A7330', onPrimary: '#FFFBF2', primaryLip: '#33521F', primaryText: '#466E2D', primaryBright: '#9CCB80',
    secondary: '#2F6A90', onSecondary: '#FFFBF2', secondaryLip: '#204B67',
    accent: '#D9774F', accentText: '#A4452A', highlight: '#F2C14E', onHighlight: '#3B2F25',
    success: '#456B2C', successSoft: '#E7EFD5', warning: '#855608', warningSoft: '#F8E6BF', error: '#A3372B', errorSoft: '#F7DDD3',
    w1: '#8DB86B', w1Ink: '#4A7330', w1Soft: '#EAF1DA',
    w2: '#7FB3D1', w2Ink: '#2F6A90', w2Soft: '#E2EEF4',
    w3: '#C98A4B', w3Ink: '#86501F', w3Soft: '#F5E4CD',
    codeBg: '#FFFBF2', codeText: '#3B2F25', codeComment: '#6E5D4C', codeKeyword: '#874079', codeString: '#A4452A',
    codeNumber: '#2F6A90', codeFunc: '#466E2D',
  },
  // A×B: B의 따뜻한 종이 바탕 + A의 선명한 과슈 색, 남색 잉크 글자
  AB: {
    bg: '#FFF4DF', surface: '#FFFCF3', surface2: '#FBEACB', line: '#EED8B0', lineStrong: '#8C7452',
    text: '#24324A', textMuted: '#55607A',
    primary: '#217A35', onPrimary: '#FFFFFF', primaryLip: '#145424', primaryText: '#1F7633', primaryBright: '#5CCB7A',
    secondary: '#1F70B5', onSecondary: '#FFFFFF', secondaryLip: '#144F85',
    accent: '#FF7F66', accentText: '#BA3F2B', highlight: '#FFD24D', onHighlight: '#24324A',
    success: '#1A7350', successSoft: '#DBF3E4', warning: '#8F5400', warningSoft: '#FFEBC2', error: '#BC3240', errorSoft: '#FFE1DC',
    w1: '#6CC77F', w1Ink: '#217A35', w1Soft: '#E4F5DE',
    w2: '#6EC1EA', w2Ink: '#126BA0', w2Soft: '#DFF0F8',
    w3: '#F4A04B', w3Ink: '#A04C0A', w3Soft: '#FDE7CC',
    codeBg: '#FFFCF3', codeText: '#24324A', codeComment: '#5E6782', codeKeyword: '#8540BD', codeString: '#B4432B',
    codeNumber: '#126BA0', codeFunc: '#1F7633',
  },
};

/** 지금 앱 브랜드 초록 (P0-13: 3.4~3.6:1 미달) */
export const LEGACY_GREEN = '#31983d';

export interface Pair {
  fg: TokenName;
  bg: TokenName;
  kind: PairKind;
  use: string;
}

/** 대비를 확인할 모든 글자/배경·버튼 글자/버튼 배경 조합 (세 시안 공통) */
export const PAIRS: Pair[] = [
  { fg: 'text', bg: 'bg', kind: 'text', use: '본문' },
  { fg: 'text', bg: 'surface', kind: 'text', use: '카드 본문' },
  { fg: 'text', bg: 'surface2', kind: 'text', use: '칸·입력 글자' },
  { fg: 'textMuted', bg: 'bg', kind: 'text', use: '보조 글자' },
  { fg: 'textMuted', bg: 'surface', kind: 'text', use: '카드 보조 글자' },
  { fg: 'textMuted', bg: 'surface2', kind: 'text', use: '칸 보조 글자' },
  { fg: 'primaryText', bg: 'bg', kind: 'text', use: '초록 글자·링크' },
  { fg: 'primaryText', bg: 'surface', kind: 'text', use: '카드 초록 글자' },
  { fg: 'onPrimary', bg: 'primary', kind: 'text', use: '주 버튼 글자' },
  { fg: 'primary', bg: 'bg', kind: 'ui', use: '주 버튼 경계 (배경 대비)' },
  { fg: 'primary', bg: 'surface', kind: 'ui', use: '주 버튼 경계 (카드 위)' },
  { fg: 'onSecondary', bg: 'secondary', kind: 'text', use: '보조 버튼 글자' },
  { fg: 'accentText', bg: 'bg', kind: 'text', use: '포인트 글자' },
  { fg: 'accentText', bg: 'surface', kind: 'text', use: '카드 포인트 글자' },
  { fg: 'onHighlight', bg: 'highlight', kind: 'text', use: '하이라이트 배지 글자' },
  { fg: 'lineStrong', bg: 'surface', kind: 'ui', use: '입력·탭 경계' },
  { fg: 'lineStrong', bg: 'bg', kind: 'ui', use: '경계 (배경 위)' },
  { fg: 'success', bg: 'successSoft', kind: 'text', use: '성공 안내' },
  { fg: 'success', bg: 'surface', kind: 'text', use: '성공 글자' },
  { fg: 'warning', bg: 'warningSoft', kind: 'text', use: '경고 안내' },
  { fg: 'warning', bg: 'surface', kind: 'text', use: '경고 글자' },
  { fg: 'error', bg: 'errorSoft', kind: 'text', use: '오류 안내' },
  { fg: 'error', bg: 'surface', kind: 'text', use: '오류 글자' },
  { fg: 'onPrimary', bg: 'w1Ink', kind: 'text', use: '월드 1 버튼 글자' },
  { fg: 'w1Ink', bg: 'w1Soft', kind: 'text', use: '월드 1 바탕 위 제목' },
  { fg: 'text', bg: 'w1Soft', kind: 'text', use: '월드 1 바탕 본문' },
  { fg: 'onPrimary', bg: 'w2Ink', kind: 'text', use: '월드 2 버튼 글자' },
  { fg: 'w2Ink', bg: 'w2Soft', kind: 'text', use: '월드 2 바탕 위 제목' },
  { fg: 'text', bg: 'w2Soft', kind: 'text', use: '월드 2 바탕 본문' },
  { fg: 'onPrimary', bg: 'w3Ink', kind: 'text', use: '월드 3 버튼 글자' },
  { fg: 'w3Ink', bg: 'w3Soft', kind: 'text', use: '월드 3 바탕 위 제목' },
  { fg: 'text', bg: 'w3Soft', kind: 'text', use: '월드 3 바탕 본문' },
  { fg: 'codeText', bg: 'codeBg', kind: 'text', use: '코드' },
  { fg: 'codeComment', bg: 'codeBg', kind: 'text', use: '코드 주석' },
  { fg: 'codeKeyword', bg: 'codeBg', kind: 'text', use: '코드 키워드' },
  { fg: 'codeString', bg: 'codeBg', kind: 'text', use: '코드 문자열' },
  { fg: 'codeNumber', bg: 'codeBg', kind: 'text', use: '코드 숫자' },
  { fg: 'codeFunc', bg: 'codeBg', kind: 'text', use: '코드 함수' },
];

// ───────────── 타이포 (P0-14 §4.7)

export const FONT_STACK = {
  /** 빌드가 서브셋을 인라인하는 이름. Pretendard는 OFL 예약 이름 때문에 서브셋 이름을 바꿨다 */
  sans: "'pyRoad Sans', 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', system-ui, sans-serif",
  mono: "'pyRoad Mono', D2Coding, 'NanumGothicCoding', 'Nanum Gothic Coding', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  jua: "'Jua', 'pyRoad Sans', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
  gaegu: "'Gaegu', 'Gowun Dodum', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
  gowun: "'Gowun Dodum', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
};

export interface TypeSpec {
  display: string;
  body: string;
  mono: string;
  /** 제목 굵기 (Jua는 400 하나, Gaegu는 700) */
  displayWeight: number;
  /** 손글씨 제목 보정 배율 (Gaegu는 같은 px에서 작게 보여 1.15배) */
  displayScale: number;
  bodyLineHeight: number;
  /** 강조 방법: Gowun Dodum은 400 하나라 굵게가 가짜(합성) → 색·밑줄 */
  emphasis: 'bold' | 'color';
}

export const TYPE: Record<Concept, TypeSpec> = {
  A: { display: FONT_STACK.jua, body: FONT_STACK.sans, mono: FONT_STACK.mono, displayWeight: 400, displayScale: 1, bodyLineHeight: 1.7, emphasis: 'bold' },
  B: { display: FONT_STACK.gaegu, body: FONT_STACK.gowun, mono: FONT_STACK.mono, displayWeight: 700, displayScale: 1.15, bodyLineHeight: 1.8, emphasis: 'color' },
  AB: { display: FONT_STACK.gaegu, body: FONT_STACK.sans, mono: FONT_STACK.mono, displayWeight: 700, displayScale: 1.15, bodyLineHeight: 1.7, emphasis: 'bold' },
};

/** 글자 크기 단계 (px, A 기준. 손글씨 제목은 displayScale을 곱한다) */
export const TYPE_SCALE = {
  hero: 44, // 랜딩 큰 제목 (모바일 34)
  h1: 32,
  h2: 26,
  h3: 21,
  button: 20, // 큰 게임 버튼 (손글씨는 ×1.15 ≈ 23~24)
  bodyLg: 18, // 튜터 대사·긴 설명
  body: 17, // 본문 기본 (최소 16)
  caption: 14, // 캡션 최소
  hud: 20, // HUD 숫자 (고정 폭 상자)
  code: 16, // 에디터 기본 (14~20 조절, 행간 1.6)
};

// ───────────── 모션 (리그 SPRING과 같은 값, P0-07 params.ts)

export interface Spring {
  k: number;
  c: number;
}
/** 질량 1. ζ = c / (2√k) */
export const SPRINGS = {
  face: { k: 420, c: 34 }, // ζ≈0.83 거의 안 튐: 눌림 복귀, 탭 전환
  body: { k: 200, c: 19 }, // ζ≈0.67 살짝 튐: 카드 등장, 스탬프 안착
  envelope: { k: 60, c: 15 }, // ζ≈0.97 천천히: 페이드·하이라이트
  prop: { k: 170, c: 13 }, // ζ≈0.50 통통: 코인·별·배지 팝
  jellyA: { k: 520, c: 10 }, // ζ≈0.22 A 젤리 (리그 착지 출렁임)
  jellyAB: { k: 500, c: 16 }, // ζ≈0.36 A×B 젤리 (A보다 덜)
  jellyB: { k: 480, c: 24 }, // ζ≈0.55 B 묵직 (리그 B)
} satisfies Record<string, Spring>;
export type SpringName = keyof typeof SPRINGS;

export const DURATION = { instant: 80, fast: 140, base: 220, slow: 360, page: 700, celebrate: 1200 };
export const EASING = {
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  press: 'cubic-bezier(0.3, 0, 0.5, 1)',
  backOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  stampIn: 'cubic-bezier(0.55, 0, 0.9, 0.3)',
  ink: 'cubic-bezier(0.2, 0.7, 0.3, 1)',
  page: 'cubic-bezier(0.45, 0.05, 0.25, 1)',
};

/** 팔레트·타이포를 CSS 변수 문자열로 (시안 루트 요소의 style 또는 :root에) */
export function cssVars(concept: Concept): Record<string, string> {
  const p = PALETTES[concept];
  const t = TYPE[concept];
  const out: Record<string, string> = {};
  for (const k of TOKEN_NAMES) out[`--c-${kebab(k)}`] = p[k];
  out['--font-display'] = t.display;
  out['--font-body'] = t.body;
  out['--font-mono'] = t.mono;
  out['--display-weight'] = String(t.displayWeight);
  out['--display-scale'] = String(t.displayScale);
  out['--body-lh'] = String(t.bodyLineHeight);
  return out;
}

export function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}
