import { Scene, type TurtleCommand } from './scene';

/** 대체 글에 쓰는 색 이름 (shim의 한글 색 이름을 거꾸로 + 자주 쓰는 CSS 이름) */
const KO_COLOR: Record<string, string> = {
  red: '빨강',
  orange: '주황',
  yellow: '노랑',
  green: '초록',
  yellowgreen: '연두',
  blue: '파랑',
  skyblue: '하늘색',
  navy: '남색',
  purple: '보라',
  pink: '분홍',
  black: '검정',
  white: '하양',
  gray: '회색',
  grey: '회색',
  brown: '갈색',
  gold: '금색',
  silver: '은색',
  cyan: '청록',
  aqua: '청록',
  teal: '청록',
  turquoise: '청록',
  magenta: '자주',
  fuchsia: '자주',
  violet: '보라',
  indigo: '남색',
  orchid: '연보라',
  lavender: '연보라',
  plum: '연보라',
  lime: '연두',
  limegreen: '연두',
  lawngreen: '연두',
  chartreuse: '연두',
  olive: '올리브색',
  seagreen: '바다 초록',
  forestgreen: '숲 초록',
  springgreen: '초록',
  maroon: '밤색',
  crimson: '진한 빨강',
  firebrick: '벽돌색',
  tomato: '토마토색',
  coral: '산호색',
  salmon: '연어색',
  hotpink: '분홍',
  beige: '베이지색',
  ivory: '상아색',
  khaki: '카키색',
  tan: '연한 갈색',
  chocolate: '초콜릿색',
  sienna: '갈색',
  peru: '갈색',
  royalblue: '파랑',
  dodgerblue: '파랑',
  steelblue: '파랑',
  cornflowerblue: '파랑',
  slategray: '푸른 회색',
  slateblue: '보랏빛 파랑',
  snow: '하양',
};

/** CSS 색 이름 앞말 (darkred → 진한 빨강, dimgray → 어두운 회색) */
const KO_SHADE: [string, string][] = [
  ['dark', '진한 '],
  ['deep', '진한 '],
  ['dim', '어두운 '],
  ['light', '연한 '],
  ['pale', '연한 '],
  ['medium', ''],
];

/** 색 문자열 → 쉬운 한글 이름. 직접 고른 색(#코드·숫자)과 모르는 이름은 뭉뚱그린다 */
export function koColorName(color: string): string {
  const c = color.trim().toLowerCase();
  if (KO_COLOR[c]) return KO_COLOR[c];
  for (const [prefix, ko] of KO_SHADE) {
    const base = c.startsWith(prefix) ? KO_COLOR[c.slice(prefix.length)] : '';
    if (base) return ko + base;
  }
  return /^[a-z]+$/.test(c) ? '그 밖의 색' : '직접 고른 색';
}

export interface DrawingSummary {
  turtles: number;
  lines: number;
  fills: number;
  dots: number;
  texts: string[];
  colors: string[];
  title: string | null;
}

/**
 * 명령 스트림 → 그림 요약 (캔버스의 대체 글, 낭독기용). 화면 지우기(`clear()`/`clearscreen()`) 뒤부터 센다.
 * shortcut: 거북이 하나만 지우는 `t.clear()`는 세는 값에서 빼지 않음, 정확한 수가 필요하면 표시 목록에서 세기
 */
export function summarizeDrawing(
  commands: readonly TurtleCommand[],
): DrawingSummary {
  const scene = new Scene();
  let s: DrawingSummary = blank();
  const colors = new Set<string>();
  for (const c of commands) {
    const op = scene.apply(c);
    switch (op.k) {
      case 'new':
        s.turtles++;
        break;
      case 'move':
        if (op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1)) {
          s.lines++;
          colors.add(op.color);
        }
        break;
      case 'endFill':
        if (op.points) {
          s.fills++;
          colors.add(op.color);
        }
        break;
      case 'dot':
        s.dots++;
        colors.add(op.color);
        break;
      case 'text':
        if (op.text.trim()) s.texts.push(op.text.trim());
        break;
      case 'clearScreen':
        s = { ...blank(), title: s.title };
        colors.clear();
        break;
      case 'title':
        s.title = op.text;
        break;
    }
  }
  s.colors = [...colors];
  return s;
}

function blank(): DrawingSummary {
  return {
    turtles: 0,
    lines: 0,
    fills: 0,
    dots: 0,
    texts: [],
    colors: [],
    title: null,
  };
}

/** 낭독기가 읽을 한 문장. 예: "거북이 1마리가 그린 그림: 선 4개, 색칠 1곳. 쓴 색: 빨강, 하늘색" */
export function describeDrawing(commands: readonly TurtleCommand[]): string {
  const s = summarizeDrawing(commands);
  if (!s.turtles) return '빈 그림판';
  const parts: string[] = [];
  if (s.lines) parts.push(`선 ${s.lines}개`);
  if (s.fills) parts.push(`색칠 ${s.fills}곳`);
  if (s.dots) parts.push(`점 ${s.dots}개`);
  if (s.texts.length)
    parts.push(
      `글씨 ${s.texts
        .slice(0, 3)
        .map((t) => `“${t}”`)
        .join(', ')}`,
    );
  const head = `${s.title ? `“${s.title}”, ` : ''}거북이 ${s.turtles}마리가 그린 그림`;
  const body = parts.length
    ? `: ${parts.join(', ')}`
    : '. 아직 그린 것이 없어요';
  // 이름이 같아진 색(예: 직접 고른 색 여럿)은 한 번만
  const names = [...new Set(s.colors.map(koColorName))];
  const colors = names.length
    ? `. 쓴 색: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` 외 ${names.length - 5}가지` : ''}`
    : '';
  return `${head}${body}${colors}`;
}
