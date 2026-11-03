// 방식 ③ 소스 변환 + 비동기 실행
// - 헤더·SW·JSPI 없이 모든 브라우저에서 동작한다. 워커 이벤트 루프는 await 지점(input)에서만 돈다.
// - 변환 규칙과 한계는 transform.py 참고.
import { boot, setupOutput, runUser, post, now, timing } from './core.js';

let pyodide, out, runTransformed, asyncInput;
let pending = null; // input() Promise resolver
// 멈춤은 input() 대기 지점에서만 처리한다. (실측) 비공유 interrupt buffer를 쓰면 WebLoop 콜백이 신호를 먼저
// 소비해 실행이 끝나지 않는 경우가 있었다 → interrupt buffer는 쓰지 않음.

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
      const src = await (await fetch(new URL('./transform.py', import.meta.url))).text();
      pyodide.runPython(src + '\n__pyroad_transform_mod = run_transformed');
      runTransformed = pyodide.globals.get('__pyroad_transform_mod');
      pyodide.globals.set('__js_wait_input', waitInput);
      asyncInput = pyodide.runPython(`
async def __pyroad_async_input(prompt=""):
    import sys
    sys.stdout.write(str(prompt)); sys.stdout.flush()
    v = await __js_wait_input()
    if v is None:
        raise KeyboardInterrupt
    return v
__pyroad_async_input`);
      post({ type: 'ready', ms: r.ms, info: r.info });
    } catch (e) {
      post({ type: 'init-error', error: String(e?.message ?? e) });
    }
  } else if (m.type === 'run') {
    await runUser(pyodide, out, m.id, m.code, (ns) =>
      runTransformed(m.code, ns, asyncInput, (names) => post({ type: 'note', text: 'async로 바뀐 함수: ' + names })),
    );
  } else if (m.type === 'answer') {
    timing.woke = now();
    if (pending) pending.resolve(m.value), (pending = null);
  } else if (m.type === 'stop') {
    if (pending) pending.resolve(undefined), (pending = null); // undefined → None (314에서 JS null은 jsnull로 변환됨)
  }
};
