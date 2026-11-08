import { MiniPythonError, type MiniError } from './errors';
import { execute, type RunState } from './interpret';

/**
 * 랜딩 30초 체험용 미니 파이썬 (P4-03, §12-Q41). Pyodide를 싣지 않고 `print`와 문자열·숫자 셈만 한다.
 * eval·Function 없이 직접 읽고 실행하며, 입력·출력·숫자 크기·중첩에 상한이 있어 오래 걸리지 않는다.
 *
 * 되는 것: print(여러 값, sep=, end=) · 문자열(작은·큰따옴표, \n \t \" \' \\) · 정수(크기 상한)·실수 ·
 * + - * / // % ** · 괄호 · 문자열+문자열 · 문자열*정수 · True/False/None · 변수 대입 · 줄바꿈·`;`로 여러 문장 · # 주석.
 * 출력 글자와 오류 이름·문장은 진짜 파이썬 3.12와 같게 맞췄다 (`__tests__/miniPython.test.ts` 표).
 */
export { MINI_ERROR_KINDS, type MiniError, type MiniErrorKind } from './errors';
export { explain, NO_PRINT_HINT } from './messages';

/** 공책 입력 상한 (글자) */
export const MAX_CODE_LENGTH = 300;

export type MiniResult =
  | {
      ok: true;
      /** 찍힌 글자 (print의 줄바꿈 포함) */
      out: string;
      /** print를 한 번이라도 불렀나 (식만 쓴 줄은 아무것도 안 찍힘) */
      printed: boolean;
    }
  | {
      ok: false;
      /** 오류 앞 줄까지 찍힌 글자 */
      out: string;
      error: MiniError;
    };

export function runMiniPython(input: string): MiniResult {
  const code = autoCorrect(input);
  if (code.length > MAX_CODE_LENGTH) {
    return {
      ok: false,
      out: '',
      error: { kind: 'too_long', pyType: null, pyMessage: '' },
    };
  }
  if (code.trim() === '') {
    return {
      ok: false,
      out: '',
      error: { kind: 'empty', pyType: null, pyMessage: '' },
    };
  }
  const state: RunState = { out: '', printed: false };
  try {
    execute(code, state);
    return { ok: true, out: state.out, printed: state.printed };
  } catch (e) {
    if (e instanceof MiniPythonError) {
      return { ok: false, out: state.out, error: e.info };
    }
    // 예상 못 한 오류도 화면을 깨뜨리지 않는다
    return {
      ok: false,
      out: state.out,
      error: { kind: 'syntax', pyType: null, pyMessage: '' },
    };
  }
}

// ── 자동 교정 (휴대폰 자판) ─────────────────────────────────

// 코드포인트로 둔다: 문자열 글자로 쓰면 랜딩 글꼴 서브셋에 들어간다 (화면에 그리지 않는 글자)
const chars = (...codes: number[]) =>
  new Set(codes.map((c) => String.fromCharCode(c)));
/** “ ” „ ‟ ″ ＂ */
const CURLY_DOUBLE = chars(0x201c, 0x201d, 0x201e, 0x201f, 0x2033, 0xff02);
/** ‘ ’ ‚ ‛ ′ ＇ */
const CURLY_SINGLE = chars(0x2018, 0x2019, 0x201a, 0x201b, 0x2032, 0xff07);
/** 전각 （ ） ， */
const FULLWIDTH: Record<string, string> = {
  [String.fromCharCode(0xff08)]: '(',
  [String.fromCharCode(0xff09)]: ')',
  [String.fromCharCode(0xff0c)]: ',',
};

/**
 * iOS "스마트 구두점"이 바꾼 둥근 따옴표와 전각 괄호를 코드용 글자로 되돌린다. 문자열 **밖**의 것만 (그리고 둥근 따옴표로
 * 연 문자열을 닫는 짝까지) 바꾸므로 `"그가 “안녕” 했다"`처럼 문자열 안에 일부러 쓴 둥근 따옴표는 그대로 둔다.
 * 글자 수가 바뀌지 않아 입력칸 커서 위치를 그대로 둘 수 있다.
 */
export function autoCorrect(code: string): string {
  let out = '';
  let quote: '"' | "'" | null = null;
  let curly = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') {
        out += c + (code[i + 1] ?? '');
        i += 1;
        continue;
      }
      const family = CURLY_DOUBLE.has(c) ? '"' : CURLY_SINGLE.has(c) ? "'" : c;
      if (c === quote || (curly && family === quote)) {
        out += quote;
        quote = null;
        continue;
      }
      if (c === '\n') quote = null;
      out += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      curly = false;
      out += c;
      continue;
    }
    if (CURLY_DOUBLE.has(c) || CURLY_SINGLE.has(c)) {
      quote = CURLY_DOUBLE.has(c) ? '"' : "'";
      curly = true;
      out += quote;
      continue;
    }
    out += FULLWIDTH[c] ?? c;
  }
  return out;
}
