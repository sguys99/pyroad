import {
  analyze,
  checkDrawingRule,
  DRAWING_RULE_TYPES,
  type Analysis,
  type DrawingRule,
} from '@/lib/turtle/check';
import type { TurtleCommand } from '@/lib/turtle/scene';

/**
 * DB `quests.validation_type`에 저장되는 규칙 유형 (CHECK 00012). 새 규칙(그림·any·시나리오, P11-05)은
 * `all` 안에만 들어가므로 이 목록은 그대로다 (`toStoredRule`).
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
 * P11-05: `any`(하나라도 통과, 제안 H) · 그림 규칙(`shape`·`circles`·`colors`·`text`·`segments`·`turtles`·`match_drawing`,
 * turtle 명령 스트림을 src/lib/turtle/check.ts로 판정) · `scenario`(시험 손님 i번 실행에만 붙는 규칙, 빌드가 만듦)
 */
export type ValidationRule =
  | { type: 'output_match'; expected: string }
  | { type: 'contains'; expected: string }
  | { type: 'contains_any'; expected: string[] }
  | { type: 'code_check'; expected: string; whole_word?: boolean }
  | { type: 'all'; rules: ValidationRule[] }
  | { type: 'any'; rules: ValidationRule[] }
  | { type: 'scenario'; index: number; rule: ValidationRule }
  | DrawingRule;

export type RuleType = ValidationRule['type'];

export interface CodeCheckOptions {
  /**
   * 패턴의 처음·끝 글자가 식별자 글자(영문·숫자·_·한글 등)이면, 바로 옆에 다른
   * 식별자 글자가 붙은 위치는 무시한다. 예: `int(`가 `randint(` 안에서는 걸리지 않음 (B30).
   * 기본값 false(부분 문자열 비교)는 기존 규칙과 같은 동작이다.
   * 규칙 자체에 `whole_word`가 있으면 그 값이 우선한다.
   */
  wholeWord?: boolean;
}

/** 실행 한 번의 결과 (출력·코드 + P11-05 그림·시험 손님 번호) */
export interface RunContext {
  stdout: string;
  studentCode: string;
  /** code_check 규칙에만 쓰는 옵션 */
  codeCheck?: CodeCheckOptions;
  /** 이 실행의 turtle 명령 (그림 규칙). 없으면 빈 그림 */
  turtle?: readonly TurtleCommand[];
  /** 시험 손님 번호 (0부터). 없으면 `scenario` 규칙은 건너뜀 (예시 출력 검사 등) */
  scenario?: number;
  /** true면 그림 규칙을 통과로 본다 (그림이 없는 예시 출력 검사, schema checkExample) */
  ignoreDrawing?: boolean;
}

export interface ValidationInput extends RunContext {
  validationType: ValidationType;
  /** DB에 저장된 기준값. contains_any·all은 JSON 문자열 (`toStoredRule` 참고) */
  expectedOutput: string;
}

export interface ValidationResult {
  passed: boolean;
  type: ValidationType;
}

interface MatchContext extends RunContext {
  /** 그림 분석은 한 번만 (규칙 여러 개가 같은 그림을 봄) */
  drawing?: Analysis;
}

type RuleOf<T extends RuleType> = Extract<ValidationRule, { type: T }>;

const drawingOf = (ctx: MatchContext): Analysis =>
  (ctx.drawing ??= analyze(ctx.turtle ?? []));

const drawingMatcher = (rule: DrawingRule, ctx: MatchContext) =>
  !!ctx.ignoreDrawing || checkDrawingRule(drawingOf(ctx), rule).ok;

