import { describe, it, expect } from 'vitest';
import {
  blankCommentsAndStrings,
  codeContains,
  isValidationRule,
  parseStoredRule,
  simplifyRule,
  toStoredRule,
  validateResult,
  validateRule,
  type ValidationRule,
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

// P1-11: 무작위 출력용 contains_any, 여러 규칙 AND인 all (B09·B30, P0-09 patches/proposed-content-fixes.json)
describe('contains_any · all (P1-11)', () => {
  const project3: ValidationRule = {
    type: 'all',
    rules: [
      { type: 'code_check', expected: 'elif' },
      { type: 'contains_any', expected: ['커요', '작아요', '정답'] },
    ],
  };
  const step3Code = [
    'import random',
    'secret = random.randint(1, 10)',
    'guess = int(random.randint(1, 10))',
    'if guess == secret:',
    '    print("정답!")',
    'elif guess < secret:',
    '    print("비밀 숫자가 추측보다 커요!")',
    'else:',
    '    print("비밀 숫자가 추측보다 작아요!")',
  ].join('\n');
  const ctx = (stdout: string, studentCode = '') => ({ stdout, studentCode });

  describe('contains_any', () => {
    const rule: ValidationRule = {
      type: 'contains_any',
      expected: ['커요', '작아요', '정답'],
    };

    it('후보 중 하나라도 출력에 있으면 통과', () => {
      expect(validateRule(rule, ctx('비밀 숫자가 추측보다 작아요!'))).toBe(
        true,
      );
      expect(validateRule(rule, ctx('정답!'))).toBe(true);
    });

    it('후보가 하나도 없으면 실패', () => {
      expect(validateRule(rule, ctx('모르겠어요'))).toBe(false);
    });

    it('빈 문자열 후보는 무시 (모든 출력을 통과시키지 않음)', () => {
      expect(
        validateRule({ type: 'contains_any', expected: [''] }, ctx('아무거나')),
      ).toBe(false);
    });

    it('DB 저장 형태(JSON 배열)로도 같은 판정', () => {
      const stored = toStoredRule(rule);
      expect(stored).toEqual({
        validation_type: 'contains_any',
        expected_output: '["커요","작아요","정답"]',
      });
      expect(
        validateResult({
          validationType: stored.validation_type,
          expectedOutput: stored.expected_output,
          stdout: '더 커요',
          studentCode: '',
        }),
      ).toEqual({ passed: true, type: 'contains_any' });
    });
  });

  describe('all', () => {
    it('B09: 세 갈래 출력 모두 통과 (정답 코드는 random 이라 셋 중 하나만 나옴)', () => {
      for (const out of [
        '비밀 숫자가 추측보다 커요!',
        '비밀 숫자가 추측보다 작아요!',
        '정답!',
      ]) {
        expect(validateRule(project3, ctx(out, step3Code))).toBe(true);
      }
    });

    it('B09: 힌트 문구(더 커요!)로 쓴 답도 통과', () => {
      const hintStyle = step3Code.replace(
        '비밀 숫자가 추측보다 커요!',
        '더 커요!',
      );
      expect(validateRule(project3, ctx('더 커요!', hintStyle))).toBe(true);
    });

    it('하위 규칙 하나라도 실패하면 실패 (elif 없는 코드)', () => {
      const noElif = 'print("더 커요!")';
      expect(validateRule(project3, ctx('더 커요!', noElif))).toBe(false);
    });

    it('주석 속 elif 로는 통과 못 함 (B25 엄격 code_check 그대로)', () => {
      expect(
        validateRule(
          project3,
          ctx('더 커요!', '# elif 쓰면 돼요\nprint("더 커요!")'),
        ),
      ).toBe(false);
    });

    it('하위 규칙이 비면 실패', () => {
      expect(validateRule({ type: 'all', rules: [] }, ctx('x', 'x'))).toBe(
        false,
      );
    });

    it('중첩 all 도 판정', () => {
      const nested: ValidationRule = {
        type: 'all',
        rules: [project3, { type: 'contains', expected: '!' }],
      };
      expect(validateRule(nested, ctx('정답!', step3Code))).toBe(true);
      expect(validateRule(nested, ctx('정답', step3Code))).toBe(false);
    });

    it('B30: 이전 단계 코드(randint)만으로는 2단계 수정 규칙을 통과 못 함', () => {
      const step2: ValidationRule = {
        type: 'all',
        rules: [
          { type: 'code_check', expected: 'guess' },
          { type: 'contains', expected: '추측' },
        ],
      };
      const step1 =
        'import random\nsecret = random.randint(1, 10)\nprint(secret)';
      expect(validateRule(step2, ctx('7', step1))).toBe(false);
      const solved = `${step1}\nguess = int(random.randint(1, 10))\nprint("추측: " + str(guess))`;
      expect(validateRule(step2, ctx('7\n추측: 3', solved))).toBe(true);
    });

    it('DB 저장 형태(JSON 하위 규칙 배열)로 왕복해도 같은 규칙', () => {
      const stored = toStoredRule(project3);
      expect(stored.validation_type).toBe('all');
      expect(JSON.parse(stored.expected_output)).toEqual(project3.rules);
      expect(
        parseStoredRule(stored.validation_type, stored.expected_output),
      ).toEqual(project3);
      expect(
        validateResult({
          validationType: 'all',
          expectedOutput: stored.expected_output,
          stdout: '정답!',
          studentCode: step3Code,
        }).passed,
      ).toBe(true);
    });
  });

  describe('code_check whole_word (규칙 옵션)', () => {
    const prevStep = 'secret = random.randint(1, 10)';

    it('규칙의 whole_word 가 randint( 안의 int( 를 무시', () => {
      expect(
        validateRule(
          { type: 'code_check', expected: 'int(' },
          ctx('', prevStep),
        ),
      ).toBe(true);
      expect(
        validateRule(
          { type: 'code_check', expected: 'int(', whole_word: true },
          ctx('', prevStep),
        ),
      ).toBe(false);
    });

    it('DB 칸이 하나뿐이라 all 하나짜리로 감싸 저장하고, simplifyRule 로 다시 풂', () => {
      const rule: ValidationRule = {
        type: 'code_check',
        expected: 'int(',
        whole_word: true,
      };
      const stored = toStoredRule(rule);
      expect(stored).toEqual({
        validation_type: 'all',
        expected_output:
          '[{"type":"code_check","expected":"int(","whole_word":true}]',
      });
      const back = parseStoredRule(
        stored.validation_type,
        stored.expected_output,
      );
      expect(back && simplifyRule(back)).toEqual(rule);
    });

    it('whole_word: false 는 기존 문자열 칸 그대로 저장', () => {
      expect(
        toStoredRule({
          type: 'code_check',
          expected: 'while',
          whole_word: false,
        }),
      ).toEqual({ validation_type: 'code_check', expected_output: 'while' });
    });
  });

  describe('저장 형태가 깨졌으면 불합격 (기준 없이 통과시키지 않음)', () => {
    it.each([
      ['contains_any', 'not json'],
      ['contains_any', '[]'],
      ['contains_any', '[1, 2]'],
      ['all', '[]'],
      ['all', '{"type":"contains","expected":"x"}'],
      ['all', '[{"type":"unknown","expected":"x"}]'],
      ['all', '[{"type":"code_check","expected":"x","whole_word":"yes"}]'],
    ] as const)('%s %s', (validationType, expectedOutput) => {
      expect(parseStoredRule(validationType, expectedOutput)).toBeNull();
      expect(
        validateResult({
          validationType,
          expectedOutput,
          stdout: 'x',
          studentCode: 'x',
        }).passed,
      ).toBe(false);
    });

    it('너무 깊게 중첩된 all 은 규칙으로 보지 않음', () => {
      let rule: unknown = { type: 'contains', expected: 'x' };
      for (let i = 0; i < 6; i++) rule = { type: 'all', rules: [rule] };
      expect(isValidationRule(rule)).toBe(false);
    });
  });

  it('기존 문자열 규칙의 저장 형태는 그대로 (기존 DB 행과 호환)', () => {
    expect(toStoredRule({ type: 'output_match', expected: 'a\nb' })).toEqual({
      validation_type: 'output_match',
      expected_output: 'a\nb',
    });
    // 기존 규칙의 기준값은 JSON 처럼 보여도 해석하지 않음
    expect(parseStoredRule('contains', '["x"]')).toEqual({
      type: 'contains',
      expected: '["x"]',
    });
  });
});
