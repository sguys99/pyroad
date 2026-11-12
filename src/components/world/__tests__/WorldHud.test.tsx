// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { WorldHud, streakText, type WorldHudProps } from '../WorldHud';
import { MissionHudButton } from '../DailyMissions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/sound/SoundToggle', () => ({
  SoundToggle: () => <button type="button">소리 끄기</button>,
}));
vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 월드맵 HUD (P5-07): 실제 값(닉네임·레벨·XP·스트릭) + 곧 열려요 칩, 누르면 쪽지

afterEach(cleanup);

const props: WorldHudProps = {
  name: '파이',
  skin: 'green',
  totalXp: 280, // Lv 2 (200~490) → 80 / 290
  level: 2,
  coins: 1280,
  streak: { days: 3, today: true },
};

describe('WorldHud', () => {
  it('닉네임은 내 프로필 링크, 레벨·XP·불꽃이 실제 값', () => {
    render(<WorldHud {...props} />);
    expect(
      screen.getByRole('link', { name: '파이, 내 프로필' }),
    ).toHaveAttribute('href', '/profile');
    expect(screen.getByText('레벨 2')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: '다음 레벨까지 경험치' }),
    ).toHaveAttribute('aria-valuetext', '80 / 290 XP');
    expect(
      screen.getByRole('button', { name: '3일 연속 모험 중' }),
    ).toHaveAttribute('data-on');
  });

  it('받을 업적 보상이 있으면 메뉴에 금색 점 + 업적 도감 줄 (P8-10)', async () => {
    render(<WorldHud {...props} achievementsReady={2} />);
    fireEvent.click(
      screen.getByRole('button', { name: '메뉴, 받을 업적 보상 2개' }),
    );
    expect(
      await screen.findByRole('link', { name: '업적 도감, 받을 보상 2개' }),
    ).toHaveAttribute('href', '/profile/achievements');
    cleanup();
    render(<WorldHud {...props} />);
    expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument();
  });

  it('곧 열려요 칩을 누르면 아이 말투 쪽지', () => {
    render(<WorldHud {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '상점, 곧 열려요' }));
    expect(screen.getByRole('status', { name: 'HUD 안내' })).toHaveTextContent(
      '상점은 곧 열려요! 조금만 기다려 줘.',
    );
  });

  it('코인 칩은 실제 잔액 (P8-04), 본 값을 이 탭에 기억해 다음에 거기서부터 센다', () => {
    sessionStorage.setItem('pyroad:hud-coins', '1200');
    render(<WorldHud {...props} />);
    expect(screen.getByTestId('hud-coin')).toHaveTextContent('코인 1,280개');
    expect(
      screen.queryByRole('button', { name: '코인, 곧 열려요' }),
    ).toBeNull();
    expect(sessionStorage.getItem('pyroad:hud-coins')).toBe('1280');
  });

  it('미션이 있으면 미션 칸(P8-07)이 들어오고 곧 열려요는 상점만', () => {
    render(
      <WorldHud
        {...props}
        missions={
          <MissionHudButton
            state={{ day: '2026-11-11', missions: [], pending: [] }}
          />
        }
      />,
    );
    expect(screen.getByTestId('hud-mission')).toHaveAccessibleName(
      '오늘의 미션 0/0 달성',
    );
    expect(
      screen.queryByRole('button', { name: '오늘의 미션, 곧 열려요' }),
    ).toBeNull();
    expect(screen.getByTestId('hud-soon')).toHaveAccessibleName(
      '상점, 곧 열려요',
    );
  });

  it('메뉴 버튼이 있다 (공지·게시판·로그아웃은 시트 안)', () => {
    render(<WorldHud {...props} />);
    expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '게시판' })).toBeNull();
  });
});

describe('스트릭 방패·반짝임 (P8-08)', () => {
  afterEach(() => window.localStorage.clear());

  it('방패가 있으면 불꽃 모서리에 개수만큼, 이름·쪽지에 개수, 어제를 지켰으면 그 안내', () => {
    render(<WorldHud {...props} shields={2} shieldSaved />);
    const fire = screen.getByTestId('hud-streak');
    expect(fire).toHaveAccessibleName('3일 연속 모험 중, 방패 2개');
    expect(
      screen.getByTestId('hud-shields').querySelectorAll('svg'),
    ).toHaveLength(2);
    fireEvent.click(fire);
    expect(screen.getByRole('status')).toHaveTextContent(
      '방패가 불꽃을 지켜 줬어요',
    );
  });

  it('방패 0개면 그림 없음', () => {
    render(<WorldHud {...props} />);
    expect(screen.queryByTestId('hud-shields')).toBeNull();
  });

  it('오늘 3일이 되면 한 번 반짝, 이 기기에서 이미 봤으면 다시 안 함', () => {
    render(<WorldHud {...props} />);
    expect(screen.getByTestId('hud-streak')).toHaveAttribute('data-spark');
    cleanup();
    render(<WorldHud {...props} />);
    expect(screen.getByTestId('hud-streak')).not.toHaveAttribute('data-spark');
  });

  it('처음 켜진 날(1일)은 반짝, 2일·오늘 아직은 안 함', () => {
    render(<WorldHud {...props} streak={{ days: 1, today: true }} />);
    expect(screen.getByTestId('hud-streak')).toHaveAttribute('data-spark');
    cleanup();
    window.localStorage.clear();
    render(<WorldHud {...props} streak={{ days: 2, today: true }} />);
    expect(screen.getByTestId('hud-streak')).not.toHaveAttribute('data-spark');
    cleanup();
    window.localStorage.clear();
    render(<WorldHud {...props} streak={{ days: 3, today: false }} />);
    expect(screen.getByTestId('hud-streak')).not.toHaveAttribute('data-spark');
  });
});

describe('streakText', () => {
  it('0일은 꺼진 불꽃 안내', () => {
    expect(streakText({ days: 0, today: false }).label).toBe(
      '불꽃이 꺼져 있어요',
    );
  });
  it('오늘 아직이면 하루 더 하자고', () => {
    expect(streakText({ days: 7, today: false }).note).toContain(
      '오늘도 풀면 8일',
    );
  });
});
