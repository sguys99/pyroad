// 방식 ④ JSPI (WebAssembly JavaScript Promise Integration) + pyodide.ffi.run_sync
// - runPythonAsync로 들어간 동기 Python 스택 어디서든 run_sync(promise)로 "멈춰서" 기다릴 수 있다.
// - 그동안 워커 이벤트 루프가 돌기 때문에 답(answer)·멈춤(stop) 메시지를 받을 수 있다.
// - JSPI가 없는 브라우저(현재 Safari/WebKit 등)에서는 can_run_sync()가 False → 다른 방식으로 폴백해야 한다.
import { boot, setupOutput, runUser, post, now, timing } from './core.js';

let pyodide, out;
let pending = null;
// 멈춤 요청 플래그. (실측) 비공유 interrupt buffer는 run_sync 중 WebLoop 콜백이 신호를 먼저 소비해서
// 학생 코드에 KeyboardInterrupt가 전달되지 않았다 → input()/time.sleep 대기 지점에서 직접 확인한다.
let stopRequested = false;
let sleepTimer = null;

// time.sleep 대체: 기다리는 동안 이벤트 루프가 돌고, 멈춤 요청이 오면 즉시 끝난다
function jsSleep(ms) {
  return new Promise((resolve) => {
    if (stopRequested) return resolve('stopped');
    sleepTimer = { resolve, id: setTimeout(() => ((sleepTimer = null), resolve('ok')), ms) };
  });
}

function waitInput() {
  out.flush();
  const id = crypto.randomUUID();
  post({ type: 'input-request', id, wt: now(), woke: timing.woke });
  return new Promise((resolve) => (pending = { id, resolve }));
}

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    try {
      const r = await boot(m.indexURL);
      pyodide = r.pyodide;
      out = setupOutput(pyodide);
      pyodide.globals.set('__js_wait_input', waitInput);
      pyodide.globals.set('__js_sleep', jsSleep);
      pyodide.runPython(`
import sys, builtins
from pyodide.ffi import run_sync, can_run_sync

def _pyroad_jspi_input(prompt=""):
    sys.stdout.write(str(prompt)); sys.stdout.flush()
    if not can_run_sync():
        raise RuntimeError("이 브라우저에서는 JSPI(run_sync)를 쓸 수 없어요")
    v = run_sync(__js_wait_input())
    if v is None:
        raise KeyboardInterrupt
    return v

class _PyroadStdin:  # (클래스 안에서 __이름은 name mangling되므로 _ 하나만 사용)
    def readline(self, size=-1):
        return _pyroad_jspi_input("") + "\\n"
    def isatty(self):
        return False

builtins.input = _pyroad_jspi_input
sys.stdin = _PyroadStdin()

import time as _time
_pyroad_orig_sleep = _time.sleep
def _pyroad_sleep(secs):
    if not can_run_sync():
        return _pyroad_orig_sleep(secs)
    if run_sync(__js_sleep(max(0, secs) * 1000)) == "stopped":
        raise KeyboardInterrupt
_time.sleep = _pyroad_sleep
`);
      const jspi = typeof WebAssembly.Suspending === 'function';
      // run_sync가 실제로 되는지 확인 (runPythonAsync 진입 시)
      const canRunSync = await pyodide.runPythonAsync('from pyodide.ffi import can_run_sync; can_run_sync()');
      post({ type: 'ready', ms: r.ms, info: { ...r.info, jspi, canRunSync } });
    } catch (e) {
      post({ type: 'init-error', error: String(e?.message ?? e) });
    }
  } else if (m.type === 'run') {
    stopRequested = false;
    await runUser(pyodide, out, m.id, m.code, (ns) =>
      pyodide.runPythonAsync(m.code, { globals: ns, filename: '<student>' }),
    );
    stopRequested = false;
  } else if (m.type === 'answer') {
    timing.woke = now();
    if (pending) pending.resolve(m.value), (pending = null);
  } else if (m.type === 'ping') {
    post({ type: 'pong', t: m.t }); // 진단용: Python 실행 중에도 이벤트 루프가 도는지
  } else if (m.type === 'stop') {
    stopRequested = true;
    if (pending) pending.resolve(undefined), (pending = null); // undefined → None (314에서 JS null은 jsnull로 변환됨)
    if (sleepTimer) clearTimeout(sleepTimer.id), sleepTimer.resolve('stopped'), (sleepTimer = null);
  }
};
