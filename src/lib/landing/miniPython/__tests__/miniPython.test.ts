import { describe, expect, it } from 'vitest';
import {
  MAX_CODE_LENGTH,
  MINI_ERROR_KINDS,
  autoCorrect,
  explain,
  runMiniPython,
  type MiniResult,
} from '..';
import { bugbugLine } from '../messages';
import { pyFloatRepr } from '../values';
import { closeToPrint, koreanKeyboardTo } from '../typos';

/**
 * 진짜 파이썬 3.12와 대조한 표 (`python3 -I -c <코드>`의 stdout, 마지막 stderr 줄, 그리고 우리 분류).
 * 표를 늘릴 때는 같은 방법으로 실제 출력을 받아 적는다. 체험 공책이 모르는 문법(리스트·비교·f-문자열 등)은 아래 따로.
 */
const TABLE: [code: string, stdout: string, stderr: string, kind: string][] = [
  ['print("안녕!")', '안녕!\n', '', 'ok'],
  ["print('hi')", 'hi\n', '', 'ok'],
  ['print("a", "b", 3)', 'a b 3\n', '', 'ok'],
  ['print(1, 2, sep="-")', '1-2\n', '', 'ok'],
  ['print("a", end="!")', 'a!', '', 'ok'],
  ['print("x", end=""); print("y")', 'xy\n', '', 'ok'],
  ['print(1 + 2 * 3)', '7\n', '', 'ok'],
  ['print((1 + 2) * 3)', '9\n', '', 'ok'],
  ['print(7 / 2)', '3.5\n', '', 'ok'],
  ['print(7 // 2)', '3\n', '', 'ok'],
  ['print(-7 // 2)', '-4\n', '', 'ok'],
  ['print(7 % 3)', '1\n', '', 'ok'],
  ['print(-7 % 3)', '2\n', '', 'ok'],
  ['print(7 % -3)', '-2\n', '', 'ok'],
  ['print(2 ** 10)', '1024\n', '', 'ok'],
  ['print(2 ** 100)', '1267650600228229401496703205376\n', '', 'ok'],
  ['print(2 ** -1)', '0.5\n', '', 'ok'],
  ['print(-2 ** 2)', '-4\n', '', 'ok'],
  ['print((-2) ** 2)', '4\n', '', 'ok'],
  ['print(2 ** 3 ** 2)', '512\n', '', 'ok'],
  ['print(10 / 5)', '2.0\n', '', 'ok'],
  ['print(0.1 + 0.2)', '0.30000000000000004\n', '', 'ok'],
  ['print(1e16)', '1e+16\n', '', 'ok'],
  ['print(1.5e16)', '1.5e+16\n', '', 'ok'],
  ['print(0.0001)', '0.0001\n', '', 'ok'],
  ['print(0.00001)', '1e-05\n', '', 'ok'],
  ['print(123456789.123)', '123456789.123\n', '', 'ok'],
  ['print(1/3)', '0.3333333333333333\n', '', 'ok'],
  ['print(2/3)', '0.6666666666666666\n', '', 'ok'],
  ['print(100.0)', '100.0\n', '', 'ok'],
  ['print(3.0 * 2)', '6.0\n', '', 'ok'],
  ['print(7.5 // 2)', '3.0\n', '', 'ok'],
  ['print(-7.5 // 2)', '-4.0\n', '', 'ok'],
  ['print(7.5 % 2)', '1.5\n', '', 'ok'],
  ['print(-7.5 % 2)', '0.5\n', '', 'ok'],
  ['print(1e300 * 1e10)', 'inf\n', '', 'ok'],
  ['print(-0.0)', '-0.0\n', '', 'ok'],
  ['print(2.5 ** 2)', '6.25\n', '', 'ok'],
  ['print("하" * 3)', '하하하\n', '', 'ok'],
  ['print(3 * "하")', '하하하\n', '', 'ok'],
  ['print("하" * 0)', '\n', '', 'ok'],
  ['print("하" * -2)', '\n', '', 'ok'],
  ['print("파이" + "썬")', '파이썬\n', '', 'ok'],
  ['print("a" "b")', 'ab\n', '', 'ok'],
  ['print("줄1\\n줄2")', '줄1\n줄2\n', '', 'ok'],
  ['print("탭\\t끝")', '탭\t끝\n', '', 'ok'],
  ["print('It\\'s')", "It's\n", '', 'ok'],
  ['print("\\"따옴표\\"")', '"따옴표"\n', '', 'ok'],
  ['print("\\\\")', '\\\n', '', 'ok'],
  ['print("\\q")', '\\q\n', '', 'ok'],
  ['print(True, False, None)', 'True False None\n', '', 'ok'],
  ['print(True + 1)', '2\n', '', 'ok'],
  ['print("a" * True)', 'a\n', '', 'ok'],
  ['print()', '\n', '', 'ok'],
  ['print("")', '\n', '', 'ok'],
  ['x = 3\nprint(x * 2)', '6\n', '', 'ok'],
  ['x = "파"; y = x * 2; print(y)', '파파\n', '', 'ok'],
  ['print(1) # 주석', '1\n', '', 'ok'],
  ['# 주석만', '', '', 'no_print'],
  ['3 + 4', '', '', 'no_print'],
  ['print(1_000)', '1000\n', '', 'ok'],
  ['print(.5)', '0.5\n', '', 'ok'],
  ['print(5.)', '5.0\n', '', 'ok'],
  ['print(+3, -(-3))', '3 3\n', '', 'ok'],
  ['print(-"a")', '', "TypeError: bad operand type for unary -: 'str'", 'type'],
  ['print(1/0)', '', 'ZeroDivisionError: division by zero', 'zero_division'],
  [
    'print(1//0)',
    '',
    'ZeroDivisionError: integer division or modulo by zero',
    'zero_division',
  ],
  [
    'print(1%0)',
    '',
    'ZeroDivisionError: integer modulo by zero',
    'zero_division',
  ],
  [
    'print(1.0/0)',
    '',
    'ZeroDivisionError: float division by zero',
    'zero_division',
  ],
  [
    'print(1.0//0)',
    '',
    'ZeroDivisionError: float floor division by zero',
    'zero_division',
  ],
  ['print(1.0%0)', '', 'ZeroDivisionError: float modulo', 'zero_division'],
  [
    'print(0**-1)',
    '',
    'ZeroDivisionError: 0.0 cannot be raised to a negative power',
    'zero_division',
  ],
  [
    'print("나이: " + 10)',
    '',
    'TypeError: can only concatenate str (not "int") to str',
    'str_plus_number',
  ],
  [
    'print(10 + "살")',
    '',
    "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
    'str_plus_number',
  ],
  [
    'print("a" * "b")',
    '',
    "TypeError: can't multiply sequence by non-int of type 'str'",
    'str_times',
  ],
  [
    'print("a" * 1.5)',
    '',
    "TypeError: can't multiply sequence by non-int of type 'float'",
    'str_times',
  ],
  [
    'print("a" - "b")',
    '',
    "TypeError: unsupported operand type(s) for -: 'str' and 'str'",
    'type',
  ],
  [
    'pirnt("hi")',
    '',
    "NameError: name 'pirnt' is not defined. Did you mean: 'print'?",
    'print_typo',
  ],
  [
    'Print("hi")',
    '',
    "NameError: name 'Print' is not defined. Did you mean: 'print'?",
    'print_case',
  ],
  ['PRINT("hi")', '', "NameError: name 'PRINT' is not defined", 'print_case'],
  [
    'prnt(1)',
    '',
    "NameError: name 'prnt' is not defined. Did you mean: 'print'?",
    'print_typo',
  ],
  ['say("hi")', '', "NameError: name 'say' is not defined", 'unknown_function'],
  ['print(안녕)', '', "NameError: name '안녕' is not defined", 'unquoted_text'],
  [
    'print(hello world)',
    '',
    'SyntaxError: invalid syntax. Perhaps you forgot a comma?',
    'unquoted_text',
  ],
  [
    'print "hi"',
    '',
    "SyntaxError: Missing parentheses in call to 'print'. Did you mean print(...)?",
    'print_no_parens',
  ],
  [
    'print("a" 3)',
    '',
    'SyntaxError: invalid syntax. Perhaps you forgot a comma?',
    'missing_comma',
  ],
  ['print("hi"', '', "SyntaxError: '(' was never closed", 'unclosed_paren'],
  [
    'print("hi)',
    '',
    'SyntaxError: unterminated string literal (detected at line 1)',
    'unterminated_string',
  ],
  ['print("hi"))', '', "SyntaxError: unmatched ')'", 'unmatched_paren'],
  ['  print(1)', '', 'IndentationError: unexpected indent', 'indent'],
  [
    'print(1 × 2)',
    '',
    "SyntaxError: invalid character '×' (U+00D7)",
    'invalid_char',
  ],
  ['print(1 $ 2)', '', 'SyntaxError: invalid syntax', 'invalid_char'],
  [
    'print(007)',
    '',
    'SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers',
    'syntax',
  ],
  ['print(3a)', '', 'SyntaxError: invalid decimal literal', 'syntax'],
  [
    'print(1, sep=2)',
    '',
    'TypeError: sep must be None or a string, not int',
    'type',
  ],
  [
    'print(1, foo=2)',
    '',
    "TypeError: 'foo' is an invalid keyword argument for print()",
    'type',
  ],
  [
    'print(sep="a", 1)',
    '',
    'SyntaxError: positional argument follows keyword argument',
    'syntax',
  ],
  [
    'print(1, sep="a", sep="b")',
    '',
    'SyntaxError: keyword argument repeated: sep',
    'syntax',
  ],
  ['x = 3\nx(1)', '', "TypeError: 'int' object is not callable", 'type'],
  ['True = 3', '', 'SyntaxError: cannot assign to True', 'syntax'],
  [
    'print(1)\nprint(1/0)\nprint(2)',
    '1\n',
    'ZeroDivisionError: division by zero',
    'zero_division',
  ],
  [
    'print("a")\nprint("b"',
    '',
    "SyntaxError: '(' was never closed",
    'unclosed_paren',
  ],
  [
    'print(10 ** 400.0)',
    '',
    "OverflowError: (34, 'Numerical result out of range')",
    'too_big',
  ],
  ['print(u"hi")', 'hi\n', '', 'ok'],
  ['print("a", sep=None)', 'a\n', '', 'ok'],
  [
    'print(1 2)',
    '',
    'SyntaxError: invalid syntax. Perhaps you forgot a comma?',
    'missing_comma',
  ],
  ['print(,)', '', 'SyntaxError: invalid syntax', 'syntax'],
  ['print(1,)', '1\n', '', 'ok'],
  ['print("a"\n)', 'a\n', '', 'ok'],
  ['print("a" + "b" * 2)', 'abb\n', '', 'ok'],
];

