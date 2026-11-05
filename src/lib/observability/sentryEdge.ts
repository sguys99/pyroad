import * as Sentry from '@sentry/nextjs';
import { getSentryDsn, getServerTracesSampleRate } from './config';
import { PRIVACY_DATA_COLLECTION } from './privacy';
import { createBeforeSend, scrubBreadcrumb, scrubSpan } from './scrub';

/**
 * Edge 런타임 Sentry 초기화 (`src/middleware.ts`). 옵션은 `sentryServer.ts`와 같다.
 */
Sentry.init({
  dsn: getSentryDsn(),
  dataCollection: PRIVACY_DATA_COLLECTION,
  tracesSampleRate: getServerTracesSampleRate(),
  maxBreadcrumbs: 30,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: createBeforeSend(),
  beforeSendSpan: scrubSpan,
});
