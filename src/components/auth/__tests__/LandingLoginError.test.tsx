// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 랜딩: 실패·취소로 돌아오면 로그인 시트를 저절로 열고 주소를 정리 (P3-10)

vi.mock('@/fonts/landing', () => ({
  displayLanding: { variable: '__variable_d1' },
  sansLanding: { variable: '__variable_s1' },
}));
// next/dynamic 대신 바로 그리는 가짜 시트
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeSheet(props: {
      open: boolean;
      notice: { reason: string; via: string | null };
      className?: string;
    }) {
      return props.open ? (
        <div
          data-testid="fake-sheet"
          data-reason={props.notice.reason}
          data-via={props.notice.via ?? ''}
          className={props.className}
        />
      ) : null;
    },
}));

import { LandingLoginError } from '../LandingLoginError';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('LandingLoginError', () => {
  it('?login_error=&via= → 시트를 열고 그 키만 지운다, 랜딩 글꼴 변수를 넘긴다', async () => {
    window.history.replaceState(
      null,
      '',
      '/?login_error=other_browser&via=naver&ref=a',
    );
    render(<LandingLoginError />);
    const sheet = await screen.findByTestId('fake-sheet');
    expect(sheet).toHaveAttribute('data-reason', 'other_browser');
    expect(sheet).toHaveAttribute('data-via', 'naver');
    expect(sheet).toHaveClass('__variable_d1', '__variable_s1');
    expect(window.location.search).toBe('?ref=a');
  });

  it('GoTrue가 바로 보낸 bad_oauth_state도 받는다', async () => {
    window.history.replaceState(
      null,
      '',
      '/?error=invalid_request&error_code=bad_oauth_state&error_description=x',
    );
    render(<LandingLoginError />);
    expect(await screen.findByTestId('fake-sheet')).toHaveAttribute(
      'data-reason',
      'expired',
    );
    expect(window.location.search).toBe('');
  });

  it('오류가 없으면 아무것도 그리지 않는다', () => {
    window.history.replaceState(null, '', '/?ref=a');
    render(<LandingLoginError />);
    expect(screen.queryByTestId('fake-sheet')).toBeNull();
    expect(window.location.search).toBe('?ref=a');
  });
});
