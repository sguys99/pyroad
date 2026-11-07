'use client';

import { useEffect } from 'react';
import { takeLastLoginFragment, writeLastLogin } from '@/lib/auth/lastLogin';
import { clearLoginAttempt } from '@/lib/auth/loginAttempt';

/**
 * 로그인 직후 도착한 화면에서 `#lp=<provider>`(P3-08, `/auth/callback`이 붙임)를 이 기기에 저장하고 주소에서 지운다.
 * 루트 레이아웃에 하나만 둔다: 미들웨어가 다른 화면(온보딩 등)으로 다시 보내도 조각이 따라오므로 어디서 도착하든 받는다.
 * 그리는 것은 없다. `history.state`를 그대로 넘겨 Next 라우터 상태를 지킨다.
 */
export function LastLoginRecorder() {
  useEffect(() => {
    const taken = takeLastLoginFragment(window.location.href);
    if (!taken) return;
    if (taken.provider) writeLastLogin(taken.provider);
    // 로그인이 끝났으니 시도 기록은 지운다 (B43, 다음 오류 안내에 섞이지 않게)
    clearLoginAttempt();
    try {
      window.history.replaceState(window.history.state, '', taken.cleaned);
    } catch {
      // 일부 웹뷰에서 replaceState가 막혀도 저장은 끝났다
    }
  }, []);
  return null;
}
