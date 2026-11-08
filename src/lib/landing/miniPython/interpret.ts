import { fail } from './errors';
import { tokenize, type Token } from './lexer';
import { NONE, float, int, str, toText, typeName, type Value } from './values';
import { closeToPrint, editDistance, koreanKeyboardTo } from './typos';

/**
 * 미니 파이썬 문법·실행 (P4-03, Q41). 파이썬처럼 먼저 전체를 읽어(문법 오류는 아무것도 찍기 전에) 문장을 차례로 실행한다.
 *
 * 문법: 문장 = `이름 = 식` | 식 (줄바꿈·`;`로 나눔)
 *   식 := 항 (('+'|'-') 항)*      항 := 단항 (('*'|'/'|'//'|'%') 단항)*
 *   단항 := ('+'|'-') 단항 | 거듭     거듭 := 호출 ['**' 단항]   (파이썬처럼 -2**2 = -4, 오른쪽 결합)
 *   호출 := 원자 ('(' 인자 ')')*      원자 := 숫자 | 문자열+ (붙여 쓰면 이어짐) | 이름 | '(' 식 ')'
 * 함수는 print만 (sep·end 키워드). 비교·리스트·점(.) 같은 다른 문법은 'unsupported'.
 */

type Node =
  | { k: 'lit'; value: Value }
  | { k: 'name'; id: string }
  | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'unary'; op: string; e: Node }
  | {
      k: 'call';
      fn: Node;
      args: Node[];
      kw: { name: string; value: Node }[];
    };

type Stmt = { k: 'assign'; id: string; e: Node } | { k: 'expr'; e: Node };

/** 괄호·단항 중첩 상한 (재귀가 깊어지지 않게) */
const MAX_DEPTH = 40;
/** 결과 글자 상한 (화면·메모리) */
export const MAX_OUTPUT = 2000;
/** 정수 크기 상한 (비트). 2**1000(302자리)쯤까지 */
const MAX_INT_BITS = 3400;

/** 파이썬 예약어 (이름으로 쓰면 문법 오류. 체험 공책은 모름) */
const KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
]);
/** 파이썬에는 있지만 체험 공책은 모르는 내장 함수 */
const BUILTINS = new Set([
  'abs',
  'bool',
  'chr',
  'dict',
  'divmod',
  'enumerate',
  'eval',
  'exec',
  'float',
  'format',
  'help',
  'input',
  'int',
  'isinstance',
  'len',
  'list',
  'max',
  'min',
  'open',
  'ord',
  'pow',
  'range',
  'repr',
  'reversed',
  'round',
  'set',
  'sorted',
  'str',
  'sum',
  'tuple',
  'type',
  'zip',
  'exit',
  'quit',
]);

// ── 읽기 ─────────────────────────────────────────────────

