// 최종 시안 토큰 (P2-07, 사용자 리뷰 1차 §12-Q28 반영 → P2-09 입력)
// - 시안 B의 따뜻한 팔레트는 유지하고 잉크를 가볍게: 글자는 따뜻한 짙은 갈색, 선은 회갈색(장식) / 경계선만 3:1
// - 제목 Jua 400(보정 배율 1), 본문 Pretendard(pyRoad Sans) 17px·1.7, 코드 D2Coding
// - shared/tokens.ts의 B 값을 mountPrototype 뒤에 덮어쓴다 (같은 CSS 변수 이름)
import { FONT_STACK } from '../shared/tokens';

export const FINAL = {
  bg: '#FAF5EA', // 크림 종이
  surface: '#FFFDF8',
  surface2: '#F2EADB', // 보조 면 (테두리 없이 면 색으로 구분)
  line: '#E7DDCB', // 장식 구분선
  lineStrong: '#8F7F6B', // 입력·탭 경계 (UI 3:1)
  text: '#3E342B',
  textMuted: '#6B5F53',
  primary: '#4A7330',
  onPrimary: '#FFFDF8',
  primaryLip: '#3A5C25',
  primaryText: '#466E2D',
  primaryBright: '#9CCB80',
  secondary: '#2F6A90',
  onSecondary: '#FFFDF8',
  secondaryLip: '#245271',
  accent: '#D9774F',
  accentText: '#A4452A',
  highlight: '#F2C14E',
  onHighlight: '#3E342B',
  success: '#456B2C',
  successSoft: '#EAF2DC',
  warning: '#855608',
  warningSoft: '#FAEBC8',
  error: '#A3372B',
  errorSoft: '#F9E2D9',
  w1: '#8DB86B',
  w1Ink: '#4A7330',
  w1Soft: '#EEF4E1',
  w2: '#7FB3D1',
  w2Ink: '#2F6A90',
  w2Soft: '#E6F0F5',
  w3: '#C98A4B',
  w3Ink: '#86501F',
  w3Soft: '#F7EBD9',
  codeBg: '#FFFDF8',
  codeText: '#3E342B',
  codeComment: '#6E5D4C',
  codeKeyword: '#874079',
  codeString: '#A4452A',
  codeNumber: '#2F6A90',
  codeFunc: '#466E2D',
} as const;

/** 선: UI 경계 1.5px 회갈색, 일러스트 1.6px (B 1차는 2~2.4px 잉크 갈색) */
export const INK = { ui: '#8C7C69', art: '#7A6A59', face: '#3E342B', uiWidth: 1.5, artWidth: 1.6 };

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function applyFinalTokens() {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(FINAL)) r.setProperty(`--c-${kebab(k)}`, v);
  r.setProperty('--font-display', FONT_STACK.jua);
  r.setProperty('--font-body', FONT_STACK.sans);
  r.setProperty('--display-weight', '400');
  r.setProperty('--display-scale', '1');
  r.setProperty('--body-lh', '1.7');
  r.setProperty('--f-ink', INK.ui);
  r.setProperty('--f-art', INK.art);
  r.setProperty('--f-lw', `${INK.uiWidth}px`);
}
