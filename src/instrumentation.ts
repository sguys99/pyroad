import type { Instrumentation } from 'next';
import { isSentryEnabled } from '@/lib/observability/config';

/**
 * 서버 시작 때 한 번: env 점검 로그(P1-22) + 서버·Edge Sentry 등록(P1-16). DSN이 없으면 SDK를 불러오지 않는다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { reportServerEnvProblems } =
      await import('@/lib/env/checkServerEnv');
    reportServerEnvProblems();
  }

  if (!isSentryEnabled()) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/observability/sentryServer');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('@/lib/observability/sentryEdge');
  }
}

/**
 * API Route·서버 컴포넌트·미들웨어에서 throw된 에러를 받는다 (Next.js 15 `onRequestError`).
 * 사용자 취소(abort)와 민감값은 `beforeSend`(`scrub.ts`)에서 거른다.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!isSentryEnabled()) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
};
