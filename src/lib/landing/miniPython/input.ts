/**
 * 미니 파이썬 입력 쪽 (P4-12에서 `index.ts`에서 떼어 냄): 입력 상한과 휴대폰 자판 자동 교정.
 * 해석기(`interpret`·`lexer`) 없이 쓸 수 있어 랜딩 공책이 첫 JS에 이것만 싣고, 해석기는 처음 주문을 걸 때 받는다.
 */

/** 공책 입력 상한 (글자) */
export const MAX_CODE_LENGTH = 300;

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