class Parser {
  private i = 0;
  private depth = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(o = 0): Token {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)];
  }
  private next(): Token {
    return this.toks[this.i++];
  }
  private isOp(text: string, o = 0): boolean {
    const t = this.peek(o);
    return t.type === 'op' && t.text === text;
  }
  private enter() {
    this.depth += 1;
    if (this.depth > MAX_DEPTH) fail('too_long', null);
  }

  program(): Stmt[] {
    const out: Stmt[] = [];
    while (this.peek().type !== 'eof') {
      if (this.peek().type === 'sep') {
        this.next();
        continue;
      }
      out.push(this.statement());
      const t = this.peek();
      if (t.type !== 'sep' && t.type !== 'eof') this.unexpected();
    }
    return out;
  }

  private statement(): Stmt {
    const t = this.peek();
    if (t.type === 'name') {
      if (
        KEYWORDS.has(t.text) ||
        t.text === 'True' ||
        t.text === 'False' ||
        t.text === 'None'
      ) {
        // True·False·None은 값이라 식으로 읽는다. 다른 예약어는 체험 공책이 모르는 문법
        if (KEYWORDS.has(t.text)) fail('unsupported', null);
      }
      // print "hi" (파이썬 2 꼴)
      if (t.text === 'print') {
        const n = this.peek(1);
        if (n.type === 'str' || n.type === 'num' || n.type === 'name') {
          fail(
            'print_no_parens',
            'SyntaxError',
            "Missing parentheses in call to 'print'. Did you mean print(...)?",
          );
        }
      }
      if (this.isOp('=', 1)) {
        this.next();
        this.next();
        if (t.text === 'True' || t.text === 'False' || t.text === 'None') {
          fail('syntax', 'SyntaxError', `cannot assign to ${t.text}`);
        }
        return { k: 'assign', id: t.text, e: this.expr() };
      }
    }
    return { k: 'expr', e: this.expr() };
  }

  /** 식이 끝나야 할 자리에 다른 것이 옴 */
  private unexpected(prev?: Node): never {
    const t = this.peek();
    if (t.type === 'op') {
      if (
        ['==', '!=', '<', '>', '<=', '>=', '[', '{', '.', ':'].includes(t.text)
      ) {
        fail('unsupported', null);
      }
      if (t.text === '=') fail('syntax', 'SyntaxError', 'invalid syntax');
    }
    if (t.type === 'num' || t.type === 'str' || t.type === 'name') {
      // 따옴표 없는 글자 두 낱말 (print(hello world)) → 따옴표 안내가 더 쉽다
      if (prev?.k === 'name' && t.type === 'name') {
        fail(
          'unquoted_text',
          'SyntaxError',
          'invalid syntax. Perhaps you forgot a comma?',
          prev.id,
        );
      }
      fail(
        'missing_comma',
        'SyntaxError',
        'invalid syntax. Perhaps you forgot a comma?',
      );
    }
    fail('syntax', 'SyntaxError', 'invalid syntax');
  }

  private expr(): Node {
    this.enter();
    let l = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.next() as { text: string }).text;
      l = { k: 'bin', op, l, r: this.term() };
    }
    this.depth -= 1;
    return l;
  }

  private term(): Node {
    let l = this.unary();
    while (
      this.isOp('*') ||
      this.isOp('/') ||
      this.isOp('//') ||
      this.isOp('%')
    ) {
      const op = (this.next() as { text: string }).text;
      l = { k: 'bin', op, l, r: this.unary() };
    }
    return l;
  }

  private unary(): Node {
    if (this.isOp('+') || this.isOp('-')) {
      this.enter();
      const op = (this.next() as { text: string }).text;
      const e = this.unary();
      this.depth -= 1;
      return { k: 'unary', op, e };
    }
    return this.power();
  }

  private power(): Node {
    const base = this.call();
    if (this.isOp('**')) {
      this.next();
      this.enter();
      const r = this.unary();
      this.depth -= 1;
      return { k: 'bin', op: '**', l: base, r };
    }
    return base;
  }

  private call(): Node {
    let n = this.atom();
    while (this.isOp('(')) {
      this.next();
      const args: Node[] = [];
      const kw: { name: string; value: Node }[] = [];
      while (!this.isOp(')')) {
        const t = this.peek();
        if (t.type === 'name' && this.isOp('=', 1)) {
          this.next();
          this.next();
          if (kw.some((k) => k.name === t.text)) {
            fail(
              'syntax',
              'SyntaxError',
              `keyword argument repeated: ${t.text}`,
            );
          }
          kw.push({ name: t.text, value: this.expr() });
        } else {
          if (kw.length) {
            fail(
              'syntax',
              'SyntaxError',
              'positional argument follows keyword argument',
            );
          }
          args.push(this.expr());
        }
        if (this.isOp(',')) {
          this.next();
          continue;
        }
        if (!this.isOp(')')) this.unexpected(args[args.length - 1]);
      }
      this.next();
      n = { k: 'call', fn: n, args, kw };
    }
    return n;
  }

  private atom(): Node {
    const t = this.peek();
    if (t.type === 'num') {
      this.next();
      if (t.float) return { k: 'lit', value: float(Number(t.text)) };
      return { k: 'lit', value: int(BigInt(t.text)) };
    }
    if (t.type === 'str') {
      let v = '';
      while (this.peek().type === 'str')
        v += (this.next() as { value: string }).value;
      return { k: 'lit', value: str(v) };
    }
    if (t.type === 'name') {
      this.next();
      if (t.text === 'True' || t.text === 'False') {
        return { k: 'lit', value: { t: 'bool', v: t.text === 'True' } };
      }
      if (t.text === 'None') return { k: 'lit', value: NONE };
      if (KEYWORDS.has(t.text)) fail('unsupported', null);
      return { k: 'name', id: t.text };
    }
    if (t.type === 'op' && t.text === '(') {
      this.next();
      if (this.isOp(')')) fail('unsupported', null); // 빈 튜플
      this.enter();
      const e = this.expr();
      this.depth -= 1;
      if (this.isOp(',')) fail('unsupported', null); // 튜플
      if (!this.isOp(')')) this.unexpected(e);
      this.next();
      return e;
    }
    if (
      t.type === 'op' &&
      ['[', '{', '.', '<', '>', '==', '!=', '<=', '>=', ':'].includes(t.text)
    ) {
      fail('unsupported', null);
    }
    fail('syntax', 'SyntaxError', 'invalid syntax');
  }
}

