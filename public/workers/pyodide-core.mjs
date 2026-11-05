// Pyodide 실행 코어 (B15·B26·P1-09 §2.9)
//
// 브라우저 module Worker(`pyodide-worker.mjs`)와 Node worker_threads(P1-13 정답 자동 검증,
// `scripts/pyodide/node-worker.mjs`)가 같은 파일을 그대로 import한다. 그래서 이 파일은
// 번들러 없이 도는 순수 ES 모듈이고, 브라우저·Node 전용 API(self, fetch, process 등)를 직접 쓰지 않는다.
//
// 하는 일
// - 실행마다 새 namespace + 학생 코드에만 적용되는 import 훅(표준 모듈 내부 import는 그대로)
// - stdout·stderr를 실행 중에 묶어서(batched) 흘려보냄 + 실행당 출력 상한
// - traceback은 학생 코드(`<exec>`) 줄만, 예외 여부는 done 메시지로 알림(B25 후속)
// - `time.sleep` 중 멈추기(JSPI가 있으면 Worker를 살린 채 KeyboardInterrupt)
// - Python에서 `js`·`pyodide_js` 모듈을 뗌. 단 Python 쪽 차단은 우회되므로(gc, __globals__ 등)
//   진짜 경계는 `removeNetworkGlobals()`로 JS 전역의 네트워크 API를 지우는 것이다.
//
// 메시지 프로토콜은 src/lib/pyodide/types.ts 참고.

export const PYODIDE_VERSION = '314.0.7';

/** 학생 코드에서 import할 수 없는 모듈 (src/lib/pyodide/constants.ts와 같아야 함, 테스트로 확인) */
export const BLOCKED_MODULES = [
  'os',
  'subprocess',
  'socket',
  'urllib',
  'http',
  'ftplib',
  'smtplib',
  'webbrowser',
  'ctypes',
  'importlib',
  'shutil',
  'pathlib',
  'signal',
  'multiprocessing',
  'threading',
  // JS 다리 모듈 (B15). 실수 방지용이고 보안 경계는 removeNetworkGlobals()
  'js',
  'pyodide',
  'pyodide_js',
  '_pyodide',
  '_pyodide_core',
  'micropip',
];

/** 실행 한 번에 모으는 출력(stdout + stderr) 최대 글자 수. 넘으면 자르고 실행을 멈춘다 */
export const MAX_CAPTURE_LENGTH = 100_000;

/** traceback에 보이는 학생 코드 파일 이름 (예전 워커와 같은 이름) */
export const STUDENT_FILENAME = '<exec>';

/** interruptBuffer[1]에 넣는 KeyboardInterrupt 이유: 시간 초과 (Node 검증 실행기) */
export const INTERRUPT_REASON_TIMEOUT = 1;

export const OUTPUT_LIMIT_NOTICE =
  '\n[출력이 너무 많아서 여기서 멈췄어요. 끝없이 반복되는 print가 있는지 확인해 보세요!]\n';

/**
 * Pyodide 로딩이 끝난 뒤 JS 전역에서 지울 네트워크·저장소·다른 실행 문맥 API.
 * 학생 코드가 Python 쪽 차단을 우회해 JsProxy를 손에 넣어도 바깥으로 요청을 보낼 수 없게 한다.
 * (`import()` 구문은 지울 수 없지만 문자열을 코드로 바꾸려면 eval이 필요하고, 이는 CSP가 막는다: B27)
 */
export const NETWORK_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'EventSource',
  'WebTransport',
  'importScripts',
  'Worker',
  'SharedWorker',
  'BroadcastChannel',
  'caches',
  'CacheStorage',
  'indexedDB',
  'FontFace',
  'fonts',
  'Notification',
  'RTCPeerConnection',
];

/** navigator(WorkerNavigator)에서 지울 속성. 서비스 워커 등록·전송 기능 */
const NETWORK_NAVIGATOR_PROPS = ['serviceWorker', 'sendBeacon'];

/**
 * 전역 객체와 그 프로토타입 체인에서 네트워크 API를 지운다. 지운 이름 목록을 돌려준다.
 * Pyodide 로딩(fetch로 wasm·zip을 받음)이 **끝난 뒤** 불러야 한다.
 */
