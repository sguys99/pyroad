import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isTestPagesEnabled } from '@/lib/env/testPages';
import { isPolicyEffective } from './meta';

/** 테스트 서버(`isTestPagesEnabled`)에서만 읽는 쿠키: `before` = 시행일 전처럼 끔 (e2e `policy-not-yet.spec.ts`) */
export const POLICY_TEST_COOKIE = 'pyroad-test-policy';

/**
 * 새 처리방침 근거 기능(자랑 카드·보호자 리포트·자유 질문)이 지금 켜졌는지 (B79). 서버 컴포넌트·API 에서 **요청 때** 부른다
 * (쿠키를 읽으므로 그 화면은 정적으로 굳지 않음 → 시행일 0시에 저절로 켜짐).
 * 테스트 서버(개발 서버·e2e)는 오늘 날짜와 상관없이 켜 두고, 쿠키 `before` 일 때만 끈다. 운영은 시각만 본다
 */
export async function isPolicyLive(): Promise<boolean> {
  if (isTestPagesEnabled())
    return (await cookies()).get(POLICY_TEST_COOKIE)?.value !== 'before';
  return isPolicyEffective();
}

/** 시행일 전 API 응답: 없는 기능처럼 404 (캐시하지 않음 — 시행일 뒤 CDN 이 이 답을 내놓지 않게) */
export function policyNotYet(): NextResponse {
  return NextResponse.json(
    { error: '찾을 수 없어요.', code: 'not_yet' },
    { status: 404, headers: { 'cache-control': 'no-store' } },
  );
}
