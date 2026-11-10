import { describe, it, expect } from 'vitest';
import { runnerState } from '../RunControls';

describe('runnerState (P6-05·P6-16)', () => {
  const base = {
    status: 'ready' as const,
    restarting: null,
    isRunning: false,
    isSubmitting: false,
  };

  it('채점 중은 checking, 단계 통과 박자 중은 잠겨 있어도 stepping', () => {
    expect(runnerState({ ...base, isSubmitting: true })).toBe('checking');
    expect(runnerState({ ...base, isSubmitting: true, stepping: true })).toBe(
      'stepping',
    );
    expect(runnerState(base)).toBe('ready');
  });

  it('실행기 상태가 먼저 (오류·준비 중은 박자와 상관없이)', () => {
    expect(runnerState({ ...base, status: 'error', stepping: true })).toBe(
      'error',
    );
    expect(runnerState({ ...base, status: 'loading', stepping: true })).toBe(
      'preparing',
    );
  });
});