/** 결과를 파이썬 표기로 (오류는 "이름: 문장") */
function asPython(r: MiniResult): [string, string] {
  if (r.ok) return [r.out, ''];
  return [
    r.out,
    r.error.pyType ? `${r.error.pyType}: ${r.error.pyMessage}` : '',
  ];
}

describe('runMiniPython = 진짜 파이썬 3.12', () => {
  it.each(TABLE)('%j', (code, stdout, stderr, kind) => {
    const r = runMiniPython(code);
    expect(asPython(r)).toEqual([stdout, stderr]);
    const got = r.ok ? (r.printed ? 'ok' : 'no_print') : r.error.kind;
    expect(got).toBe(kind);
  });
});

describe('체험 공책이 모르는 문법은 unsupported (파이썬에서는 됨)', () => {
  it.each([
    'print(len("a"))',
    'print(input())',
    'print(1 < 2)',
    'print([1])',
    'print("a".upper())',
    'print(f"hi")',
    'if 1: print(1)',
    'print("%s" % 1)',
    'print((1, 2))',
    'print((-8) ** 0.5)',
    'for i in range(3): print(i)',
  ])('%s', (code) => {
    const r = runMiniPython(code);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('unsupported');
      expect(r.error.pyType).toBeNull();
    }
  });
});

