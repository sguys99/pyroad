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

import type {
  AttendanceStatus,
  StampAttendanceResult,
} from '@/lib/world/attendance';
import { AttendanceCard, AttendanceMenuSection } from '../AttendanceCard';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const play = vi.fn();
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => play,
}));

// 출석 카드 (P8-08): 7칸·도장 찍기·완료 모습·이미 찍었으면 숨김·방패 안내·메뉴 달력

afterEach(() => {
  cleanup();
  refresh.mockReset();
  play.mockReset();
});

const status = (over: Partial<AttendanceStatus> = {}): AttendanceStatus => ({
  today: '2026-11-11',
  total: 2,
  stamped_today: false,
  day_n: 3,
  cycle: ['2026-11-09', '2026-11-10'],
  ...over,
});

const RES: StampAttendanceResult = {
  stamped: true,
  already_stamped: false,
  day_n: 3,
  coins_earned: 10,
  coins_balance: 110,
  shield_granted: 0,
  shields: 0,
};

describe('AttendanceCard', () => {
  it('오늘 찍을 칸·7일째 상자에 든 것·도장 버튼', () => {
    render(<AttendanceCard status={status()} shields={0} />);
    expect(screen.getByRole('heading')).toHaveTextContent(
      '오늘은 3일째 출석이에요',
    );
    expect(screen.getByTestId('attendance-cell-3')).toHaveAttribute(
      'data-state',
      'next',
    );
    expect(screen.getByTestId('attendance-cell-1')).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByTestId('attendance-cell-7')).toHaveAccessibleName(
      '7일째 상자, 코인 30개, 남음',
    );
    expect(
      screen.getByText(/7일째 상자: 코인 30 \+ 스트릭 방패 1개/),
    ).toBeVisible();
    expect(screen.getByTestId('attendance-stamp')).toBeVisible();
  });

  it('도장을 누르면 서버 결과로 칸이 찍히고 소리·낭독, HUD 새로 고침', async () => {
    const request = vi.fn().mockResolvedValue(RES);
    render(<AttendanceCard status={status()} shields={0} request={request} />);
    fireEvent.click(screen.getByTestId('attendance-stamp'));
    await waitFor(() =>
      expect(screen.getByRole('heading')).toHaveTextContent('3일째 출석 완료!'),
    );
    expect(screen.getByTestId('attendance-cell-3')).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByRole('status')).toHaveTextContent('코인 10개');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(play).toHaveBeenCalledWith('coin');
    expect(screen.queryByTestId('attendance-stamp')).toBeNull();
  });

  it('7일째는 방패를 받은 낭독, 새로 고침은 상자 카드를 띄울 때 한 번 (B56)', async () => {
    const request = vi.fn().mockResolvedValue({
      ...RES,
      day_n: 7,
      coins_earned: 30,
      shield_granted: 1,
      shields: 1,
    });
    render(
      <AttendanceCard
        status={status({
          total: 6,
          day_n: 7,
          cycle: [
            '2026-11-01',
            '2026-11-02',
            '2026-11-03',
            '2026-11-05',
            '2026-11-08',
            '2026-11-10',
          ],
        })}
        shields={0}
        request={request}
      />,
    );
    fireEvent.click(screen.getByTestId('attendance-stamp'));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('스트릭 방패도 1개'),
    );
    // 카드를 닫을 때(퇴장 연출 끝) 부르면 새로 고침이 가끔 커밋되지 않아 띄울 때 받아 둠
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('실패하면 안내 한 줄, 버튼은 그대로', async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error('도장을 찍지 못했어요.'));
    render(<AttendanceCard status={status()} shields={0} request={request} />);
    fireEvent.click(screen.getByTestId('attendance-stamp'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '도장을 찍지 못했어요',
    );
    expect(screen.getByTestId('attendance-stamp')).toBeVisible();
  });

  it('오늘 이미 찍었으면(서버) 카드 없음', () => {
    render(
      <AttendanceCard status={status({ stamped_today: true })} shields={0} />,
    );
    expect(screen.queryByTestId('attendance-card')).toBeNull();
  });

  it('어제를 방패가 지켰으면 안내 한 줄', () => {
    render(<AttendanceCard status={status()} shields={1} shieldSaved />);
    expect(screen.getByTestId('attendance-shield-saved')).toHaveTextContent(
      '방패가 불꽃을 지켜 줬어요',
    );
  });
});

describe('AttendanceMenuSection', () => {
  it('7일째를 찍으면 도장 + 작은 열린 상자, 다른 찍은 칸에는 없음 (§12-Q66 ⑤)', () => {
    render(
      <AttendanceMenuSection
        status={status({
          stamped_today: true,
          total: 7,
          day_n: 7,
          cycle: [
            '2026-11-04',
            '2026-11-05',
            '2026-11-06',
            '2026-11-07',
            '2026-11-08',
            '2026-11-10',
            '2026-11-11',
          ],
        })}
        shields={1}
      />,
    );
    const seventh = screen.getByTestId('attendance-cell-7');
    expect(seventh).toHaveAttribute('data-state', 'done');
    expect(seventh).toHaveAttribute(
      'aria-label',
      '7일째 상자 열림, 코인 30개, 11월 11일 찍음',
    );
    expect(seventh.querySelector('.at-stamp')).toHaveTextContent('출석');
    expect(
      seventh.querySelector('.at-chest-mark [data-reward="chestOpen"]'),
    ).not.toBeNull();
    expect(document.querySelectorAll('.at-chest-mark')).toHaveLength(1);
  });

  it('찍은 날·방패 수를 보여 줌 (도장 버튼 없음)', () => {
    render(
      <AttendanceMenuSection
        status={status({
          stamped_today: true,
          day_n: 2,
          cycle: ['2026-11-10', '2026-11-11'],
        })}
        shields={2}
      />,
    );
    expect(screen.getByRole('heading')).toHaveTextContent(
      '오늘 2일째 출석했어요',
    );
    expect(screen.getByText(/스트릭 방패 2\/2개/)).toBeVisible();
    expect(screen.getByText(/방패가 가득하면 코인만/)).toBeVisible();
    expect(screen.queryByTestId('attendance-stamp')).toBeNull();
  });
});
