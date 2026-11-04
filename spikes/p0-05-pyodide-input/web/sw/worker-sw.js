// 방식 ② Service Worker + 동기 XHR ("sync-message" 패턴)
// - 격리 헤더가 필요 없다. 대신 이 워커가 Service Worker의 제어를 받아야 한다.
// - 워커 스크립트를 SW scope(…/web/sw/) 안에 두면 페이지는 scope 밖이어도 된다 (페이지 탐색은 SW를 거치지 않음).
// - SAB가 없으므로 CPU 무한 루프는 멈출 수 없다 → Worker terminate 후 재시작 (메인 쪽 fallback).
import { boot, setupOutput, runUser, post, now, timing } from '../worker/core.js';

let pyodide, out;
const intr = new Uint8Array(1); // 비공유 버퍼: 워커 안에서만 써서 checkInterrupt로 KeyboardInterrupt를 만든다
const SYNC = new URL('./__sync/', self.location).href;

function syncGet(path) {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', SYNC + path, false); // 동기 XHR (워커에서는 허용)
  xhr.send(null);
  return xhr;
}

function readLine() {
  out.flush();
  const id = crypto.randomUUID();
  post({ type: 'input-request', id, wt: now(), woke: timing.woke });
  for (;;) {
    let xhr;
    try {
      xhr = syncGet('read?id=' + id);
    } catch (e) {
      post({ type: 'channel-error', error: String(e?.message ?? e) });
      return null; // EOF
    }
    if (xhr.status !== 200 || !xhr.responseText.startsWith('{')) {
      post({ type: 'channel-error', error: 'HTTP ' + xhr.status + ' (SW가 이 워커를 제어하지 않음)' });
      return null;
    }
    const msg = JSON.parse(xhr.responseText);
    if (msg.kind === 'value') {
      timing.woke = now();
      return msg.value;
    }
    if (msg.kind === 'stop') {
      intr[0] = 2;
      pyodide.checkInterrupt();
      return null;
    }
    // 'timeout' -> 다시 기다림
  }
}

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    try {
      const r = await boot(m.indexURL);
      // SW 채널 확인. Firefox(실측)는 새 워커의 첫 요청들을 SW가 가로채지 않으므로 async fetch로 한 번 깨운 뒤 재시도한다.
      let channel = 'not-controlled';
      for (let i = 0; i < 5 && channel !== 'ok'; i++) {
        try {
          await fetch(SYNC + 'ping?warm=' + i);
          const x = syncGet('ping?try=' + i);
          if (x.responseText.includes('pong')) channel = 'ok';
          else channel = 'not-controlled (HTTP ' + x.status + ', try ' + i + ')';
        } catch (e) {
          channel = 'error: ' + (e?.message ?? e);
        }
        if (channel !== 'ok') await new Promise((res) => setTimeout(res, 50));
      }
      pyodide = r.pyodide;
      pyodide.setInterruptBuffer(intr);
      pyodide.setStdin({ stdin: readLine });
      out = setupOutput(pyodide);
      post({
        type: 'ready',
        ms: r.ms,
        info: { ...r.info, channel, swController: !!self.navigator.serviceWorker?.controller },
      });
    } catch (e) {
      post({ type: 'init-error', error: String(e?.message ?? e) });
    }
  } else if (m.type === 'run') {
    intr[0] = 0;
    await runUser(pyodide, out, m.id, m.code, (ns) =>
      pyodide.runPython(m.code, { globals: ns, filename: '<student>' }),
    );
    intr[0] = 0;
  }
};