describe('상한 (오래 걸리거나 화면을 덮지 않게)', () => {
  it('빈 공책', () => {
    expect(runMiniPython('   ')).toMatchObject({
      ok: false,
      error: { kind: 'empty' },
    });
  });
  it('입력·출력·반복·거듭제곱·중첩', () => {
    expect(
      runMiniPython(`print("${'a'.repeat(MAX_CODE_LENGTH)}")`),
    ).toMatchObject({
      error: { kind: 'too_long' },
    });
    expect(runMiniPython('print("하" * 100000000)')).toMatchObject({
      error: { kind: 'too_long' },
    });
    expect(runMiniPython('print(9 ** 99999)')).toMatchObject({
      error: { kind: 'too_big' },
    });
    expect(
      runMiniPython(`print(${'('.repeat(60)}1${')'.repeat(60)})`),
    ).toMatchObject({
      error: { kind: 'too_long' },
    });
    expect(runMiniPython(`print(${'-'.repeat(80)}1)`)).toMatchObject({
      error: { kind: 'too_long' },
    });
  });
  it('긴 입력도 금방 끝난다', () => {
    const codes = [
      'print(' + '"a"+'.repeat(70) + '"a")',
      'print("' + '\\'.repeat(290) + '")',
      '1+'.repeat(149) + '1',
      '"'.repeat(299),
    ];
    for (const c of codes) {
      const t0 = performance.now();
      runMiniPython(c);
      expect(performance.now() - t0).toBeLessThan(100);
    }
  });
});

