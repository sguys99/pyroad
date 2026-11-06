'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ConsentStatus } from '@/lib/consent/status';

/**
 * 보호자 동의 상태 (P3-15). 로그인 레이아웃이 서버에서 읽은 값(`loadOwnUserRow` 한 번)을 넘긴다.
 * null = 모름(00024 미적용·조회 실패) → 화면은 막지 않는다. 실제로 막는 것은 서버 API(`guardianWriteGate`)
 */
const ConsentContext = createContext<ConsentStatus | null>(null);

export function ConsentProvider({
  status,
  children,
}: {
  status: ConsentStatus | null;
  children: ReactNode;
}) {
  return (
    <ConsentContext.Provider value={status}>{children}</ConsentContext.Provider>
  );
}

export function useConsentStatus(): ConsentStatus | null {
  return useContext(ConsentContext);
}

/** 제한 모드인지 (게시판 글쓰기·댓글·신고 화면을 안내로 바꿀 때) */
export function useRestricted(): boolean {
  return useConsentStatus()?.state === 'pending';
}
