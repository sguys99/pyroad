// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LOGIN_ERROR_REASONS } from '@/lib/auth/loginError';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

import { LoginErrorPanel } from '../LoginErrorPanel';

// /auth/error 안내 패널 (P3-10)

afterEach(cleanup);

describe('LoginErrorPanel', () => {
  it.each(LOGIN_ERROR_REASONS)('%s: 제목(h1)·설명·처음 화면 링크', (reason) => {
    render(<LoginErrorPanel reason={reason} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '처음 화면으로' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(
      screen.getByTestId(`login-error-panel-${reason}`),
    ).toBeInTheDocument();
  });

  it('계정 연결 충돌: 설정으로 돌아가기가 먼저', () => {
    render(
      <LoginErrorPanel
        reason="identity_taken"
        via="kakao"
        backHref="/settings"
        backLabel="설정으로 돌아가기"
      />,
    );
    expect(
      screen.getByRole('heading', { name: '이미 다른 계정에 연결돼 있어' }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAccessibleName('설정으로 돌아가기');
    expect(links[0]).toHaveAttribute('href', '/settings');
  });
});