// ── 실행 ─────────────────────────────────────────────────

/** BigInt 상수 (tsconfig target이 ES2020 아래라 `0n` 리터럴을 못 씀) */
const B0 = BigInt(0);
const B1 = BigInt(1);
const B_NEG1 = BigInt(-1);

const isNum = (x: Value) => x.t === 'int' || x.t === 'float' || x.t === 'bool';

/** 정수로 (bool은 0·1) */
function asInt(x: Value): bigint {
  if (x.t === 'int') return x.v;
  if (x.t === 'bool') return x.v ? B1 : B0;
  throw new Error('not int');
}

function toFloat(x: Value): number {
  if (x.t === 'float') return x.v;
  const n = Number(asInt(x));
  if (!Number.isFinite(n)) {
    fail('too_big', 'OverflowError', 'int too large to convert to float');
  }
  return n;
}

function bitLength(n: bigint): number {
  return (n < B0 ? -n : n).toString(2).length;
}

function checkInt(n: bigint): Value {
  if (bitLength(n) > MAX_INT_BITS) fail('too_big', null);
  return int(n);
}

function checkStr(s: string): Value {
  if (s.length > MAX_OUTPUT) fail('too_long', null);
  return str(s);
}

function unsupportedOperands(op: string, a: Value, b: Value): never {
  const msg = `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`;
  if ((a.t === 'str') !== (b.t === 'str') && op === '+') {
    fail('str_plus_number', 'TypeError', msg);
  }
  fail('type', 'TypeError', msg);
}

/** 파이썬 float `divmod` (CPython float_divmod와 같은 계산: 나머지 부호는 나누는 수를 따름) */
function pyFloatDivmod(x: number, y: number): [number, number] {
  let mod = x % y;
  let div = (x - mod) / y;
  if (mod) {
    if (y < 0 !== mod < 0) {
      mod += y;
      div -= 1;
    }
  } else {
    mod = y < 0 ? -0 : 0;
  }
  let floordiv: number;
  if (div) {
    floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1;
  } else {
    floordiv = x / y < 0 ? -0 : 0;
  }
  return [floordiv, mod];
}