// 규칙 유형별 판정. all·any·scenario는 하위 규칙마다 이 표를 다시 부른다.
const matchers: {
  [T in RuleType]: (rule: RuleOf<T>, ctx: MatchContext) => boolean;
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
  any: ({ rules }, ctx) => rules.some((rule) => matchRule(rule, ctx)),
  // 그 손님의 실행에만 붙는 규칙. 손님 번호가 없는 판정(예시 출력 검사)에서는 건너뜀
  scenario: ({ index, rule }, ctx) =>
    ctx.scenario !== index || matchRule(rule, ctx),
  shape: drawingMatcher,
  circles: drawingMatcher,
  colors: drawingMatcher,
  text: drawingMatcher,
  segments: drawingMatcher,
  turtles: drawingMatcher,
  match_drawing: drawingMatcher,
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
    passed: rule !== null && matchRule(rule, { ...ctx }),
    type: validationType,
  };
}

/** 규칙 객체로 판정한다 (콘텐츠 검증 등 DB를 거치지 않는 곳) */
export function validateRule(rule: ValidationRule, ctx: RunContext): boolean {
  return matchRule(rule, { ...ctx });
}

/**
 * 떨어진 그림 규칙의 이유 (아이에게 보여 주는 한국어 문장, 튜터 힌트로도 씀). 출력 규칙의 이유는 내지 않는다
 * (기준값이 정답이라 서버 밖으로 내보내지 않음). `any`는 모든 갈래가 떨어졌을 때만 그 이유들을.
 */
export function drawingReasons(
  rule: ValidationRule,
  ctx: RunContext,
): string[] {
  const c: MatchContext = { ...ctx };
  const walk = (r: ValidationRule): string[] => {
    if (DRAWING_RULE_TYPES.has(r.type)) {
      if (ctx.ignoreDrawing) return [];
      return checkDrawingRule(drawingOf(c), r as DrawingRule).reasons;
    }
    switch (r.type) {
      case 'all':
        return r.rules.flatMap(walk);
      case 'any':
        return matchRule(r, c) ? [] : r.rules.flatMap(walk);
      case 'scenario':
        return ctx.scenario === r.index ? walk(r.rule) : [];
      default:
        return [];
    }
  };
  return [...new Set(walk(rule))];
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
    case 'output_match':
    case 'contains':
      return { validation_type: rule.type, expected_output: rule.expected };
    default:
      // any·그림·시나리오(P11-05)는 공개 칸 CHECK(00012)에 없으므로 all 하나짜리로 감싼다
      return {
        validation_type: 'all',
        expected_output: JSON.stringify([normalizeRule(rule)]),
      };
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
        rules.every((r) => isValidationRule(r))
        ? { type: 'all', rules }
        : null;
    }
    default:
      return null;
  }
}

/**
 * 출력이 한 글자까지 정해진 규칙인지 (`output_match`, 또는 `all` 안에 있음). 그러면 공개 예시 출력이 곧 기준값이라
 * 결과 쪽지가 줄 단위로 견줘도 된다 (P10-09, 빌드가 `example_exact` 공개 플래그로 내보냄 — 기준값 자체는 내보내지 않음)
 */
export function hasExactOutput(rule: ValidationRule): boolean {
  return (
    rule.type === 'output_match' ||
    (rule.type === 'all' && rule.rules.some(hasExactOutput))
  );
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
    case 'any':
      return { type: rule.type, rules: rule.rules.map(normalizeRule) };
    case 'scenario':
      return {
        type: 'scenario',
        index: rule.index,
        rule: normalizeRule(rule.rule),
      };
    case 'code_check':
      return rule.whole_word
        ? { type: 'code_check', expected: rule.expected, whole_word: true }
        : { type: 'code_check', expected: rule.expected };
    case 'contains_any':
      return { type: 'contains_any', expected: [...rule.expected] };
    case 'output_match':
    case 'contains':
      return { type: rule.type, expected: rule.expected };
    default: {
      // 그림 규칙: type 다음 나머지 키를 이름 순으로
      const { type, ...rest } = rule;
      const keys = Object.keys(rest).sort() as (keyof typeof rest)[];
      return {
        type,
        ...Object.fromEntries(
          keys.filter((k) => rest[k] !== undefined).map((k) => [k, rest[k]]),
        ),
      } as ValidationRule;
    }
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

// all → scenario → all → any → 규칙 (빌드가 시나리오를 감싸는 깊이 + 여유)
const MAX_RULE_DEPTH = 6;
/** match_drawing 정답 선분 상한 (그림 퀘스트 정답은 명령 5,000개 이하, world3.md §10) */
export const MAX_RULE_SEGMENTS = 5000;

const optNum = (v: unknown, min = 0) =>
  v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min);
