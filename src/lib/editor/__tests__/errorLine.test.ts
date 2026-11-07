import { describe, it, expect } from 'vitest';
import { STUDENT_FILENAME as CORE_FILENAME } from '../../../../public/workers/pyodide-core.mjs';
import { STUDENT_FILENAME, errorLineFromStderr } from '../errorLine';

const TB = 'Traceback (most recent call last):';

describe('오류 줄 찾기 (P2-18)', () => {
  it('파일 이름은 실행 코어와 같다', () => {
    expect(STUDENT_FILENAME).toBe(CORE_FILENAME);
  });

  it('학생 코드 프레임의 줄 번호를 찾는다 (여러 개면 가장 안쪽 = 마지막)', () => {
    expect(
      errorLineFromStderr(
        `${TB}\n  File "<exec>", line 1, in <module>\nNameError: name 'y' is not defined\n`,
      ),
    ).toBe(1);
    expect(
      errorLineFromStderr(
        `${TB}\n  File "<exec>", line 5, in <module>\n  File "<exec>", line 2, in f\nZeroDivisionError: division by zero\n`,
      ),
    ).toBe(2);
    // SyntaxError는 in <module> 없이 줄만
    expect(
      errorLineFromStderr(
        '  File "<exec>", line 3\n    print("a"\n         ^\nSyntaxError: \'(\' was never closed\n',
      ),
    ).toBe(3);
  });

  it('경고·직접 쓴 stderr·빈 값은 null', () => {
    expect(
      errorLineFromStderr(
        "<exec>:2: SyntaxWarning: invalid escape sequence '\\d'\n",
      ),
    ).toBeNull();
    expect(errorLineFromStderr('그냥 메시지')).toBeNull();
    expect(errorLineFromStderr('')).toBeNull();
    expect(errorLineFromStderr(undefined)).toBeNull();
    // 다른 파일 프레임은 무시
    expect(
      errorLineFromStderr(`${TB}\n  File "/lib/python3.13/x.py", line 9\n`),
    ).toBeNull();
  });
});
