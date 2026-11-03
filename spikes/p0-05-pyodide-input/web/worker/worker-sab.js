// 방식 ① SharedArrayBuffer + Atomics.wait
// - 페이지가 crossOriginIsolated(COOP same-origin + COEP require-corp|credentialless)여야 SAB를 만들 수 있다.
// - input()은 CPython 내장 그대로 쓰고, pyodide.setStdin의 동기 콜백 안에서 Atomics.wait로 답을 기다린다.
// - 같은 SAB로 pyodide.setInterruptBuffer를 걸어 무한 루프도 Worker를 죽이지 않고 KeyboardInterrupt로 멈춘다.
import { boot, setupOutput, runUser, post, now, timing } from './core.js';

let pyodide, out, ctrl, data, intr;
const dec = new TextDecoder();

// ctrl[0]: 0=대기, 1=답 도착, 2=멈춤 요청 / ctrl[1]: 답 바이트 길이
function readLine() {
  out.flush();
  Atomics.store(ctrl, 0, 0);
  post({ type: 'input-request', wt: now(), woke: timing.woke });
  for (;;) {
    Atomics.wait(ctrl, 0, 0, 500); // 500ms마다 깨어나 멈춤 여부 확인 (busy loop 아님)
    const state = Atomics.load(ctrl, 0);
    if (state === 1) {
      timing.woke = now();
      const text = dec.decode(data.slice(0, ctrl[1])); // slice로 비공유 버퍼 복사 (TextDecoder는 SAB 뷰 불가)
      Atomics.store(ctrl, 0, 0);
      return text;
    }
    if (state === 2 || intr[0] !== 0) {
      Atomics.store(ctrl, 0, 0);
      if (intr[0] === 0) intr[0] = 2;
      pyodide.checkInterrupt(); // KeyboardInterrupt를 던진다
      return null;
    }
  }
}

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    try {
      const r = await boot(m.indexURL);
      pyodide = r.pyodide;
      ctrl = new Int32Array(m.ctrlSab);
      data = new Uint8Array(m.dataSab);
      intr = new Uint8Array(m.intSab);
      pyodide.setInterruptBuffer(intr);
      pyodide.setStdin({ stdin: readLine });
      out = setupOutput(pyodide);
      post({ type: 'ready', ms: r.ms, info: { ...r.info, jspi: typeof WebAssembly.Suspending === 'function' } });
    } catch (e) {
      post({ type: 'init-error', error: String(e?.message ?? e) });
    }
  } else if (m.type === 'run') {
    intr[0] = 0;
    // m.pyasync: 진단용. runPythonAsync(JSPI 진입)에서도 SAB 인터럽트가 먹는지 확인
    await runUser(pyodide, out, m.id, m.code, (ns) =>
      m.pyasync
        ? pyodide.runPythonAsync(m.code, { globals: ns, filename: '<student>' })
        : pyodide.runPython(m.code, { globals: ns, filename: '<student>' }),
    );
    intr[0] = 0;
  }
};
