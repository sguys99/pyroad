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

/**
 * 에러가 아닌 서버 사건을 Sentry 메시지로 보낸다 (예: 튜터 API 남용 의심, P1-19).
 * `beforeSend`의 스크럽·폭주 제한(같은 fingerprint 10분 3회, 인스턴스 단위)을 그대로 거친다.
 * 학생 코드·내용은 넣지 않는다 (태그·extra 는 짧은 값만).
 */
export function captureServerMessage(
  message: string,
  level: 'info' | 'warning' | 'error',
  context: ErrorReportContext = {},
): void {
  if (!isSentryEnabled()) return;
  void import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.captureMessage(message, {
        level,
        tags: context.tags,
        extra: context.extra,
        fingerprint: context.fingerprint,
      });
    })
    .catch(() => {
      // 관측 실패가 요청 처리를 깨뜨리지 않게 한다
    });
}
