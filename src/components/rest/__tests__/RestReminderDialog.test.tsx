// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/characters/rig/MascotRig', () => ({
  PybaemRig: ({ state }: { state: string }) => <span data-pose={state} />,
}));

import { RestReminderDialog } from '../RestReminderDialog';

const noop = () => {};
const props = { onRest: noop, onMore: noop, onRestEnd: noop, onClose: noop };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RestReminderDialog (P8-12)', () => {
  it('권유: 제목·제안 3개·5분 쉬기에 초점, Esc는 조금만 더', async () => {
    const onMore = vi.fn();
    render(<RestReminderDialog {...props} phase="ask" onMore={onMore} />);
    const dialog = await screen.findByRole('dialog', {
      name: '40분이나 모험했어요!',
    });
    expect(dialog).toHaveAccessibleDescription(/눈과 몸을 잠깐 쉬어요/);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await vi.waitFor(() =>
      expect(screen.getByRole('button', { name: '5분 쉬기' })).toHaveFocus(),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(onMore).toHaveBeenCalledOnce();
  });

  it('쉬기: 남은 시간을 세고 0이 되면 알린다', () => {
    vi.useFakeTimers({ now: 0 });
    const onRestEnd = vi.fn();
    render(
      <RestReminderDialog
        {...props}
        phase="rest"
        restEndsAt={300_000}
        onRestEnd={onRestEnd}
      />,
    );
    expect(screen.getByRole('timer')).toHaveTextContent('5:00');
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('3:59');
    act(() => {
      vi.advanceTimersByTime(240_000);
    });
    expect(onRestEnd).toHaveBeenCalledOnce();
  });
});