export function removeNetworkGlobals(scope = globalThis) {
  const removed = [];
  const strip = (obj, name) => {
    let found = false;
    for (
      let o = obj;
      o && o !== Object.prototype;
      o = Object.getPrototypeOf(o)
    ) {
      if (!Object.prototype.hasOwnProperty.call(o, name)) continue;
      found = true;
      try {
        if (!delete o[name]) {
          Object.defineProperty(o, name, {
            value: undefined,
            configurable: false,
            writable: false,
          });
        }
      } catch {
        try {
          Object.defineProperty(o, name, {
            value: undefined,
            configurable: false,
            writable: false,
          });
        } catch {
          // 지울 수 없는 속성: 아래 확인에서 남은 것으로 보고된다
        }
      }
    }
    return found;
  };
  for (const name of NETWORK_GLOBALS) {
    if (strip(scope, name)) removed.push(name);
  }
  const nav = scope.navigator;
  if (nav) {
    for (const name of NETWORK_NAVIGATOR_PROPS) {
      if (strip(nav, name)) removed.push(`navigator.${name}`);
    }
  }
  return removed;
}

/** 남아 있는 네트워크 API 이름 (테스트·준비 메시지용) */
export function remainingNetworkGlobals(scope = globalThis) {
  const left = NETWORK_GLOBALS.filter((name) => scope[name] !== undefined);
  const nav = scope.navigator;
  if (nav) {
    for (const name of NETWORK_NAVIGATOR_PROPS) {
      if (nav[name] !== undefined) left.push(`navigator.${name}`);
    }
  }
  return left;
}

const IMPORT_LINE = /^\s*(?:import|from)\s+(\w+)/gm;

/** import 문에서 차단 모듈을 찾는다 (실행 전 안내용. 실행 중에는 Python import 훅이 막음) */
export function findBlockedImport(code, blocked = BLOCKED_MODULES) {
  const set = new Set(blocked);
  IMPORT_LINE.lastIndex = 0;
  let match;
  while ((match = IMPORT_LINE.exec(code)) !== null) {
    if (set.has(match[1])) return match[1];
  }
  return null;
}

export function blockedImportMessage(name) {
  return `이 모듈은 사용할 수 없어요: ${name}. 안전한 모듈만 사용해 주세요!`;
}

