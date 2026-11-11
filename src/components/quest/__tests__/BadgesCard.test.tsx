// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { achv } from '@/lib/quest/__tests__/achievementFixture';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), play: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => mocks.play,
}));

import { BadgesCard } from '../celebrations/BadgesCard';

afterEach(cleanup);

const ok = (coins: number) => ({
  claimed: true as const,
  already_claimed: coins === 0,
  coins_earned: coins,
  coins_balance: 100 + coins,
});

describe('BadgesCard (P8-09 업적 카드)', () => {
  it('티어 색 메달 + 티어 이름, "코인 N개 받기"가 모두 받고 "좋아요!"로', async () => {
    const onNext = vi.fn();
    const request = vi.fn(async (id: string) => ok(id === 'a' ? 10 : 100));
    render(
      <BadgesCard
        badges={[achv('a'), achv('b', 'gold')]}
        onNext={onNext}
        request={request}
      />,
    );
    const medals = screen.getAllByTestId('achievement-medal');
    expect(medals[1].querySelector('.cel-medal')).toHaveAttribute(
      'data-tier',
      'gold',
    );
    expect(screen.getByText('골드')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('achievement-claim'));
    expect(screen.getByTestId('achievement-claim')).toHaveTextContent(
      '코인 110개 받기',
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('+110'),
    );
    expect(request.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(mocks.play).toHaveBeenCalledWith('coin');
    expect(mocks.refresh).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    expect(onNext).toHaveBeenCalled();
  });

  it('"나중에 받을래요"는 받지 않고 넘김, 실패하면 안내 + 다시 누를 수 있음', async () => {
    const onNext = vi.fn();
    const request = vi.fn(async () => {
      throw new Error('');
    });
    render(
      <BadgesCard badges={[achv('a')]} onNext={onNext} request={request} />,
    );
    fireEvent.click(screen.getByTestId('achievement-claim'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('다음에 다시'),
    );
    expect(screen.getByTestId('achievement-claim')).toBeEnabled();
    fireEvent.click(screen.getByTestId('celebration-cta'));
    expect(onNext).toHaveBeenCalled();
  });

  it('이미 받은 업적이면 0 코인 안내', async () => {
    render(
      <BadgesCard
        badges={[achv('a')]}
        onNext={() => {}}
        request={async () => ok(0)}
      />,
    );
    fireEvent.click(screen.getByTestId('achievement-claim'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('이미 받은'),
    );
  });
});
