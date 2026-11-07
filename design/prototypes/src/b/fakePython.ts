// 프로토타입용 가짜 파이썬 (진짜 실행은 앱의 Pyodide). 1월드 1~3스테이지 정도만 해석한다:
// 주석, 변수 대입, 글자·숫자·True/False, + - * / // %, 비교, and/or/not, int()/str()/len(), print(…, …),
// if/elif/else 들여쓰기 블록. 오류는 아이 말로 바꾼 설명을 함께 돌려준다.

export interface PyError {
  kind: 'SyntaxError' | 'NameError' | 'TypeError' | 'IndentationError' | 'ZeroDivisionError' | 'Unsupported';
  line: number; // 1부터
  message: string; // 파이썬식 한 줄
  kid: string; // 버그버그가 해 주는 쉬운 설명
}
export interface RunResult {
  output: string[];
  error?: PyError;
}

type Val = string | number | boolean | null;
type Tok = { t: 'num' | 'str' | 'name' | 'op' | 'end'; v: string };

class PyFail extends Error {
  constructor(public err: Omit<PyError, 'line'>) {
    super(err.message);
  }
}
const fail = (kind: PyError['kind'], message: string, kid: string): never => {
  throw new PyFail({ kind, message, kid });
};

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '#') break;
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const n = src[j + 1];
          s += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          j += 2;
          continue;
        }
        s += src[j++];
      }
      if (j >= src.length)
        fail('SyntaxError', 'unterminated string literal', `따옴표(${c})를 열었는데 닫지 않았어요. 글자 끝에도 ${c}를 붙여 주세요.`);
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: num[0] });
      i += num[0].length;
      continue;
    }
    const name = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(src.slice(i));
    if (name) {
      out.push({ t: 'name', v: name[0] });
      i += name[0].length;
      continue;
    }
    const op = /^(==|!=|<=|>=|\/\/|[-+*/%<>=(),:])/.exec(src.slice(i));
    if (op) {
      out.push({ t: 'op', v: op[0] });
      i += op[0].length;
      continue;
    }
    if (c === '“' || c === '”' || c === '‘' || c === '’')
      fail('SyntaxError', 'invalid character', '둥근 따옴표(“ ”)는 파이썬이 몰라요. 키보드의 곧은 따옴표 " 를 써 주세요.');
    fail('SyntaxError', `invalid character '${c}'`, `'${c}' 글자는 파이썬이 몰라요. 지우고 다시 써 볼까요?`);
  }
  out.push({ t: 'end', v: '' });
  return out;
}

const KW = new Set(['if', 'elif', 'else', 'and', 'or', 'not', 'True', 'False', 'None', 'for', 'while', 'def', 'return', 'in']);

/** 받침에 따라 '이라는/라는' 같은 조사 고르기 */
function josa(word: string, withFinal: string, without: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return without;
  return (c - 0xac00) % 28 ? withFinal : without;
}

function show(v: Val): string {
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (v === null) return 'None';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return v;
}

