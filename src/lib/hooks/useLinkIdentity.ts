'use client';

import { useCallback } from 'react';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { detectInAppBrowser } from '@/lib/browser/detectInAppBrowser';
import {
  getOAuthCredentials,
  needsExternalBrowser,
  type SocialProvider,
} from '@/lib/auth/socialLogin';
import { linkNext } from '@/lib/auth/accountLinks';

/**
 * 계정 연결 결과 (P3-07).
 * - `redirecting`: provider 화면으로 떠나는 중 · `external-only`: 인앱 브라우저에서 Google(웹뷰 OAuth 차단) — 로그인 세션이
 *   이 앱 안에만 있어 외부 브라우저로 넘기면 연결할 수 없다 → 안내만 · `error`: 시작하지 못함(Manual linking 꺼짐 등)
 */
export type LinkIdentityResult = 'redirecting' | 'external-only' | 'error';

/**
 * 설정 화면 "로그인 계정 연결"용 훅 (P3-07). 호출 옵션은 로그인과 같은 P1-14 헬퍼(`getOAuthCredentials`)에서 만든다
 * (Kakao scope 덮어쓰기·Naver Android appscheme도 연결에 그대로 적용). 돌아올 곳은 `/settings?linked=<provider>`이고,
 * 실패(예: `identity_already_exists`)는 `/auth/callback`이 P3-10 안내(`/auth/error`, 돌아가기 = 설정)로 보낸다.
 */
export function useLinkIdentity() {
  return useCallback(
    async (provider: SocialProvider): Promise<LinkIdentityResult> => {
      const info = detectInAppBrowser();
      if (needsExternalBrowser(provider, info)) return 'external-only';
      try {
        const supabase = await loadBrowserClient();
        const { error } = await supabase.auth.linkIdentity(
          getOAuthCredentials(provider, {
            origin: window.location.origin,
            next: linkNext(provider),
            device: info,
          }),
        );
        return error ? 'error' : 'redirecting';
      } catch {
        return 'error';
      }
    },
    [],
  );
}
