// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  comboRate,
  getQuizCombo,
  recordQuizAnswer,
  resetQuizCombo,
  subscribeQuizCombo,
  useQuizCombo,
} from '../quizCombo';

beforeEach(() => resetQuizCombo());

describe('quizCombo (P7-09)', () => {
  it('정답마다 1씩 늘고 오답이면 0', () => {
    expect(recordQuizAnswer(true)).toBe(1);
    expect(recordQuizAnswer(true)).toBe(2);
    expect(recordQuizAnswer(true)).toBe(3);
    expect(recordQuizAnswer(false)).toBe(0);
    expect(recordQuizAnswer(true)).toBe(1);
    expect(getQuizCombo()).toBe(1);
  });

  it('구독자에게 알리고, 훅은 바뀐 값을 그린다', () => {
    const l = vi.fn();
    const off = subscribeQuizCombo(l);
    recordQuizAnswer(true);
    resetQuizCombo();
    resetQuizCombo(); // 이미 0이면 알리지 않음
    off();
    recordQuizAnswer(true);
    expect(l).toHaveBeenCalledTimes(2);

    const { result } = renderHook(() => useQuizCombo());
    expect(result.current).toBe(1);
    act(() => void recordQuizAnswer(true));
    expect(result.current).toBe(2);
  });

  it('정답 피치: 1 → 1.12 → 1.26 에서 멈춤', () => {
    expect([0, 1, 2, 3, 4, 10].map(comboRate)).toEqual([
      1, 1, 1.12, 1.26, 1.26, 1.26,
    ]);
  });
});