const optBool = (v: unknown) => v === undefined || typeof v === 'boolean';
const isSeg4 = (v: unknown) =>
  Array.isArray(v) &&
  v.length === 4 &&
  v.every((n) => typeof n === 'number' && Number.isFinite(n));

/** DB에서 읽은 JSON이 규칙 모양인지 확인한다 (콘텐츠 원본은 zod 스키마가 먼저 검사함) */
export function isValidationRule(
  value: unknown,
  depth = 0,
): value is ValidationRule {
  if (depth > MAX_RULE_DEPTH || typeof value !== 'object' || value === null) {
    return false;
  }
  const rule = value as Record<string, unknown>;
  const children = () =>
    Array.isArray(rule.rules) &&
    rule.rules.length > 0 &&
    rule.rules.every((child) => isValidationRule(child, depth + 1));
  switch (rule.type) {
    case 'output_match':
    case 'contains':
      return typeof rule.expected === 'string';
    case 'code_check':
      return typeof rule.expected === 'string' && optBool(rule.whole_word);
    case 'contains_any':
      return isNonEmptyStringList(rule.expected);
    case 'all':
    case 'any':
      return children();
    case 'scenario':
      return (
        Number.isInteger(rule.index) &&
        (rule.index as number) >= 0 &&
        isValidationRule(rule.rule, depth + 1)
      );
    case 'shape':
      return (
        (rule.shape === 'regular' || rule.shape === 'rectangle') &&
        optNum(rule.n, 3) &&
        optNum(rule.k, 1) &&
        optNum(rule.side) &&
        optNum(rule.count, 1) &&
        optBool(rule.filled)
      );
    case 'circles':
      return optNum(rule.min) && optNum(rule.radius);
    case 'colors':
    case 'turtles':
      return typeof rule.min === 'number' && optNum(rule.min);
    case 'text':
      return (
        (rule.includes === undefined || typeof rule.includes === 'string') &&
        optNum(rule.min)
      );
    case 'segments':
      return optNum(rule.min) && optNum(rule.max);
    case 'match_drawing':
      return (
        Array.isArray(rule.segments) &&
        rule.segments.length > 0 &&
        rule.segments.length <= MAX_RULE_SEGMENTS &&
        rule.segments.every(isSeg4) &&
        optBool(rule.translate) &&
        optBool(rule.extra_ok)
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
  const visible = normalizeSpacing(blankCommentsAndStrings(code));
  const target = normalizeSpacing(pattern);
  return options.wholeWord
    ? includesWholeWord(visible, target)
    : visible.includes(target);
}

/**
 * 띄어쓰기 차이로 맞는 답이 떨어지지 않게 코드와 패턴을 같은 모양으로 맞춘다 (P10-09).
 * 공백·탭 묶음마다: 줄 처음(들여쓰기)은 깊이·탭과 상관없이 한 칸, 낱말 사이는 한 칸, 기호 옆이나 줄 끝은 지운다.
 * 예: `book["x"]="y"` ≡ `book["x"] = "y"`, `x%26` ≡ `x % 26`, 탭·2칸 들여쓴 `for` ≡ `    for`.
 * 낱말 사이 한 칸은 남기므로 whole_word 판정(`for` ≠ `format`)은 그대로다.
 */
export function normalizeSpacing(text: string): string {
  return text.replace(/[ \t]+/g, (run: string, at: number) => {
    const before = text[at - 1];
    const after = text[at + run.length];
    if (after === '\n' || after === '\r') return '';
    if (before === undefined || before === '\n' || before === '\r')
      return isIdentChar(after) ? ' ' : '';
    if (after === undefined) return isIdentChar(before) ? ' ' : '';
    return isIdentChar(before) && isIdentChar(after) ? ' ' : '';
  });
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
