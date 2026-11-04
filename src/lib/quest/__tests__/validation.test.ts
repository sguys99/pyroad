import { describe, it, expect } from 'vitest';
import {
  blankCommentsAndStrings,
  codeContains,
  validateResult,
} from '../validation';

describe('validateResult', () => {
  describe('output_match', () => {
    it('stdout과 expected가 정확히 일치하면 통과', () => {
      const result = validateResult({
        validationType: 'output_match',
        expectedOutput: 'Hello, World!',
        stdout: 'Hello, World!',
        studentCode: '',
      });
      expect(result).toEqual({ passed: true, type: 'output_match' });
    });

    it('앞뒤 공백/개행이 있어도 trim 후 일치하면 통과', () => {
      const result = validateResult({
        validationType: 'output_match',
        expectedOutput: 'Hello',
        stdout: '  Hello\n',
        studentCode: '',
      });
      expect(result.passed).toBe(true);
    });

    it('내용이 다르면 실패', () => {
      const result = validateResult({
        validationType: 'output_match',
        expectedOutput: 'Hello',
        stdout: 'Bye',
        studentCode: '',
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('contains', () => {
    it('stdout에 expected가 포함되면 통과', () => {
      const result = validateResult({
        validationType: 'contains',
        expectedOutput: 'World',
        stdout: 'Hello, World! Nice.',
        studentCode: '',
      });
      expect(result).toEqual({ passed: true, type: 'contains' });
    });

    it('stdout에 expected가 없으면 실패', () => {
      const result = validateResult({
        validationType: 'contains',
        expectedOutput: 'Python',
        stdout: 'Hello, World!',
        studentCode: '',
      });
      expect(result.passed).toBe(false);
    });
  });

  describe('code_check', () => {
    it('studentCode에 expected 문자열이 포함되면 통과', () => {
      const result = validateResult({
        validationType: 'code_check',
        expectedOutput: 'for i in range',
        stdout: '',
        studentCode: 'for i in range(10):\n  print(i)',
      });
      expect(result).toEqual({ passed: true, type: 'code_check' });
    });

    it('studentCode에 expected가 없으면 실패', () => {
      const result = validateResult({
        validationType: 'code_check',
        expectedOutput: 'while',
        stdout: '',
        studentCode: 'for i in range(10):\n  print(i)',
      });
      expect(result.passed).toBe(false);
    });

    // B25: 주석·문자열 안의 글자로는 통과할 수 없음
    it.each([
      ['주석만', '# while 쓰면 돼요\nprint("hi")'],
      ['줄 끝 주석', 'x = 1  # while'],
      ['큰따옴표 문자열', 'print("while")'],
      ['작은따옴표 문자열', "print('while 문')"],
      ['삼중따옴표 문자열', '"""\nwhile True:\n    pass\n"""\nprint(1)'],
      ['f-string 글자 부분', 'n = 3\nprint(f"while {n}")'],
      ['raw·bytes 문자열', 'a = r"\\while"\nb = b"while"'],
    ])('%s 안의 while로는 code_check "while" 실패', (_label, code) => {
      const result = validateResult({
        validationType: 'code_check',
        expectedOutput: 'while',
        stdout: '',
        studentCode: code,
      });
      expect(result.passed).toBe(false);
    });

    it('실제 while 문은 주석·문자열과 함께 있어도 통과', () => {
      const code = [
        '# while 반복문 연습',
        'count = 3',
        'while count > 0:  # 3번 반복',
        '    print("남은 횟수:", count)',
        '    count = count - 1',
      ].join('\n');
      const result = validateResult({
        validationType: 'code_check',
        expectedOutput: 'while',
        stdout: '',
        studentCode: code,
      });
      expect(result.passed).toBe(true);
    });

    it('문자열 안의 #은 주석이 아니므로 뒤의 코드는 그대로 검사', () => {
      expect(codeContains('print("#") ; x = len("abc")', 'len(')).toBe(true);
      expect(codeContains('s = "#"; t = "for"', 'for')).toBe(false);
    });

    it('f-string의 {식} 부분은 코드로 검사', () => {
      expect(
        codeContains('name = "파이"\nprint(f"길이: {len(name)}")', 'len('),
      ).toBe(true);
      expect(codeContains('print(f"len(name)")', 'len(')).toBe(false);
    });

    describe('wholeWord 옵션 (B30)', () => {
      const prevStep =
        'import random\n\nsecret = random.randint(1, 10)\nprint(secret)';

      it('기본값은 부분 문자열 비교라서 randint( 안의 int(도 걸림 (기존 동작)', () => {
        expect(codeContains(prevStep, 'int(')).toBe(true);
      });

      it('wholeWord면 randint( 안의 int(는 무시', () => {
        expect(codeContains(prevStep, 'int(', { wholeWord: true })).toBe(false);
        expect(
          codeContains(
            prevStep + '\nguess = int(random.randint(1, 10))',
            'int(',
            { wholeWord: true },
          ),
        ).toBe(true);
      });

      it('validateResult에 codeCheck 옵션으로 전달', () => {
        const result = validateResult({
          validationType: 'code_check',
          expectedOutput: 'int(',
          stdout: '',
          studentCode: prevStep,
          codeCheck: { wholeWord: true },
        });
        expect(result.passed).toBe(false);
      });

      it('패턴 끝이 식별자 글자가 아니면 그쪽 경계는 보지 않음', () => {
        const whole = { wholeWord: true };
        expect(codeContains('x = int(3)', 'int(', whole)).toBe(true);
        expect(codeContains('items.append(1)', '.append', whole)).toBe(true);
        expect(codeContains('while_count = 1', 'while', whole)).toBe(false);
        expect(codeContains('내점수 = 1', '점수', whole)).toBe(false);
      });
    });
  });

  describe('blankCommentsAndStrings', () => {
    it('주석·문자열 내용만 공백으로 바꾸고 #·따옴표·길이·줄바꿈은 유지', () => {
      const code = 'print("hi")  # 인사\nx = \'a#b\'';
      const blanked = blankCommentsAndStrings(code);
      expect(blanked).toBe('print("  ")  #   \nx = \'   \'');
      expect(blanked.length).toBe(code.length);
    });

    it('이스케이프된 따옴표에서 문자열이 끝나지 않음', () => {
      expect(blankCommentsAndStrings('s = "a\\"while"; for')).toBe(
        's = "        "; for',
      );
    });

    it('삼중따옴표 안의 따옴표·줄바꿈 처리', () => {
      expect(blankCommentsAndStrings("t = '''a 'b'\nc'''\nif t: pass")).toBe(
        "t = '''     \n '''\nif t: pass",
      );
    });

    it('f-string: {{ }}는 글자, {식}과 중첩 문자열, 서식 지정 처리', () => {
      expect(blankCommentsAndStrings('f"{{x}} {d["k"]:>{w}}"')).toBe(
        'f"      {d[" "]: {w}}"',
      );
    });

    it('닫히지 않은 한 줄 문자열은 그 줄 끝까지만 지움', () => {
      expect(blankCommentsAndStrings('print("while\nwhile x: pass')).toBe(
        'print("     \nwhile x: pass',
      );
    });
  });

  it('각 validationType에 맞는 type 필드를 반환', () => {
    const types = ['output_match', 'contains', 'code_check'] as const;
    for (const t of types) {
      const result = validateResult({
        validationType: t,
        expectedOutput: '',
        stdout: '',
        studentCode: '',
      });
      expect(result.type).toBe(t);
    }
  });
});
