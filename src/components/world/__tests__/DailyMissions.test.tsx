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

import type { DailyMission, DailyMissionsState } from '@/lib/world/missions';
import { MissionHudButton, MissionList } from '../DailyMissions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const play = vi.fn();
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => play,
}));

// 데일리 미션 (P8-07): 진행·받기·받았어요·지난 보상·HUD 칸

afterEach(() => {
  cleanup();
  refresh.mockReset();
  play.mockReset();
});

const m = (id: string, over: Partial<DailyMission> = {}): DailyMission => ({
  id,
  title: `미션 ${id}`,
  kind: 'quest_clear',
  difficulty: 2,
  target: 2,
  progress: 0,
  coins: 15,
  xp: 15,
  claimed: false,
  ...over,
});

const state = (over: Partial<DailyMissionsState> = {}): DailyMissionsState => ({
  day: '2026-11-11',
  missions: [
    m('quest_2', { progress: 1 }),
    m('no_hint_1', { kind: 'no_hint', target: 1, progress: 1 }),
    m('review_1', { kind: 'review', target: 1, progress: 1, claimed: true }),
  ],
  pending: [],
  ...over,
});

const RES = {
  claimed: true as const,
  already_claimed: false,
  mission_coins: 15,
  xp_earned: 15,
  coins_earned: 35,
  coins_balance: 135,
  total_xp: 205,
  level_before: 1,
  level_after: 2,
  level_ups: [{ level: 2, coins: 20 }],
};

describe('MissionList', () => {
  it('진행 중은 막대와 n/목표, 달성은 받기, 받은 것은 받았어요 + 남은 시간', () => {
    render(<MissionList state={state()} />);
    const doing = screen.getByTestId('mission-quest_2');
    expect(doing).toHaveAttribute('data-state', 'doing');
    expect(within(doing).getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByTestId('mission-no_hint_1')).toHaveAttribute(
      'data-state',
      'ready',
    );
    expect(
      within(screen.getByTestId('mission-review_1')).getByText('받았어요'),
    ).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByTestId('mission-timer')).toHaveTextContent(
      '새 미션까지',
    );
  });

  it('받기 → 그 날짜·미션으로 요청, 효과음·받았어요·낭독(레벨 업 코인 포함)·새로 고침', async () => {
    const request = vi.fn().mockResolvedValue(RES);
    render(<MissionList state={state()} request={request} />);
    fireEvent.click(screen.getByTestId('mission-claim'));
    await waitFor(() =>
      expect(screen.getByTestId('mission-no_hint_1')).toHaveAttribute(
        'data-state',
        'claimed',
      ),
    );
    expect(request).toHaveBeenCalledWith('2026-11-11', 'no_hint_1');
    expect(play).toHaveBeenCalledWith('coin');
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '코인 15개와 15 XP를 받았어요! 레벨 업! Lv 2, 코인 20개 더!',
    );
  });

  it('레벨이 오르면 onLevelUp(레벨 업 카드)으로 넘기고 새로 고침은 카드가 (P8-08)', async () => {
    const onLevelUp = vi.fn();
    render(
      <MissionList
        state={state()}
        request={vi.fn().mockResolvedValue(RES)}
        onLevelUp={onLevelUp}
      />,
    );
    fireEvent.click(screen.getByTestId('mission-claim'));
    await waitFor(() => expect(onLevelUp).toHaveBeenCalled());
    expect(onLevelUp.mock.calls[0][0]).toEqual([
      expect.objectContaining({ type: 'level_up', level: 2, coins: 20 }),
    ]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('실패하면 서버 문구, 버튼은 그대로', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error('아직 미션을 다 하지 않았어요.'));
    render(<MissionList state={state()} request={request} />);
    fireEvent.click(screen.getByTestId('mission-claim'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '아직 미션을 다 하지 않았어요.',
    );
    expect(screen.getByTestId('mission-claim')).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
  });

  it('지난 보상: "어제" 꼬리표, 그 날짜로 받기', async () => {
    const request = vi.fn().mockResolvedValue(RES);
    render(
      <MissionList
        state={state({
          missions: [],
          pending: [{ ...m('quest_1', { progress: 2 }), day: '2026-11-10' }],
        })}
        request={request}
      />,
    );
    expect(screen.getByText('지난 보상')).toBeInTheDocument();
    expect(screen.getByText('어제')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mission-claim'));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('2026-11-10', 'quest_1'),
    );
  });
});

describe('MissionHudButton', () => {
  it('달성 수와 받을 보상 수를 이름으로, 받을 것이 있으면 data-ready', () => {
    render(<MissionHudButton state={state()} />);
    const b = screen.getByTestId('hud-mission');
    expect(b).toHaveAccessibleName('오늘의 미션 2/3 달성, 받을 보상 1개');
    expect(b).toHaveAttribute('data-ready');
  });
});
