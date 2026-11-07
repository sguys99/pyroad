// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

import { AuthErrorView } from '../AuthErrorView';

// /auth/error 본문 (B43): 시도한 수단을 sessionStorage에서 읽어 안내 문구에 이름을 넣는다

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('AuthErrorView', () => {
  it('주소에 via가 없으면 로그인 직전에 적어 둔 수단으로', async () => {
    window.sessionStorage.setItem(
      'pyroad.loginAttempt.v1',
      JSON.stringify({ provider: 'google', at: Date.now() }),
    );
    render(<AuthErrorView reason="identity_taken" backHref="/settings" />);
    expect(
      await screen.findByText(/이 Google 계정은 다른 pyRoad 계정에서/),
    ).toBeInTheDocument();
  });

  it('기록이 없으면 이름 없는 안내', () => {
    render(<AuthErrorView reason="cancelled" />);
    expect(
      screen.getByRole('heading', { name: '로그인을 그만뒀구나' }),
    ).toBeInTheDocument();
  });

  it('예전 주소의 via가 있으면 그것이 먼저', () => {
    window.sessionStorage.setItem(
      'pyroad.loginAttempt.v1',
      JSON.stringify({ provider: 'google', at: Date.now() }),
    );
    render(<AuthErrorView reason="cancelled" via="naver" />);
    expect(
      screen.getByRole('heading', { name: '네이버 로그인을 그만뒀구나' }),
    ).toBeInTheDocument();
  });
});
