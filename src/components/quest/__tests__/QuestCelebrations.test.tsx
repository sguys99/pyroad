// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LazyMotion, domAnimation } from 'framer-motion';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';

const mocks = vi.hoisted(() => ({ confetti: vi.fn() }));
vi.mock('@/lib/confetti', () => ({ fireConfetti: mocks.confetti }));
vi.mock('@/lib/tutor/useTutor', () => ({
  useTutor: () => ({
    sendTutorStreamRequest: async () => ({ message: '정리했어요', is_fallback: false }),
  }),
}));

import { QuestCelebrations } from '../QuestCelebrations';
import { LevelUpCelebration } from '../celebrations/LevelUpCelebration';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  mocks.confetti.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wrap = (ui: React.ReactNode) => (
  <LazyMotion features={domAnimation}>{ui}</LazyMotion>
);

describe('QuestCelebrations (축하 이벤트 목록 → 기존 축하 컴포넌트)', () => {
  it('앞에서부터 하나씩: 레벨 업 CTA를 누르면 1개를 보여 줬다고 알린다', () => {
    const onDismiss = vi.fn();
    const events: CelebrationEvent[] = [
      { type: 'level_up', level: 2, title: '새싹 코더' },
      { type: 'badge', badge: 'first_code' },
    ];
    render(wrap(<QuestCelebrations events={events} questId="q1" onDismiss={onDismiss} />));
    expect(screen.getByText('Lv.2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it('이어지는 뱃지는 한 팝업으로 묶고, 다 보면 묶은 개수만큼 지운다', () => {
    const onDismiss = vi.fn();
    const events: CelebrationEvent[] = [
      { type: 'badge', badge: 'first_code' },
      { type: 'badge', badge: 'stage_clear' },
    ];
    render(wrap(<QuestCelebrations events={events} questId="q1" onDismiss={onDismiss} />));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // 뱃지마다 3초 뒤 자동으로 넘김 (replayKey), 첫 뱃지 뒤에는 아직 지우지 않음
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalledWith(2);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('이벤트가 없으면 아무것도 그리지 않는다', () => {
    render(wrap(<QuestCelebrations events={[]} questId="q1" onDismiss={() => {}} />));
    expect(screen.queryByTestId('celebration-overlay')).toBeNull();
  });
});

describe('CelebrationOverlay (§2.10: 부모 재렌더와 분리)', () => {
  it('부모가 새 onClose로 다시 그려도 컨페티를 다시 쏘거나 자동 닫힘을 미루지 않는다', () => {
    const closes: number[] = [];
    const { rerender } = render(
      wrap(<LevelUpCelebration newLevel={2} newTitle="새싹" onClose={() => closes.push(1)} />),
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const fired = mocks.confetti.mock.calls.length;
    expect(fired).toBeGreaterThan(0);

    // 튜터 스트리밍 등으로 셸이 다시 그려지는 상황
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(900);
      });
      rerender(
        wrap(<LevelUpCelebration newLevel={2} newTitle="새싹" onClose={() => closes.push(2)} />),
      );
    }
    expect(mocks.confetti.mock.calls.length).toBe(fired);
    // 5초 자동 닫힘은 처음 시각 기준으로 한 번, 최신 onClose로
    expect(closes).toEqual([2]);
  });
});
