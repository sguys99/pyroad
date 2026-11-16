// input() 폴백 채널 준비 (P11-01, P0-05 ②, §2.9).
//
// 기본은 JSPI(`pyodide.ffi.run_sync`)라 아무것도 등록하지 않는다. JSPI가 없는 브라우저(Safari/iOS 26 이하 등)만
// 실행기 경로에 Service Worker를 등록하고, 활성화된 뒤에 Worker를 띄운다(첫 방문에도 Worker가 SW 제어를 받게).
// 실패하면(SW를 막는 정책·인앱 WKWebView) Worker가 ping으로 알아채 input: 'none'을 알리고, input()만 안내로 끝난다.

import { INPUT_SW_URL, PYODIDE_RUNNER_PATH } from './constants';

/** SW 활성화를 기다리는 최대 시간. 넘으면 SW 없이 Worker를 띄운다 */
const ACTIVATE_TIMEOUT_MS = 4000;

/** JSPI가 없고 SW를 쓸 수 있는 브라우저인지 (Pyodide도 `WebAssembly.Suspending`으로 JSPI를 가린다) */
export function needsInputServiceWorker(): boolean {
  return (
    typeof WebAssembly === 'object' &&
    !('Suspending' in WebAssembly) &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/** 입력 SW를 등록하고 활성화될 때까지 기다린다. 못 쓰면 null */
export async function registerInputServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register(INPUT_SW_URL, {
      scope: PYODIDE_RUNNER_PATH,
    });
    const sw = reg.active ?? reg.waiting ?? reg.installing;
    if (sw && sw.state !== 'activated') {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ACTIVATE_TIMEOUT_MS);
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated' || sw.state === 'redundant') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }
    return reg;
  } catch {
    return null;
  }
}
