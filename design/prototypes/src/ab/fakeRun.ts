// 가짜 실행 (프로토타입 전용, 진짜 실행은 Pyodide §2.9)
// 해석하는 것: 주석·빈 줄, 변수 = 값, print(값, 값…). 값은 "문자열"·'문자열'·숫자·변수 이름과 + 연결.
// 오류는 아이가 읽을 수 있는 말로 바꿔서 돌려준다 (버그버그 대사).

export type Value = string | number;
export interface RunError {
  line: number;
  kind: 'quote' | 'empty' | 'name' | 'paren' | 'syntax' | 'type';
  /** 버그버그가 하는 쉬운 말 */
  talk: string;
  /** 출력 창에 보이는 짧은 줄 */
  short: string;
}
export interface RunResult {
  out: string[];
  error: RunError | null;
}

const NAME = /^[A-Za-z_가-힣][A-Za-z0-9_가-힣]*$/;

/** 받침에 맞는 조사: 안녕 → 안녕이라는, 사과 → 사과라는 */
function ira(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? '이라는' : '라는';
  return /[0-9lmnLMN]$/.test(word) ? '이라는' : '라는';
}

function splitTop(src: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let q: string | null = null;
  let cur = '';
  for (const ch of src) {
    if (q) {
      cur += ch;
      if (ch === q) q = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      cur += ch;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function evalExpr(raw: string, vars: Map<string, Value>, line: number): Value | RunError {
  const src = raw.trim();
  if (!src) return { line, kind: 'empty', talk: '= 오른쪽이 비어 있어! 상자에 넣을 값을 써 줘.', short: `${line}번째 줄: 넣을 값이 없어요` };
  const quotes = (src.match(/["']/g) ?? []).length;
  if (quotes % 2 === 1)
    return { line, kind: 'quote', talk: '따옴표 짝이 안 맞아! 글자는 "안녕"처럼 앞뒤를 꼭 감싸 줘.', short: `${line}번째 줄: 따옴표 짝이 안 맞아요` };
  const pieces = splitTop(src, '+');
  if (pieces.length > 1) {
    const vals: Value[] = [];
    for (const p of pieces) {
      const v = evalExpr(p, vars, line);
      if (typeof v === 'object') return v;
      vals.push(v);
    }
    const allNum = vals.every((v) => typeof v === 'number');
    const allStr = vals.every((v) => typeof v === 'string');
    if (!allNum && !allStr)
      return { line, kind: 'type', talk: '숫자와 글자는 바로 더할 수 없어! str()로 숫자를 글자로 바꿔 볼까?', short: `${line}번째 줄: 숫자와 글자를 더했어요` };
    return allNum ? (vals as number[]).reduce((a, b) => a + b, 0) : (vals as string[]).join('');
  }
  const m = src.match(/^(["'])(.*)\1$/);
  if (m) return m[2];
  if (/^-?\d+(\.\d+)?$/.test(src)) return Number(src);
  if (/^str\((.*)\)$/.test(src)) {
    const v = evalExpr(src.slice(4, -1), vars, line);
    return typeof v === 'object' ? v : String(v);
  }
  if (NAME.test(src)) {
    if (vars.has(src)) return vars.get(src)!;
    return {
      line,
      kind: 'name',
      talk: `"${src}"${ira(src)} 상자를 못 찾았어! 글자를 넣고 싶었다면 "${src}"처럼 따옴표로 감싸 줘.`,
      short: `${line}번째 줄: ${src}${ira(src)} 이름이 없어요`,
    };
  }
  return { line, kind: 'syntax', talk: '이 줄은 파이썬이 못 알아들었어. 띄어쓰기나 기호를 다시 볼까?', short: `${line}번째 줄: 알아들을 수 없어요` };
}

export function fakeRun(code: string): RunResult {
  const vars = new Map<string, Value>();
  const out: string[] = [];
  const lines = code.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    let ln = lines[i];
    // 주석 (따옴표 밖의 #)
    let q: string | null = null;
    for (let j = 0; j < ln.length; j++) {
      const ch = ln[j];
      if (q) {
        if (ch === q) q = null;
      } else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '#') {
        ln = ln.slice(0, j);
        break;
      }
    }
    const t = ln.trim();
    if (!t) continue;
    if (/^print\b/.test(t)) {
      const pm = t.match(/^print\s*\((.*)\)$/);
      if (!pm) {
        const talk = t.includes('(') ? '괄호 짝이 안 맞아! print( 다음에 ) 로 닫아 줘.' : 'print 다음에는 괄호가 필요해! print("안녕")처럼 써 줘.';
        return { out, error: { line: n, kind: 'paren', talk, short: `${n}번째 줄: 괄호를 확인해요` } };
      }
      const inner = pm[1].trim();
      if (!inner) {
        out.push('');
        continue;
      }
      const args = splitTop(inner, ',');
      const vals: string[] = [];
      for (const a of args) {
        const v = evalExpr(a, vars, n);
        if (typeof v === 'object') return { out, error: v };
        vals.push(String(v));
      }
      out.push(vals.join(' '));
      continue;
    }
    const am = t.match(/^([^=]+?)\s*=(?!=)\s*(.*)$/);
    if (am) {
      const name = am[1].trim();
      if (!NAME.test(name))
        return { out, error: { line: n, kind: 'syntax', talk: `상자 이름 "${name}"은 쓸 수 없어. 영어 글자로 시작하는 이름을 써 줘.`, short: `${n}번째 줄: 이름을 확인해요` } };
      const v = evalExpr(am[2], vars, n);
      if (typeof v === 'object') return { out, error: v };
      vars.set(name, v);
      continue;
    }
    if (/^\w+\s*\(/.test(t) && !t.endsWith(')'))
      return { out, error: { line: n, kind: 'paren', talk: '괄호 짝이 안 맞아! 여는 괄호 ( 가 있으면 닫는 괄호 ) 도 있어야 해.', short: `${n}번째 줄: 괄호를 확인해요` } };
    return { out, error: { line: n, kind: 'syntax', talk: '이 줄은 파이썬이 못 알아들었어. 띄어쓰기나 기호를 다시 볼까?', short: `${n}번째 줄: 알아들을 수 없어요` } };
  }
  return { out, error: null };
}
