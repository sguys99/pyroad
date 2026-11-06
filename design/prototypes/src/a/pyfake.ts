// 가짜 파이썬 실행 (프로토타입 전용, 진짜 실행은 앱의 Pyodide).
// 지원: 주석·빈 줄, `이름 = 값`, `print(값, 값, …)`, 값 = 문자열 "…"/'…' · 정수 · 변수 · `+` 연결/덧셈.
// 오류는 아이용 쉬운 말 + 파이썬 오류 이름을 함께 돌려준다 (버그버그가 읽어 줌).

export interface RunError {
  line: number; // 1부터
  kind: 'SyntaxError' | 'NameError' | 'TypeError';
  /** 버그버그가 하는 말 (쉬운 한국어) */
  say: string;
}
export interface RunResult {
  out: string[];
  error: RunError | null;
}

type Val = string | number;

const IDENT = /^[A-Za-z_가-힣][A-Za-z0-9_가-힣]*$/;

function splitTop(s: string, sep: string): string[] | null {
  const parts: string[] = [];
  let cur = '';
  let q: string | null = null;
  let depth = 0;
  for (const ch of s) {
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
  if (q) return null; // 따옴표가 안 닫힘
  parts.push(cur);
  return parts;
}

function evalExpr(src: string, vars: Map<string, Val>, line: number): Val | RunError {
  const e = src.trim();
  if (!e) return { line, kind: 'SyntaxError', say: '= 오른쪽이 비어 있어! 상자에 넣을 값을 써 줘.' };
  const terms = splitTop(e, '+');
  if (!terms) return { line, kind: 'SyntaxError', say: '따옴표 짝이 안 맞아! 여는 따옴표 "가 있으면 닫는 따옴표 "도 있어야 해.' };
  let acc: Val | null = null;
  for (const raw of terms) {
    const t = raw.trim();
    let v: Val;
    if (!t) return { line, kind: 'SyntaxError', say: '+ 앞뒤에 값이 하나씩 있어야 해.' };
    if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) || (t.startsWith("'") && t.endsWith("'") && t.length >= 2)) {
      v = t.slice(1, -1).replace(/\\n/g, '\n');
    } else if (/^-?\d+$/.test(t)) {
      v = Number(t);
    } else if (IDENT.test(t)) {
      if (!vars.has(t)) {
        const looksKorean = /[가-힣]/.test(t);
        return {
          line,
          kind: 'NameError',
          say: looksKorean
            ? `‘${t}’라는 이름의 상자를 못 찾았어! 글자를 쓰고 싶으면 따옴표로 감싸 줘: "${t}"`
            : `‘${t}’라는 상자는 아직 없어! 이름 철자가 맞는지 확인해 봐.`,
        };
      }
      v = vars.get(t)!;
    } else if (t.startsWith('"') || t.startsWith("'")) {
      return { line, kind: 'SyntaxError', say: '따옴표 짝이 안 맞아! 여는 따옴표 "가 있으면 닫는 따옴표 "도 있어야 해.' };
    } else {
      return { line, kind: 'SyntaxError', say: '이 모양은 아직 내가 모르는 코드야. 따옴표나 괄호를 살펴볼까?' };
    }
    if (acc === null) acc = v;
    else if (typeof acc === typeof v) acc = (acc as never) + (v as never);
    else return { line, kind: 'TypeError', say: '글자와 숫자는 + 로 바로 붙일 수 없어! 둘 다 글자로 바꿔 볼까?' };
  }
  return acc as Val;
}

const isErr = (v: unknown): v is RunError => typeof v === 'object' && v !== null && 'kind' in v;

export function runPython(code: string): RunResult {
  const vars = new Map<string, Val>();
  const out: string[] = [];
  const lines = code.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const raw = lines[i];
    // 문자열 밖의 # 이후는 주석
    let src = '';
    let q: string | null = null;
    for (const ch of raw) {
      if (q) {
        if (ch === q) q = null;
      } else if (ch === '"' || ch === "'") q = ch;
      else if (ch === '#') break;
      src += ch;
    }
    const s = src.trim();
    if (!s) continue;
    if (/^\s+/.test(src) && src.trim()) {
      return { out, error: { line: n, kind: 'SyntaxError', say: '줄 앞에 빈칸이 있어! 이 줄은 맨 앞에서 시작해야 해.' } };
    }
    const pm = /^print\s*\((.*)\)$/.exec(s);
    if (pm) {
      const args = splitTop(pm[1], ',');
      if (!args) return { out, error: { line: n, kind: 'SyntaxError', say: '따옴표 짝이 안 맞아! 여는 따옴표 "가 있으면 닫는 따옴표 "도 있어야 해.' } };
      const vals: string[] = [];
      for (const a of args) {
        if (!a.trim() && args.length === 1) break;
        const v = evalExpr(a, vars, n);
        if (isErr(v)) return { out, error: v };
        vals.push(String(v));
      }
      out.push(...vals.join(' ').split('\n'));
      continue;
    }
    if (/^print\b/.test(s)) {
      return { out, error: { line: n, kind: 'SyntaxError', say: 'print 뒤에 괄호 ( ) 짝이 맞는지 봐 줘! print("…") 모양이야.' } };
    }
    const am = /^([^=]+?)\s*=(?!=)\s*(.*)$/.exec(s);
    if (am) {
      const name = am[1].trim();
      if (!IDENT.test(name)) return { out, error: { line: n, kind: 'SyntaxError', say: '상자 이름에는 빈칸이나 기호를 쓸 수 없어.' } };
      const v = evalExpr(am[2], vars, n);
      if (isErr(v)) return { out, error: v };
      vars.set(name, v);
      continue;
    }
    if (IDENT.test(s)) {
      if (!vars.has(s)) return { out, error: { line: n, kind: 'NameError', say: `‘${s}’라는 상자는 아직 없어!` } };
      continue;
    }
    return { out, error: { line: n, kind: 'SyntaxError', say: '이 줄은 아직 내가 모르는 모양이야. 따옴표나 괄호를 살펴볼까?' } };
  }
  return { out, error: null };
}

// ───────────── 구문 색 (무드보드 code 토큰)

export type TokKind = 'kw' | 'str' | 'num' | 'com' | 'fn' | 'txt';
const KW = new Set(['if', 'elif', 'else', 'for', 'while', 'in', 'def', 'return', 'True', 'False', 'None', 'and', 'or', 'not', 'import', 'from', 'break', 'continue']);

export function tokenize(line: string): { t: TokKind; s: string }[] {
  const out: { t: TokKind; s: string }[] = [];
  let i = 0;
  const push = (t: TokKind, s: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t && t === 'txt') last.s += s;
    else out.push({ t, s });
  };
  while (i < line.length) {
    const ch = line[i];
    if (ch === '#') {
      push('com', line.slice(i));
      break;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j++;
      push('str', line.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      push('num', line.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j++;
      const w = line.slice(i, j);
      let k = j;
      while (line[k] === ' ') k++;
      push(KW.has(w) ? 'kw' : line[k] === '(' ? 'fn' : 'txt', w);
      i = j;
      continue;
    }
    push('txt', ch);
    i++;
  }
  return out;
}
