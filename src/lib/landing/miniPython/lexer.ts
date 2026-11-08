import { fail } from './errors';

/**
 * 미니 파이썬 낱말 나누기 (P4-03). 정규식 반복 없이 한 글자씩 한 번만 훑는다 (입력 길이에 비례).
 * 파이썬 토크나이저처럼 문자열이 안 닫힘·쓸 수 없는 글자·짝 없는 `)`는 만나는 즉시, 안 닫힌 `(`는 끝에서 알린다.
 */
export type Token =
  | { type: 'num'; text: string; float: boolean; pos: number }
  | { type: 'str'; value: string; pos: number }
  | { type: 'name'; text: string; pos: number }
  | { type: 'op'; text: string; pos: number }
  /** 문장 끝 (줄바꿈 또는 `;`) */
  | { type: 'sep'; pos: number }
  | { type: 'eof'; pos: number };

/** 낱말 개수 상한 (긴 입력이 해석기를 오래 붙잡지 않게) */
export const MAX_TOKENS = 400;

const TWO_CHAR_OPS = new Set(['**', '//', '==', '!=', '<=', '>=']);
const ONE_CHAR_OPS = new Set([...'+-*/%(),=<>[]{}.:']);
/** 문자열 앞 접두사 (f-문자열·바이트 등은 체험 공책이 모름. u·U는 그냥 문자열) */
const STRING_PREFIXES = new Set(['f', 'r', 'b', 'rb', 'br', 'fr', 'rf']);

const isDigit = (c: string) => c >= '0' && c <= '9';
const isAsciiNameStart = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
/** 한 글자 검사라 정규식이 되돌아가며 헤맬 일이 없다 */
const LETTER = /^\p{L}$/u;
const isNameStart = (c: string) => isAsciiNameStart(c) || LETTER.test(c);
const isNameChar = (c: string) => isNameStart(c) || isDigit(c);

function hex(c: string): string {
  return (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
}

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const parens: number[] = [];
  let i = 0;
  let line = 1;
  let lineStart = true;
  const push = (t: Token) => {
    out.push(t);
    if (out.length > MAX_TOKENS) fail('too_long', null);
  };

  while (i < src.length) {
    const c = src[i];

    // 줄 맨 앞 빈칸 = 들여쓰기 (빈 줄·주석 줄은 괜찮음)
    if (lineStart && parens.length === 0) {
      let j = i;
      while (src[j] === ' ' || src[j] === '\t') j += 1;
      lineStart = false;
      if (j > i && j < src.length && src[j] !== '\n' && src[j] !== '#') {
        fail('indent', 'IndentationError', 'unexpected indent');
      }
      i = j;
      continue;
    }

    if (c === '\n') {
      if (parens.length === 0) push({ type: 'sep', pos: i });
      line += 1;
      lineStart = true;
      i += 1;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i += 1;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
      line += 1;
      continue;
    }

    // 숫자
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      const start = i;
      let float = false;
      while (isDigit(src[i] ?? '') || src[i] === '_') i += 1;
      if (src[i] === '.') {
        float = true;
        i += 1;
        while (isDigit(src[i] ?? '') || src[i] === '_') i += 1;
      }
      if (src[i] === 'e' || src[i] === 'E') {
        const save = i;
        i += 1;
        if (src[i] === '+' || src[i] === '-') i += 1;
        if (isDigit(src[i] ?? '')) {
          float = true;
          while (isDigit(src[i] ?? '') || src[i] === '_') i += 1;
        } else {
          i = save;
        }
      }
      if (i < src.length && isNameChar(src[i])) {
        fail('syntax', 'SyntaxError', 'invalid decimal literal');
      }
      const text = src.slice(start, i).replaceAll('_', '');
      if (!float && text.length > 1 && text[0] === '0' && /[1-9]/.test(text)) {
        fail(
          'syntax',
          'SyntaxError',
          'leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers',
        );
      }
      push({ type: 'num', text, float, pos: start });
      continue;
    }

    // 이름 (한글 이름도 파이썬에서는 이름이다 → 정의되지 않았으면 NameError)
    if (isNameStart(c)) {
      const start = i;
      while (i < src.length && isNameChar(src[i])) i += 1;
      const text = src.slice(start, i);
      const next = src[i];
      if (next === '"' || next === "'") {
        const p = text.toLowerCase();
        if (STRING_PREFIXES.has(p)) fail('unsupported', null);
        if (p === 'u') continue; // u"…" = 그냥 문자열
      }
      push({ type: 'name', text, pos: start });
      continue;
    }

    // 문자열
    if (c === '"' || c === "'") {
      const start = i;
      i += 1;
      let value = '';
      for (;;) {
        const d = src[i];
        if (d === undefined || d === '\n') {
          fail(
            'unterminated_string',
            'SyntaxError',
            `unterminated string literal (detected at line ${line})`,
          );
        }
        if (d === c) {
          i += 1;
          break;
        }
        if (d === '\\') {
          const e = src[i + 1];
          if (e === undefined) {
            i += 1;
            continue;
          }
          const map: Record<string, string> = {
            n: '\n',
            t: '\t',
            r: '\r',
            '\\': '\\',
            "'": "'",
            '"': '"',
            '\n': '',
            '0': '\0',
          };
          // 모르는 이스케이프는 파이썬처럼 역슬래시를 그대로 둔다
          value += e in map ? map[e] : `\\${e}`;
          if (e === '\n') line += 1;
          i += 2;
          continue;
        }
        value += d;
        i += 1;
      }
      push({ type: 'str', value, pos: start });
      continue;
    }

    // 기호
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      push({ type: 'op', text: two, pos: i });
      i += 2;
      continue;
    }
    if (c === ';') {
      push({ type: 'sep', pos: i });
      i += 1;
      continue;
    }
    if (ONE_CHAR_OPS.has(c)) {
      if (c === '(' || c === '[' || c === '{') parens.push(i);
      if (c === ')' || c === ']' || c === '}') {
        if (parens.length === 0) {
          fail(
            c === ')' ? 'unmatched_paren' : 'syntax',
            'SyntaxError',
            `unmatched '${c}'`,
          );
        }
        parens.pop();
      }
      push({ type: 'op', text: c, pos: i });
      i += 1;
      continue;
    }

    const ch = String.fromCodePoint(src.codePointAt(i) ?? 0);
    fail(
      'invalid_char',
      'SyntaxError',
      ch.charCodeAt(0) > 127
        ? `invalid character '${ch}' (U+${hex(ch)})`
        : 'invalid syntax',
      ch,
    );
  }

  if (parens.length > 0) {
    const open = src[parens[parens.length - 1]];
    fail('unclosed_paren', 'SyntaxError', `'${open}' was never closed`);
  }
  push({ type: 'eof', pos: src.length });
  return out;
}
