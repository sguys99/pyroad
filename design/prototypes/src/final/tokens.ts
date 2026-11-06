// 최종 시안 토큰 (P2-07 2차 수정 → P2-09 입력)
// 1차(§12-Q28): B의 따뜻한 팔레트 + 잉크 가볍게. 2차(사용자 의견 "바탕 난잡·선 투박·색 너무 다양"):
// - 바탕은 평평한 단색(종이 결·섬유·수채 없음). 표면은 아주 옅은 톤 차이와 여백으로 구분
// - 색은 중립 5단계 + 주색 하나(브랜드 초록) + 강조색 하나(따뜻한 금색: 보상·도장·하이라이트) + 의미색(성공·오류·경고)
//   · secondary(파랑)·accent(주황)·highlight(겨자)를 따로 두지 않는다: secondary = 짙은 중립(포커스 링·보조 글자색),
//     accent·highlight = 금색 하나, warning = 금색 계열 글자
//   · 월드 테마색 w1~w3는 지도·표지의 아주 옅은 틴트로만 (화면 전체를 칠하지 않음)
// - 제목 Jua 400, 본문 Pretendard(pyRoad Sans) 17px·1.7, 코드 D2Coding
// - shared/tokens.ts의 B 값을 mountPrototype 뒤에 덮어쓴다 (같은 CSS 변수 이름)
import { FONT_STACK } from '../shared/tokens';

export const FINAL = {
  // 중립
  bg: '#F6F4EF', // 단색 바탕 (따뜻한 오프화이트, 종이 결 없음)
  surface: '#FFFFFF', // 카드·시트
  surface2: '#EFECE5', // 보조 면 (칩·결과 상자·눌린 탭)
  line: '#E5E1D9', // 장식 구분선 (글자·경계 의미 없음)
  lineStrong: '#8E877C', // 입력 경계 (UI 3:1)
  text: '#2E2A25',
  textMuted: '#6B645B',
  // 주색: 브랜드 초록 하나
  primary: '#3E7B3A',
  onPrimary: '#FFFFFF',
  primaryLip: '#2F5F2C', // 버튼 아랫면 (장식)
  primaryText: '#3A7336', // 초록 글자 (bg·surface·surface2·primarySoft 위 AA)
  primaryBright: '#A9D38F', // 장식 전용 (진행 막대 끝·지도 길)
  primarySoft: '#E8F0E3', // 초록 틴트 면 (해 볼 일·성공 말풍선)
  secondary: '#2E2A25', // 파랑 없음 → 짙은 중립 (포커스 링)
  onSecondary: '#FFFFFF',
  secondaryLip: '#000000',
  // 강조색: 따뜻한 금색 하나 (별·코인·도장·형광펜·"지금 여기")
  accent: '#F0B43C', // 장식 전용 (글자 얹으면 text만)
  accentText: '#8A5A00', // 금색 계열 글자 (도장·보상 수치·경고)
  accentSoft: '#FBF1DC',
  highlight: '#F0B43C', // = accent (따로 두지 않음)
  onHighlight: '#2E2A25',
  // 의미색
  success: '#3A7336', // = primaryText
  successSoft: '#E8F0E3',
  warning: '#8A5A00', // = accentText
  warningSoft: '#FBF1DC',
  error: '#B3402F',
  errorSoft: '#FBEAE6',
  // 월드 틴트 (지도·표지 배경에만, 아주 옅게)
  w1: '#A9CF94',
  w1Ink: '#3A7336',
  w1Soft: '#EDF3E8',
  w2: '#B4C8D2',
  w2Ink: '#6B645B', // 글자는 중립 (칩·배지마다 다른 색 금지)
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

/**
 * 선 규칙 (2차): 외곽선은 "면 색의 진한 톤 1px 안팎" 또는 없음.
 * - UI: 버튼·카드·칩은 테두리 없음(면 + 얕은 깊이). 입력·코드 상자만 1px `lineStrong`(3:1)
 * - 일러스트: 면마다 그 면 색을 어둡게 한 선 1px(art.tsx `tone()`), 세부 선은 `art` 회갈색 1px
 * - 캐릭터: 앱 리그 B 스타일(외곽선 1.1, 캐릭터 몸색의 진한 톤, 눈·입은 짙게)
 */
export const INK = { ui: '#E5E1D9', art: '#9A9184', face: '#2E2A25', uiWidth: 1, artWidth: 1 };

/** 반경·그림자 (2차: 한 벌로 통일) */
export const SHAPE = { rS: '10px', r: '14px', rL: '20px', pill: '999px' };
export const SHADOW = '0 1px 2px rgba(46, 42, 37, 0.06), 0 4px 14px rgba(46, 42, 37, 0.06)';

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
  // 바탕 질감 없음 (1차의 --b-grain·--b-fiber 타일을 비운다: 남은 background-image 선언이 none이 됨)
  r.setProperty('--b-grain', 'none');
  r.setProperty('--b-fiber', 'none');
  r.setProperty('--b-shadow', SHADOW);
  r.setProperty('--b-r', SHAPE.r);
  r.setProperty('--b-r-s', SHAPE.rS);
}
