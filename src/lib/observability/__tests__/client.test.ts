// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const captureException = vi.fn();
const initSentryBrowser = vi.fn((dsn: string) => {
  void dsn;
  return { captureException };
});
vi.mock('../sentryBrowser', () => ({ initSentryBrowser }));

import {
  reportClientError,
  resetClientMonitoringForTests,
  startClientMonitoring,
} from '../client';

const DSN = 'https://key@o1.ingest.sentry.io/1';

/** 동적 import·Promise 체인이 끝날 때까지 기다린다 */
async function settle() {
  for (let i = 0; i < 5; i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
}

function dispatchWindowError(error: Error) {
  window.dispatchEvent(
    new ErrorEvent('error', { error, message: error.message }),
  );
}

// 테스트에서 일부러 낸 window 에러를 vitest가 "처리되지 않은 에러"로 보지 않게 하는 빈 리스너
const swallow = () => {};

beforeEach(() => {
  window.addEventListener('error', swallow);
  resetClientMonitoringForTests();
  captureException.mockClear();
  initSentryBrowser.mockClear();
});

afterEach(() => {
  resetClientMonitoringForTests();
  window.removeEventListener('error', swallow);
});

describe('DSN이 없으면 완전히 비활성', () => {
  it('리스너를 달지 않고 SDK도 불러오지 않는다', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    startClientMonitoring(undefined);
    expect(addEventListener).not.toHaveBeenCalled();
    addEventListener.mockRestore();

    dispatchWindowError(new Error('boom'));
    reportClientError(new Error('boom'), {}, undefined);
    await settle();

    expect(initSentryBrowser).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('기본값(env 없음)에서도 비활성', async () => {
    startClientMonitoring();
    reportClientError(new Error('boom'));
    await settle();
    expect(initSentryBrowser).not.toHaveBeenCalled();
  });
});

describe('DSN이 있으면 첫 에러 때 SDK를 불러온다', () => {
  it('에러가 나기 전에는 SDK를 불러오지 않는다', async () => {
    startClientMonitoring(DSN);
    await settle();
    expect(initSentryBrowser).not.toHaveBeenCalled();
  });

  it('SDK가 뜨기 전에 난 에러를 모아 두었다가 보낸다', async () => {
    startClientMonitoring(DSN);
    const first = new Error('first');
    const second = new Error('second');
    dispatchWindowError(first);
    dispatchWindowError(second);
    await settle();

    expect(initSentryBrowser).toHaveBeenCalledTimes(1);
    expect(initSentryBrowser).toHaveBeenCalledWith(DSN);
    expect(captureException).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenNthCalledWith(1, first, {
      mechanism: { type: 'onerror', handled: false },
    });

    // SDK가 뜬 뒤에는 SDK의 전역 핸들러가 받으므로 임시 리스너는 떨어져 있다
    dispatchWindowError(new Error('after'));
    await settle();
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('error 객체가 없는 다른 출처 스크립트 에러는 무시한다', async () => {
    startClientMonitoring(DSN);
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
    await settle();
    expect(initSentryBrowser).not.toHaveBeenCalled();
  });

  it('reportClientError는 태그·fingerprint와 함께 보낸다', async () => {
    const error = new Error('worker');
    reportClientError(
      error,
      { tags: { area: 'pyodide' }, fingerprint: ['a'] },
      DSN,
    );
    await settle();
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'pyodide' },
      extra: undefined,
      fingerprint: ['a'],
    });
  });
});
