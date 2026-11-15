// input() 폴백 채널 Service Worker (P11-01, P0-05 ②, §2.9)
//
// JSPI가 없는 브라우저(Safari/iOS 26 이하 등)에서만 등록한다. `/pyodide/runner/input-sw.js`로 서빙되고
// (next.config.ts rewrites → 이 파일) scope는 `/pyodide/runner/`라 앱 페이지는 이 SW를 거치지 않는다.
// 같은 경로의 Pyodide Worker가 보내는 동기 XHR(`/pyodide/runner/__sync/read?id=`)을 붙잡아 두었다가
// 페이지가 registration.active.postMessage({ id, kind: 'value' | 'stop', value })로 답을 보내면 응답한다.
// 15초마다 'timeout'으로 끊고 Worker가 다시 묻는다 (SW 수명 제한 대비 long-poll). 나머지 요청은 건드리지 않는다.

const HOLD_MS = 15000;
/** requestId → 응답 함수 */
const waiting = new Map();
/** 요청보다 먼저 온 답 */
const mailbox = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg.id !== 'string') return;
  if (msg.kind !== 'value' && msg.kind !== 'stop') return;
  const reply = { kind: msg.kind, value: String(msg.value ?? '') };
  const resolve = waiting.get(msg.id);
  if (resolve) {
    waiting.delete(msg.id);
    resolve(reply);
  } else {
    mailbox.set(msg.id, reply);
  }
});

const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const at = url.pathname.indexOf('/__sync/');
  if (at < 0) return;
  const op = url.pathname.slice(at + '/__sync/'.length);
  if (op === 'ping') {
    event.respondWith(json({ kind: 'pong' }));
    return;
  }
  const id = url.searchParams.get('id');
  if (op !== 'read' || !id) {
    event.respondWith(json({ kind: 'unknown' }));
    return;
  }
  if (mailbox.has(id)) {
    const reply = mailbox.get(id);
    mailbox.delete(id);
    event.respondWith(json(reply));
    return;
  }
  event.respondWith(
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        resolve({ kind: 'timeout' });
      }, HOLD_MS);
      waiting.set(id, (reply) => {
        clearTimeout(timer);
        resolve(reply);
      });
    }).then(json),
  );
});
