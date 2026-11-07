// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';

// 계정 연결 훅 (P3-07): P1-14 헬퍼 인자 그대로 linkIdentity, 인앱 Google은 시작하지 않음

const { linkIdentity, detectInAppBrowser } = vi.hoisted(() => ({
  linkIdentity: vi.fn(async () => ({ data: {}, error: null as unknown })),
  detectInAppBrowser: vi.fn<() => InAppBrowserInfo>(),
}));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({ auth: { linkIdentity } }),
}));
vi.mock('@/lib/browser/detectInAppBrowser', () => ({ detectInAppBrowser }));

import { useLinkIdentity } from '../useLinkIdentity';

const NORMAL = { isInApp: false, type: null, isAndroid: false, isIOS: false };
const KAKAOTALK = {
  isInApp: true,
  type: 'kakaotalk' as const,
  isAndroid: true,
  isIOS: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  detectInAppBrowser.mockReturnValue(NORMAL);
});

describe('useLinkIdentity', () => {
  it('Kakao: scope 덮어쓰기 그대로, 돌아올 곳 /settings?linked=kakao', async () => {
    const { result } = renderHook(() => useLinkIdentity());
    expect(await result.current('kakao')).toBe('redirecting');
    const [creds] = linkIdentity.mock.calls[0] as unknown as [
      {
        provider: string;
        options: { redirectTo: string; queryParams: unknown };
      },
    ];
    expect(creds.provider).toBe('kakao');
    expect(creds.options.queryParams).toEqual({ scope: '' });
    const redirect = new URL(creds.options.redirectTo);
    expect(redirect.pathname).toBe('/auth/callback');
    expect(redirect.searchParams.get('next')).toBe('/settings?linked=kakao');
    // 시도한 수단은 주소가 아니라 이 탭에 (B43)
    expect(redirect.searchParams.has('via')).toBe(false);
    expect(
      JSON.parse(window.sessionStorage.getItem('pyroad.loginAttempt.v1')!)
        .provider,
    ).toBe('kakao');
  });

  it('인앱에서 Google은 시작하지 않음 (세션이 앱 안에만 있음)', async () => {
    detectInAppBrowser.mockReturnValue(KAKAOTALK);
    const { result } = renderHook(() => useLinkIdentity());
    expect(await result.current('google')).toBe('external-only');
    expect(linkIdentity).not.toHaveBeenCalled();
    // 카카오·네이버는 인앱에서도 그대로
    expect(await result.current('naver')).toBe('redirecting');
  });

  it('시작하지 못하면 error (Manual linking 꺼짐 등)', async () => {
    linkIdentity.mockResolvedValueOnce({
      data: {},
      error: { code: 'manual_linking_disabled' },
    });
    const { result } = renderHook(() => useLinkIdentity());
    expect(await result.current('naver')).toBe('error');
  });
});
