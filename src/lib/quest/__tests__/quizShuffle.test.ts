import { describe, it, expect } from 'vitest';

import { shuffleQuiz } from '../quizShuffle';
import type { QuizPrompt } from '@/lib/types/database';

const mc: QuizPrompt = {
  kind: 'multiple_choice',
  question: '?',
  options: ['opt-a1b1', 'opt-a1b2', 'opt-a1b3', 'opt-a1b4'].map((id) => ({
    id,
    text: id,
  })),
};
const bug: QuizPrompt = {
  kind: 'bug_hunt',
  question: '?',
  lines: [
    { id: 'ln-a1b1', code: 'a' },
    { id: 'ln-a1b2', code: 'b' },
  ],
  fixes: [
    { id: 'fx-a1b1', code: 'x' },
    { id: 'fx-a1b2', code: 'y' },
    { id: 'fx-a1b3', code: 'z' },
  ],
};

describe('shuffleQuiz', () => {
  it('보기를 섞되 같은 보기 집합, 입력은 그대로', () => {
    const before = JSON.stringify(mc);
    const out = shuffleQuiz(mc, () => 0); // 항상 0 → [b,c,d,a]
    expect(JSON.stringify(mc)).toBe(before);
    if (out.kind !== 'multiple_choice') throw new Error();
    expect(out.options.map((o) => o.id)).toEqual([
      'opt-a1b2',
      'opt-a1b3',
      'opt-a1b4',
      'opt-a1b1',
    ]);
  });

  it('버그 찾기는 수정안만 섞고 코드 줄 순서는 그대로', () => {
    const out = shuffleQuiz(bug, () => 0);
    if (out.kind !== 'bug_hunt') throw new Error();
    expect(out.lines).toEqual(bug.kind === 'bug_hunt' ? bug.lines : []);
    expect(out.fixes.map((f) => f.id)).toEqual([
      'fx-a1b2',
      'fx-a1b3',
      'fx-a1b1',
    ]);
  });

  it('crypto 난수: 여러 번 섞으면 첫 자리에 모든 보기가 나옴', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const out = shuffleQuiz(mc);
      if (out.kind !== 'multiple_choice') throw new Error();
      expect(new Set(out.options.map((o) => o.id)).size).toBe(4);
      firsts.add(out.options[0].id);
    }
    expect(firsts.size).toBe(4);
  });
});
