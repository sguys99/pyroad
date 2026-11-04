export type ValidationType = 'output_match' | 'contains' | 'code_check';

export interface CodeCheckOptions {
  /**
   * 패턴의 처음·끝 글자가 식별자 글자(영문·숫자·_·한글 등)이면, 바로 옆에 다른
   * 식별자 글자가 붙은 위치는 무시한다. 예: `int(`가 `randint(` 안에서는 걸리지 않음 (B30).
   * 기본값 false(부분 문자열 비교)는 기존 규칙과 같은 동작이다.
   */
  wholeWord?: boolean;
}

export interface ValidationInput {
  validationType: ValidationType;
  expectedOutput: string;
  stdout: string;
  studentCode: string;
  /** code_check 규칙에만 쓰는 옵션 */
  codeCheck?: CodeCheckOptions;
}

export interface ValidationResult {
  passed: boolean;
  type: ValidationType;
}

interface MatchContext {
  stdout: string;
  studentCode: string;
  codeCheck?: CodeCheckOptions;
}

// 규칙 유형별 판정. P1-11에서 contains_any·all을 추가할 때 여기에 항목을 더하고,
// all은 하위 규칙마다 이 표를 다시 부르면 된다.
const matchers: Record<
  ValidationType,
  (expected: string, ctx: MatchContext) => boolean
> = {
  output_match: (expected, { stdout }) => stdout.trim() === expected.trim(),
  contains: (expected, { stdout }) => stdout.includes(expected),
  code_check: (expected, { studentCode, codeCheck }) =>
    codeContains(studentCode, expected, codeCheck),
};

export function validateResult(input: ValidationInput): ValidationResult {
  const { validationType, expectedOutput, ...ctx } = input;
  return {
    passed: matchers[validationType](expectedOutput, ctx),
    type: validationType,
  };
}

/**
 * 엄격 code_check (B25): 주석과 문자열 리터럴 안의 글자를 지운 코드에서 패턴을 찾는다.
 * `# while`이나 `print("while")`로는 `while` 규칙을 통과할 수 없다.
 */
export function codeContains(
  code: string,
  pattern: string,
  options: CodeCheckOptions = {},
): boolean {
  const visible = blankCommentsAndStrings(code);
  return options.wholeWord
    ? includesWholeWord(visible, pattern)
    : visible.includes(pattern);
}

// Python 식별자에 쓰일 수 있는 글자 (근사: 유니코드 글자·숫자·밑줄)
const IDENT_CHAR = /[\p{L}\p{N}_]/u;
const isIdentChar = (c: string | undefined) => !!c && IDENT_CHAR.test(c);

function includesWholeWord(haystack: string, pattern: string): boolean {
  if (pattern === '') return true;
  const checkStart = isIdentChar(pattern[0]);
  const checkEnd = isIdentChar(pattern[pattern.length - 1]);
  for (
    let k = haystack.indexOf(pattern);
    k !== -1;
    k = haystack.indexOf(pattern, k + 1)
  ) {
    const startOk = !checkStart || !isIdentChar(haystack[k - 1]);
    const endOk = !checkEnd || !isIdentChar(haystack[k + pattern.length]);
    if (startOk && endOk) return true;
  }
  return false;
}

const STRING_PREFIXES = new Set([
  'r',
  'u',
  'b',
  'f',
  't',
  'br',
  'rb',
  'fr',
  'rf',
  'tr',
  'rt',
]);

/**
 * Python 코드에서 주석 내용과 문자열 리터럴 내용을 공백으로 바꾼다.
 * - `#`과 따옴표·접두사(r, b, f 등)는 남기고, 줄바꿈과 글자 위치도 그대로 둔다.
 * - 작은/큰따옴표, 삼중따옴표, 역슬래시 이스케이프를 처리하므로 문자열 안의 `#`은 주석이 아니다.
 * - f-string(과 t-string)의 `{식}` 부분은 실제 코드이므로 남긴다 (Python 3.12 문법: 식 안의 중첩 문자열 허용).
 * Python 없이 도는 작은 상태 기계라 서버 API와 CI에서 그대로 쓸 수 있다.
 * 문법이 틀린 코드(닫히지 않은 문자열 등)는 끝까지 문자열로 보고 지운다(더 엄격한 쪽).
 */
export function blankCommentsAndStrings(code: string): string {
  const out = code.split('');
  const n = code.length;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };

  // 따옴표 바로 앞의 식별자 글자들이 문자열 접두사인지 확인한다 (예: f"...", Rb'...').
  const prefixBefore = (quote: number): string => {
    let k = quote;
    while (k > 0 && isIdentChar(code[k - 1])) k--;
    const word = code.slice(k, quote).toLowerCase();
    return STRING_PREFIXES.has(word) ? word : '';
  };

  // 코드 구간을 읽는다. inField면 f-string `{식}` 안이므로 짝이 없는 `}`나 최상위 `:`에서 멈춘다.
  const scanCode = (start: number, inField: boolean): number => {
    let i = start;
    let depth = 0;
    while (i < n) {
      const c = code[i];
      if (c === '#') {
        const end = code.indexOf('\n', i);
        const stop = end === -1 ? n : end;
        blank(i + 1, stop);
        i = stop;
        continue;
      }
      if (c === '"' || c === "'") {
        i = scanString(i);
        continue;
      }
      if (inField) {
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === '}') {
          if (depth <= 0) return i;
          depth--;
        } else if (c === ':' && depth <= 0) return i;
      }
      i++;
    }
    return n;
  };

  // f-string의 `{` 다음부터 읽고, 닫는 `}` 다음 위치를 돌려준다.
  const scanField = (start: number): number => {
    let i = scanCode(start, true);
    if (code[i] === ':') {
      // 서식 지정(`:>10` 등)은 글자로 보되, 중첩 `{식}`은 코드로 남긴다.
      let literal = i + 1;
      i++;
      while (i < n && code[i] !== '}' && code[i] !== '\n') {
        if (code[i] === '{') {
          blank(literal, i);
          i = scanField(i + 1);
          literal = i;
          continue;
        }
        i++;
      }
      blank(literal, i);
    }
    return code[i] === '}' ? i + 1 : i;
  };

  // 여는 따옴표 위치에서 시작해 문자열이 끝난 다음 위치를 돌려준다.
  const scanString = (start: number): number => {
    const prefix = prefixBefore(start);
    const isTemplate = prefix.includes('f') || prefix.includes('t');
    const isRaw = prefix.includes('r');
    const q = code[start];
    const delim = code.startsWith(q + q + q, start) ? q + q + q : q;
    const triple = delim.length === 3;
    let i = start + delim.length;
    let literal = i;
    while (i < n) {
      const c = code[i];
      if (c === '\\') {
        // \N{이름} 이스케이프의 중괄호는 f-string 식이 아니다
        if (!isRaw && code[i + 1] === 'N' && code[i + 2] === '{') {
          const close = code.indexOf('}', i + 3);
          i = close === -1 ? n : close + 1;
        } else {
          i += 2;
        }
        continue;
      }
      if (!triple && c === '\n') break; // 닫히지 않은 한 줄 문자열
      if (code.startsWith(delim, i)) {
        blank(literal, i);
        return i + delim.length;
      }
      if (isTemplate && c === '{') {
        if (code[i + 1] === '{') {
          i += 2;
          continue;
        }
        blank(literal, i);
        i = scanField(i + 1);
        literal = i;
        continue;
      }
      i++;
    }
    const end = Math.min(i, n);
    blank(literal, end);
    return end;
  };

  scanCode(0, false);
  return out.join('');
}
