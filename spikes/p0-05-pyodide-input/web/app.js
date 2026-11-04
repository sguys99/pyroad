// P0-05 데모 페이지 컨트롤러. ?opt=sab|sw|transform|jspi &v=314.0.7|0.27.5 &cdn=1 &swscope=worker|page
import { DEMO, CASES } from './programs.js';

const qs = new URLSearchParams(location.search);
const OPT = qs.get('opt') || 'sab';
const VER = qs.get('v') || '314.0.7';
const CDN = qs.get('cdn') === '1';
const SWSCOPE = qs.get('swscope') || 'worker';
const MODE_BASE = location.pathname.replace(/web\/.*$/, ''); // "/m/<mode>/"
const INDEX_URL = CDN
  ? `https://cdn.jsdelivr.net/pyodide/v${VER}/full/`
  : new URL(`${MODE_BASE}pyodide/${VER}/`, location).href;
const WORKER_URL = {
  sab: './worker/worker-sab.js',
  sw: './sw/worker-sw.js',
  transform: './worker/worker-transform.js',
  jspi: './worker/worker-jspi.js',
}[OPT];

const $ = (s) => document.querySelector(s);
const log = [];
const ev = (type, data = {}) => {
  const e = { t: Math.round(performance.now() * 10) / 10, type, ...data };
  log.push(e);
  return e;
};

// ---------- 환경 표시 ----------
const env = {
  opt: OPT,
  version: VER,
  cdn: CDN,
  crossOriginIsolated: self.crossOriginIsolated === true,
  sab: typeof SharedArrayBuffer === 'function',
  jspi: typeof WebAssembly?.Suspending === 'function',
  serviceWorker: 'serviceWorker' in navigator,
  ua: navigator.userAgent,
};
$('#env').textContent = Object.entries(env)
  .filter(([k]) => k !== 'ua')
  .map(([k, v]) => `${k}=${v}`)
  .join('  ');

// ---------- 출력 영역 (대화창 스타일) ----------
const outEl = $('#out');
let transcript = '';
function append(cls, text) {
  transcript += text;
  const last = outEl.lastElementChild;
  if (last && last.className === cls) last.textContent += text;
  else {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    outEl.appendChild(span);
  }
  outEl.scrollTop = outEl.scrollHeight;
}

// ---------- Service Worker 등록 (방식 ②) ----------
async function ensureSW() {
  const scope = SWSCOPE === 'page' ? './' : './sw/';
  const t0 = performance.now();
  const reg = await navigator.serviceWorker.register('./sw.js', { scope });
  const sw = reg.active || reg.waiting || reg.installing;
  if (sw.state !== 'activated') {
    await new Promise((res) => sw.addEventListener('statechange', () => sw.state === 'activated' && res()));
  }
  ev('sw-ready', { ms: Math.round(performance.now() - t0), scope: reg.scope, pageControlled: !!navigator.serviceWorker.controller });
  return reg;
}

// ---------- Runner ----------
class Runner {
  constructor() {
    this.waitingInput = null; // { id }
    this.current = null; // { id, resolve }
    this.restarts = 0;
  }

  async start() {
    if (OPT === 'sab') {
      if (!self.crossOriginIsolated) throw new Error('crossOriginIsolated=false → SharedArrayBuffer 사용 불가');
      this.ctrl = new Int32Array(new SharedArrayBuffer(8));
      this.data = new Uint8Array(new SharedArrayBuffer(64 * 1024));
      this.intr = new Uint8Array(new SharedArrayBuffer(1));
    }
    if (OPT === 'sw') this.reg = this.reg || (await ensureSW());
    const t0 = performance.now();
    const gen = (this.gen = (this.gen || 0) + 1); // 종료된 이전 Worker의 늦은 이벤트를 무시하기 위한 세대 번호
    const worker = (this.worker = new Worker(WORKER_URL, { type: 'module' }));
    worker.onmessage = (e) => gen === this.gen && this.onMessage(e.data);
    worker.onerror = (e) => {
      ev('worker-error', { message: e.message, gen, current: gen === this.gen });
      if (gen === this.gen) this.readyReject?.(new Error('worker error: ' + e.message));
    };
    const ready = new Promise((res, rej) => ((this.readyResolve = res), (this.readyReject = rej)));
    this.worker.postMessage({
      type: 'init',
      indexURL: INDEX_URL,
      ctrlSab: this.ctrl?.buffer,
      dataSab: this.data?.buffer,
      intSab: this.intr?.buffer,
    });
    const info = await ready;
    const e = ev('ready', { ms: Math.round(performance.now() - t0), workerMs: info.ms, info: info.info });
    $('#status').textContent = `준비됨 (${e.ms} ms) ${JSON.stringify(info.info)}`;
    return e;
  }

