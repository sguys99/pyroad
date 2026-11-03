// Node worker_thread that hosts one Pyodide instance.
//
// mode "prod":  evaluates the REAL public/workers/pyodide-worker.js unmodified, with tiny shims
//               (self / importScripts / loadPyodide -> npm package). Same preamble, same shared
//               globals, same error capture as the browser. Zero drift by construction.
// mode "fresh": the proposed sandbox (B15): same blocked list + stdout/stderr capture + error capture,
//               but every run gets a NEW globals dict and the import hook is not visible to user code.
//
// Protocol = src/lib/pyodide/types.ts (init / run -> init-status / run-result / run-error),
// plus host-only messages: { type: 'seed', seed } and { type: 'stats' }.

import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const { pyodidePkg, mode, workerFile, interruptBuffer, blockedModules, extraBlocked, captureLimit } = workerData;
const require = createRequire(import.meta.url);
const { loadPyodide } = require(pyodidePkg);
const interrupt = new Int32Array(interruptBuffer);

let py = null;
let loadMs = 0;
const cdnUrls = [];

async function load() {
  const t0 = performance.now();
  // Python's own stdout (outside the capture) would otherwise go to the CI log
  const inst = await loadPyodide({ stdout: () => {}, stderr: () => {} });
  inst.setInterruptBuffer(interrupt); // lets the host turn a timeout into KeyboardInterrupt
  loadMs = performance.now() - t0;
  py = inst;
  return inst;
}

function stats() {
  const m = process.memoryUsage();
  return {
    type: 'stats',
    loadMs,
    version: py?.version,
    python: py?.runPython('import sys; sys.version.split()[0]'),
    cdnUrls,
    rssMB: m.rss / 1e6,
    heapUsedMB: m.heapUsed / 1e6,
    wasmHeapMB: py?._module?.HEAPU8 ? py._module.HEAPU8.length / 1e6 : null,
  };
}

function seedRandom(seed) {
  // `random` is already in sys.modules at startup (both 0.27.5 and 0.29.3), so this does not
  // trigger any import of blocked modules. 'entropy' = random.seed() from os.urandom, i.e. what a
  // freshly loaded page has. Needed because module state (sys.modules) survives a fresh namespace.
  const arg = seed === 'entropy' ? '' : String(Number(seed));
  py.runPython(`import random as _r; _r.seed(${arg}); del _r`);
}

// ------------------------------------------------------------------ mode: prod
function startProd() {
  const self = {
    postMessage: (m) => parentPort.postMessage(m),
    onmessage: null,
    loadPyodide: async () => load(), // ignore the CDN indexURL, use the local npm package
  };
  const importScripts = (url) => cdnUrls.push(url);
  const src = readFileSync(workerFile, 'utf8');
  // The worker is a classic script; run it with `self` and `importScripts` bound to the shims.
  new Function('self', 'importScripts', src)(self, importScripts);
  parentPort.on('message', async (msg) => {
    if (msg.type === 'seed') { seedRandom(msg.seed); parentPort.postMessage({ type: 'seeded' }); return; }
    if (msg.type === 'stats') { parentPort.postMessage(stats()); return; }
    if (msg.type === 'run' && msg.seed != null) seedRandom(msg.seed);
    await self.onmessage({ data: msg });
  });
}

// ------------------------------------------------------------------ mode: fresh
const FRESH_HELPERS = (blocked, captureLimit) => `
import sys as _sys, io as _io, builtins as _builtins

_BLOCKED = frozenset(${JSON.stringify(blocked)})
_original_import = _builtins.__import__
_state = {}
_LIMIT = ${Number(captureLimit) || 0}

class _CappedIO(_io.StringIO):
    # keeps at most _LIMIT chars: an infinite print loop cannot grow memory, and the result
    # is truncated to MAX_OUTPUT_LENGTH by the caller anyway
    def write(self, s):
        room = _LIMIT - self.tell() if _LIMIT else len(s)
        if room > 0:
            super().write(s[:room])
        return len(s)

def _safe_import(name, *args, **kwargs):
    top_level = name.split('.')[0]
    if top_level in _BLOCKED:
        raise ImportError(f"이 모듈은 사용할 수 없어요: {top_level}")
    return _original_import(name, *args, **kwargs)

def begin():
    _state['out'], _state['err'] = _CappedIO(), _CappedIO()
    _sys.stdout, _sys.stderr = _state['out'], _state['err']
    _builtins.__import__ = _safe_import

def write_err(text):
    _state['err'].write(text)

def end():
    _builtins.__import__ = _original_import
    _sys.stdout, _sys.stderr = _sys.__stdout__, _sys.__stderr__
    return [_state['out'].getvalue(), _state['err'].getvalue()]
`;

// same static pre-check as the worker
function checkBlockedImports(code, blocked) {
  const importRegex = /^\s*(?:import|from)\s+(\w+)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) if (blocked.has(match[1])) return match[1];
  return null;
}

function startFresh() {
  const blockedList = [...blockedModules, ...(extraBlocked ?? [])];
  const blocked = new Set(blockedList);
  let helpers = null;
  parentPort.on('message', async (msg) => {
    switch (msg.type) {
      case 'init': {
        try {
          parentPort.postMessage({ type: 'init-status', status: 'loading' });
          await load();
          const priv = py.globals.get('dict')();
          py.runPython(FRESH_HELPERS(blockedList, captureLimit), { globals: priv });
          helpers = { begin: priv.get('begin'), writeErr: priv.get('write_err'), end: priv.get('end') };
          parentPort.postMessage({ type: 'init-status', status: 'ready' });
        } catch (err) {
          parentPort.postMessage({ type: 'init-status', status: 'error', error: String(err) });
        }
        return;
      }
      case 'seed': seedRandom(msg.seed); parentPort.postMessage({ type: 'seeded' }); return;
      case 'stats': parentPort.postMessage(stats()); return;
      case 'run': {
        const { id, code } = msg;
        if (msg.seed != null) seedRandom(msg.seed);
        const b = checkBlockedImports(code, blocked);
        if (b) {
          parentPort.postMessage({ type: 'run-result', id, stdout: '', stderr: `이 모듈은 사용할 수 없어요: ${b}. 안전한 모듈만 사용해 주세요!`, success: false });
          return;
        }
        const ns = py.globals.get('dict')();
        ns.set('__name__', '__main__');
        try {
          helpers.begin();
          try {
            py.runPython(code, { globals: ns });
          } catch (execErr) {
            helpers.writeErr(String(execErr)); // same as the worker: String(PythonError)
          }
          const res = helpers.end();
          const [stdout, stderr] = res.toJs();
          res.destroy();
          parentPort.postMessage({ type: 'run-result', id, stdout: stdout || '', stderr: stderr || '', success: !stderr });
        } catch (err) {
          try { helpers.end(); } catch { /* ignore */ }
          parentPort.postMessage({ type: 'run-error', id, error: err?.message || String(err) });
        } finally {
          ns.destroy();
        }
        return;
      }
    }
  });
}

if (mode === 'prod') startProd();
else startFresh();
