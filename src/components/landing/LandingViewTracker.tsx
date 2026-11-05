'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/track';

/**
 * 랜딩 화면을 본 것을 남긴다 (P1-17: "랜딩 → 로그인 전환율"의 분모). 그리는 것은 없음.
 * 랜딩은 정적 페이지라 서버가 방문을 알 수 없으므로 브라우저에서 보낸다.
 */
export function LandingViewTracker() {
  useEffect(() => {
    track('landing_view', {});
  }, []);
  return null;
}
