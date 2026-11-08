// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { LAST_LOGIN_STORAGE_KEY } from '@/lib/auth/lastLogin';
import { SHARED_DEVICE_STORAGE_KEY } from '@/lib/auth/sharedDevice';
import { LastLoginRecorder } from '../LastLoginRecorder';

// 로그인 직후 #lp= 조각을 저장하고 주소에서 지운다 (P3-08)

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('LastLoginRecorder', () => {
  it('#lp=kakao → 저장하고 조각을 지운다 (경로·쿼리·history.state 유지), 로그인 시도 기록도 지운다 (B43)', () => {
    window.sessionStorage.setItem(
      'pyroad.loginAttempt.v1',
      JSON.stringify({ provider: 'kakao', at: Date.now() }),
    );
    window.history.replaceState({ keep: 1 }, '', '/world?tab=map#lp=kakao');
    render(<LastLoginRecorder />);
    expect(
      JSON.parse(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY)!).provider,
    ).toBe('kakao');
    expect(window.location.pathname + window.location.search).toBe(
      '/world?tab=map',
    );
    expect(window.location.hash).toBe('');
    expect(window.history.state).toEqual({ keep: 1 });
    expect(window.sessionStorage.getItem('pyroad.loginAttempt.v1')).toBeNull();
  });

  it('모르는 값은 저장하지 않고 조각만 지운다', () => {
    window.history.replaceState(null, '', '/world#lp=github');
    render(<LastLoginRecorder />);
    expect(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('조각이 없거나 다른 조각이면 아무것도 하지 않는다', () => {
    window.history.replaceState(null, '', '/notice#top');
    render(<LastLoginRecorder />);
    expect(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe('#top');
  });

  it('공용 기기로 표시된 기기는 기록하지 않고 같은 수단의 옛 기록도 지운다 (P4-09)', () => {
    window.localStorage.setItem(SHARED_DEVICE_STORAGE_KEY, '1');
    window.localStorage.setItem(
      LAST_LOGIN_STORAGE_KEY,
      JSON.stringify({ provider: 'kakao', at: new Date().toISOString() }),
    );
    window.history.replaceState(null, '', '/world#lp=kakao');
    render(<LastLoginRecorder />);
    expect(window.localStorage.getItem(LAST_LOGIN_STORAGE_KEY)).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
