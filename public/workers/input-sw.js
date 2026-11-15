// input() 폴백 채널 Service Worker (P11-01, P0-05 ②, §2.9)
//
// JSPI가 없는 브라우저(Safari/iOS 26 이하 등)에서만 등록한다. `/pyodide/runner/input-sw.js`로 서빙되고
// (next.config.ts rewrites → 이 파일) scope는 `/pyodide/runner/`라 앱 페이지는 이 SW를 거치지 않는다.
// 같은 경로의 Pyodide Worker가 보내는 동기 XHR(`/pyodide/runner/__sync/read?id=`)을 붙잡아 두었다가
// 페이지가 registration.active.postMessage({ id, kind: 'value' | 'stop', value })로 답을 보내면 응답한다.
// 15초마다 'timeout'으로 끊고 Worker가 다시 묻는다 (SW 수명 제한 대비 long-poll). 나머지 요청은 건드리지 않는다.
// time.sleep (P11-03): `__sync/sleep?run=&ms=`를 ms만큼 붙잡았다가 'ok'. 페이지가 { id: 실행 id, kind: 'stop-run' }을
// 보내면 그 실행의 잠을 바로 'stop'으로 깨우고, 그 뒤에 오는 잠도 바로 'stop'.
// 키 입력 (P11-04): 페이지가 { id: 실행 id, kind: 'key', key }를 보내면 쌓아 두었다가 그 실행의 다음 잠 답에 { keys }로 싣는다.

const HOLD_MS = 15000;
/** requestId → 응답 함수 */
const waiting = new Map();
/** 요청보다 먼저 온 답 */
const mailbox = new Map();
/** 실행 id → 자고 있는 요청을 깨우는 함수 (time.sleep) */
const sleepers = new Map();
/** 멈춘 실행 id (멈춘 뒤에 온 잠도 바로 깨움). 오래된 것부터 버린다 */
const stoppedRuns = new Set();
/** 실행 id → 아직 Worker에 못 준 키 (실행 수·키 수 모두 상한) */
const keyQueues = new Map();
const MAX_KEYS = 32;

/** 쌓인 키를 꺼내 비운다 */
function takeKeys(run) {
  const keys = keyQueues.get(run) ?? [];
  keyQueues.delete(run);
  return keys;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg.id !== 'string') return;
  if (msg.kind === 'key') {
    if (typeof msg.key !== 'string' || msg.key.length > 16) return;
    if (!keyQueues.has(msg.id)) {
      keyQueues.set(msg.id, []);
      if (keyQueues.size > 50) keyQueues.delete(keyQueues.keys().next().value);
    }
    const queue = keyQueues.get(msg.id);
    if (queue.length < MAX_KEYS) queue.push(msg.key);
    return;
  }
  if (msg.kind === 'stop-run') {
    keyQueues.delete(msg.id);
    stoppedRuns.add(msg.id);
    if (stoppedRuns.size > 50)
      stoppedRuns.delete(stoppedRuns.values().next().value);
    sleepers.get(msg.id)?.();
    return;
  }
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
  if (op === 'sleep') {
    const run = url.searchParams.get('run') ?? '';
    if (stoppedRuns.has(run)) {
      event.respondWith(json({ kind: 'stop' }));
      return;
    }
    const ms = Math.min(
      Math.max(Number(url.searchParams.get('ms')) || 0, 0),
      HOLD_MS,
    );
    event.respondWith(
      new Promise((resolve) => {
        const timer = setTimeout(() => {
          sleepers.delete(run);
          resolve({ kind: 'ok', keys: takeKeys(run) });
        }, ms);
        sleepers.set(run, () => {
          clearTimeout(timer);
          sleepers.delete(run);
          resolve({ kind: 'stop' });
        });
      }).then(json),
    );
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
