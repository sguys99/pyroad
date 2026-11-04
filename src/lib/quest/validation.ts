/**
 * 판정 규칙 유형.
 * - output_match·contains·code_check: 기준값이 문자열 하나 (기존 규칙)
 * - contains_any: 출력에 여러 문자열 중 하나라도 있으면 통과 (무작위 출력 퀘스트, B09·P1-11)
 * - all: 여러 규칙을 모두 통과해야 통과 (예: 코드에 `elif` + 출력에 "커요"·"작아요"·"정답" 중 하나)
 */
export type ValidationType =
  | 'output_match'
  | 'contains'
  | 'contains_any'
  | 'code_check'
  | 'all';

/**
 * 판정 규칙 (콘텐츠 원본 `content/**.yaml`의 `answer.validation`, 검증 JSON의 `rule`과 같은 형태).
 * DB에는 `toStoredRule()`로 바꿔 `validation_type`(공개) + `expected_output`(정답 테이블) 두 칸에 저장한다.
 */
export type ValidationRule =
  | { type: 'output_match'; expected: string }
  | { type: 'contains'; expected: string }
  | { type: 'contains_any'; expected: string[] }
  | { type: 'code_check'; expected: string; whole_word?: boolean }
  | { type: 'all'; rules: ValidationRule[] };

export interface CodeCheckOptions {
  /**
   * 패턴의 처음·끝 글자가 식별자 글자(영문·숫자·_·한글 등)이면, 바로 옆에 다른
   * 식별자 글자가 붙은 위치는 무시한다. 예: `int(`가 `randint(` 안에서는 걸리지 않음 (B30).
   * 기본값 false(부분 문자열 비교)는 기존 규칙과 같은 동작이다.
   * 규칙 자체에 `whole_word`가 있으면 그 값이 우선한다.
   */
  wholeWord?: boolean;
}

