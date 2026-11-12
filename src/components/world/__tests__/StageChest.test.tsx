// @vitest-environment jsdom
import { achv } from '@/lib/quest/__tests__/achievementFixture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { StageChest } from '../StageChest';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 스테이지 보물상자 한 줄 (P8-06): 별/목표·내용 공개·열기 → 축하 이벤트, 이미 열림·실패

afterEach(cleanup);

const stage = {
  id: 's1',
  title: '파이썬 마을',
  status: 'in_progress' as const,
  stars: 15,
  totalQuestCount: 7,
  completedQuestCount: 5,
  is_final: false,
  chestOpened: false,
};

describe('StageChest', () => {
  it('모으는 중: 남은 별·막대·안에 든 것(내용 공개), 열기 버튼 없음', () => {
    render(<StageChest stage={{ ...stage, stars: 9 }} onOpened={() => {}} />);
    expect(screen.getByTestId('stage-chest')).toHaveAttribute(
      'data-state',
      'locked',
    );
    expect(screen.getByText('별 6개 더 모으면 열려요')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/코인 30/)).toBeInTheDocument();
    expect(screen.queryByTestId('stage-chest-open')).toBeNull();
  });

  it('별은 채웠지만 코드 퀘스트를 아직 안 풂: 잠김 + 안내 (§12-Q65 (c))', () => {
    render(
      <StageChest
        stage={{
          ...stage,
          totalQuestCount: 1,
          stars: 6,
          completedQuestCount: 0,
        }}
        onOpened={() => {}}
      />,
    );
    expect(screen.getByTestId('stage-chest')).toHaveAttribute(
      'data-state',
      'locked',
    );
    expect(
      screen.getByText('코드 퀘스트를 하나 풀면 열려요'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('stage-chest-open')).toBeNull();
  });

  it('마지막 스테이지 상자는 코인 50', () => {
    render(
      <StageChest stage={{ ...stage, is_final: true }} onOpened={() => {}} />,
    );
    expect(screen.getByText(/코인 50/)).toBeInTheDocument();
  });

  it('열기 → 서버가 준 코인으로 축하 이벤트', async () => {
    const onOpened = vi.fn();
    const request = vi
      .fn()
      .mockResolvedValue({ already_opened: false, coins_earned: 30 });
    render(<StageChest stage={stage} onOpened={onOpened} request={request} />);
    fireEvent.click(screen.getByTestId('stage-chest-open'));
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
    expect(request).toHaveBeenCalledWith('s1');
    expect(onOpened).toHaveBeenCalledWith([
      {
        type: 'chest',
        stageTitle: '파이썬 마을',
        goal: 15,
        contents: { coins: 30, goldenKeys: 0 },
      },
    ]);
  });

  it('열어서 새 업적을 얻으면 상자 뒤에 업적 축하 (P8-09)', async () => {
    const onOpened = vi.fn();
    const won = achv('chest_1');
    render(
      <StageChest
        stage={stage}
        onOpened={onOpened}
        request={async () => ({
          already_opened: false,
          coins_earned: 30,
          new_achievements: [won],
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('stage-chest-open'));
    await waitFor(() => expect(onOpened).toHaveBeenCalled());
    expect(
      onOpened.mock.calls[0][0].map((e: { type: string }) => e.type),
    ).toEqual(['chest', 'badge']);
  });

  it('이미 열린 상자(다른 탭)면 축하 없이 null, 실패면 안내 한 줄', async () => {
    const onOpened = vi.fn();
    const { rerender } = render(
      <StageChest
        stage={stage}
        onOpened={onOpened}
        request={async () => ({ already_opened: true, coins_earned: 0 })}
      />,
    );
    fireEvent.click(screen.getByTestId('stage-chest-open'));
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith(null));

    rerender(
      <StageChest
        stage={stage}
        onOpened={onOpened}
        request={async () => {
          throw new Error('별이 아직 모자라요.');
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('stage-chest-open'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '별이 아직 모자라요.',
    );
  });

  it('열었음: 열린 상자 + 받은 것, 버튼 없음 / 잠긴 스테이지는 그리지 않음', () => {
    const { rerender } = render(
      <StageChest
        stage={{ ...stage, chestOpened: true }}
        onOpened={() => {}}
      />,
    );
    expect(screen.getByTestId('stage-chest')).toHaveAttribute(
      'data-state',
      'opened',
    );
    expect(screen.getByText('받은 것')).toBeInTheDocument();
    expect(screen.queryByTestId('stage-chest-open')).toBeNull();
    rerender(
      <StageChest stage={{ ...stage, status: 'locked' }} onOpened={() => {}} />,
    );
    expect(screen.queryByTestId('stage-chest')).toBeNull();
  });
});