// 비공개 dict에서 한 번 실행되는 Python 코드. 학생 namespace에는 아무 이름도 넣지 않는다.
// (클래스 안의 __이름은 name mangling되므로 쓰지 않음)
const PRELUDE = String.raw`
import sys, builtins, linecache, traceback
import time as _time
from pyodide.ffi import run_sync as _run_sync, can_run_sync as _can_run_sync

FILENAME = __pyroad_filename
_BLOCKED = frozenset(__pyroad_blocked)
_real_import = builtins.__import__


def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    # 학생 코드의 import에만 쓰인다. 표준 모듈은 자기 builtins(진짜 __import__)를 쓰므로
    # 3.13+ linecache의 함수 안 "import os" 같은 내부 import는 막히지 않는다 (P0-09).
    if level == 0 and isinstance(name, str):
        top = name.partition(".")[0]
        if top in _BLOCKED:
            raise ImportError(f"이 모듈은 사용할 수 없어요: {top}", name=top)
    return _real_import(name, globals, locals, fromlist, level)


def _student_builtins():
    b = dict(builtins.__dict__)
    b["__import__"] = _guarded_import
    return b


_orig_sleep = _time.sleep


def _sleep(secs):
    if not isinstance(secs, (int, float)):
        raise TypeError(f"'{type(secs).__name__}' object cannot be interpreted as an integer")
    if secs < 0:
        raise ValueError("sleep length must be non-negative")
    if _can_run_sync():
        # JSPI: 기다리는 동안 Worker 이벤트 루프가 돌아서 stop 메시지를 받을 수 있다
        if _run_sync(__pyroad_js_sleep(secs * 1000)) == "stopped":
            raise KeyboardInterrupt
    else:
        _orig_sleep(secs)


_time.sleep = _sleep


def _keep_student_frames(te, seen):
    if te is None or id(te) in seen:
        return
    seen.add(id(te))
    te.stack = traceback.StackSummary.from_list(
        [f for f in te.stack if f.filename == FILENAME]
    )
    _keep_student_frames(te.__cause__, seen)
    _keep_student_frames(te.__context__, seen)
    for sub in getattr(te, "exceptions", None) or ():
        _keep_student_frames(sub, seen)


def _write_traceback(e):
    try:
        te = traceback.TracebackException.from_exception(e)
        _keep_student_frames(te, set())
        text = "".join(te.format())
    except BaseException:
        text = f"{type(e).__name__}: {e}\n"
    sys.stderr.write(text)


def _flush():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except BaseException:
            pass


def seed(value):
    import random

    random.seed(value)


def run(code, stopped):
    # 학생이 바꿔 둔 표준 입출력을 되돌린다
    sys.stdout, sys.stderr, sys.stdin = sys.__stdout__, sys.__stderr__, sys.__stdin__
    linecache.cache[FILENAME] = (len(code), None, code.splitlines(True), FILENAME)
    ns = {"__name__": "__main__", "__builtins__": _student_builtins()}
    had_exception, error_type = False, None
    try:
        exec(compile(code, FILENAME, "exec"), ns)
    except SystemExit as e:
        if e.code not in (None, 0):
            had_exception, error_type = True, "SystemExit"
            if not isinstance(e.code, int):
                sys.stderr.write(f"{e.code}\n")
    except KeyboardInterrupt as e:
        had_exception, error_type = True, "KeyboardInterrupt"
        if not stopped():
            _write_traceback(e)
    except BaseException as e:
        had_exception, error_type = True, type(e).__name__
        _write_traceback(e)
    finally:
        _flush()
    return [had_exception, error_type]


def probe():
    return bool(_can_run_sync())


def harden():
    # Python에서 js·pyodide_js 모듈을 뗀다 (실수 방지. 진짜 경계는 JS 쪽 removeNetworkGlobals)
    import types
    from _pyodide import _importhook

    # pyodide.webloop이 함수 안에서 "from pyodide_js._api import config"를 하므로(asyncio.run 등)
    # 그 값 하나만 든 순수 Python 대역을 남긴다 (JS 객체 없음)
    enable_ruc = bool(sys.modules["pyodide_js"]._api.config.enableRunUntilComplete)
    for name in ("js", "pyodide_js"):
        try:
            _importhook.unregister_js_module(name)
        except ValueError:
            pass
    for name in list(sys.modules):
        if name.partition(".")[0] in ("js", "pyodide_js", "micropip"):
            del sys.modules[name]
    api = types.ModuleType("pyodide_js._api")
    api.config = types.SimpleNamespace(enableRunUntilComplete=enable_ruc)
    stub = types.ModuleType("pyodide_js")
    stub._api = api
    sys.modules["pyodide_js"], sys.modules["pyodide_js._api"] = stub, api

    def _disabled(*_args, **_kwargs):
        raise RuntimeError("JS 모듈 등록은 사용할 수 없어요")

    _importhook.jsfinder.register_js_module = _disabled
    _importhook.register_js_module = _disabled
    import pyodide.ffi

    pyodide.ffi.register_js_module = _disabled
    sys.meta_path[:] = [f for f in sys.meta_path if f is not _importhook.jsfinder]
`;

/**
 * Pyodide 인스턴스에 실행기를 붙인다. 반환값의 `handle(msg)`에 run / stop / answer 메시지를 넘기면
 * `post`로 stdout / stderr / done / run-error 메시지를 보낸다.
 *
 * @param {any} pyodide loadPyodide() 결과
 * @param {{
 *   post: (msg: object) => void,
 *   interruptBuffer?: Int32Array,
 *   maxCaptureLength?: number,
 *   flushIntervalMs?: number,
 *   flushChars?: number,
 * }} options interruptBuffer: Node처럼 다른 스레드가 SharedArrayBuffer로 KeyboardInterrupt를 보낼 때 넘김.
 *   `new Int32Array(new SharedArrayBuffer(8))`: [0]에 2(SIGINT)를 넣으면 멈추고, [1]은 이유
 *   (INTERRUPT_REASON_TIMEOUT이면 outcome이 'timeout'). 없으면 이 스레드 전용 버퍼를 만든다
 *   (출력 상한을 넘었을 때 실행을 멈추는 데 씀)
 */
