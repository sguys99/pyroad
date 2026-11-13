// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import { useCelebrationSequence } from '../useCelebrationSequence';

// 공유 시트가 열린 동안(held) 자동 넘김이 멈추고, 닫으면 남은 시간부터 이어짐 (P9-10 → P9-11 확인)

const EVENTS: CelebrationEvent[] = [
  { type: 'level_up', level: 2, fromLevel: 1, title: '새싹' },
];

describe('useCelebrationSequence held', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    return renderHook(
      ({ held }) =>
        useCelebrationSequence({
          events: EVENTS,
          onDismiss: () => {},
          held,
          now: () => Date.now(),
        }),
      { initialProps: { held: false } },
    );
  }

  it('자동 넘김이 있는 레벨 업 카드는 held 동안 넘어가지 않는다', () => {
    const { result, rerender } = setup();
    expect(result.current.step?.kind).toBe('level_up');
    const auto = result.current.autoMs!;
    expect(auto).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(auto / 2));
    rerender({ held: true });
    expect(result.current.paused).toBe(true);
    act(() => vi.advanceTimersByTime(auto * 5));
    expect(result.current.step?.kind).toBe('level_up');

    // 닫으면 남은 절반만 기다림
    rerender({ held: false });
    act(() => vi.advanceTimersByTime(auto / 2 - 50));
    expect(result.current.step?.kind).toBe('level_up');
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.step).toBeNull();
  });

  it('held 가 없으면 autoMs 뒤에 닫힌다', () => {
    const { result } = setup();
    act(() => vi.advanceTimersByTime(result.current.autoMs! + 10));
    expect(result.current.step).toBeNull();
  });
});