function binary(op: string, a: Value, b: Value): Value {
  // 문자열
  if (a.t === 'str' || b.t === 'str') {
    if (op === '+') {
      if (a.t === 'str' && b.t === 'str') return checkStr(a.v + b.v);
      if (a.t === 'str') {
        fail(
          'str_plus_number',
          'TypeError',
          `can only concatenate str (not "${typeName(b)}") to str`,
        );
      }
      unsupportedOperands(op, a, b);
    }
    if (op === '*') {
      const [s, n] = a.t === 'str' ? [a, b] : [b, a];
      if (n.t === 'int' || n.t === 'bool') {
        const k = asInt(n);
        if (k <= B0 || s.t !== 'str' || s.v === '') return str('');
        if (BigInt(s.v.length) * k > BigInt(MAX_OUTPUT)) fail('too_long', null);
        return str(s.v.repeat(Number(k)));
      }
      fail(
        'str_times',
        'TypeError',
        `can't multiply sequence by non-int of type '${typeName(n)}'`,
      );
    }
    // "…" % 값 은 문자열 서식 (체험 공책은 모름)
    if (op === '%' && a.t === 'str') fail('unsupported', null);
    unsupportedOperands(op, a, b);
  }
  if (!isNum(a) || !isNum(b)) unsupportedOperands(op, a, b);

  // 정수끼리 (bool 포함)
  if (a.t !== 'float' && b.t !== 'float') {
    const x = asInt(a);
    const y = asInt(b);
    switch (op) {
      case '+':
        return checkInt(x + y);
      case '-':
        return checkInt(x - y);
      case '*':
        return checkInt(x * y);
      case '/':
        if (y === B0)
          fail('zero_division', 'ZeroDivisionError', 'division by zero');
        return float(trueDivide(x, y));
      case '//': {
        if (y === B0) {
          fail(
            'zero_division',
            'ZeroDivisionError',
            'integer division or modulo by zero',
          );
        }
        let q = x / y;
        if (x % y !== B0 && x < B0 !== y < B0) q -= B1;
        return int(q);
      }
      case '%': {
        if (y === B0) {
          fail('zero_division', 'ZeroDivisionError', 'integer modulo by zero');
        }
        let r = x % y;
        if (r !== B0 && r < B0 !== y < B0) r += y;
        return int(r);
      }
      case '**':
        if (y < B0) {
          if (x === B0) {
            fail(
              'zero_division',
              'ZeroDivisionError',
              '0.0 cannot be raised to a negative power',
            );
          }
          return float(Math.pow(toFloat(a), Number(y)));
        }
        if (
          bitLength(x) * Number(y) > MAX_INT_BITS * 2 &&
          x !== B0 &&
          x !== B1 &&
          x !== B_NEG1
        ) {
          fail('too_big', null);
        }
        return checkInt(x ** y);
    }
  }

  // 실수가 섞임
  const x = toFloat(a);
  const y = toFloat(b);
  switch (op) {
    case '+':
      return float(x + y);
    case '-':
      return float(x - y);
    case '*':
      return float(x * y);
    case '/':
      if (y === 0)
        fail('zero_division', 'ZeroDivisionError', 'float division by zero');
      return float(x / y);
    case '//':
      if (y === 0)
        fail(
          'zero_division',
          'ZeroDivisionError',
          'float floor division by zero',
        );
      return float(pyFloatDivmod(x, y)[0]);
    case '%':
      if (y === 0) fail('zero_division', 'ZeroDivisionError', 'float modulo');
      return float(pyFloatDivmod(x, y)[1]);
    case '**': {
      if (x === 0 && y < 0) {
        fail(
          'zero_division',
          'ZeroDivisionError',
          '0.0 cannot be raised to a negative power',
        );
      }
      if (x < 0 && !Number.isInteger(y)) fail('unsupported', null); // 복소수
      const r = Math.pow(x, y);
      if (!Number.isFinite(r) && Number.isFinite(x) && Number.isFinite(y)) {
        fail(
          'too_big',
          'OverflowError',
          "(34, 'Numerical result out of range')",
        );
      }
      return float(r);
    }
  }
  fail('syntax', 'SyntaxError', 'invalid syntax');
}

/** 정수 나누기의 실수 결과 (큰 정수도 되도록 정확히) */
function trueDivide(x: bigint, y: bigint): number {
  const n = Number(x);
  const d = Number(y);
  if (Number.isFinite(n) && Number.isFinite(d)) return n / d;
  // 아주 큰 수: 몫과 나머지로
  const q = x / y;
  return Number(q) + Number(x - q * y) / d;
}

