'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { displayLanding, sansLanding } from '@/fonts/landing';
import { cn } from '@/lib/utils';
import {
  takeLoginErrorFromUrl,
  type LoginErrorReason,
} from '@/lib/auth/loginError';
import type { SocialProvider } from '@/lib/auth/socialLogin';

// 실패해서 돌아왔을 때만 시트 모듈을 불러온다 (첫 화면 JS 밖, §2.10)
const LoginSheet = dynamic(
  () => import('./LoginSheet').then((m) => m.LoginSheet),
  { ssr: false },
);

/**
 * 랜딩: 로그인이 실패·취소되어 돌아오면(P3-10) 로그인 시트를 저절로 열어 파이뱀이 사유를 알려 주고, 바로 아래 버튼으로
 * 다시 해 보게 한다. 주소의 두 모양을 모두 받는다:
 * - 우리 콜백이 보낸 `/?login_error=<사유>&via=<provider>` (`loginErrorPath`)
 * - GoTrue가 Site URL로 바로 보낸 원래 값 `/?error=…&error_code=bad_oauth_state…` (state 만료·변조는 콜백을 거치지 않음)
 * 읽은 뒤 그 키들을 주소에서 지운다(새로고침해도 다시 뜨지 않게). 랜딩은 정적 페이지라 서버가 아니라 여기서 읽는다.
 */
export function LandingLoginError() {
  const [notice, setNotice] = useState<{
    reason: LoginErrorReason;
    via: SocialProvider | null;
  } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const taken = takeLoginErrorFromUrl(window.location.href);
    if (!taken) return;
    try {
      window.history.replaceState(window.history.state, '', taken.cleaned);
    } catch {
      // 주소를 못 지워도 안내는 보여 준다
    }
    setNotice({ reason: taken.reason, via: taken.via });
    setOpen(true);
  }, []);

  if (!notice) return null;
  return (
    <LoginSheet
      open={open}
      onOpenChange={setOpen}
      notice={notice}
      // 시트는 body로 포털되므로 랜딩 서브셋 글꼴 변수를 직접 넘긴다 (LoginSheetButton과 같음)
      className={cn(displayLanding.variable, sansLanding.variable)}
    />
  );
}