  onMessage(m) {
    switch (m.type) {
      case 'ready':
        return this.readyResolve(m);
      case 'init-error':
        ev('init-error', { error: m.error });
        return this.readyReject(new Error(m.error));
      case 'stdout':
        append('o', m.text);
        return ev('stdout', { text: m.text });
      case 'stderr':
        append('e', m.text);
        return ev('stderr', { text: m.text });
      case 'pong':
        return ev('pong', { rtt: Math.round(performance.now() - m.t) });
      case 'note':
        return ev('note', { text: m.text });
      case 'channel-error':
        append('e', `\n[입력 채널 오류] ${m.error}\n`);
        return ev('channel-error', { error: m.error });
      case 'input-request':
        this.waitingInput = { id: m.id };
        ev('input-request', { id: m.id, wt: m.wt, woke: m.woke, recv: performance.timeOrigin + performance.now() });
        showInput();
        return this.onInputRequest?.();
      case 'done': {
        this.waitingInput = null;
        hideInput();
        if (m.error) append('e', '\n' + m.error + '\n');
        if (m.stopped) append('s', '\n[멈췄어요]\n');
        clearTimeout(this.stopTimer);
        const e = ev('done', { ok: m.ok, stopped: !!m.stopped, error: m.error, ms: m.ms });
        this.current?.resolve(e);
        this.current = null;
        return;
      }
    }
  }

  run(code) {
    transcript = '';
    outEl.textContent = '';
    const id = crypto.randomUUID();
    ev('run', { id });
    return new Promise((resolve) => {
      this.current = { id, resolve };
      this.worker.postMessage({ type: 'run', id, code, pyasync: qs.get('pyasync') === '1' });
    });
  }

  answer(text) {
    if (!this.waitingInput) return false;
    const { id } = this.waitingInput;
    this.waitingInput = null;
    hideInput();
    append('a', text + '\n'); // 학생 답은 출력 영역에 말풍선처럼 남긴다 (stdout에는 들어가지 않음)
    this.lastAnswerAbs = performance.timeOrigin + performance.now();
    ev('answer', { text, abs: this.lastAnswerAbs });
    if (OPT === 'sab') {
      const bytes = new TextEncoder().encode(text);
      this.data.set(bytes);
      Atomics.store(this.ctrl, 1, bytes.length);
      Atomics.store(this.ctrl, 0, 1);
      Atomics.notify(this.ctrl, 0);
    } else if (OPT === 'sw') {
      this.reg.active.postMessage({ id, kind: 'value', value: text });
    } else {
      this.worker.postMessage({ type: 'answer', id, value: text });
    }
    return true;
  }

  /** 멈추기: 먼저 정상 중단(KeyboardInterrupt)을 시도하고, 1초 안에 안 끝나면 Worker를 terminate 후 재시작 */
  stop(graceMs = 1000) {
    if (!this.current) return Promise.resolve(null);
    const t0 = performance.now();
    ev('stop');
    const wasWaiting = this.waitingInput;
    if (OPT === 'sab') {
      this.intr[0] = 2;
      Atomics.store(this.ctrl, 0, 2);
      Atomics.notify(this.ctrl, 0);
    } else if (OPT === 'sw' && wasWaiting) {
      this.reg.active.postMessage({ id: wasWaiting.id, kind: 'stop' });
    } else {
      this.worker.postMessage({ type: 'stop' });
    }
    const pending = this.current;
    return new Promise((resolve) => {
      const origResolve = pending.resolve;
      pending.resolve = (e) => {
        origResolve(e);
        resolve({ how: 'graceful', ms: Math.round(performance.now() - t0) });
      };
      this.stopTimer = setTimeout(async () => {
        this.worker.terminate();
        this.restarts++;
        this.waitingInput = null;
        hideInput();
        append('s', '\n[멈췄어요 — 실행기를 다시 준비하는 중]\n');
        ev('terminated');
        const tRe = performance.now();
        await this.start();
        const reinitMs = Math.round(performance.now() - tRe);
        origResolve(ev('done', { ok: false, stopped: true, terminated: true }));
        this.current = null;
        resolve({ how: 'terminate', ms: Math.round(performance.now() - t0), reinitMs });
      }, graceMs);
    });
  }

  /** 테스트용: 입력을 자동으로 넣으면서 실행하고, 답 → 다음 input-request(또는 done)까지 왕복 시간을 잰다 */
  async runScripted(code, inputs, timeoutMs = 15000) {
    const startIdx = log.length;
    const queue = [...inputs];
    const rtts = [];
    let sentAt = null;
    const parts = [];
    this.onInputRequest = () => {
      if (sentAt !== null) {
        rtts.push(performance.now() - sentAt);
        const r = log[log.length - 1]; // 방금 기록한 input-request
        if (r.woke) parts.push({ toWorker: r.woke - this.lastAnswerAbs, python: r.wt - r.woke, toMain: r.recv - r.wt });
      }
      sentAt = null;
      if (queue.length) {
        sentAt = performance.now();
        this.answer(queue.shift());
      }
    };
    const timer = new Promise((res) => setTimeout(() => res({ type: 'timeout' }), timeoutMs));
    const done = await Promise.race([this.run(code), timer]);
    if (sentAt !== null && done.type === 'done') rtts.push(performance.now() - sentAt);
    this.onInputRequest = null;
    if (done.type === 'timeout') await this.stop(300);
    const notes = log.slice(startIdx).filter((e) => e.type === 'note').slice(-1)[0]?.text;
    return { done, transcript, used: inputs.length - queue.length, rtts, parts, notes };
  }
}

