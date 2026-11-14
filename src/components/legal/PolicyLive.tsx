'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * 새 처리방침 근거 기능(자랑 카드·보호자 리포트·자유 질문)을 보일지 (B79). 로그인 레이아웃이 요청 때 서버에서 판정한 값
 * (`isPolicyLive`)을 넘긴다. 없으면 false — 진입점은 그냥 그리지 않는다. 실제로 막는 것은 서버 API
 */
const PolicyLiveContext = createContext(false);

export function PolicyLiveProvider({
  live,
  children,
}: {
  live: boolean;
  children: ReactNode;
}) {
  return (
    <PolicyLiveContext.Provider value={live}>
      {children}
    </PolicyLiveContext.Provider>
  );
}

export function usePolicyLive(): boolean {
  return useContext(PolicyLiveContext);
}