export function createRuntime(pyodide, options) {
  const {
    post,
    maxCaptureLength = MAX_CAPTURE_LENGTH,
    flushIntervalMs = 30,
    flushChars = 4096,
  } = options;
  const interrupt = options.interruptBuffer ?? new Int32Array(1);
  pyodide.setInterruptBuffer(interrupt);
  const now = () => performance.now();

  /** @type {null | { id: string, total: number, truncated: boolean, stopReason: null | 'stop' | 'output-limit', stdin: string[] | null }} */
  let active = null;
  /** @type {null | { resolve: (v: string) => void, timer: any }} */
  let sleeper = null;

  // ---- 출력 스트리밍 -------------------------------------------------------
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  const pending = { stdout: '', stderr: '' };
  let lastFlush = 0;
  let flushTimer = null;

  const flush = () => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    lastFlush = now();
    if (!active) {
      pending.stdout = pending.stderr = '';
      return;
    }
    // stdout과 stderr의 순서를 지키기 위해 쓰는 쪽이 바뀔 때도 flush한다 (emit 참고)
    for (const kind of ['stdout', 'stderr']) {
      if (pending[kind]) {
        post({ type: kind, id: active.id, text: pending[kind] });
        pending[kind] = '';
      }
    }
  };

  let lastKind = null;
  const emit = (kind, text) => {
    if (!active || !text) return;
    if (lastKind && lastKind !== kind && pending[lastKind]) flush();
    lastKind = kind;
    pending[kind] += text;
    if (
      pending[kind].length >= flushChars ||
      now() - lastFlush >= flushIntervalMs
    ) {
      flush();
    } else if (flushTimer === null) {
      // 이벤트 루프가 돌 때(sleep·입력 대기·실행 끝)만 실행된다
      flushTimer = setTimeout(flush, flushIntervalMs);
    }
  };

  const capture = (kind, text) => {
    if (!active || active.truncated) return;
    const room = maxCaptureLength - active.total;
    if (text.length <= room) {
      active.total += text.length;
      emit(kind, text);
      return;
    }
    active.total = maxCaptureLength;
    active.truncated = true;
    emit(kind, text.slice(0, Math.max(0, room)));
    emit('stderr', OUTPUT_LIMIT_NOTICE);
    // 실행을 멈춘다: 지금 도는 Python 코드는 다음 확인 지점에서 KeyboardInterrupt
    requestStop('output-limit');
    Atomics.store(interrupt, 0, 2); // 2 = SIGINT
  };

  const writer = (kind) => ({
    isatty: false,
    write(bytes) {
      capture(kind, decoders[kind].decode(bytes, { stream: true }));
      return bytes.length;
    },
  });
  pyodide.setStdout(writer('stdout'));
  pyodide.setStderr(writer('stderr'));
  pyodide.setStdin({
    // 입력 시나리오(CI: 미리 정한 답, P11-05)가 있으면 한 줄씩, 없으면 EOF → EOFError
    // (브라우저 input()은 P11-01에서 input-request / answer로 붙임)
    stdin: () => {
      const line = active?.stdin?.shift();
      return line === undefined ? undefined : `${line}\n`;
    },
    isatty: false,
  });

  // ---- 멈추기 --------------------------------------------------------------
  function requestStop(reason) {
    if (!active) return;
    active.stopReason ??= reason;
    if (sleeper) {
      clearTimeout(sleeper.timer);
      sleeper.resolve('stopped');
      sleeper = null;
    }
  }

  // time.sleep 대체 (JSPI일 때만 Python에서 부른다). 'stopped'로 끝나면 Python이 KeyboardInterrupt
  const jsSleep = (ms) =>
    new Promise((resolve) => {
      if (!active || active.stopReason) {
        resolve('stopped');
        return;
      }
      const timer = setTimeout(() => {
        sleeper = null;
        resolve('ok');
      }, ms);
      sleeper = { resolve, timer };
    });

  // ---- Python 준비 ---------------------------------------------------------
  const priv = pyodide.globals.get('dict')();
  priv.set('__pyroad_filename', STUDENT_FILENAME);
  priv.set('__pyroad_blocked', pyodide.toPy(BLOCKED_MODULES));
  priv.set('__pyroad_js_sleep', jsSleep);
  pyodide.runPython(PRELUDE, { globals: priv, filename: '<pyroad>' });
  const py = {
    run: priv.get('run'),
    seed: priv.get('seed'),
    probe: priv.get('probe'),
  };
  // 학생 namespace는 이 dict와 무관하다 (실행마다 새 dict)
  priv.get('harden')();

  // interruptBuffer[1]: 다른 스레드가 interruptBuffer[0]으로 KeyboardInterrupt를 보낸 이유.
  // Node 검증 실행기가 시간 초과 때 1을 넣는다 (브라우저는 SharedArrayBuffer를 쓰지 않으므로 해당 없음)
  const resetInterrupt = () => {
    Atomics.store(interrupt, 0, 0);
    if (interrupt.length > 1) Atomics.store(interrupt, 1, 0);
  };
  const isStopped = () => {
    if (
      active &&
      !active.stopReason &&
      interrupt.length > 1 &&
      Atomics.load(interrupt, 1) === INTERRUPT_REASON_TIMEOUT
    ) {
      active.stopReason = 'timeout';
    }
    return Boolean(active?.stopReason);
  };

  // callPromising: JSPI(stack switching)가 있으면 run_sync가 동작해 time.sleep 대기 중에도 stop을 받는다.
  // 없으면(JSPI 미지원 브라우저, Node 22) "stack switching not supported"를 던지므로 동기 호출로 바꾼다
  /** @type {boolean | undefined} */
  let promising;
  const isNoStackSwitching = (err) =>
    /stack switching/i.test(String(err?.message ?? err));

  async function callRun(code) {
    if (promising !== false) {
      try {
        const proxy = await py.run.callPromising(code, isStopped);
        promising = true;
        return proxy;
      } catch (err) {
        if (promising === true || !isNoStackSwitching(err)) throw err;
        promising = false;
      }
    }
    return py.run(code, isStopped);
  }

  /** JSPI로 run_sync를 쓸 수 있는지 (준비 메시지용) */
  async function canRunSync() {
    try {
      const value = Boolean(await py.probe.callPromising());
      promising = true;
      return value;
    } catch (err) {
      if (isNoStackSwitching(err)) promising = false;
      return false;
    }
  }

  // ---- 실행 ----------------------------------------------------------------
  async function run(msg) {
    const { id, code } = msg;
    const t0 = now();
    if (active) {
      post({
        type: 'run-error',
        id,
        error: '이미 다른 코드를 실행하고 있어요.',
      });
      return;
    }
    active = {
      id,
      total: 0,
      truncated: false,
      stopReason: null,
      stdin: Array.isArray(msg.stdin) ? msg.stdin.map(String) : null,
    };
    lastKind = null;
    lastFlush = 0;
    resetInterrupt();

    const end = () => {
      flush();
      const state = active;
      active = null;
      resetInterrupt();
      return state;
    };
    const done = (fields) =>
      post({
        type: 'done',
        id,
        ms: Math.round(now() - t0),
        truncated: false,
        ...fields,
      });

    const blocked = findBlockedImport(code);
    if (blocked) {
      capture('stderr', blockedImportMessage(blocked));
      end();
      done({ outcome: 'error', hadException: true, errorType: 'ImportError' });
      return;
    }

    let result;
    try {
      // JS null은 Python에서 None이 아니라 jsnull이 되므로(314) "값 없음"은 undefined로 넘기거나 아예 안 넘긴다
      if (typeof msg.seed === 'number') py.seed(msg.seed);
      const proxy = await callRun(code);
      result = proxy.toJs();
      proxy.destroy();
    } catch (err) {
      // Pyodide 자체 오류 (학생 코드 예외는 Python 안에서 잡혀 여기로 오지 않음). done은 보내지 않는다
      end();
      post({ type: 'run-error', id, error: String(err?.message ?? err) });
      return;
    }
    const [hadException, errorType] = result;
    const state = end();
    const stopReason = state.stopReason;
    if (errorType === 'KeyboardInterrupt' && stopReason) {
      done({
        outcome: stopReason === 'stop' ? 'stopped' : stopReason,
        hadException: false,
        errorType: null,
        truncated: state.truncated,
      });
      return;
    }
    done({
      outcome: hadException ? 'error' : 'ok',
      hadException: Boolean(hadException),
      errorType: errorType ?? null,
      truncated: state.truncated,
    });
  }

  function handle(msg) {
    switch (msg?.type) {
      case 'run':
        return run(msg);
      case 'stop':
        if (active && (!msg.id || msg.id === active.id)) requestStop('stop');
        return;
      case 'answer':
        // P11-01: input-request에 대한 답. 지금은 input()을 브라우저에서 받지 않는다
        return;
    }
  }

  return {
    handle,
    run,
    canRunSync,
    get busy() {
      return active !== null;
    },
  };
}

/** Pyodide·Python 버전 정보 */
export function runtimeInfo(pyodide) {
  return {
    pyodide: pyodide.version,
    python: pyodide.runPython('import sys; sys.version.split()[0]'),
  };
}
