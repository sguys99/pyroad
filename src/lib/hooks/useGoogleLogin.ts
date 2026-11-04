'use client';

import { useCallback, useState } from 'react';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import {
  detectInAppBrowser,
  type InAppBrowserInfo,
} from '@/lib/browser/detectInAppBrowser';
import { openExternalBrowser } from '@/lib/browser/openExternalBrowser';

export function useGoogleLogin() {
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<InAppBrowserInfo | null>(null);

  const handleLogin = useCallback(async () => {
    const info = detectInAppBrowser();

    if (info.isInApp) {
      setBrowserInfo(info);
      const redirected = openExternalBrowser(window.location.href, info);
      if (!redirected) {
        setShowBrowserGuide(true);
      }
      return;
    }

    const supabase = await loadBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  return { handleLogin, showBrowserGuide, setShowBrowserGuide, browserInfo };
}
