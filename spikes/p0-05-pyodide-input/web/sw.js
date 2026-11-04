// 방식 ② Service Worker 쪽: 워커의 동기 XHR(`.../__sync/read?id=`)을 붙잡아 두었다가,
// 메인 스레드가 registration.active.postMessage({id, kind, value})로 답을 보내면 응답한다.
// 응답은 15초마다 'timeout'으로 끊고 워커가 다시 요청한다 (SW 수명 제한·XHR 타임아웃 대비 long-poll).

const waiting = new Map(); // id -> resolve
const mailbox = new Map(); // id -> msg (답이 요청보다 먼저 온 경우)
const HOLD_MS = 15000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (!msg || !msg.id) return;
  const resolve = waiting.get(msg.id);
  if (resolve) {
    waiting.delete(msg.id);
    resolve(msg);
  } else {
    mailbox.set(msg.id, msg);
  }
});

const json = (obj) =>
  new Response(JSON.stringify(obj), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const i = url.pathname.indexOf('/__sync/');
  if (i < 0) return; // 나머지 요청은 건드리지 않음 (네트워크로 통과)
  const op = url.pathname.slice(i + 8);
  if (op === 'ping') return e.respondWith(json({ kind: 'pong' }));
  if (op === 'read') {
    const id = url.searchParams.get('id');
    if (mailbox.has(id)) {
      const msg = mailbox.get(id);
      mailbox.delete(id);
      return e.respondWith(json(msg));
    }
    e.respondWith(
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          resolve({ kind: 'timeout' });
        }, HOLD_MS);
        waiting.set(id, (msg) => {
          clearTimeout(timer);
          resolve(msg);
        });
      }).then(json),
    );
    return;
  }
  e.respondWith(json({ kind: 'unknown' }));
});
