import { describe, it, expect } from 'vitest';
import { useMessageExpression, getOutputExpression } from '../useCharacterExpression';

describe('useMessageExpression', () => {
  const make = (content: string) => ({ role: 'tutor' as const, content });

  describe('celebrating 표정', () => {
    it.each(['정답', '대단', '축하', '완벽', '성공', '훌륭', '멋져', '잘했'])(
      '키워드 "%s" 포함 시 celebrating 반환',
      (keyword) => {
        expect(useMessageExpression(make(`와, ${keyword}해요!`))).toBe('celebrating');
      },
    );
  });

  describe('proud 표정', () => {
    it.each(['자랑', '뿌듯', '최고', '실력'])(
      '키워드 "%s" 포함 시 proud 반환',
      (keyword) => {
        expect(useMessageExpression(make(`${keyword}스럽네요!`))).toBe('proud');
      },
    );
  });

  describe('surprised 표정', () => {
    it.each(['어머', '놀랍', '세상에', '대박', '우와'])(
      '키워드 "%s" 포함 시 surprised 반환',
      (keyword) => {
        expect(useMessageExpression(make(`${keyword}!`))).toBe('surprised');
      },
    );
  });

  describe('encouraging 표정', () => {
    it.each(['괜찮', '힘내', '할 수 있', '다시', '앗', '오류', '에러', '실수'])(
      '키워드 "%s" 포함 시 encouraging 반환',
      (keyword) => {
        expect(useMessageExpression(make(`${keyword}아요`))).toBe('encouraging');
      },
    );
  });

  describe('teaching 표정', () => {
    it.each(['힌트', '알려', '설명', '방법', '이렇게', '먼저', '다음'])(
      '키워드 "%s" 포함 시 teaching 반환',
      (keyword) => {
        expect(useMessageExpression(make(`${keyword}를 줄게요`))).toBe('teaching');
      },
    );
  });

  describe('thinking 표정', () => {
    it.each(['생각', '음', '글쎄', '한번'])(
      '키워드 "%s" 포함 시 thinking 반환',
      (keyword) => {
        expect(useMessageExpression(make(`${keyword}해볼게요`))).toBe('thinking');
      },
    );
  });

  it('매칭 키워드가 없으면 happy 반환', () => {
    expect(useMessageExpression(make('안녕하세요!'))).toBe('happy');
  });

  it('여러 키워드 매칭 시 우선순위가 높은 표정 반환 (celebrating > encouraging)', () => {
    expect(useMessageExpression(make('정답이에요! 앗 실수가 있었지만 괜찮아요'))).toBe('celebrating');
  });
});

describe('getOutputExpression', () => {
  it('isRunning=true → thinking', () => {
    expect(getOutputExpression({ isRunning: true, result: null })).toBe('thinking');
  });

  it('result=null → happy', () => {
    expect(getOutputExpression({ isRunning: false, result: null })).toBe('happy');
  });

  it('timeout → confused', () => {
    expect(
      getOutputExpression({
        isRunning: false,
        result: { success: false, stdout: '', stderr: '', isTimeout: true },
      }),
    ).toBe('confused');
  });

  it('에러 → encouraging', () => {
    expect(
      getOutputExpression({
        isRunning: false,
        result: { success: false, stdout: '', stderr: 'SyntaxError', isTimeout: false },
      }),
    ).toBe('encouraging');
  });

  it('성공 + 검증 통과 → celebrating', () => {
    expect(
      getOutputExpression({
        isRunning: false,
        result: { success: true, stdout: 'Hello', stderr: '', isTimeout: false },
        validationResult: { passed: true },
      }),
    ).toBe('celebrating');
  });

  it('성공 + 검증 실패 → teaching', () => {
    expect(
      getOutputExpression({
        isRunning: false,
        result: { success: true, stdout: 'Wrong', stderr: '', isTimeout: false },
        validationResult: { passed: false },
      }),
    ).toBe('teaching');
  });

  it('성공 + 검증 없음 → happy', () => {
    expect(
      getOutputExpression({
        isRunning: false,
        result: { success: true, stdout: 'Hello', stderr: '', isTimeout: false },
      }),
    ).toBe('happy');
  });
});
