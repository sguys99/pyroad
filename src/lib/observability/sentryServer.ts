import * as Sentry from '@sentry/nextjs';
import { getSentryDsn, getServerTracesSampleRate } from './config';
import { PRIVACY_DATA_COLLECTION } from './privacy';
import { createBeforeSend, scrubBreadcrumb, scrubSpan } from './scrub';

/**
 * Node.js 런타임 Sentry 초기화 (API Route, 서버 컴포넌트). `src/instrumentation.ts`가 DSN이 있을 때만 import한다.
 *
 * - 개인정보 수집 범위는 `privacy.ts`(SDK v11 `dataCollection`, `sendDefaultPii`의 후속)
 * - 요청 본문(학생 코드)은 수집하지 않는다: `httpBodies: []` + `maxRequestBodySize: 'none'` + `beforeSend`에서 한 번 더 제거
 * - 스택 프레임의 지역 변수(학생 코드·프롬프트가 들어 있음)도 수집하지 않는다
 * - 트레이싱은 기본 꺼짐. `SENTRY_TRACES_SAMPLE_RATE`로 0.05 이하에서만 켤 수 있다
 */
Sentry.init({
  dsn: getSentryDsn(),
  dataCollection: PRIVACY_DATA_COLLECTION,
  includeLocalVariables: false,
  tracesSampleRate: getServerTracesSampleRate(),
  integrations: [Sentry.httpIntegration({ maxRequestBodySize: 'none' })],
  // Express 등 diagnostics-channel 기반 계측은 쓰지 않는다. 켜 두면 Turbopack 번들에서 훅 등록에 실패해 시작 때 경고가 난다
  enableRuntimeChannelInjection: false,
  maxBreadcrumbs: 30,
  beforeBreadcrumb: scrubBreadcrumb,
  beforeSend: createBeforeSend(),
  beforeSendSpan: scrubSpan,
});
