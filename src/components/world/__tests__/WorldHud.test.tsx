// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { WorldHud, streakText, type WorldHudProps } from '../WorldHud';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
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

  it('곧 열려요 칩을 누르면 아이 말투 쪽지', () => {
    render(<WorldHud {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '상점, 곧 열려요' }));
    expect(screen.getByRole('status', { name: 'HUD 안내' })).toHaveTextContent(
      '상점은 곧 열려요! 조금만 기다려 줘.',
    );
  });

  it('메뉴 버튼이 있다 (공지·게시판·로그아웃은 시트 안)', () => {
    render(<WorldHud {...props} />);
    expect(screen.getByRole('button', { name: '메뉴' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '게시판' })).toBeNull();
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
