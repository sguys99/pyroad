import { describe, it, expect } from 'vitest';
import { stageDots, type StageQuestDot } from '../stageProgress';

const q = (order: number, completed = false): StageQuestDot => ({
  id: `q${order}`,
  order,
  title: `퀘스트 ${order}`,
  completed,
});

describe('stageDots', () => {
  it('order 순으로 정렬하고 완료·아직·현재를 나눈다', () => {
    const dots = stageDots([q(3), q(1, true), q(2)], 'q2', false);
    expect(dots.map((d) => [d.id, d.state, d.current])).toEqual([
      ['q1', 'done', false],
      ['q2', 'todo', true],
      ['q3', 'todo', false],
    ]);
  });

  it('이번 세션에 통과하면 현재 퀘스트를 완료로', () => {
    const dots = stageDots([q(1), q(2)], 'q1', true);
    expect(dots[0]).toMatchObject({ state: 'done', current: true });
    expect(dots[1].state).toBe('todo');
  });

  it('잠긴 스테이지 복습: 안 끝낸 다른 퀘스트만 잠김', () => {
    const dots = stageDots([q(1, true), q(2), q(3, true)], 'q1', false, false);
    expect(dots.map((d) => d.state)).toEqual(['done', 'locked', 'done']);
  });
});
