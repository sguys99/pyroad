import { describe, expect, it } from 'vitest';
import type { QuizPrompt } from '../questKind';
import { quizRunCode, tryItPrompt } from '../quizCode';

describe('quizRunCode (P7-07): 정답 제출값으로 돌려 볼 코드 조립', () => {
  it('객관식은 문제 코드가 있을 때(출력 예측형)만', () => {
    const base = {
      kind: 'multiple_choice' as const,
      question: 'q',
      options: [
        { id: 'opt-k7qz', text: '0 1 2' },
        { id: 'opt-w9fa', text: '1 2 3' },
      ],
    };
    expect(quizRunCode({ ...base, code: 'print(1)' }, 'opt-k7qz')).toBe(
      'print(1)',
    );
    expect(quizRunCode(base, 'opt-k7qz')).toBeNull();
  });

  it('빈칸 채우기: 모든 빈칸을 고른 토큰 글자로', () => {
    const quiz: QuizPrompt = {
      kind: 'fill_blank',
      question: 'q',
      code: 'for i in {{bk-r2fa}}(3):\n    {{bk-m8ce}}(i)',
      tokens: [
        { id: 'tok-m4xe', text: 'range' },
        { id: 'tok-c3pd', text: 'print' },
        { id: 'tok-z9aa', text: 'list' },
      ],
    };
    expect(
      quizRunCode(quiz, { 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'tok-c3pd' }),
    ).toBe('for i in range(3):\n    print(i)');
    // 빈칸이 빠졌거나 모르는 토큰이면 null
    expect(quizRunCode(quiz, { 'bk-r2fa': 'tok-m4xe' })).toBeNull();
    expect(quizRunCode(quiz, 'opt-k7qz')).toBeNull();
  });

  it('순서 맞추기: 정답 순서 + 들여쓰기 단계(4칸)', () => {
    const lines = [
      { id: 'ln-q8wd', code: 'print(i)' },
      { id: 'ln-a3ke', code: 'for i in range(2):' },
    ];
    expect(
      quizRunCode({ kind: 'parsons', question: 'q', lines, indent: true }, [
        { id: 'ln-a3ke', indent: 0 },
        { id: 'ln-q8wd', indent: 1 },
      ]),
    ).toBe('for i in range(2):\n    print(i)');
    expect(
      quizRunCode({ kind: 'parsons', question: 'q', lines }, [
        'ln-a3ke',
        'ln-q8wd',
      ]),
    ).toBe('for i in range(2):\nprint(i)');
    expect(
      quizRunCode({ kind: 'parsons', question: 'q', lines }, ['ln-zz9z']),
    ).toBeNull();
  });

  it('버그 찾기: 고른 줄을 수정안으로 (들여쓰기 없는 수정안은 원래 줄 들여쓰기를 이어 받음)', () => {
    const quiz: QuizPrompt = {
      kind: 'bug_hunt',
      question: 'q',
      lines: [
        { id: 'ln-x5pc', code: 'for i in range(3):' },
        { id: 'ln-h7jq', code: '    print(i' },
      ],
      fixes: [
        { id: 'fx-b7nd', code: 'print(i)' },
        { id: 'fx-e4kr', code: '    print[i]' },
      ],
    };
    expect(quizRunCode(quiz, { line: 'ln-h7jq', fix: 'fx-b7nd' })).toBe(
      'for i in range(3):\n    print(i)',
    );
    expect(quizRunCode(quiz, { line: 'ln-h7jq', fix: 'fx-e4kr' })).toBe(
      'for i in range(3):\n    print[i]',
    );
    expect(quizRunCode(quiz, { line: 'ln-h7jq', fix: 'fx-nope1' })).toBeNull();
    expect(quizRunCode(quiz, null)).toBeNull();
  });
});

describe('tryItPrompt (§12-Q60 4b): 코드 내용으로 도전 문구', () => {
  it('숫자 → 글자 → 그 밖 순서, 이름 속 숫자·주석은 보지 않음', () => {
    expect(tryItPrompt('for i in range(3):\n    print(i)')).toMatch(/숫자/);
    expect(tryItPrompt('print("안녕")')).toMatch(/글자/);
    expect(tryItPrompt('x2 = "hi"  # 3번')).toMatch(/글자/);
    expect(tryItPrompt('print(x)')).toMatch(/한 줄/);
  });
});
