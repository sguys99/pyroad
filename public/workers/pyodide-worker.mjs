// Pyodide module Web Worker (B26·B15·§2.9)
//
// `new Worker('/workers/pyodide-worker.mjs', { type: 'module' })`로 만든다 (Pyodide 314는 classic Worker를 거부).
// Pyodide는 자체 호스팅(/pyodide/<버전>/, 빌드 전에 npm 패키지에서 복사)에서 불러오고,
// 실패했을 때만 jsDelivr에서 불러온다. 로딩이 끝나면 Worker 전역의 네트워크 API를 지운다.
// 실행 로직은 Node 검증 실행기와 같이 쓰는 pyodide-core.mjs에 있다. 메시지는 src/lib/pyodide/types.ts.
//
// input() (P11-01): JSPI가 있으면 코어가 run_sync로 answer를 기다린다. 없으면 SW 동기 XHR 채널을 쓴다 —
// 이 Worker는 `/pyodide/runner/pyodide-worker.mjs`(next.config.ts rewrites)로 떠서 SW scope 안에 있고,
// 페이지가 미리 등록한 SW(`input-sw.js`)가 `__sync/read` 요청을 답이 올 때까지 붙잡아 둔다.
//
// turtle (P11-02): shim `turtle.py`를 같은 경로(`/pyodide/runner/turtle.py` → public/workers/)에서 Pyodide와 함께 받아 코어에 넘긴다.

import {
  PYODIDE_VERSION,
  createRuntime,
  remainingNetworkGlobals,
  removeNetworkGlobals,
  runtimeInfo,
} from './pyodide-core.mjs';

const SOURCES = [
  {
    source: 'self',
    indexURL: new URL(`/pyodide/${PYODIDE_VERSION}/`, self.location.origin)
      .href,
  },
  {
    source: 'cdn',
    indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
  },
];

const post = (msg) => self.postMessage(msg);

// 동기 XHR은 SW 입력 채널에만 쓴다. 전역의 XMLHttpRequest는 로딩 뒤 지우므로(B15) 그 전에 여기에만 잡아 둔다.
// 모듈 안 변수라 학생 코드(JsProxy로 전역까지 가도)는 닿지 않는다
const SyncXHR = self.XMLHttpRequest;
const SYNC_URL = new URL('./__sync/', self.location.href).href;

function syncGet(path) {
  const xhr = new SyncXHR();
  xhr.open('GET', SYNC_URL + path, false);
  xhr.send(null);
  return xhr;
}

/** turtle shim 받기. 못 받으면 null (turtle만 못 쓰고 나머지 실행은 그대로) */
function fetchTurtleSource() {
  return fetch(new URL('./turtle.py', import.meta.url)).then(
    (res) => (res.ok ? res.text() : null),
    () => null,
  );
}

/** SW 채널로 답 하나를 기다린다. 채널이 끊기면 null (코어가 "입력을 받을 수 없어요"로 끝냄) */
function swReadLine(requestId) {
  for (;;) {
    let reply;
    try {
      const xhr = syncGet(`read?id=${encodeURIComponent(requestId)}`);
      if (xhr.status !== 200) return null;
      reply = JSON.parse(xhr.responseText);
    } catch {
      return null;
    }
    if (reply?.kind === 'value' || reply?.kind === 'stop') return reply;
    if (reply?.kind !== 'timeout') return null;
  }
}

/**
 * SW가 이 Worker의 요청을 가로채는지 확인한다. 강력 새로고침·SW를 막는 정책이면 실패.
 * Firefox는 새 Worker의 첫 요청 몇 개를 SW가 가로채지 않아서(P0-05 실측) async fetch로 한 번 깨운 뒤 다시 묻는다
 */