describe('아이용 안내', () => {
  it('모든 오류 종류에 문장이 있고, 틀린 이름을 짚어 준다', () => {
    for (const kind of MINI_ERROR_KINDS) {
      const text = explain({ kind, pyType: null, pyMessage: '', detail: 'x' });
      expect(text.length).toBeGreaterThan(5);
    }
    const r = runMiniPython('pirnt("hi")');
    expect(!r.ok && explain(r.error)).toContain('pirnt');
    const q = runMiniPython('print(안녕)');
    expect(!q.ok && explain(q.error)).toContain('print("안녕")');
  });
  it('버그버그 한마디는 결과 칸 안내를 되풀이하지 않고, 다시 틀리면 다른 말 (P4-13)', () => {
    for (const kind of MINI_ERROR_KINDS) {
      const a = bugbugLine(kind, 0);
      const b = bugbugLine(kind, 1);
      expect(a, kind).toContain('결과 칸');
      expect(b, kind).not.toBe(a);
      expect(bugbugLine(kind, 2), kind).toBe(a);
      const text = explain({ kind, pyType: null, pyMessage: '', detail: 'x' });
      expect(a).not.toContain(text);
      expect([...a].length, kind).toBeLessThanOrEqual(26);
    }
  });
  it('긴 이름은 줄여서 말한다', () => {
    const r = runMiniPython('print(가나다라마바사아자차카타파하)');
    expect(!r.ok && explain(r.error)).toContain('…');
  });
});

describe('print 오타·한글 자판', () => {
  it('철자가 가까운 이름', () => {
    for (const id of ['pirnt', 'prnt', 'printt', 'pint', 'pritn', 'sprint']) {
      expect(closeToPrint(id), id).toBe(true);
    }
    for (const id of ['pr', 'say', 'hello', 'print']) {
      expect(closeToPrint(id), id).toBe(false);
    }
  });
  it('한글 자판으로 친 print (ㅔ갸ㅜㅅ)', () => {
    expect(koreanKeyboardTo('ㅔ갸ㅜㅅ', 'print')).toBe(true);
    expect(koreanKeyboardTo('안녕', 'print')).toBe(false);
    expect(koreanKeyboardTo('print', 'print')).toBe(false);
    const r = runMiniPython('ㅔ갸ㅜㅅ("안녕")');
    expect(r).toMatchObject({
      ok: false,
      error: { kind: 'korean_keyboard', pyType: 'NameError' },
    });
  });
});

describe('autoCorrect (휴대폰 둥근 따옴표·전각 괄호)', () => {
  it.each([
    ['print(“안녕”)', 'print("안녕")'],
    ['print(‘hi’)', "print('hi')"],
    ['print（"a"）', 'print("a")'],
    ['print("그가 “안녕” 했다")', 'print("그가 “안녕” 했다")'],
    ["print('It’s')", "print('It’s')"],
    ['print(“a”, “b”)', 'print("a", "b")'],
  ])('%s → %s', (input, output) => {
    expect(autoCorrect(input)).toBe(output);
    expect(autoCorrect(input).length).toBe(input.length);
  });
  it('둥근 따옴표로 쓴 주문도 실행된다', () => {
    expect(runMiniPython('print(“안녕”)')).toEqual({
      ok: true,
      out: '안녕\n',
      printed: true,
    });
  });
});

describe('pyFloatRepr = 파이썬 repr(float)', () => {
  it.each([
    [0.1 + 0.2, '0.30000000000000004'],
    [1e16, '1e+16'],
    [1e-5, '1e-05'],
    [123.0, '123.0'],
    [1.5e300, '1.5e+300'],
    [-2.5, '-2.5'],
    [Infinity, 'inf'],
    [NaN, 'nan'],
    [1e15, '1000000000000000.0'],
    [0.0001, '0.0001'],
  ])('%d → %s', (x, s) => {
    expect(pyFloatRepr(x)).toBe(s);
  });
});