export interface ValidationInput {
  validationType: ValidationType;
  /** DB에 저장된 기준값. contains_any·all은 JSON 문자열 (`toStoredRule` 참고) */
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

type RuleOf<T extends ValidationType> = Extract<ValidationRule, { type: T }>;

// 규칙 유형별 판정. all은 하위 규칙마다 이 표를 다시 부른다.
const matchers: {
  [T in ValidationType]: (rule: RuleOf<T>, ctx: MatchContext) => boolean;
} = {
  output_match: ({ expected }, { stdout }) => stdout.trim() === expected.trim(),
  contains: ({ expected }, { stdout }) => stdout.includes(expected),
  // 빈 문자열 후보는 모든 출력에 들어 있으므로 무시한다 (기준이 비면 통과시키지 않음)
  contains_any: ({ expected }, { stdout }) =>
    expected.some(
      (candidate) => candidate !== '' && stdout.includes(candidate),
    ),
  code_check: ({ expected, whole_word }, { studentCode, codeCheck }) =>
    codeContains(studentCode, expected, {
      wholeWord: whole_word ?? codeCheck?.wholeWord,
    }),
  // 하위 규칙이 없으면 실패 (빈 AND가 모든 답을 통과시키지 않게)
  all: ({ rules }, ctx) =>
    rules.length > 0 && rules.every((rule) => matchRule(rule, ctx)),
};

function matchRule(rule: ValidationRule, ctx: MatchContext): boolean {
  const match = matchers[rule.type] as (
    rule: ValidationRule,
    ctx: MatchContext,
  ) => boolean;
  return match(rule, ctx);
}

/** DB에 저장된 규칙(validation_type + expected_output)으로 판정한다. 기준값이 깨져 있으면 불합격 */
export function validateResult(input: ValidationInput): ValidationResult {
  const { validationType, expectedOutput, ...ctx } = input;
  const rule = parseStoredRule(validationType, expectedOutput);
  return {
    passed: rule !== null && matchRule(rule, ctx),
    type: validationType,
  };
}

/** 규칙 객체로 판정한다 (콘텐츠 검증 등 DB를 거치지 않는 곳) */
export function validateRule(
  rule: ValidationRule,
  ctx: Omit<ValidationInput, 'validationType' | 'expectedOutput'>,
): boolean {
  return matchRule(rule, ctx);
}

// ------------------------------------------------------------
// DB 저장 형태 (P1-11)
// quests.validation_type(공개)·quest_answer_keys.expected_output(정답) 두 칸은 그대로 두고,
// 새 규칙은 기준값 칸에 JSON을 넣는다. 그래서 채점 API(/api/quest/validate)는 바꾸지 않아도 된다.
//   output_match·contains·code_check → 기준값 문자열 그대로 (기존 행과 같음)
//   contains_any                      → JSON 문자열 배열      예: ["커요","작아요","정답"]
//   all                               → JSON 하위 규칙 배열    예: [{"type":"code_check","expected":"elif"}, …]
//   code_check + whole_word           → 칸이 하나뿐이므로 all 하나짜리로 감싼다
// ------------------------------------------------------------

export interface StoredRule {
  validation_type: ValidationType;
  expected_output: string;
}

export function toStoredRule(rule: ValidationRule): StoredRule {
  switch (rule.type) {
    case 'contains_any':
      return {
        validation_type: 'contains_any',
        expected_output: JSON.stringify(rule.expected),
      };
    case 'all':
      return {
        validation_type: 'all',
        expected_output: JSON.stringify(rule.rules.map(normalizeRule)),
      };
    case 'code_check':
      if (rule.whole_word) {
        return {
          validation_type: 'all',
          expected_output: JSON.stringify([normalizeRule(rule)]),
        };
      }
      return { validation_type: 'code_check', expected_output: rule.expected };
    default:
      return { validation_type: rule.type, expected_output: rule.expected };
  }
}

/** 저장 형태 → 규칙. JSON이 깨졌거나 모양이 틀리면 null (채점하지 않음) */
export function parseStoredRule(
  validationType: ValidationType,
  expectedOutput: string,
): ValidationRule | null {
  switch (validationType) {
    case 'output_match':
    case 'contains':
    case 'code_check':
      return { type: validationType, expected: expectedOutput };
    case 'contains_any': {
      const list = parseJson(expectedOutput);
      return isNonEmptyStringList(list)
        ? { type: 'contains_any', expected: list }
        : null;
    }
    case 'all': {
      const rules = parseJson(expectedOutput);
      return Array.isArray(rules) &&
        rules.length > 0 &&
        rules.every(isValidationRule)
        ? { type: 'all', rules }
        : null;
    }
    default:
      return null;
  }
}

/** 하위 규칙이 하나뿐인 all은 그 규칙으로 푼다 (DB에서 콘텐츠로 되돌릴 때, toStoredRule의 반대) */
export function simplifyRule(rule: ValidationRule): ValidationRule {
  if (rule.type !== 'all') return rule;
  const rules = rule.rules.map(simplifyRule);
  return rules.length === 1 ? rules[0] : { type: 'all', rules };
}

/** 키 순서를 고정하고 whole_word: false 를 지운 사본 (생성 결과가 매번 같도록) */
function normalizeRule(rule: ValidationRule): ValidationRule {
  switch (rule.type) {
    case 'all':
      return { type: 'all', rules: rule.rules.map(normalizeRule) };
    case 'code_check':
      return rule.whole_word
        ? { type: 'code_check', expected: rule.expected, whole_word: true }
        : { type: 'code_check', expected: rule.expected };
    case 'contains_any':
      return { type: 'contains_any', expected: [...rule.expected] };
    default:
      return { type: rule.type, expected: rule.expected };
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isNonEmptyStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string')
  );
}

const MAX_RULE_DEPTH = 4;

/** DB에서 읽은 JSON이 규칙 모양인지 확인한다 (콘텐츠 원본은 zod 스키마가 먼저 검사함) */
export function isValidationRule(
  value: unknown,
  depth = 0,
): value is ValidationRule {
  if (depth > MAX_RULE_DEPTH || typeof value !== 'object' || value === null) {
    return false;
  }
  const rule = value as Record<string, unknown>;
  switch (rule.type) {
    case 'output_match':
    case 'contains':
      return typeof rule.expected === 'string';
    case 'code_check':
      return (
        typeof rule.expected === 'string' &&
        (rule.whole_word === undefined || typeof rule.whole_word === 'boolean')
      );
    case 'contains_any':
      return isNonEmptyStringList(rule.expected);
    case 'all':
      return (
        Array.isArray(rule.rules) &&
        rule.rules.length > 0 &&
        rule.rules.every((child) => isValidationRule(child, depth + 1))
      );
    default:
      return false;
  }
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
