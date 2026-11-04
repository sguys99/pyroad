// P0-06 데모: 워커 + 렌더러 + 검사기 연결. 쿼리 파라미터:
//   ?pyodide=local|root|cdn  &ver=314.0.7  &timeout=5000  &stream=0(끝에 한 번에 보내기)  &first=40  &max=50000
import { TurtleCanvas } from './renderer.js';
import { analyze, runRules } from './checker.js';

const qs = new URLSearchParams(location.search);
const PY = qs.get('pyodide') || 'local';
const VER = qs.get('ver') || '314.0.7';
const INDEX_URL = PY === 'cdn' ? `https://cdn.jsdelivr.net/pyodide/v${VER}/full/` : PY === 'root' ? '/pyodide/root/' : '/pyodide/local/';
const TIMEOUT_MS = +(qs.get('timeout') || 5000);
const STREAM = qs.get('stream') !== '0';
const MAX_COMMANDS = +(qs.get('max') || 50000);

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8, Infinity];
const SPEED_LABELS = ['아주 느리게', '느리게', '보통', '빠르게', '아주 빠르게', '번개', '바로'];

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const codeEl = /** @type {HTMLTextAreaElement} */ ($('code'));
const speedEl = /** @type {HTMLInputElement} */ ($('speed'));

const renderer = new TurtleCanvas($('stage'));
const demo = {
  phase: 'loading', // loading | ready | running | drawing | idle | error
  renderer,
  samples: [],
  sampleId: null,
  lastCommands: [],
  lastResult: null,
  lastCheck: null,
  init: null,
  metrics: {},
  errors: [],
  stream: STREAM, // false면 실행이 끝난 뒤 한 번에 보냄 (비교 측정용)
  firstMs: +(qs.get('first') ?? 40), // 첫 전송까지 기다리는 시간. 0이면 1→4→16… 즉시 전송
  run: () => runCode(codeEl.value),
  loadSample,
  analyze: () => analyze(demo.lastCommands),
};
// @ts-ignore
window.__demo = demo;

let worker = null;
let runId = 0;
let timer = 0;
let t0 = 0;

function setPhase(p) {
  demo.phase = p;
  document.body.dataset.phase = p;
  const busy = p === 'running' || p === 'drawing';
  /** @type {HTMLButtonElement} */ ($('run')).disabled = p === 'loading' || p === 'error' || busy;
  /** @type {HTMLButtonElement} */ ($('stop')).disabled = !busy;
  /** @type {HTMLButtonElement} */ ($('skip')).disabled = !busy;
  /** @type {HTMLButtonElement} */ ($('save')).disabled = busy || !renderer.items.length;
}

function setStatus(state, text) {
  $('status').dataset.state = state;
  $('status-text').textContent = text;
}

function bubble(html, warn = false) {
  $('bubble').innerHTML = html;
  $('bubble').classList.toggle('warn', warn);
}

// ------------------------------------------------------------------ 워커

function startWorker() {
  worker?.terminate();
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onWorkerMessage;
  worker.onerror = (e) => {
    setStatus('error', '실행기 오류');
    demo.errors.push(String(e.message || e));
  };
  setPhase('loading');
  setStatus('loading', '파이썬 준비 중…');
  worker.postMessage({ type: 'init', indexURL: INDEX_URL });
}

