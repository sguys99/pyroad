import { getSentryDsn } from './config';
import type { SentryBrowserApi } from './sentryBrowser';

/**
 * 브라우저 에러 보고 (P1-16).
 *
 * Sentry SDK는 첫 로드 JS에 넣지 않는다 (랜딩 JS 예산 250KB gzip, §2.10).
 * 처음에는 아주 작은 리스너만 달아 두고, 에러가 실제로 나거나 `reportClientError`가 불릴 때
 * SDK를 동적 import해 초기화한 뒤 그동안 모아 둔 에러를 보낸다 (Sentry Loader Script의 lazy 방식).
 * 대가: 첫 에러 전의 브레드크럼은 없다. 아동 개인정보 측면에서는 오히려 수집이 적다.
 *
 * DSN이 없으면(로컬·테스트·CI) 아무것도 하지 않는다: 리스너도, SDK 다운로드도 없다.
 */

export interface ErrorReportContext {
  /** 검색·집계용 짧은 값 (예: `{ area: 'pyodide', phase: 'init' }`) */
  tags?: Record<string, string>;
  /** 추가 정보. 학생 코드·출력·토큰은 넣지 말 것 (넣어도 `beforeSend`가 지움) */
  extra?: Record<string, unknown>;
  /** 같은 묶음으로 볼 이슈 키 */
  fingerprint?: string[];
}

interface QueuedError {
  error: unknown;
  mechanism: 'onerror' | 'onunhandledrejection';
}

/** SDK가 뜨기 전에 쌓아 둘 에러 수 상한 */
const MAX_QUEUED = 10;

let sentryPromise: Promise<SentryBrowserApi | null> | null = null;
let started = false;
const queue: QueuedError[] = [];
let removeEarlyListeners: (() => void) | null = null;

function flushQueue(sentry: SentryBrowserApi) {
  for (const { error, mechanism } of queue.splice(0)) {
    sentry.captureException(error, {
      mechanism: { type: mechanism, handled: false },
    });
  }
}

function loadSentry(dsn: string): Promise<SentryBrowserApi | null> {
  sentryPromise ??= import('./sentryBrowser')
    .then(({ initSentryBrowser }) => {
      const sentry = initSentryBrowser(dsn);
      // 이제 SDK의 전역 핸들러가 받으므로 임시 리스너는 뗀다
      removeEarlyListeners?.();
      removeEarlyListeners = null;
      flushQueue(sentry);
      return sentry;
    })
    .catch(() => {
      // 청크를 못 받으면(오프라인 등) 다음 에러 때 다시 시도
      sentryPromise = null;
      return null;
    });
  return sentryPromise;
}

/**
 * `instrumentation-client.ts`에서 한 번 부른다. 첫 에러가 날 때까지 SDK를 받지 않는다.
 */
export function startClientMonitoring(
  dsn: string | undefined = getSentryDsn(),
): void {
  if (!dsn || started || typeof window === 'undefined') return;
  started = true;

  const enqueue = (item: QueuedError) => {
    if (queue.length < MAX_QUEUED) queue.push(item);
    void loadSentry(dsn);
  };
  const onError = (event: ErrorEvent) => {
    // 다른 출처 스크립트의 "Script error."는 error 객체가 없다 → 보내지 않음
    if (event.error) enqueue({ error: event.error, mechanism: 'onerror' });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    enqueue({ error: event.reason, mechanism: 'onunhandledrejection' });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  removeEarlyListeners = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/**
 * 잡은 에러를 직접 보고한다 (error boundary, Pyodide Worker 등). DSN이 없으면 아무것도 하지 않는다.
 */
export function reportClientError(
  error: unknown,
  context: ErrorReportContext = {},
  dsn: string | undefined = getSentryDsn(),
): void {
  if (!dsn || typeof window === 'undefined') return;
  void loadSentry(dsn).then((sentry) => {
    sentry?.captureException(error, {
      tags: context.tags,
      extra: context.extra,
      fingerprint: context.fingerprint,
    });
  });
}

/** 테스트 전용: 모듈 상태 초기화 */
export function resetClientMonitoringForTests(): void {
  removeEarlyListeners?.();
  removeEarlyListeners = null;
  sentryPromise = null;
  started = false;
  queue.length = 0;
}