class Expr {
  i = 0;
  constructor(
    private toks: Tok[],
    private env: Map<string, Val>,
  ) {}
  peek() {
    return this.toks[this.i];
  }
  next() {
    return this.toks[this.i++];
  }
  eat(v: string) {
    const t = this.peek();
    if (t.t === 'op' && t.v === v) {
      this.i++;
      return true;
    }
    return false;
  }
  parse(): Val {
    return this.or();
  }
  or(): Val {
    let a = this.and();
    while (this.peek().t === 'name' && this.peek().v === 'or') {
      this.next();
      const b = this.and();
      a = a || b;
    }
    return a;
  }
  and(): Val {
    let a = this.not();
    while (this.peek().t === 'name' && this.peek().v === 'and') {
      this.next();
      const b = this.not();
      a = a && b;
    }
    return a;
  }
  not(): Val {
    if (this.peek().t === 'name' && this.peek().v === 'not') {
      this.next();
      return !this.not();
    }
    return this.cmp();
  }
  cmp(): Val {
    const a = this.add();
    const t = this.peek();
    if (t.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(t.v)) {
      this.next();
      const b = this.add();
      if (t.v === '==') return a === b;
      if (t.v === '!=') return a !== b;
      if (typeof a !== typeof b)
        fail('TypeError', `'${t.v}' not supported between instances`, '글자와 숫자는 크기를 비교할 수 없어요. 둘 다 숫자인지 확인해 보세요.');
      const x = a as number;
      const y = b as number;
      return t.v === '<' ? x < y : t.v === '>' ? x > y : t.v === '<=' ? x <= y : x >= y;
    }
    return a;
  }
  add(): Val {
    let a = this.mul();
    for (;;) {
      const t = this.peek();
      if (t.t !== 'op' || (t.v !== '+' && t.v !== '-')) return a;
      this.next();
      const b = this.mul();
      if (t.v === '+') {
        if (typeof a === 'string' && typeof b === 'string') a = a + b;
        else if (typeof a === 'number' && typeof b === 'number') a = a + b;
        else
          fail(
            'TypeError',
            'can only concatenate str (not "int") to str',
            '글자와 숫자는 바로 더할 수 없어요. 숫자를 str( )로 감싸 글자로 바꾸거나, 글자를 int( )로 숫자로 바꿔 보세요.',
          );
      } else {
        if (typeof a !== 'number' || typeof b !== 'number') fail('TypeError', "unsupported operand type(s) for -", '빼기는 숫자끼리만 할 수 있어요.');
        a = (a as number) - (b as number);
      }
    }
  }
  mul(): Val {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.t !== 'op' || !['*', '/', '//', '%'].includes(t.v)) return a;
      this.next();
      const b = this.unary();
      if (t.v === '*' && typeof a === 'string' && typeof b === 'number') {
        a = a.repeat(Math.max(0, b));
        continue;
      }
      if (typeof a !== 'number' || typeof b !== 'number') fail('TypeError', `unsupported operand type(s) for ${t.v}`, '이 계산은 숫자끼리만 할 수 있어요.');
      const x = a as number;
      const y = b as number;
      if ((t.v === '/' || t.v === '//' || t.v === '%') && y === 0) fail('ZeroDivisionError', 'division by zero', '0으로는 나눌 수 없어요!');
      a = t.v === '*' ? x * y : t.v === '/' ? x / y : t.v === '//' ? Math.floor(x / y) : ((x % y) + y) % y;
    }
  }
  unary(): Val {
    if (this.eat('-')) {
      const v = this.unary();
      if (typeof v !== 'number') fail('TypeError', 'bad operand type for unary -', '- 는 숫자 앞에만 붙일 수 있어요.');
      return -(v as number);
    }
    return this.atom();
  }
  atom(): Val {
    const t = this.next();
    if (t.t === 'num') return Number(t.v);
    if (t.t === 'str') return t.v;
    if (t.t === 'op' && t.v === '(') {
      const v = this.parse();
      if (!this.eat(')')) fail('SyntaxError', "'(' was never closed", '여는 괄호 ( 를 썼으면 닫는 괄호 ) 도 꼭 써 주세요.');
      return v;
    }
    if (t.t === 'name') {
      if (t.v === 'True') return true;
      if (t.v === 'False') return false;
      if (t.v === 'None') return null;
      if (this.eat('(')) {
        const args: Val[] = [];
        if (!this.eat(')')) {
          do args.push(this.parse());
          while (this.eat(','));
          if (!this.eat(')')) fail('SyntaxError', "'(' was never closed", '여는 괄호 ( 를 썼으면 닫는 괄호 ) 도 꼭 써 주세요.');
        }
        return callFn(t.v, args);
      }
      if (KW.has(t.v)) fail('SyntaxError', 'invalid syntax', `'${t.v}'는 파이썬의 특별한 낱말이라 여기에 쓸 수 없어요.`);
      if (!this.env.has(t.v)) {
        const korean = /[가-힣]/.test(t.v);
        fail(
          'NameError',
          `name '${t.v}' is not defined`,
          korean
            ? `'${t.v}'${josa(t.v, '이라는', '라는')} 이름의 상자는 아직 없어요. 글자를 넣고 싶었다면 "${t.v}"처럼 따옴표로 감싸 주세요!`
            : `'${t.v}'라는 상자를 아직 만들지 않았어요. 이름을 잘못 쓰지 않았는지 확인해 보세요.`,
        );
      }
      return this.env.get(t.v) as Val;
    }
    if (t.t === 'end') fail('SyntaxError', 'invalid syntax', '= 오른쪽이 비어 있어요. 상자에 넣을 값을 써 주세요.');
    return fail('SyntaxError', 'invalid syntax', `'${t.v}' 자리가 이상해요. 그 줄을 다시 살펴볼까요?`);
  }
}

function callFn(name: string, args: Val[]): Val {
  if (name === 'int') {
    const v = args[0];
    if (typeof v === 'number') return Math.trunc(v);
    if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return parseInt(v, 10);
    return fail('TypeError', `invalid literal for int(): '${show(v ?? '')}'`, 'int( ) 안에는 숫자 모양 글자만 넣을 수 있어요. 예: int("100")');
  }
  if (name === 'str') return show(args[0] ?? '');
  if (name === 'len') {
    if (typeof args[0] !== 'string') fail('TypeError', 'object has no len()', 'len( )은 글자의 길이를 세어 줘요. 글자를 넣어 주세요.');
    return (args[0] as string).length;
  }
  if (name === 'print') return fail('Unsupported', 'print inside expression', 'print( )는 한 줄에 하나씩 써 주세요.');
  if (name === 'input') return '';
  return fail('Unsupported', `${name}() is not supported`, `'${name}( )'은 이 연습장에서는 아직 못 써요. 진짜 퀘스트 화면에서는 돌아가요!`);
}

interface Line {
  no: number;
  indent: number;
  text: string;
}

