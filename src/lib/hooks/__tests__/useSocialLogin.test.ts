// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { InAppBrowserInfo } from '@/lib/browser/detectInAppBrowser';

const { signInWithOAuth, detectInAppBrowser, openExternalBrowser } = vi.hoisted(
  () => ({
    signInWithOAuth: vi.fn<
      (creds: unknown) => Promise<{ error: { message: string } | null }>
    >(async () => ({ error: null })),
    detectInAppBrowser: vi.fn<() => InAppBrowserInfo>(),
    openExternalBrowser:
      vi.fn<(url: string, info: InAppBrowserInfo) => boolean>(),
  }),
);
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: vi.fn(async () => ({ auth: { signInWithOAuth } })),
}));
vi.mock('@/lib/browser/detectInAppBrowser', () => ({ detectInAppBrowser }));
vi.mock('@/lib/browser/openExternalBrowser', () => ({ openExternalBrowser }));

import { useSocialLogin, type SocialLoginResult } from '../useSocialLogin';
import { LOGIN_ATTEMPT_STORAGE_KEY } from '@/lib/auth/loginAttempt';

const KAKAOTALK: InAppBrowserInfo = {
  isInApp: true,
  type: 'kakaotalk',
  isAndroid: true,
  isIOS: false,
};
const IOS_WEBVIEW: InAppBrowserInfo = {
  isInApp: true,
  type: 'unknown-webview',
  isAndroid: false,
  isIOS: true,
};
const NORMAL: InAppBrowserInfo = {
  isInApp: false,
  type: null,
  isAndroid: false,
  isIOS: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  openExternalBrowser.mockReturnValue(true);
});

async function login(provider: 'google' | 'kakao' | 'naver') {
  const { result } = renderHook(() => useSocialLogin(provider));
  let outcome: SocialLoginResult | null = null;
  await act(async () => {
    outcome = await result.current.handleLogin();
  });
  return {
    get current() {
      return result.current;
    },
    outcome: outcome as SocialLoginResult | null,
  };
}

describe('useSocialLogin (P1-14, B16)', () => {
  it('일반 브라우저의 Google 로그인은 기존과 같은 signInWithOAuth 호출', async () => {
    detectInAppBrowser.mockReturnValue(NORMAL);
    await login('google');
    expect(openExternalBrowser).not.toHaveBeenCalled();
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  });

  it('결과를 돌려준다: 떠나는 중 redirecting · 시작 실패 error (P3-05 버튼 바쁨·오류 표시)', async () => {
    detectInAppBrowser.mockReturnValue(NORMAL);
    expect((await login('kakao')).outcome).toBe('redirecting');

    signInWithOAuth.mockResolvedValueOnce({ error: { message: 'boom' } });
    expect((await login('kakao')).outcome).toBe('error');

    signInWithOAuth.mockRejectedValueOnce(new Error('offline'));
    expect((await login('naver')).outcome).toBe('error');
  });

  it('카카오톡 인앱에서 Google은 로그인 전에 외부 브라우저로 보냄', async () => {
    detectInAppBrowser.mockReturnValue(KAKAOTALK);
    const result = await login('google');
    expect(openExternalBrowser).toHaveBeenCalledWith(
      window.location.href,
      KAKAOTALK,
    );
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(result.current.showBrowserGuide).toBe(false);
    expect(result.current.browserInfo).toEqual(KAKAOTALK);
    expect(result.outcome).toBe('external-browser');
  });

  it('외부 전환이 안 되는 인앱(iOS 웹뷰)에서 Google은 안내 모달을 띄움', async () => {
    detectInAppBrowser.mockReturnValue(IOS_WEBVIEW);
    openExternalBrowser.mockReturnValue(false);
    const result = await login('google');
    expect(signInWithOAuth).not.toHaveBeenCalled();
    expect(result.current.showBrowserGuide).toBe(true);
    expect(result.outcome).toBe('browser-guide');
  });

  it('Android에서 네이버는 appscheme=true를 붙여 인앱에서 그대로 로그인 (P3-09)', async () => {
    detectInAppBrowser.mockReturnValue(KAKAOTALK);
    await login('naver');
    expect(openExternalBrowser).not.toHaveBeenCalled();
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'custom:naver',
        options: expect.objectContaining({
          queryParams: { appscheme: 'true' },
        }),
      }),
    );
  });

  it.each(['kakao', 'naver'] as const)(
    '카카오톡 인앱에서 %s는 외부 전환 없이 인앱에서 로그인',
    async (provider) => {
      detectInAppBrowser.mockReturnValue(KAKAOTALK);
      const result = await login(provider);
      expect(openExternalBrowser).not.toHaveBeenCalled();
      expect(result.current.showBrowserGuide).toBe(false);
      expect(signInWithOAuth).toHaveBeenCalledTimes(1);
      expect(signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: provider === 'naver' ? 'custom:naver' : 'kakao',
        }),
      );
    },
  );

  it('signInWithOAuth 직전에 시도한 수단을 이 탭에 적는다 (B43), 외부 브라우저로 넘길 때는 적지 않음', async () => {
    detectInAppBrowser.mockReturnValue(NORMAL);
    await login('kakao');
    expect(
      JSON.parse(window.sessionStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY)!)
        .provider,
    ).toBe('kakao');

    window.sessionStorage.clear();
    detectInAppBrowser.mockReturnValue(KAKAOTALK);
    await login('google');
    expect(window.sessionStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY)).toBeNull();
  });
});
