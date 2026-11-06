// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LAST_LOGIN_STORAGE_KEY } from '@/lib/auth/lastLogin';

// 로그인 시트 (P3-05 · P3-08): 이 기기의 최근 로그인 수단을 읽어 맨 위 + 이름표 + 같은 계정 안내

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('@/components/characters/rig/MascotRig', () => ({
  PybaemRig: () => null,
}));
vi.mock('@/lib/analytics/track', () => ({ track: vi.fn() }));
vi.mock('@/lib/hooks/useSocialLogin', () => ({
  useSocialLogin: () => ({
    handleLogin: vi.fn(),
    showBrowserGuide: false,
    setShowBrowserGuide: vi.fn(),
    browserInfo: null,
  }),
}));

import { LoginSheet } from '../LoginSheet';

const order = () =>
  screen
    .getAllByRole('button')
    .map((b) => b.getAttribute('data-provider'))
    .filter(Boolean);

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('LoginSheet', () => {
  it('기록이 없으면 기본 순서와 기본 안내', () => {
    render(<LoginSheet open onOpenChange={() => {}} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '가지고 있는 계정 하나를 골라 줘.',
    );
  });

  it('이 기기 저장값(네이버)을 열 때 읽어 맨 위 + 같은 계정 안내', () => {
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'naver', at: new Date().toISOString() }),
    );
    render(<LoginSheet open onOpenChange={() => {}} />);
    expect(order()).toEqual(['naver', 'kakao', 'google']);
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '지난번엔 네이버로 들어왔어',
    );
    expect(
      screen.getByRole('button', { name: '네이버 로그인' }),
    ).toHaveAccessibleDescription('최근에 네이버로 로그인했어요');
  });

  it('lastUsed를 직접 주면 저장값보다 우선 (카탈로그)', () => {
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'naver', at: new Date().toISOString() }),
    );
    render(<LoginSheet open onOpenChange={() => {}} lastUsed={null} />);
    expect(order()).toEqual(['kakao', 'naver', 'google']);
  });
});

describe('LoginSheet 실패 안내 (P3-10)', () => {
  it('사유별 제목·설명으로 바뀌고 버튼은 그대로 (바로 다시 해 보기)', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed={null}
        notice={{ reason: 'cancelled', via: 'kakao' }}
      />,
    );
    expect(
      screen.getByRole('dialog', { name: '카카오 로그인을 그만뒀구나' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('login-sheet-hint')).toHaveTextContent(
      '마음이 바뀌면 아래에서 다시 골라 줘',
    );
    expect(order()).toEqual(['kakao', 'naver', 'google']);
    // 취소에는 "다른 방법" 한마디가 없다
    expect(screen.queryByTestId('login-error-hint')).toBeNull();
  });

  it('설정 오류면 다른 계정을 권하는 한마디', () => {
    render(
      <LoginSheet
        open
        onOpenChange={() => {}}
        lastUsed={null}
        notice={{ reason: 'unavailable', via: 'naver' }}
      />,
    );
    expect(screen.getByTestId('login-error-hint')).toHaveTextContent(
      '카카오·Google 계정이 있으면 그걸로 들어가 봐.',
    );
  });
});