async function pingSwChannel() {
  if (!SyncXHR) return false;
  for (let i = 0; i < 5; i++) {
    try {
      await fetch(`${SYNC_URL}ping?warm=${i}`, { cache: 'no-store' });
      if (syncGet(`ping?try=${i}`).responseText.includes('pong')) return true;
    } catch {
      // 다시 시도
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

/** @type {ReturnType<typeof createRuntime> | null} */
let runtime = null;
let initStarted = false;

/** loadPyodide가 받는 큰 파일. 하나라도 막혀 있으면 자체 호스팅을 건너뛴다 */
const PRELOAD_CHECK = [
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

/**
 * 자체 호스팅 파일이 실제로 받아지는지 HEAD로 먼저 확인한다.
 * (실측, Firefox) pyodide.mjs는 받아졌는데 wasm·zip이 막히면 loadPyodide가 reject하지 않고 멈춰서
 * 폴백으로 넘어가지 못한다. 학교망 필터는 확장자·MIME 단위로 막는 경우가 있다.
 */
async function assertReachable(indexURL) {
  const results = await Promise.all(
    PRELOAD_CHECK.map((name) =>
      fetch(`${indexURL}${name}`, { method: 'HEAD', cache: 'no-store' }).then(
        (res) => (res.ok ? null : `${name} ${res.status}`),
        () => `${name} 연결 실패`,
      ),
    ),
  );
  const failed = results.filter(Boolean);
  if (failed.length > 0) throw new Error(failed.join(', '));
}

/** 로딩 중 Pyodide 안에서 처리되지 않은 reject가 나면(파일 일부 실패) 멈추지 말고 실패로 본다 */
function failOnUnhandledRejection() {
  let onReject;
  const promise = new Promise((_, reject) => {
    onReject = (event) => {
      event.preventDefault();
      reject(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
      );
    };
    self.addEventListener('unhandledrejection', onReject);
  });
  return {
    promise,
    dispose: () => self.removeEventListener('unhandledrejection', onReject),
  };
}

async function load({ source, indexURL }) {
  if (source === 'self') await assertReachable(indexURL);
  const guard = failOnUnhandledRejection();
  try {
    const loading = (async () => {
      const { loadPyodide } = await import(`${indexURL}pyodide.mjs`);
      // Pyodide 자체 출력(캡처 밖)은 버린다. 학생 코드 출력은 createRuntime이 setStdout으로 받는다
      return loadPyodide({ indexURL, stdout: () => {}, stderr: () => {} });
    })();
    return await Promise.race([loading, guard.promise]);
  } finally {
    guard.dispose();
  }
}

async function init() {
  if (initStarted) return;
  initStarted = true;
  // 단계(P6-05): download = 파일 받기·파이썬 띄우기(대부분의 시간), setup = 실행기 안전 장치. 바이트 진행률은 loadPyodide가 주지 않는다
  post({ type: 'init-status', status: 'loading', stage: 'download' });
  const t0 = performance.now();
  const turtleSource = fetchTurtleSource();
  try {
    let pyodide = null;
    let source = null;
    const errors = [];
    for (const candidate of SOURCES) {
      try {
        pyodide = await load(candidate);
        source = candidate.source;
        break;
      } catch (err) {
        errors.push(`${candidate.source}: ${String(err?.message ?? err)}`);
      }
    }
    if (!pyodide) throw new Error(errors.join(' / '));
    post({ type: 'init-status', status: 'loading', stage: 'setup' });

    const options = {
      post,
      interactiveInput: true,
      turtleSource: (await turtleSource) ?? undefined,
    };
    runtime = createRuntime(pyodide, options);
    const jspi = await runtime.canRunSync();
    // 네트워크 API를 지우기 전에 (ping의 깨우기 fetch)
    const swChannel = !jspi && (await pingSwChannel());
    if (swChannel) options.readLineSync = swReadLine;
    // 여기부터 Worker는 바깥으로 요청을 보낼 수 없다 (B15)
    const removedGlobals = removeNetworkGlobals(self);
    const left = remainingNetworkGlobals(self);
    if (left.length > 0)
      throw new Error(`네트워크 API를 지우지 못했어요: ${left.join(', ')}`);

    post({
      type: 'init-status',
      status: 'ready',
      info: {
        ...runtimeInfo(pyodide),
        source,
        jspi,
        input: jspi ? 'jspi' : swChannel ? 'sw' : 'none',
        loadMs: Math.round(performance.now() - t0),
        removedGlobals,
      },
    });
  } catch (err) {
    runtime = null;
    post({
      type: 'init-status',
      status: 'error',
      error: String(err?.message ?? err),
    });
  }
}

// stop으로 끝낸 KeyboardInterrupt가 WebLoop에서 한 번 더 올라오는 경우가 있다 (§2.9). 콘솔 오류로 남기지 않는다
self.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    /KeyboardInterrupt/.test(
      `${reason?.type ?? ''} ${reason?.message ?? reason ?? ''}`,
    )
  ) {
    event.preventDefault();
  }
});

self.onmessage = (event) => {
  const msg = event.data;
  if (msg?.type === 'init') {
    void init();
    return;
  }
  if (!runtime) {
    if (msg?.type === 'run') {
      post({
        type: 'run-error',
        id: msg.id,
        error: 'Pyodide가 아직 준비되지 않았어요.',
      });
    }
    return;
  }
  void runtime.handle(msg);
};
