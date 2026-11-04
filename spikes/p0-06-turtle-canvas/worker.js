/* P0-06 spike: Pyodide 워커 + turtle shim.
 * 기존 public/workers/pyodide-worker.js의 차단 모듈·stdout 캡처를 그대로 따르고,
 * turtle 명령 스트림을 실행 도중에 postMessage로 흘려보냅니다.
 *
 * module worker로 띄웁니다: new Worker('worker.js', { type: 'module' })
 * (Pyodide 314.x는 pyodide.asm.mjs를 동적 import 하므로 module worker가 자연스러움)
 *
 * main → worker
 *   { type:'init', indexURL }
 *   { type:'run', id, code, maxCommands?, stream?, firstMs? }
 * worker → main
 *   { type:'init-status', status:'loading'|'ready'|'error', ms?, version?, python?, error? }
 *   { type:'turtle', id, chunk }            // chunk = JSON 문자열 (명령 배열)
 *   { type:'run-result', id, stdout, stderr, success, turtle, execMs }
 */

const BLOCKED_MODULES = [
  'os', 'subprocess', 'socket', 'urllib', 'http', 'ftplib', 'smtplib', 'webbrowser',
  'ctypes', 'importlib', 'shutil', 'pathlib', 'signal', 'multiprocessing', 'threading',
  // spike에서 추가: 브라우저 API에 바로 닿는 모듈 (기존 워커는 막지 않음 → 보고서 7절)
  'js', 'pyodide', 'pyodide_js', '_pyroad_bridge',
];

let pyodide = null;
let currentId = null;

async function init(indexURL) {
  const t0 = performance.now();
  self.postMessage({ type: 'init-status', status: 'loading' });
  try {
    const mod = await import(indexURL + 'pyodide.mjs');
    pyodide = await mod.loadPyodide({ indexURL });
    // turtle shim 설치 (/pyroad/turtle.py → sys.path 맨 앞)
    const src = await (await fetch(new URL('./turtle.py', import.meta.url))).text();
    pyodide.FS.mkdirTree('/pyroad');
    pyodide.FS.writeFile('/pyroad/turtle.py', src);
    pyodide.registerJsModule('_pyroad_bridge', {
      emit: (chunk) => self.postMessage({ type: 'turtle', id: currentId, chunk }),
    });
    pyodide.FS.writeFile('/pyroad/_pyroad_runner.py', RUNNER);
    pyodide.runPython(`
import sys
sys.path.insert(0, '/pyroad')
import random, math
from _pyroad_runner import run as __pyroad_run
`);
    self.postMessage({
      type: 'init-status', status: 'ready', ms: Math.round(performance.now() - t0),
      version: pyodide.version, python: pyodide.runPython('import sys; sys.version.split()[0]'),
    });
  } catch (err) {
    self.postMessage({ type: 'init-status', status: 'error', error: err.message || String(err) });
  }
}

// 사용자 코드 실행기 (Python 모듈로 FS에 씀 → 사용자 traceback에 실행기 줄이 섞이지 않음).
// 새 globals로 실행하고, 에러는 사용자 코드(<exec>) 줄만 남겨 보여 줌.
const RUNNER = `
import builtins, io, linecache, sys, traceback
import turtle, _pyroad_bridge

BLOCKED = set(${JSON.stringify(BLOCKED_MODULES)})

def run(src, max_commands, stream, first_ms):
    out, err = io.StringIO(), io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    orig_import = builtins.__import__
    def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
        # 사용자 코드(__main__)의 import만 막음. random이 내부에서 os를 import하는 것은 허용
        if (globals or {}).get('__name__') == '__main__' and name.split('.')[0] in BLOCKED:
            raise ImportError(f"이 모듈은 사용할 수 없어요: {name.split('.')[0]}")
        return orig_import(name, globals, locals, fromlist, level)
    turtle._pyroad_begin(_pyroad_bridge.emit, max_commands, stream, first_ms)
    linecache.cache['<exec>'] = (len(src), None, src.splitlines(True), '<exec>')
    g = {'__name__': '__main__', '__builtins__': builtins}
    builtins.__import__ = safe_import
    try:
        exec(compile(src, '<exec>', 'exec'), g)
    except SystemExit:
        pass
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == '<exec>']
        lines = ['Traceback (most recent call last):\\n'] if frames else []
        lines += traceback.format_list(frames) + traceback.format_exception_only(type(e), e)
        err.write(''.join(lines))
    finally:
        builtins.__import__ = orig_import
        sys.stdout, sys.stderr = old_out, old_err
    summary = turtle._pyroad_end()
    return out.getvalue(), err.getvalue(), summary
`;

function run({ id, code, maxCommands = 50000, stream = true, firstMs = 40 }) {
  if (!pyodide) {
    self.postMessage({ type: 'run-result', id, stdout: '', stderr: 'Pyodide가 아직 준비되지 않았어요.', success: false });
    return;
  }
  currentId = id;
  const t0 = performance.now();
  try {
    const fn = pyodide.globals.get('__pyroad_run');
    const res = fn(code, maxCommands, stream, firstMs);
    const [stdout, stderr, summary] = res.toJs();
    res.destroy();
    fn.destroy();
    self.postMessage({
      type: 'run-result', id, stdout, stderr, success: !stderr,
      turtle: JSON.parse(summary), execMs: performance.now() - t0,
    });
  } catch (err) {
    self.postMessage({ type: 'run-result', id, stdout: '', stderr: err.message || String(err), success: false, execMs: performance.now() - t0 });
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') await init(msg.indexURL);
  else if (msg.type === 'run') run(msg);
};