function onWorkerMessage(e) {
  const m = e.data;
  if (m.type === 'init-status') {
    if (m.status === 'ready') {
      demo.init = m;
      setStatus('ready', `Pyodide ${m.version} · Python ${m.python} · ${(m.ms / 1000).toFixed(1)}초`);
      setPhase('ready');
    } else if (m.status === 'error') {
      setStatus('error', '파이썬을 불러오지 못했어요');
      demo.errors.push(m.error);
      setPhase('error');
    }
    return;
  }
  if (m.id !== runId) return; // 지난 실행의 늦은 메시지
  if (m.type === 'turtle') {
    const cmds = JSON.parse(m.chunk);
    const mt = demo.metrics;
    if (!mt.chunks) mt.firstChunkMs = performance.now() - t0;
    if (mt.firstMoveChunkMs == null && cmds.some((c) => c[0] === 'm')) mt.firstMoveChunkMs = performance.now() - t0;
    mt.chunks = (mt.chunks || 0) + 1;
    mt.chars = (mt.chars || 0) + m.chunk.length;
    for (const c of cmds) demo.lastCommands.push(c);
    renderer.push(cmds);
  } else if (m.type === 'run-result') {
    clearTimeout(timer);
    demo.lastResult = m;
    demo.metrics.resultMs = performance.now() - t0;
    demo.metrics.execMs = m.execMs;
    renderer.end();
    showOutput(m.stdout, m.stderr);
    runCheck();
    setPhase(renderer.isIdle() ? 'idle' : 'drawing');
    if (renderer.isIdle()) onDrawDone();
  }
}

// ------------------------------------------------------------------ 실행

function runCode(code) {
  if (demo.phase === 'loading' || demo.phase === 'error') return;
  runId++;
  renderer.reset();
  demo.lastCommands = [];
  demo.lastResult = null;
  demo.lastCheck = null;
  demo.metrics = { startedAt: performance.now() };
  $('out').hidden = true;
  $('err').hidden = true;
  $('check').hidden = true;
  $('meta').textContent = '';
  $('art-title').textContent = currentTitle();
  bubble('그리는 중이에요…');
  setPhase('running');
  t0 = performance.now();
  worker.postMessage({ type: 'run', id: runId, code, stream: demo.stream, firstMs: demo.firstMs, maxCommands: MAX_COMMANDS });
  timer = setTimeout(onTimeout, TIMEOUT_MS);
}

function onTimeout() {
  // 무한 반복: 워커를 끝내고 새로 띄움 (기존 usePyodide와 같은 방식)
  demo.metrics.timeout = true;
  renderer.end();
  showOutput('', '');
  bubble(`코드가 ${TIMEOUT_MS / 1000}초 넘게 끝나지 않아서 멈췄어요. <b>while True</b> 같은 끝나지 않는 반복이 있는지 살펴볼까요?`, true);
  startWorker();
}

renderer.on('firstInk', (t) => {
  demo.metrics.firstInkMs = t - t0;
});
renderer.on('idle', () => {
  if (demo.phase === 'drawing') {
    setPhase('idle');
    onDrawDone();
  }
});
renderer.on('title', (text) => {
  $('art-title').textContent = text;
});

function onDrawDone() {
  demo.metrics.idleMs = performance.now() - t0;
  const r = demo.lastResult;
  const mt = demo.metrics;
  if (r && !r.stderr) {
    bubble(r.turtle?.commands ? '다 그렸어요! 멋진 그림이에요.' : '실행이 끝났어요.');
  }
  const tt = r?.turtle || {};
  $('meta').textContent = [
    `명령 ${fmt(tt.commands || 0)}개`,
    `메시지 ${mt.chunks || 0}개 (${((mt.chars || 0) / 1024).toFixed(1)}KB)`,
    `파이썬 ${Math.round(mt.execMs || 0)}ms`,
    mt.firstInkMs != null ? `첫 선 ${Math.round(mt.firstInkMs)}ms` : null,
    `완성 ${Math.round(mt.idleMs)}ms`,
  ].filter(Boolean).join(' · ');
  setPhase(demo.phase);
}

function showOutput(stdout, stderr) {
  if (stdout) { $('out').textContent = stdout; $('out').hidden = false; }
  if (stderr) {
    $('err').textContent = stderr;
    $('err').hidden = false;
    const last = stderr.trim().split('\n').pop() || '';
    const msg = last.replace(/^[\w.]+Error: |^[\w.]+: /, '');
    bubble(`앗, 버그버그가 나타났어요! <b>${escapeHtml(msg)}</b>`, true);
  }
}

