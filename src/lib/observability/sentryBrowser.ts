import { captureException, init } from '@sentry/nextjs';
import { PRIVACY_DATA_COLLECTION } from './privacy';
import { createBeforeSend, scrubBreadcrumb } from './scrub';

/**
 * 브라우저 Sentry 초기화. `client.ts`가 첫 에러가 났을 때만 동적 import한다 (첫 로드 JS에 넣지 않음).
 *
 * - Session Replay·User Feedback·트레이싱은 쓰지 않는다 (아동 개인정보 §2.6, 무료 티어 §12-Q10)
 * - 릴리즈 헬스(세션) 수집도 끈다. 에러가 날 때만 SDK를 불러오므로 세션 수가 의미 없다
 */
const DROPPED_DEFAULT_INTEGRATIONS = new Set([
  'BrowserTracing',
  'BrowserSession',
]);

/** 초기화 뒤 `client.ts`가 쓰는 API. 모듈 전체(namespace)를 넘기면 트리 셰이킹이 안 돼 Replay 등까지 번들된다 */
export interface SentryBrowserApi {
  captureException: typeof captureException;
}

export function initSentryBrowser(dsn: string): SentryBrowserApi {
  init({
    dsn,
    dataCollection: PRIVACY_DATA_COLLECTION,
    // tracesSampleRate를 주지 않으면 트레이싱이 꺼진다
    integrations: (defaults) =>
      defaults.filter((i) => !DROPPED_DEFAULT_INTEGRATIONS.has(i.name)),
    maxBreadcrumbs: 30,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: createBeforeSend(),
    ignoreErrors: [
      // 브라우저가 내는 무해한 경고
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // 다른 출처 스크립트(확장 프로그램 등)의 에러는 내용이 없다
      /^Script error\.?$/,
    ],
    denyUrls: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-(web-)?extension:\/\//,
    ],
  });
  return { captureException };
}
