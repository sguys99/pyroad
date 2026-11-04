// Node worker_threads에서 Pyodide 하나를 띄우는 진입점 (P1-13 정답 자동 검증, B15 테스트).
// 브라우저 Worker(public/workers/pyodide-worker.mjs)와 같은 실행 코어를 쓰고, 메시지도 같다
// (src/lib/pyodide/types.ts). 차이는 Pyodide를 npm 패키지에서 불러오는 것과,
// 메인 스레드가 SharedArrayBuffer interrupt buffer로 시간 초과를 KeyboardInterrupt로 바꿀 수 있다는 것.
//
// workerData: { interruptBuffer: SharedArrayBuffer(8), maxCaptureLength?: number, removeNetwork?: boolean }

import { parentPort, workerData } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';

import {
  createRuntime,
  removeNetworkGlobals,
  runtimeInfo,
} from '../../public/workers/pyodide-core.mjs';

const post = (msg) => parentPort.postMessage(msg);

async function main() {
  post({ type: 'init-status', status: 'loading' });
  const t0 = performance.now();
  // Python 자체 출력(캡처 밖)이 CI 로그로 새지 않게 막는다
  const pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} });
  const runtime = createRuntime(pyodide, {
    post,
    interruptBuffer: new Int32Array(workerData.interruptBuffer),
    ...(workerData.maxCaptureLength && {
      maxCaptureLength: workerData.maxCaptureLength,
    }),
  });
  const jspi = await runtime.canRunSync();
  const removedGlobals =
    workerData.removeNetwork === false ? [] : removeNetworkGlobals(globalThis);
  parentPort.on('message', (msg) => {
    runtime.handle(msg);
  });
  post({
    type: 'init-status',
    status: 'ready',
    info: {
      ...runtimeInfo(pyodide),
      source: 'npm',
      jspi,
      loadMs: Math.round(performance.now() - t0),
      removedGlobals,
    },
  });
}

main().catch((err) => {
  post({
    type: 'init-status',
    status: 'error',
    error: String(err?.message ?? err),
  });
});
