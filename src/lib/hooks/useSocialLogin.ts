'use client';

import { useCallback, useState } from 'react';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import {
  detectInAppBrowser,
  type InAppBrowserInfo,
} from '@/lib/browser/detectInAppBrowser';
import { openExternalBrowser } from '@/lib/browser/openExternalBrowser';
import {
  getOAuthCredentials,
  needsExternalBrowser,
  type SocialProvider,
} from '@/lib/auth/socialLogin';

/**
 * `handleLogin()`이 끝난 뒤의 상태 (P3-05 로그인 버튼의 바쁨·오류 표시용).
 * - `redirecting`: provider 로그인 화면으로 떠나는 중 (버튼은 계속 바쁨)
 * - `external-browser`: 인앱에서 외부 브라우저를 열었음 (이 화면은 그대로 남음)
 * - `browser-guide`: 외부 전환이 안 되는 인앱이라 안내 모달을 띄움
 * - `error`: 로그인을 시작하지 못함 (네트워크·설정 오류). 다시 누를 수 있게 한다
 */
export type SocialLoginResult =
  | 'redirecting'
  | 'external-browser'
  | 'browser-guide'
  | 'error';

/**
 * 소셜 로그인 버튼용 훅 (P1-14). provider별 호출 옵션은 `@/lib/auth/socialLogin`에만 있습니다.
 * 인앱 브라우저의 외부 전환은 Google일 때만 합니다(B16). 안내 모달(`InAppBrowserGuide`)도 Google 전용입니다.
 */
export function useSocialLogin(provider: SocialProvider) {
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);

  const handleLogin = useCallback(async (): Promise<SocialLoginResult> => {
    const info = detectInAppBrowser();

    if (needsExternalBrowser(provider, info)) {
      setBrowserInfo(info);
      const redirected = openExternalBrowser(window.location.href, info);
      if (!redirected) {
        setShowBrowserGuide(true);
        return 'browser-guide';
      }
      return 'external-browser';
    }

    try {
      const supabase = await loadBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth(
        getOAuthCredentials(provider, {
          origin: window.location.origin,
          device: info,
        }),
      );
      return error ? 'error' : 'redirecting';
    } catch {
      // 클라이언트 청크를 못 받았거나(오프라인) 인가 URL을 만들지 못함
      return 'error';
    }
  }, [provider]);

  return { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo };
}