// ---------- 입력 박스 ----------
const form = $('#inputForm');
const answerEl = $('#answer');
function showInput() {
  form.hidden = false;
  answerEl.value = '';
  answerEl.focus();
}
function hideInput() {
  form.hidden = true;
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  runner.answer(answerEl.value);
});

// ---------- 화면 ----------
const runner = new Runner();
const sel = $('#program');
for (const name of Object.keys(DEMO)) sel.add(new Option(name, name));
sel.addEventListener('change', () => ($('#code').value = DEMO[sel.value]));
$('#code').value = DEMO.guess;
$('#run').addEventListener('click', () => runner.run($('#code').value));
$('#stop').addEventListener('click', () => runner.stop());
$('#probeBtn').addEventListener('click', () => runProbes());
$('#opt').textContent = OPT;

// 교차 출처 리소스 프로브 (localhost <-> 127.0.0.1 은 다른 출처)
const other = `${location.protocol}//${location.hostname === 'localhost' ? '127.0.0.1' : 'localhost'}:${location.port}${MODE_BASE}xo/`;
const probes = [
  ['img 헤더 없음', 'img', other + 'plain.png', null],
  ['img CORP: cross-origin', 'img', other + 'corp.png', null],
  ['img ACAO:* + crossorigin 속성', 'img', other + 'cors.png', 'anonymous'],
  ['img ACAO:* (crossorigin 속성 없음)', 'img', other + 'cors.png', null],
  ['script ACAO:* (속성 없음)', 'script', other + 'script.js', null],
  ['script ACAO:* + crossorigin 속성', 'script', other + 'script.js?c', 'anonymous'],
];
if (qs.get('real') === '1') {
  probes.push(
    ['Google 아바타 lh3.googleusercontent.com', 'img', 'https://lh3.googleusercontent.com/a/default-user=s96-c', null],
    ['네이버 이미지 ssl.pstatic.net', 'img', 'https://ssl.pstatic.net/static/pwe/address/img_profile.png', null],
    ['네이버 이미지 + crossorigin', 'img', 'https://ssl.pstatic.net/static/pwe/address/img_profile.png?c', 'anonymous'],
    ['Kakao SDK (속성 없음)', 'script', 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js', null],
    ['Kakao SDK + crossorigin', 'script', 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js?c', 'anonymous'],
  );
}
async function runProbes() {
  const results = {};
  await Promise.all(
    probes.map(
      ([name, tag, src, co]) =>
        new Promise((res) => {
          const el = document.createElement(tag);
          if (co) el.crossOrigin = co;
          const t = setTimeout(() => res((results[name] = 'timeout')), 8000);
          el.onload = () => (clearTimeout(t), res((results[name] = 'ok')));
          el.onerror = () => (clearTimeout(t), res((results[name] = 'blocked')));
          el.src = src;
          (tag === 'img' ? $('#probes') : document.head).appendChild(el);
        }),
    ),
  );
  try {
    const r = await fetch(other + 'cors.png', { mode: 'cors' });
    results['fetch CORS (Supabase API 같은 경우)'] = r.ok ? 'ok' : 'HTTP ' + r.status;
  } catch {
    results['fetch CORS (Supabase API 같은 경우)'] = 'blocked';
  }
  $('#probeResult').textContent = Object.entries(results)
    .map(([k, v]) => `${v.padEnd(8)} ${k}`)
    .join('\n');
  return results;
}

// COOP same-origin이면 교차 출처 팝업과의 opener 관계가 끊긴다 (OAuth·SDK 팝업 흐름에 영향)
async function popupProbe() {
  const w = window.open(other.replace(/\/m\/[a-z]+\/xo\/$/, '/m/plain/web/popup.html'), 'p0-05-popup', 'width=300,height=200');
  const got = await new Promise((res) => {
    const onMsg = (e) => e.data?.from === 'popup' && res(true);
    window.addEventListener('message', onMsg, { once: true });
    setTimeout(() => res(false), 5000);
  });
  const r = { popupHandleClosed: w ? w.closed : 'null', messageFromPopup: got };
  try { w?.close(); } catch {}
  return r;
}

/** 테스트용: log에서 from 이후 type 이벤트가 나올 때까지 기다림 */
function waitFor(type, from = 0, timeoutMs = 15000) {
  const t0 = performance.now();
  return new Promise((res) => {
    (function poll() {
      const e = log.slice(from).find((x) => x.type === type);
      if (e) return res(e);
      if (performance.now() - t0 > timeoutMs) return res(null);
      setTimeout(poll, 10);
    })();
  });
}

window.spike = { env, log, runner, DEMO, CASES, runProbes, popupProbe, waitFor, start: () => runner.start() };

if (qs.get('autostart') !== '0') {
  runner.start().catch((e) => {
    $('#status').textContent = '시작 실패: ' + e.message;
    ev('start-failed', { error: e.message });
  });
}
