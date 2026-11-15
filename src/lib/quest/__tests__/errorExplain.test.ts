import { describe, it, expect } from 'vitest';
import { bugbugTaunt, explainError } from '../errorExplain';

/** Python 3.14 traceback 모양 (마지막 줄은 실제 python3 출력에서 옮김) */
const tb = (line: number, last: string) =>
  `Traceback (most recent call last):\n  File "<exec>", line ${line}, in <module>\n    ...\n${last}\n`;

describe('explainError', () => {
  it.each([
    [
      "NameError: name 'scroe' is not defined. Did you mean: 'score'?",
      'NameError',
      /scroe 라는 이름은 처음 봐요\. 혹시 score 를/,
    ],
    [
      "NameError: name 'nmae' is not defined",
      'NameError',
      /nmae 라는 이름은 처음 봐요\. 철자가/,
    ],
    [
      'SyntaxError: unterminated string literal (detected at line 1)',
      'SyntaxError',
      /따옴표를 열고 닫지/,
    ],
    ["SyntaxError: '(' was never closed", 'SyntaxError', /\( 를 닫지.*\) 를/],
    ["SyntaxError: unmatched ')'", 'SyntaxError', /\) 가 짝 없이/],
    [
      "SyntaxError: closing parenthesis ']' does not match opening parenthesis '('",
      'SyntaxError',
      /\( 로 열었으면 \) 로 닫아야/,
    ],
    [
      "SyntaxError: Missing parentheses in call to 'print'. Did you mean print(...)?",
      'SyntaxError',
      /print 뒤에는 괄호/,
    ],
    ["SyntaxError: expected ':'", 'SyntaxError', /쌍점\(:\)이 있어야/],
    [
      "SyntaxError: invalid character '“' (U+201C)",
      'SyntaxError',
      /둥근 따옴표/,
    ],
    [
      'SyntaxError: invalid syntax. Perhaps you forgot a comma?',
      'SyntaxError',
      /쉼표\(,\)가 빠진/,
    ],
    [
      "SyntaxError: invalid syntax. Maybe you meant '==' or ':=' instead of '='?",
      'SyntaxError',
      /== 두 개/,
    ],
    [
      "IndentationError: expected an indented block after 'if' statement on line 1",
      'IndentationError',
      /빈칸 4개만큼/,
    ],
    [
      'IndentationError: unexpected indent',
      'IndentationError',
      /필요 없는 빈칸/,
    ],
    [
      'TypeError: can only concatenate str (not "int") to str',
      'TypeError',
      /글자와 숫자는 \+ 로/,
    ],
    [
      "TypeError: unsupported operand type(s) for +: 'int' and 'str'",
      'TypeError',
      /숫자와 글자는 \+ 로/,
    ],
    ['ZeroDivisionError: division by zero', 'ZeroDivisionError', /0으로는/],
    [
      "ValueError: invalid literal for int() with base 10: 'a'",
      'ValueError',
      /int\( \)로 바꾸려고/,
    ],
    ['IndexError: list index out of range', 'IndexError', /없는 번호/],
    // 2월드 (P10-08)
    ['IndexError: string index out of range', 'IndexError', /글자에 없는 자리/],
    ["KeyError: 'apple'", 'KeyError', /'apple' 라는 이름표\(키\)/],
    [
      "ValueError: could not convert string to float: 'a'",
      'ValueError',
      /바꿀 수 없어요/,
    ],
    [
      "TypeError: 'str' object does not support item assignment",
      'TypeError',
      /한 자리만 바꿔/,
    ],
    [
      'TypeError: list indices must be integers or slices, not str',
      'TypeError',
      /정수여야/,
    ],
    [
      "ModuleNotFoundError: No module named 'randon'",
      'ModuleNotFoundError',
      /randon 라는 모듈/,
    ],
    [
      "AttributeError: module 'random' has no attribute 'randit'",
      'AttributeError',
      /random 모듈에는 randit/,
    ],
  ])('%s', (last, type, re) => {
    const e = explainError(tb(3, last));
    expect(e.type).toBe(type);
    expect(e.line).toBe(3);
    expect(e.text).toMatch(/^3번째 줄을 봐요\. /);
    expect(e.text).toMatch(re);
  });

  it('줄을 모르면 줄 없이, 모르는 오류는 기본 문장', () => {
    const e = explainError('Something odd happened');
    expect(e).toEqual({
      type: null,
      line: null,
      text: expect.stringContaining('파이뱀에게 물어봐요'),
    });
  });

  it('모르는 SyntaxError는 SyntaxError 기본 문장', () => {
    expect(explainError(tb(1, 'SyntaxError: weird')).text).toMatch(
      /주문 모양이 조금 이상해요/,
    );
  });
});

describe('bugbugTaunt', () => {
  it('줄 번호가 있으면 넣는다', () => {
    expect(bugbugTaunt(2)).toBe('히히, 2번째 줄에 숨었지!');
    expect(bugbugTaunt(null)).toBe('히히, 버그 찾았다!');
  });
});
