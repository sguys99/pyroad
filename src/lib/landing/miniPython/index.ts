import { MiniPythonError, type MiniError } from './errors';
import { execute, type RunState } from './interpret';
import { MAX_CODE_LENGTH, autoCorrect } from './input';

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
// 입력칸이 바로 쓰는 가벼운 것 (해석기 없이, P4-12: 공책은 해석기를 첫 실행 때 받는다)
export { MAX_CODE_LENGTH, autoCorrect } from './input';

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