export function runPython(code: string): RunResult {
  const output: string[] = [];
  const env = new Map<string, Val>();
  const lines: Line[] = [];
  code.split('\n').forEach((raw, idx) => {
    const text = raw.replace(/\s+$/, '');
    const body = text.trimStart();
    if (!body || body.startsWith('#')) return;
    lines.push({ no: idx + 1, indent: text.length - body.length, text: body });
  });

  let cur = 0;
  try {
    // 들여쓰기 블록 실행: base 들여쓰기의 줄들을 차례로
    const block = (base: number, active: boolean) => {
      let chainDone = false; // if/elif 중 하나가 이미 실행됨
      let inChain = false; // 바로 위가 if/elif 블록
      while (cur < lines.length) {
        const ln = lines[cur];
        if (ln.indent < base) return;
        if (ln.indent > base)
          throw new PyFail({ kind: 'IndentationError', message: 'unexpected indent', kid: '이 줄 앞에 칸이 너무 많아요. 위 줄과 시작 위치를 맞춰 주세요.' });
        const m = /^(if|elif|else)\b\s*(.*)$/.exec(ln.text);
        if (m) {
          const head = m[1];
          let rest = m[2];
          if (!rest.endsWith(':'))
            throw new PyFail({ kind: 'SyntaxError', message: "expected ':'", kid: `${head} 줄 끝에 쌍점 : 이 빠졌어요.` });
          rest = rest.slice(0, -1).trim();
          if (head !== 'if' && !inChain)
            throw new PyFail({ kind: 'SyntaxError', message: 'invalid syntax', kid: `${head}는 if 바로 아래에만 쓸 수 있어요.` });
          let run = false;
          if (head === 'if') {
            chainDone = false;
            run = active && truthy(evalExpr(rest, env));
          } else if (head === 'elif') {
            run = active && !chainDone && truthy(evalExpr(rest, env));
          } else {
            run = active && !chainDone;
          }
          if (run) chainDone = true;
          inChain = head !== 'else';
          cur++;
          const inner = lines[cur];
          if (!inner || inner.indent <= base)
            throw new PyFail({ kind: 'IndentationError', message: 'expected an indented block', kid: `${head} 아래 줄은 스페이스 4칸 들여 써야 해요.` });
          block(inner.indent, run);
          continue;
        }
        chainDone = false;
        inChain = false;
        if (active) exec(ln.text, env, output);
        cur++;
      }
    };
    block(lines[0]?.indent ?? 0, true);
    return { output };
  } catch (e) {
    if (e instanceof PyFail) return { output, error: { ...e.err, line: lines[cur]?.no ?? 1 } };
    throw e;
  }
}

function truthy(v: Val) {
  return !(v === false || v === null || v === 0 || v === '');
}

function evalExpr(src: string, env: Map<string, Val>): Val {
  const p = new Expr(tokenize(src), env);
  const v = p.parse();
  if (p.peek().t !== 'end') fail('SyntaxError', 'invalid syntax', `'${p.peek().v}' 앞에서 문장이 끝나야 해요. 쉼표나 연산자가 빠지지 않았나요?`);
  return v;
}

function exec(text: string, env: Map<string, Val>, output: string[]) {
  // print(...)
  if (/^print\b/.test(text)) {
    const toks = tokenize(text);
    if (!(toks[1]?.t === 'op' && toks[1].v === '('))
      fail('SyntaxError', "Missing parentheses in call to 'print'", 'print 뒤에는 괄호가 필요해요. print("안녕")처럼 써 주세요.');
    const p = new Expr(toks, env);
    p.i = 2;
    const args: Val[] = [];
    if (!p.eat(')')) {
      do args.push(p.parse());
      while (p.eat(','));
      if (!p.eat(')')) fail('SyntaxError', "'(' was never closed", 'print( 의 닫는 괄호 ) 가 빠졌어요.');
    }
    if (p.peek().t !== 'end') fail('SyntaxError', 'invalid syntax', '괄호를 닫은 뒤에 글자가 더 있어요. 한 줄에 한 문장만 써 주세요.');
    output.push(...args.map(show).join(' ').split('\n'));
    return;
  }
  // 대입
  const m = /^([\p{L}_][\p{L}\p{N}_]*)\s*=(?!=)\s*(.*)$/u.exec(text);
  if (m) {
    const [, name, rhs] = m;
    if (KW.has(name)) fail('SyntaxError', 'invalid syntax', `'${name}'는 상자 이름으로 쓸 수 없는 특별한 낱말이에요.`);
    if (!rhs.trim()) fail('SyntaxError', 'invalid syntax', `${name} = 오른쪽이 비어 있어요. 상자에 넣을 값을 써 주세요.`);
    env.set(name, evalExpr(rhs, env));
    return;
  }
  if (/^(for|while|def)\b/.test(text))
    fail('Unsupported', 'not supported in prototype', '이 연습장은 아직 반복문·함수를 못 돌려요. 진짜 퀘스트 화면에서는 돌아가요!');
  // 식만 있는 줄
  const v = evalExpr(text, env);
  void v;
}

/** 출력이 기대와 같은지 (끝 공백 무시) */
export function matches(output: string[], expected: string | RegExp | undefined): boolean {
  const got = output.join('\n').replace(/\s+$/, '');
  if (expected === undefined) return got.length > 0;
  if (expected instanceof RegExp) return expected.test(got);
  return got === expected;
}
