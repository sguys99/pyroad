/**
 * 미니 파이썬 오류 (P4-03). `kind`는 아이용 안내(`messages.ts`)와 분석 이벤트(`trial_run.result`)가 함께 쓰는 분류,
 * `pyType`·`pyMessage`는 진짜 파이썬 3.12가 내는 오류 이름·문장 (테스트가 실제 출력과 대조).
 * `pyType`이 null이면 진짜 파이썬에서는 되지만 체험 공책이 모르는 것.
 */
export const MINI_ERROR_KINDS = [
  'empty',
  'unterminated_string',
  'unclosed_paren',
  'unmatched_paren',
  'print_no_parens',
  'print_typo',
  'print_case',
  'korean_keyboard',
  'unknown_function',
  'unquoted_text',
  'missing_comma',
  'invalid_char',
  'indent',
  'syntax',
  'zero_division',
  'str_plus_number',
  'str_times',
  'type',
  'unsupported',
  'too_long',
  'too_big',
] as const;

export type MiniErrorKind = (typeof MINI_ERROR_KINDS)[number];

export type PyErrorType =
  | 'SyntaxError'
  | 'IndentationError'
  | 'NameError'
  | 'TypeError'
  | 'ZeroDivisionError'
  | 'OverflowError';

export interface MiniError {
  kind: MiniErrorKind;
  pyType: PyErrorType | null;
  /** 진짜 파이썬의 오류 문장 (콜론 뒤). 체험 공책만의 오류면 빈 문자열 */
  pyMessage: string;
  /** 안내에 넣을 조각 (틀린 이름·기호 등). 화면에만 쓰고 분석에는 보내지 않는다 */
  detail?: string;
}

/** 해석기 안에서 던지고 `runMiniPython`이 받아 결과로 바꾼다 */
export class MiniPythonError extends Error {
  constructor(public readonly info: MiniError) {
    super(info.pyMessage || info.kind);
  }
}

export function fail(
  kind: MiniErrorKind,
  pyType: PyErrorType | null,
  pyMessage = '',
  detail?: string,
): never {
  throw new MiniPythonError({ kind, pyType, pyMessage, detail });
}
