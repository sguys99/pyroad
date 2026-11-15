import { Scene, type TurtleCommand } from './scene';

/** 대체 글에 쓰는 색 이름 (shim의 한글 색 이름을 거꾸로). 없으면 코드에 쓴 이름 그대로 */
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
  brown: '갈색',
  gold: '금색',
  silver: '은색',
};

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
  const colors = s.colors.length
    ? `. 쓴 색: ${s.colors
        .slice(0, 5)
        .map((c) => KO_COLOR[c] ?? c)
        .join(
          ', ',
        )}${s.colors.length > 5 ? ` 외 ${s.colors.length - 5}가지` : ''}`
    : '';
  return `${head}${body}${colors}`;
}
