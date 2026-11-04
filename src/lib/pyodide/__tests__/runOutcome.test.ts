import { describe, it, expect } from 'vitest';
import { isRunSuccessful, isWarningOnlyStderr } from '../runOutcome';

// 실제 pyodide-worker.js(Pyodide 0.27.5, Node)에서 받은 stderr
const TRACEBACK_HEAD = [
  'Traceback (most recent call last):',
  '  File "/lib/python312.zip/_pyodide/_base.py", line 523, in eval_code',
  '    .run(globals, locals)',
  '     ^^^^^^^^^^^^^^^^^^^^',
  '  File "/lib/python312.zip/_pyodide/_base.py", line 357, in run',
  '    coroutine = eval(self.code, globals, locals)',
  '                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
].join('\n');

const STDERR = {
  syntaxWarning: "<exec>:1: SyntaxWarning: invalid escape sequence '\\d'\n",
  isLiteral:
    '<exec>:2: SyntaxWarning: "is" with \'int\' literal. Did you mean "=="?\n',
  deprecation: '<exec>:2: DeprecationWarning: old\n',
  userWarning: '<exec>:2: UserWarning: hello\n',
  stdlibWarning:
    '/lib/python312.zip/foo.py:12: DeprecationWarning: bar is deprecated\n  bar()\n',
  nameError: `${TRACEBACK_HEAD}\n  File "<exec>", line 1, in <module>\nNameError: name 'y' is not defined\nPythonError`,
  warningThenError: `<exec>:1: SyntaxWarning: invalid escape sequence '\\d'\n${TRACEBACK_HEAD}\n  File "<exec>", line 2, in <module>\nZeroDivisionError: division by zero\nPythonError`,
  blockedModule: '이 모듈은 사용할 수 없어요: os. 안전한 모듈만 사용해 주세요!',
  studentStderr: 'hi\n',
  multilineWarning: '<exec>:2: UserWarning: a\nb\n',
};

describe('isWarningOnlyStderr', () => {
  it.each([
    ['SyntaxWarning', STDERR.syntaxWarning],
    ['is 리터럴 SyntaxWarning', STDERR.isLiteral],
    ['DeprecationWarning', STDERR.deprecation],
    ['UserWarning', STDERR.userWarning],
    ['소스 줄이 붙은 표준 라이브러리 경고', STDERR.stdlibWarning],
    ['경고 여러 개', STDERR.syntaxWarning + STDERR.deprecation],
  ])('%s만 있으면 true', (_label, stderr) => {
    expect(isWarningOnlyStderr(stderr)).toBe(true);
  });

  it.each([
    ['빈 stderr', ''],
    ['NameError Traceback', STDERR.nameError],
    ['경고 뒤 예외', STDERR.warningThenError],
    ['차단 모듈 안내', STDERR.blockedModule],
    ['학생이 직접 쓴 stderr', STDERR.studentStderr],
    [
      '여러 줄 경고 메시지(형식을 모르므로 보수적으로)',
      STDERR.multilineWarning,
    ],
  ])('%s는 false', (_label, stderr) => {
    expect(isWarningOnlyStderr(stderr)).toBe(false);
  });
});

describe('isRunSuccessful', () => {
  it('워커가 성공이라고 하면 성공', () => {
    expect(isRunSuccessful({ success: true, stderr: '' })).toBe(true);
  });

  it('경고만 있으면 워커가 실패라고 해도 성공 (B25)', () => {
    expect(
      isRunSuccessful({ success: false, stderr: STDERR.syntaxWarning }),
    ).toBe(true);
  });

  it('실제 예외나 차단 모듈이면 실패', () => {
    expect(isRunSuccessful({ success: false, stderr: STDERR.nameError })).toBe(
      false,
    );
    expect(
      isRunSuccessful({ success: false, stderr: STDERR.warningThenError }),
    ).toBe(false);
    expect(
      isRunSuccessful({ success: false, stderr: STDERR.blockedModule }),
    ).toBe(false);
  });
});
