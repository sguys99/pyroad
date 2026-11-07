'use client';

import { useEffect, useState } from 'react';
import type { LoginErrorReason } from '@/lib/auth/loginError';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import { takeLoginAttempt } from '@/lib/auth/loginAttempt';
import { LoginErrorPanel, type LoginErrorPanelProps } from './LoginErrorPanel';

/**
 * `/auth/error` 화면 본문 (B43). 시도한 수단은 주소가 아니라 이 탭의 sessionStorage에 있으므로(`loginAttempt.ts`)
 * 마운트 뒤에 읽어 안내 문구에 이름을 넣는다. 서버·첫 렌더는 이름 없는 안내(같은 사유 문구)라 하이드레이션 불일치가 없다.
 */
export function AuthErrorView({
  reason,
  via: viaFromUrl = null,
  ...rest
}: Omit<LoginErrorPanelProps, 'via'> & {
  reason: LoginErrorReason;
  /** 예전 주소(`?via=`)로 온 값. 있으면 그것 */
  via?: SocialProvider | null;
}) {
  const [via, setVia] = useState<SocialProvider | null>(viaFromUrl);
  useEffect(() => {
    const attempted = takeLoginAttempt();
    if (!viaFromUrl && attempted) setVia(attempted);
  }, [viaFromUrl]);
  return <LoginErrorPanel reason={reason} via={via} {...rest} />;
}