function unaryOp(op: string, x: Value): Value {
  if (x.t === 'float') return float(op === '-' ? -x.v : x.v);
  if (x.t === 'int' || x.t === 'bool') {
    const n = asInt(x);
    return int(op === '-' ? -n : n);
  }
  fail(
    'type',
    'TypeError',
    `bad operand type for unary ${op}: '${typeName(x)}'`,
  );
}

interface Env {
  vars: Map<string, Value>;
  out: string[];
  outLen: number;
  printed: boolean;
}

function nameError(id: string, called: boolean): never {
  const msg = `name '${id}' is not defined`;
  // 파이썬 3.12는 철자가 가까우면 "Did you mean: 'print'?"를 붙인다 (대소문자도 한 글자로 침)
  const near = id.length >= 3 && editDistance(id, 'print') <= 2;
  const py = near ? `${msg}. Did you mean: 'print'?` : msg;
  if (id !== 'print' && id.toLowerCase() === 'print')
    fail('print_case', 'NameError', py, id);
  if (koreanKeyboardTo(id, 'print'))
    fail('korean_keyboard', 'NameError', msg, id);
  if (closeToPrint(id)) fail('print_typo', 'NameError', py, id);
  if (called) fail('unknown_function', 'NameError', py, id);
  fail('unquoted_text', 'NameError', py, id);
}

function evaluate(n: Node, env: Env): Value {
  switch (n.k) {
    case 'lit':
      return n.value;
    case 'name': {
      const v = env.vars.get(n.id);
      if (v) return v;
      if (n.id === 'print' || BUILTINS.has(n.id)) fail('unsupported', null);
      nameError(n.id, false);
      break;
    }
    case 'unary':
      return unaryOp(n.op, evaluate(n.e, env));
    case 'bin': {
      const l = evaluate(n.l, env);
      const r = evaluate(n.r, env);
      return binary(n.op, l, r);
    }
    case 'call': {
      if (n.fn.k !== 'name') fail('unsupported', null);
      const id = n.fn.id;
      const own = env.vars.get(id);
      if (own)
        fail('type', 'TypeError', `'${typeName(own)}' object is not callable`);
      if (id !== 'print') {
        if (BUILTINS.has(id)) fail('unsupported', null);
        nameError(id, true);
      }
      const args = n.args.map((a) => evaluate(a, env));
      let sep = ' ';
      let end = '\n';
      for (const k of n.kw) {
        const v = evaluate(k.value, env);
        if (k.name !== 'sep' && k.name !== 'end') {
          if (k.name === 'file' || k.name === 'flush')
            fail('unsupported', null);
          fail(
            'type',
            'TypeError',
            `'${k.name}' is an invalid keyword argument for print()`,
          );
        }
        if (v.t === 'none') continue;
        if (v.t !== 'str') {
          fail(
            'type',
            'TypeError',
            `${k.name} must be None or a string, not ${typeName(v)}`,
          );
        }
        if (k.name === 'sep') sep = v.v;
        else end = v.v;
      }
      const line = args.map(toText).join(sep) + end;
      env.outLen += line.length;
      if (env.outLen > MAX_OUTPUT) fail('too_long', null);
      env.out.push(line);
      env.printed = true;
      return NONE;
    }
  }
  fail('syntax', 'SyntaxError', 'invalid syntax');
}

export interface RunState {
  out: string;
  printed: boolean;
}

/**
 * 읽고 실행한다. 오류는 `MiniPythonError`로 던지고, 그때까지 찍힌 글자는 `partial`에 남긴다
 * (파이썬처럼 오류 앞 줄의 출력은 보인다).
 */
export function execute(src: string, partial: RunState): RunState {
  const program = new Parser(tokenize(src)).program();
  const env: Env = { vars: new Map(), out: [], outLen: 0, printed: false };
  const sync = () => {
    partial.out = env.out.join('');
    partial.printed = env.printed;
  };
  try {
    for (const s of program) {
      if (s.k === 'assign') {
        env.vars.set(s.id, evaluate(s.e, env));
      } else {
        evaluate(s.e, env);
      }
      sync();
    }
  } finally {
    sync();
  }
  return partial;
}