function runCheck() {
  $('check').innerHTML = '';
  $('check').hidden = true;
  const s = demo.samples.find((x) => x.id === demo.sampleId);
  if (!s || !s.rules?.length) return;
  const res = runRules(analyze(demo.lastCommands), s.rules);
  demo.lastCheck = res;
  const box = $('check');
  box.innerHTML = '';
  for (const r of res.results) {
    const div = document.createElement('div');
    div.className = 'badge' + (r.ok ? '' : ' fail');
    div.innerHTML = `<b>${r.ok ? '통과' : '다시 보기'}</b><span>${escapeHtml(ruleLabel(r.rule))}${r.ok ? '' : ' — ' + escapeHtml(r.reasons.join(' '))}</span>`;
    box.appendChild(div);
  }
  box.hidden = false;
}

function ruleLabel(r) {
  if (r.type === 'shape' && r.shape === 'regular') {
    const base = r.k === 2 && r.n === 5 ? '오각별' : r.n === 4 ? '정사각형' : `정${r.n}각형`;
    return base + (r.side ? ` (한 변 ${r.side})` : '') + (r.filled ? ' + 색칠' : '');
  }
  if (r.type === 'shape') return '직사각형 막대';
  if (r.type === 'circles') return `원 ${r.min}개 이상${r.radius ? ` (반지름 ${r.radius})` : ''}`;
  if (r.type === 'colors') return `색 ${r.min}가지 이상`;
  if (r.type === 'text') return `"${r.includes}" 글씨`;
  if (r.type === 'segments') return `선 ${r.min}개 이상`;
  if (r.type === 'turtles') return `거북이 ${r.min}마리`;
  return r.type;
}

// ------------------------------------------------------------------ UI

async function loadSamples() {
  demo.samples = await (await fetch('samples/index.json')).json();
  const box = $('samples');
  for (const s of demo.samples) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = s.title;
    b.dataset.id = s.id;
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => loadSample(s.id);
    box.appendChild(b);
  }
  await loadSample(qs.get('sample') || 'square');
}

async function loadSample(id) {
  const s = demo.samples.find((x) => x.id === id);
  if (!s) return;
  demo.sampleId = id;
  codeEl.value = await (await fetch('samples/' + s.file, { cache: 'no-store' })).text();
  for (const b of $('samples').querySelectorAll('.chip')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.id === id));
  $('art-title').textContent = s.title;
}

function currentTitle() {
  return demo.samples.find((x) => x.id === demo.sampleId)?.title || '나의 그림';
}

function applySpeed() {
  const i = +speedEl.value;
  renderer.setSpeedMultiplier(SPEEDS[i]);
  $('speed-label').textContent = SPEED_LABELS[i];
}

speedEl.oninput = applySpeed;
if (renderer.reducedMotion) {
  speedEl.value = String(SPEEDS.length - 1);
  $('rm-note').hidden = false;
}
applySpeed();

$('run').onclick = () => runCode(codeEl.value);
$('stop').onclick = () => {
  if (demo.phase === 'running') {
    clearTimeout(timer);
    startWorker();
  }
  renderer.stop();
  if (demo.phase === 'drawing') setPhase('idle');
  bubble('멈췄어요. 다시 실행해 볼까요?');
};
$('skip').onclick = () => renderer.skipToEnd();
$('grid').onclick = () => {
  const on = $('grid').getAttribute('aria-pressed') !== 'true';
  $('grid').setAttribute('aria-pressed', String(on));
  renderer.setGrid(on);
};
$('save').onclick = async () => {
  const blob = await renderer.exportPNG({ width: 800, height: 800, fit: 'content', padding: 40 });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${$('art-title').textContent || 'turtle'}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
codeEl.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = codeEl.selectionStart;
    codeEl.setRangeText('    ', s, codeEl.selectionEnd, 'end');
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runCode(codeEl.value);
  }
});

function fmt(n) {
  return n.toLocaleString('ko-KR');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// 캔버스 글씨에 쓰는 한글 웹폰트를 미리 받아 둠 (첫 write()가 글꼴을 기다리지 않게)
if (qs.get('preload') !== '0') {
  for (const f of ['16px "Gowun Dodum"', 'bold 16px "Gowun Dodum"', '16px "Jua"']) document.fonts?.load(f, '가나다 abc');
}

startWorker();
loadSamples();
