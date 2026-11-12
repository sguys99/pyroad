// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  buildAchievementBook,
  type AchievementDef,
} from '@/lib/quest/achievementBook';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), play: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => mocks.play,
}));

import { AchievementBook } from '../AchievementBook';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const AT = '2026-11-10T03:00:00Z';
const def = (
  id: string,
  over: Partial<AchievementDef> = {},
): AchievementDef => ({
  id,
  name: `이름 ${id}`,
  description: `${id} 설명`,
  icon: 'Code',
  tier: 'bronze',
  category: 'learn',
  metric: 'quests',
  sort: 10,
  hidden: false,
  ...over,
});
const entries = buildAchievementBook(
  [
    def('ready'),
    def('gold', { tier: 'gold', sort: 20 }),
    def('todo', { sort: 30 }),
    def('err', { category: 'grit' }),
    def('secret', { hidden: true, category: 'growth' }),
  ],
  [
    { achievement_id: 'ready', achieved_at: AT, claimed_at: null },
    { achievement_id: 'gold', achieved_at: AT, claimed_at: null },
  ],
  [{ achievement_id: 'todo', progress: 3, goal: 10 }],
);
const ok = (coins: number, balance: number) => ({
  claimed: true as const,
  already_claimed: coins === 0,
  coins_earned: coins,
  coins_balance: balance,
});

describe('AchievementBook (P8-10)', () => {
  it('요약·카테고리 절·실패 칭찬 띠, 칸 이름에 상태', () => {
    render(<AchievementBook entries={entries} coins={50} />);
    expect(
      screen.getByRole('heading', { name: '업적 도감' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('achievement-collect')).toHaveTextContent('110');
    expect(screen.getByText('실수도 실력이 돼요!')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /이름 todo, 브론즈, 아직, 3\/10/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /비밀 업적, 브론즈, 아직 비밀이에요/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('이름 secret')).toBeNull();
  });

  it('칸 받기 → 응답 잔액으로 지갑, 효과음 coin, 새로 고침 없음 (B56)', async () => {
    const request = vi.fn(async () => ok(10, 60));
    render(<AchievementBook entries={entries} coins={50} request={request} />);
    const tile = screen.getByTestId('achievement-ready');
    fireEvent.click(within(tile).getByTestId('achievement-claim'));
    await waitFor(() =>
      expect(screen.getByTestId('achievement-ready')).toHaveAttribute(
        'data-state',
        'earned',
      ),
    );
    expect(request).toHaveBeenCalledWith('ready');
    expect(mocks.play).toHaveBeenCalledWith('coin');
    expect(mocks.refresh).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('hud-coin')).toHaveTextContent('코인 60개'),
    );
    expect(screen.getByTestId('achievement-collect')).toHaveTextContent('100');
  });

  it('모두 받기 → 남은 받기가 사라지고 가장 큰 잔액', async () => {
    const request = vi.fn(async (id: string) =>
      id === 'ready' ? ok(10, 60) : ok(100, 160),
    );
    render(<AchievementBook entries={entries} coins={50} request={request} />);
    fireEvent.click(screen.getByTestId('achievement-claim-all'));
    await waitFor(() =>
      expect(screen.queryByTestId('achievement-collect')).toBeNull(),
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryAllByTestId('achievement-claim')).toHaveLength(0);
    await waitFor(() =>
      expect(screen.getByTestId('hud-coin')).toHaveTextContent('코인 160개'),
    );
  });

  it('받기 실패면 안내, 칸은 그대로', async () => {
    const request = vi.fn(async () => {
      throw new Error('아직 얻지 않은 업적이에요.');
    });
    render(<AchievementBook entries={entries} coins={50} request={request} />);
    fireEvent.click(
      within(screen.getByTestId('achievement-ready')).getByTestId(
        'achievement-claim',
      ),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('아직 얻지');
    expect(screen.getByTestId('achievement-ready')).toHaveAttribute(
      'data-state',
      'claimable',
    );
  });

  it('거르기 탭: 얻었어요 → 얻은 칸만, 도전 중 → 나머지', () => {
    render(<AchievementBook entries={entries} coins={0} />);
    fireEvent.click(screen.getByRole('tab', { name: '얻었어요' }));
    expect(screen.getByTestId('achievement-ready')).toBeInTheDocument();
    expect(screen.queryByTestId('achievement-todo')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: '도전 중' }));
    expect(screen.queryByTestId('achievement-ready')).toBeNull();
    expect(screen.getByTestId('achievement-todo')).toBeInTheDocument();
  });

  it('칸을 누르면 상세 시트(얻는 법·진행)', async () => {
    render(<AchievementBook entries={entries} coins={0} />);
    fireEvent.click(screen.getByRole('button', { name: /이름 todo/ }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveTextContent('퀘스트 10개를 혼자 풀어요');
    expect(within(sheet).getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
  });
});
