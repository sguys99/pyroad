// `node --experimental-wasm-jspi`로 띄우는 확인 스크립트 (runtime.pyodide.test.ts).
// JSPI가 있는 환경(브라우저와 같음)에서 time.sleep 대기 중 stop이 Worker를 살린 채 끝나는지 본다.
import { loadPyodide } from 'pyodide';

import { createRuntime } from '../../../../public/workers/pyodide-core.mjs';

const pyodide = await loadPyodide({ stdout: () => {}, stderr: () => {} });
const waiters = new Map();
const runtime = createRuntime(pyodide, {
  post: (msg) => {
    if (msg.type === 'done') waiters.get(msg.id)?.(msg);
  },
});
const jspi = await runtime.canRunSync();

function run(id, code, stopAfterMs) {
  const t0 = performance.now();
  const done = new Promise((resolve) => waiters.set(id, resolve));
  void runtime.handle({ type: 'run', id, code });
  if (stopAfterMs != null) {
    setTimeout(() => runtime.handle({ type: 'stop', id }), stopAfterMs);
  }
  return done.then((msg) => ({
    ...msg,
    wall: Math.round(performance.now() - t0),
  }));
}

const stopped = await run(
  'a',
  'import time\nwhile True:\n    time.sleep(0.5)',
  200,
);
const after = await run('b', 'import time\ntime.sleep(0.05)\nprint("ok")');
console.log(JSON.stringify({ jspi, stopped, after }));
