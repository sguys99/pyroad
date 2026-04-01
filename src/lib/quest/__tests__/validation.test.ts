import { describe, it, expect } from 'vitest';
import { validateResult } from '../validation';

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
