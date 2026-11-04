import { isSentryEnabled } from './config';
import type { ErrorReportContext } from './client';

/**
 * 서버에서 잡은(throw하지 않는) 에러를 Sentry로 보낸다 (예: 튜터 provider 실패 후 폴백).
 * throw된 에러는 `src/instrumentation.ts`의 `onRequestError`가 자동으로 받으므로 여기서 다시 보내지 않는다.
 *
 * DSN이 없으면 SDK를 import하지도 않는다. 보고는 응답을 기다리게 하지 않는다 (fire-and-forget).
 */
export function captureServerError(
  error: unknown,
  context: ErrorReportContext = {},
): void {
  if (!isSentryEnabled()) return;
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureException(error, {
        tags: context.tags,
        extra: context.extra,
        fingerprint: context.fingerprint,
      });
    })
    .catch(() => {
      // 관측 실패가 요청 처리를 깨뜨리지 않게 한다
    });
}
