// P0-05 공통 워커 코어 (module worker 전용).
// Pyodide 314부터 classic worker(importScripts)를 지원하지 않으므로 모든 워커를 { type: 'module' }로 만든다.

export const post = (msg) => self.postMessage(msg);
/** 스레드 간 비교 가능한 절대 시각(ms). 지연 측정용 */
export const now = () => performance.timeOrigin + performance.now();
export const timing = { woke: 0 }; // 마지막으로 답을 받은 시각

const MAX_OUTPUT = 20000; // 스파이크용 출력 상한 (P11-03에서 실제 값 결정)

/** Pyodide 로드. indexURL은 self-host(/m/<mode>/pyodide/<ver>/) 또는 jsdelivr CDN. */
export async function boot(indexURL) {
  const t0 = performance.now();
  const { loadPyodide } = await import(indexURL + 'pyodide.mjs');
  const pyodide = await loadPyodide({ indexURL });
  const ms = Math.round(performance.now() - t0);
  const pyVersion = pyodide.runPython('import sys; sys.version.split()[0]');
  pyodide.runPython(PRELUDE);
  return { pyodide, ms, info: { pyodide: pyodide.version, python: pyVersion } };
}

/**
 * stdout/stderr를 실시간으로 메인 스레드에 흘려보낸다 (input() 앞의 print가 프롬프트보다 먼저 보여야 함).
 * 워커가 Atomics.wait / 동기 XHR로 막혀 있어도 postMessage는 즉시 전달된다.
 */
export function setupOutput(pyodide) {
  const dec = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  const buf = { stdout: '', stderr: '' };
  let last = performance.now();
  let total = 0;
  const flush = () => {
    for (const k of ['stdout', 'stderr']) {
      if (buf[k]) post({ type: k, text: buf[k] });
      buf[k] = '';
    }
    last = performance.now();
  };
  const handler = (kind) => ({
    write(bytes) {
      total += bytes.length;
      if (total > MAX_OUTPUT) {
        if (total - bytes.length <= MAX_OUTPUT) post({ type: 'stderr', text: '\n[출력이 너무 길어서 잘랐어요]\n' });
        return bytes.length;
      }
      buf[kind] += dec[kind].decode(bytes, { stream: true });
      if (buf[kind].length > 4096 || performance.now() - last > 30) flush();
      return bytes.length;
    },
  });
  pyodide.setStdout(handler('stdout'));
  pyodide.setStderr(handler('stderr'));
  return { flush, reset: () => (total = 0) };
}

// 학생 코드용 보조 함수 (실행마다 새 namespace, 트레이스백에 소스 줄 표시)
const PRELUDE = `
import linecache as __lc
def __pyroad_new_ns(src):
    __lc.cache["<student>"] = (len(src), None, src.splitlines(True), "<student>")
    return {"__name__": "__main__"}
`;

export function newNamespace(pyodide, code) {
  return pyodide.globals.get('__pyroad_new_ns')(code);
}

/** Pyodide 내부 프레임을 지우고 학생 코드 프레임 + 마지막 예외 줄만 남긴다. */
export function formatError(e) {
  const msg = String(e?.message ?? e);
  const out = [];
  let keep = false;
  for (const line of msg.split('\n')) {
    if (line.startsWith('Traceback')) continue;
    if (line.startsWith('  File "')) {
      keep = line.includes('"<student>"');
      if (keep) out.push(line);
    } else if (line.startsWith('    ')) {
      if (keep) out.push(line);
    } else if (line.trim()) {
      keep = false;
      out.push(line);
    }
  }
  return out.join('\n');
}

export const isInterrupt = (e) => /KeyboardInterrupt/.test(String(e?.type ?? '') + String(e?.message ?? ''));

/** 공통 실행 래퍼. exec(ns)는 동기/비동기 실행 함수. */
export async function runUser(pyodide, out, id, code, exec) {
  const t0 = performance.now();
  const ns = newNamespace(pyodide, code);
  out.reset();
  let result;
  try {
    await exec(ns);
    result = { ok: true };
  } catch (e) {
    result = isInterrupt(e) ? { ok: false, stopped: true } : { ok: false, error: formatError(e), errorType: e?.type };
  } finally {
    out.flush();
    ns.destroy();
  }
  post({ type: 'done', id, ms: Math.round(performance.now() - t0), ...result });
}
