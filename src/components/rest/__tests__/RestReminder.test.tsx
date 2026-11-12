// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 모달은 따로 테스트한다(RestReminderDialog). 여기는 타이머·미루기·고르기 흐름만 — 동적 import 대신 단추 셋짜리 대역
vi.mock('next/dynamic', () => ({
  default: () =>
    function Stub(p: {
      phase: string | null;
      onMore: () => void;
      onRest: () => void;
    }) {
      return p.phase ? (
        <div data-testid="rest-reminder" data-phase={p.phase}>
          <button onClick={p.onMore}>more</button>
          <button onClick={p.onRest}>rest</button>
        </div>
      ) : null;
    },
}));
const track = vi.fn();
vi.mock('@/lib/analytics/track', () => ({
  track: (...a: unknown[]) => track(...a),
}));

import '@testing-library/jest-dom/vitest';
import { RestReminder } from '../RestReminder';
import { useRestHold } from '@/lib/rest/restHold';
import { TICK_MS } from '@/lib/rest/restTimer';

const MIN = 60_000;

/** 아이가 계속 만지며 ms만큼 논다 */
function playFor(ms: number) {
  for (let t = 0; t < ms; t += TICK_MS) {
    fireEvent.pointerDown(window);
    act(() => {
      vi.advanceTimersByTime(TICK_MS);
    });
  }
}

function Hold({ on }: { on: boolean }) {
  useRestHold(on);
  return null;
}

describe('RestReminder (P8-12)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000_000 });
    sessionStorage.clear();
    track.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('40분에 뜨고, 조금만 더 → 20분 뒤 다시', () => {
    render(<RestReminder />);
    playFor(39 * MIN);
    expect(screen.queryByTestId('rest-reminder')).toBeNull();
    playFor(1 * MIN);
    expect(screen.getByTestId('rest-reminder')).toHaveAttribute(
      'data-phase',
      'ask',
    );
    expect(track).toHaveBeenCalledWith('rest_reminder_shown', {
      snoozed: false,
    });

    fireEvent.click(screen.getByText('more'));
    expect(track).toHaveBeenCalledWith('rest_reminder_choice', {
      choice: 'more',
    });
    playFor(19 * MIN);
    expect(screen.queryByTestId('rest-reminder')).toBeNull();
    playFor(1 * MIN);
    expect(screen.getByTestId('rest-reminder')).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('rest_reminder_shown', {
      snoozed: true,
    });
  });

  it('실행·채점 중이면 끝날 때까지 미룬다', () => {
    const { rerender } = render(
      <>
        <RestReminder />
        <Hold on />
      </>,
    );
    playFor(45 * MIN);
    expect(screen.queryByTestId('rest-reminder')).toBeNull();
    rerender(
      <>
        <RestReminder />
        <Hold on={false} />
      </>,
    );
    playFor(TICK_MS);
    expect(screen.getByTestId('rest-reminder')).toBeInTheDocument();
  });

  it('새로 고침해도 sessionStorage로 이어서 센다', () => {
    const first = render(<RestReminder />);
    playFor(30 * MIN);
    first.unmount();
    render(<RestReminder />);
    playFor(10 * MIN);
    expect(screen.getByTestId('rest-reminder')).toBeInTheDocument();
  });
});
