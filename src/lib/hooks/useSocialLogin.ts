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
 * 소셜 로그인 버튼용 훅 (P1-14). provider별 호출 옵션은 `@/lib/auth/socialLogin`에만 있습니다.
 * 인앱 브라우저의 외부 전환은 Google일 때만 합니다(B16). 안내 모달(`InAppBrowserGuide`)도 Google 전용입니다.
 */
export function useSocialLogin(provider: SocialProvider) {
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);

  const handleLogin = useCallback(async () => {
    const info = detectInAppBrowser();

    if (needsExternalBrowser(provider, info)) {
      setBrowserInfo(info);
      const redirected = openExternalBrowser(window.location.href, info);
      if (!redirected) {
        setShowBrowserGuide(true);
      }
      return;
    }

    const supabase = await loadBrowserClient();
    await supabase.auth.signInWithOAuth(
      getOAuthCredentials(provider, { origin: window.location.origin }),
    );
  }, [provider]);

  return { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo };
}
