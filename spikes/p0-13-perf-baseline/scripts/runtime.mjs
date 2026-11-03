// P0-13 런타임 측정 (Playwright + CDP, Chromium)
//
//   P013_WORK=<작업> node scripts/runtime.mjs pyodide [--runs 3]   퀘스트 첫 화면·Pyodide 준비·실행 지연·Worker 재시작
//   P013_WORK=<작업> node scripts/runtime.mjs frames  [--runs 3] [--rates 1,4,6] [--scenes landing,world,quest,celebration]
//
// - 태블릿 820×1180 DPR 2 (터치, 안드로이드 태블릿 UA). 매 회 새 컨텍스트(HTTP 캐시 없음)
// - CPU 스로틀은 CDP Emulation.setCPUThrottlingRate(페이지 메인 스레드만. Worker에는 적용 불가 → Pyodide 초기화는 스로틀 안 됨)
// - 프레임 = 페이지 rAF 간격(메인 스레드 기준) + Long Animation Frames + Long Tasks + CDP Performance.getMetrics
//   (스크롤·축하 장면은 Chrome trace의 PipelineReporter로 컴포지터가 실제로 내보낸 프레임도 함께 집계)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { APP, CHROME, QUEST, RAW, SPIKE, STAGE1_LAST_ANSWER, USERS, ensureUser, machineState, median, pct, r0, r1, resetCeleb, sessionCookies, spread, waitQuiet, writeJSON } from './lib.mjs';

const [mode = 'pyodide', ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.reduce((a, x, i, arr) => (x.startsWith('--') ? [...a, [x.slice(2), arr[i + 1]]] : a), []));
const RUNS = Number(args.runs ?? 3);
const OUT = path.resolve(SPIKE, 'results', args.out ?? `runtime-${mode}.json`);
const TRACE_DIR = path.join(RAW, 'traces');
fs.mkdirSync(TRACE_DIR, { recursive: true });

export const DEVICES = {
  tabletLandscape: { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36' },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X210) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36' },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A256N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36' },
};

// 문서 시작 시 주입: Worker 메시지 시각, FCP/LCP/롱태스크/LoAF/CLS, 에디터·실행 버튼 준비 시각, rAF 기록기
export const INIT = `(() => {
  const S = (window.__p = { workers: [], lt: [], loaf: [], lcp: [], cls: 0, fcp: null, marks: {} });
  const W = window.Worker;
  if (W) {
    window.Worker = function (url, opts) {
      const w = new W(url, opts);
      const rec = { url: String(url), created: performance.now(), msgs: [] };
      S.workers.push(rec);
      w.addEventListener('message', (e) => { const d = e.data || {}; rec.msgs.push({ t: performance.now(), type: d.type, status: d.status }); });
      return w;
    };
    window.Worker.prototype = W.prototype;
  }
  const obs = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) {} };
  obs('paint', (e) => { if (e.name === 'first-contentful-paint') S.fcp = e.startTime; });
  obs('largest-contentful-paint', (e) => S.lcp.push({ t: e.startTime, size: e.size, el: e.element ? (e.element.tagName + (e.element.id ? '#' + e.element.id : '') + ' "' + (e.element.textContent || '').trim().slice(0, 30) + '"') : null }));
  obs('longtask', (e) => S.lt.push({ t: e.startTime, d: e.duration }));
  obs('long-animation-frame', (e) => S.loaf.push({ t: e.startTime, d: e.duration, b: e.blockingDuration, s: (e.scripts || []).slice(0, 2).map((x) => (x.sourceURL || '').split('/').pop() + ':' + (x.sourceFunctionName || x.invoker || '')) }));
  obs('layout-shift', (e) => { if (!e.hadRecentInput) S.cls += e.value; });
  const iv = setInterval(() => {
    if (S.marks.editor == null && document.querySelector('.cm-content')) S.marks.editor = performance.now();
    if (S.marks.runEnabled == null && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('코드 돌려보기') && !b.disabled)) S.marks.runEnabled = performance.now();
    if ((S.marks.editor != null && S.marks.runEnabled != null) || performance.now() > 180000) clearInterval(iv);
  }, 50);
  window.__rec = {
    start() { this.f = []; this.on = true; this.t0 = performance.now(); const loop = (t) => { if (!this.on) return; this.f.push(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); },
    stop() {
      this.on = false;
      const t1 = performance.now();
      const iv = []; for (let i = 1; i < this.f.length; i++) iv.push(this.f[i] - this.f[i - 1]);
      const inWin = (x) => x.t >= this.t0 && x.t <= t1;
      return { dur: t1 - this.t0, frames: this.f.length, iv, lt: S.lt.filter(inWin), loaf: S.loaf.filter(inWin), heap: performance.memory ? performance.memory.usedJSHeapSize : null };
    },
  };
})();`;

// --reduced 1 이면 prefers-reduced-motion: reduce (현재 앱의 감속 경로 = 저사양 'minimal' 단계의 하한선 참고값)
const REDUCED = args.reduced === '1';
export async function newContext(browser, device, user) {
  const ctx = await browser.newContext({ ...DEVICES[device], locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: REDUCED ? 'reduce' : 'no-preference' });
  if (user) await ctx.addCookies(await sessionCookies(user));
  await ctx.addInitScript(INIT);
  return ctx;
}

export const launch = () =>
  chromium.launch({ executablePath: CHROME, headless: true, args: ['--lang=ko-KR', '--enable-precise-memory-info', '--no-sandbox'] });

async function setThrottle(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await cdp.send('Performance.enable');
  return cdp;
}
const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

export async function waitRunEnabled(page, timeout = 180000) {
  await page.waitForFunction(() => window.__p.marks.runEnabled != null, null, { timeout, polling: 100 });
}
export async function setCode(page, code) {
  await page.click('.cm-content');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}
async function clickRunAndWait(page, marker) {
  return page.evaluate(
    (marker) =>
      new Promise((resolve, reject) => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('코드 돌려보기') && !b.disabled);
        if (!btn) return reject(new Error('run button not ready'));
        const t0 = performance.now();
        const to = setTimeout(() => reject(new Error('output timeout')), 30000);
        const mo = new MutationObserver(() => {
          if (document.body.textContent.includes(marker)) {
            mo.disconnect();
            clearTimeout(to);
            const dom = performance.now() - t0;
            requestAnimationFrame(() => setTimeout(() => resolve({ dom, paint: performance.now() - t0 }), 0));
          }
        });
        mo.observe(document.body, { childList: true, subtree: true, characterData: true });
        btn.click();
      }),
    marker,
  );
}

function frameStats(rec, m0, m1) {
  const iv = rec.iv;
  const d = m1 && m0 ? { task: m1.TaskDuration - m0.TaskDuration, script: m1.ScriptDuration - m0.ScriptDuration, layout: m1.LayoutDuration - m0.LayoutDuration, style: m1.RecalcStyleDuration - m0.RecalcStyleDuration } : {};
  return {
    durMs: r0(rec.dur),
    fps: rec.frames > 1 ? r1(((rec.frames - 1) / rec.dur) * 1000) : 0,
    p50: r1(pct(iv, 50)),
    p95: r1(pct(iv, 95)),
    p99: r1(pct(iv, 99)),
    max: r1(Math.max(0, ...iv)),
    jankPct: iv.length ? r1((iv.filter((x) => x > 20).length / iv.length) * 100) : null, // 60Hz 한 번 이상 놓친 프레임 비율
    longTasks: rec.lt.length,
    longTaskMs: r0(rec.lt.reduce((s, x) => s + x.d, 0)),
    loaf: rec.loaf.length,
    loafBlockingMs: r0(rec.loaf.reduce((s, x) => s + (x.b ?? 0), 0)),
    loafTop: rec.loaf.sort((a, b) => b.d - a.d).slice(0, 3).map((x) => `${r0(x.d)}ms ${x.s.join(',')}`),
    mainBusyPct: d.task != null ? r1((d.task * 1000 * 100) / rec.dur) : null,
    scriptMs: d.script != null ? r0(d.script * 1000) : null,
    layoutStyleMs: d.layout != null ? r0((d.layout + d.style) * 1000) : null,
    heapMB: m1 ? r1(m1.JSHeapUsedSize / 1048576) : rec.heap ? r1(rec.heap / 1048576) : null,
  };
}

// trace 의 PipelineReporter(프레임 단위) 상태 집계: 컴포지터가 실제로 화면에 낸 프레임
function pipelineFrames(traceBuf, fromUs, toUs) {
  let ev;
  try {
    ev = JSON.parse(traceBuf.toString()).traceEvents;
  } catch {
    return null;
  }
  const st = {};
  const seen = new Set();
  for (const e of ev) {
    if (e.name !== 'PipelineReporter' || e.ph !== 'b') continue;
    if (fromUs && (e.ts < fromUs || e.ts > toUs)) continue;
    const r = e.args?.frame_reporter ?? e.args?.chrome_frame_reporter;
    if (!r) continue;
    const key = `${e.pid}:${r.frame_source}:${r.frame_sequence}`;
    if (seen.has(key)) continue;
    seen.add(key);
    st[r.state] = (st[r.state] ?? 0) + 1;
    if (r.affects_smoothness) st.smooth = (st.smooth ?? 0) + 1;
    if (r.affects_smoothness && r.state === 'STATE_DROPPED') st.smoothDropped = (st.smoothDropped ?? 0) + 1;
  }
  const presented = (st.STATE_PRESENTED_ALL ?? 0) + (st.STATE_PRESENTED_PARTIAL ?? 0);
  const dropped = st.STATE_DROPPED ?? 0;
  return { ...st, presented, dropped, droppedPct: presented + dropped ? r1((dropped / (presented + dropped)) * 100) : null };
}

// ── 장면별 프레임 측정 ───────────────────────────────────────
async function record(page, cdp, fn, { trace = false, browser } = {}) {
  if (trace) await browser.startTracing(page, { categories: ['benchmark', 'cc', 'disabled-by-default-devtools.timeline.frame', 'viz'] });
  const m0 = await metrics(cdp);
  await page.evaluate(() => window.__rec.start());
  await fn();
  const rec = await page.evaluate(() => window.__rec.stop());
  const m1 = await metrics(cdp);
  const s = frameStats(rec, m0, m1);
  if (trace) {
    const buf = await browser.stopTracing();
    s.compositor = pipelineFrames(buf);
    if (s.compositor && rec.dur) s.compositor.fps = r1((s.compositor.presented / rec.dur) * 1000);
  }
  return s;
}

async function scrollGesture(page, cdp) {
  const { dist, w, h } = await page.evaluate(() => ({ dist: document.scrollingElement.scrollHeight - innerHeight, w: innerWidth, h: innerHeight }));
  if (dist < 50) return 0;
  // 터치 스와이프 아래로 → 위로, 2회 (800px/s). Telemetry 스크롤 벤치마크와 같은 입력 경로
  for (let k = 0; k < 2; k++) {
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(w / 2), y: Math.round(h * 0.8), yDistance: -dist, speed: 800, gestureSourceType: 'touch' });
    await page.waitForTimeout(200);
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(w / 2), y: Math.round(h * 0.2), yDistance: dist, speed: 800, gestureSourceType: 'touch' });
    await page.waitForTimeout(200);
  }
  return dist;
}

const SCENES = {
  async landing(browser, rate) {
    const ctx = await newContext(browser, 'tablet', null);
    const page = await ctx.newPage();
    const cdp = await setThrottle(page, rate);
    await page.goto(APP + '/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const idle = await record(page, cdp, () => page.waitForTimeout(4000));
    let dist = 0;
    const scroll = await record(page, cdp, async () => (dist = await scrollGesture(page, cdp)), { trace: true, browser });
    await ctx.close();
    return { idle, scroll: { ...scroll, distPx: dist } };
  },
  async world(browser, rate) {
    const ctx = await newContext(browser, 'tablet', 'perf');
    const page = await ctx.newPage();
    const cdp = await setThrottle(page, rate);
    await page.goto(APP + '/world', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    const idle = await record(page, cdp, () => page.waitForTimeout(4000));
    await ctx.close();
    // 현재 월드맵은 태블릿 세로(820×1180)에서 한 화면에 다 들어가 스크롤이 없음 → 가로(1180×820)에서 스크롤 측정
    const ctx2 = await newContext(browser, 'tabletLandscape', 'perf');
    const page2 = await ctx2.newPage();
    const cdp2 = await setThrottle(page2, rate);
    await page2.goto(APP + '/world', { waitUntil: 'load' });
    await page2.waitForTimeout(2000);
    let dist = 0;
    const scroll = await record(page2, cdp2, async () => (dist = await scrollGesture(page2, cdp2)), { trace: true, browser });
    await ctx2.close();
    return { idle, scroll: { ...scroll, distPx: dist, viewport: '1180x820' } };
  },
  async quest(browser, rate) {
    const ctx = await newContext(browser, 'tablet', 'newbie');
    const page = await ctx.newPage();
    const cdp = await setThrottle(page, rate);
    await page.goto(APP + `/quest/${QUEST.first}`, { waitUntil: 'commit' });
    await waitRunEnabled(page);
    const load = await page.evaluate(() => {
      const S = window.__p;
      const ready = S.marks.runEnabled;
      const lt = S.lt.filter((x) => x.t <= ready);
      return { readyMs: ready, longTasks: lt.length, longTaskMs: lt.reduce((s, x) => s + x.d, 0), maxLongTask: Math.max(0, ...lt.map((x) => x.d)) };
    });
    await page.waitForTimeout(1000);
    const idle = await record(page, cdp, () => page.waitForTimeout(5000));
    await ctx.close();
    return { loadToReady: { readyMs: r0(load.readyMs), longTasks: load.longTasks, longTaskMs: r0(load.longTaskMs), maxLongTaskMs: r0(load.maxLongTask) }, idle };
  },
  async celebration(browser, rate) {
    resetCeleb(await ensureUser('celeb'));
    const ctx = await newContext(browser, 'tablet', 'celeb');
    const page = await ctx.newPage();
    const cdp = await setThrottle(page, rate);
    await page.goto(APP + `/quest/${QUEST.stage1Last}`, { waitUntil: 'commit' });
    await waitRunEnabled(page);
    await page.waitForTimeout(800);
    await setCode(page, STAGE1_LAST_ANSWER);
    await page.waitForTimeout(500);
    // A: 실행 클릭 → 정답 → 컨페티 → 1초 뒤 스테이지 클리어 오버레이(Lottie + 컨페티 3발)
    const stage = await record(
      page,
      cdp,
      async () => {
        await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('코드 돌려보기')).click());
        await page.waitForTimeout(7000);
      },
      { trace: true, browser },
    );
    const sawStage = await page.evaluate(() => document.body.textContent.includes('완료!'));
    // B: "다음 모험으로!" → 레벨업 오버레이(Lottie + 컨페티 4발)
    let level = null;
    try {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('다음 모험으로') && !b.disabled), null, { timeout: 30000 });
      level = await record(
        page,
        cdp,
        async () => {
          await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('다음 모험으로')).click());
          await page.waitForTimeout(5000);
        },
        { trace: true, browser },
      );
      level.sawLevelUp = true;
    } catch (e) {
      level = { error: e.message };
    }
    await ctx.close();
    return { stage: { ...stage, sawStage }, level };
  },
};

// ── 퀘스트 첫 화면·Pyodide ───────────────────────────────────
async function pyodideRun(browser, { rate = 1, net = null }) {
  const ctx = await newContext(browser, 'tablet', 'newbie');
  const page = await ctx.newPage();
  const cdp = await setThrottle(page, rate);
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
  const reqs = [];
  page.on('requestfinished', async (r) => {
    if (!/jsdelivr|pyodide/.test(r.url())) return;
    const s = await r.sizes().catch(() => null);
    reqs.push({ url: r.url(), start: r.timing().startTime, end: r.timing().startTime + r.timing().responseEnd, kb: s ? r1(s.responseBodySize / 1024) : null });
  });
  const t0 = Date.now();
  await page.goto(APP + `/quest/${QUEST.first}`, { waitUntil: 'commit' });
  await waitRunEnabled(page);
  const p = await page.evaluate(() => {
    const S = window.__p;
    const nav = performance.getEntriesByType('navigation')[0];
    const w = S.workers[0];
    const loading = w?.msgs.find((m) => m.status === 'loading')?.t;
    const ready = w?.msgs.find((m) => m.status === 'ready')?.t;
    return {
      timeOrigin: performance.timeOrigin,
      ttfb: nav.responseStart,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      fcp: S.fcp,
      lcp: S.lcp.at(-1)?.t,
      lcpEl: S.lcp.at(-1)?.el,
      editor: S.marks.editor,
      workerCreated: w?.created,
      workerLoading: loading,
      workerReady: ready,
      runEnabled: S.marks.runEnabled,
      longTasksToReady: S.lt.filter((x) => x.t <= S.marks.runEnabled).length,
      longTaskMsToReady: S.lt.filter((x) => x.t <= S.marks.runEnabled).reduce((s, x) => s + x.d, 0),
    };
  });
  const lastByte = Math.max(...reqs.map((r) => r.end)) - p.timeOrigin;
  const cdnKB = reqs.reduce((s, r) => s + (r.kb ?? 0), 0);
  // 실행 → 출력 (5회, 첫 회는 파이썬 첫 실행 비용 포함)
  const runs = [];
  if (!net) {
    for (let i = 0; i < 5; i++) {
      const n = 7 + i;
      await setCode(page, `print("P013-" + str(${n}*6))\n`);
      await page.waitForTimeout(300);
      runs.push(await clickRunAndWait(page, `P013-${n * 6}`));
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('코드 돌려보기') && !b.disabled), null, { timeout: 30000 });
      await page.waitForTimeout(800);
    }
  }
  const heap = (await metrics(cdp)).JSHeapUsedSize;
  // 같은 컨텍스트에서 다시 열기 (HTTP 캐시 있음)
  let warm = null;
  let reinit = [];
  if (!net) {
    await page.goto(APP + `/quest/${QUEST.first}`, { waitUntil: 'commit' });
    await waitRunEnabled(page);
    warm = await page.evaluate(() => {
      const w = window.__p.workers[0];
      return { runEnabled: window.__p.marks.runEnabled, initToReady: w.msgs.find((m) => m.status === 'ready').t - w.created, workerCreated: w.created };
    });
    // Worker 재시작 비용 (시간 초과·재시도 경로와 같은 방식: 새 Worker + init)
    for (let i = 0; i < 3; i++) {
      reinit.push(
        await page.evaluate(
          () =>
            new Promise((res) => {
              const t0 = performance.now();
              const w = new Worker('/workers/pyodide-worker.js');
              w.onmessage = (e) => {
                if (e.data?.status === 'ready') {
                  const d = performance.now() - t0;
                  w.terminate();
                  res(d);
                }
              };
              w.postMessage({ type: 'init' });
            }),
        ),
      );
    }
  }
  await ctx.close();
  return {
    rate,
    net: net ? 'slow4g' : 'none',
    wallMs: Date.now() - t0,
    ttfb: r0(p.ttfb),
    fcp: r0(p.fcp),
    lcp: r0(p.lcp),
    lcpEl: p.lcpEl,
    dcl: r0(p.dcl),
    load: r0(p.load),
    editor: r0(p.editor),
    workerCreated: r0(p.workerCreated),
    workerInitToReady: r0(p.workerReady - p.workerCreated),
    pyodideLastByte: r0(lastByte),
    pyodideCpuAfterDownload: r0(p.workerReady - lastByte),
    runEnabled: r0(p.runEnabled),
    longTasksToReady: p.longTasksToReady,
    longTaskMsToReady: r0(p.longTaskMsToReady),
    cdnKB: r0(cdnKB),
    cdn: reqs.map((r) => ({ file: r.url.split('/').pop(), kb: r.kb, ms: r0(r.end - r.start) })),
    runFirst: runs[0] ? { dom: r0(runs[0].dom), paint: r0(runs[0].paint) } : null,
    runNext: runs.length > 1 ? { dom: r0(median(runs.slice(1).map((x) => x.dom))), paint: r0(median(runs.slice(1).map((x) => x.paint))) } : null,
    heapMB: r1(heap / 1048576),
    warm: warm && { runEnabled: r0(warm.runEnabled), workerCreated: r0(warm.workerCreated), initToReady: r0(warm.initToReady) },
    reinitMs: reinit.map(r0),
  };
}

const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) await main();

async function main() {
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { batches: {} };
const browser = await launch();
existing.browser = browser.version();
try {
  if (mode === 'pyodide') {
    const plans = (args.plans ?? '1x,4x,slow4g').split(',');
    const PLAN = { '1x': { rate: 1 }, '4x': { rate: 4 }, '6x': { rate: 6 }, slow4g: { rate: 1, net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } } };
    for (const plan of plans) {
      const quiet = await waitQuiet({ label: `pyodide ${plan}`, maxMin: Number(process.env.P013_MAX_WAIT_MIN_NEXT ?? 15) });
      const runs = [];
      for (let i = 1; i <= RUNS; i++) {
        const before = machineState();
        try {
          const r = await pyodideRun(browser, PLAN[plan]);
          runs.push({ i, load1: before.load1, ...r });
          console.log(`[pyodide] ${plan} #${i} fcp=${r.fcp} lcp=${r.lcp} editor=${r.editor} worker=${r.workerCreated} init→ready=${r.workerInitToReady} lastByte=${r.pyodideLastByte} runEnabled=${r.runEnabled} run1=${r.runFirst?.paint} runN=${r.runNext?.paint} warm=${r.warm?.initToReady} reinit=${r.reinitMs} cdnKB=${r.cdnKB} load=${before.load1}`);
        } catch (e) {
          console.log(`[pyodide] ${plan} #${i} FAILED ${e.message}`);
          runs.push({ i, error: e.message });
        }
      }
      const ok = runs.filter((r) => !r.error);
      const keys = ['ttfb', 'fcp', 'lcp', 'editor', 'workerCreated', 'workerInitToReady', 'pyodideLastByte', 'pyodideCpuAfterDownload', 'runEnabled', 'longTasksToReady', 'longTaskMsToReady', 'cdnKB', 'heapMB'];
      const med = Object.fromEntries(keys.map((k) => [k, r0(median(ok.map((r) => r[k])))]));
      med.runFirstPaint = r0(median(ok.map((r) => r.runFirst?.paint)));
      med.runNextPaint = r0(median(ok.map((r) => r.runNext?.paint)));
      med.warmInitToReady = r0(median(ok.map((r) => r.warm?.initToReady)));
      med.warmRunEnabled = r0(median(ok.map((r) => r.warm?.runEnabled)));
      med.reinit = r0(median(ok.flatMap((r) => r.reinitMs ?? [])));
      const spr = Object.fromEntries(['runEnabled', 'workerInitToReady', 'lcp'].map((k) => [k, spread(ok.map((r) => r[k]))]));
      existing.batches[plan] = { plan, quiet, loadAfter: machineState(), median: med, spread: spr, runs };
      writeJSON(OUT, existing);
    }
  } else {
    const rates = (args.rates ?? '1,4,6').split(',').map(Number);
    const scenes = (args.scenes ?? 'landing,world,quest,celebration').split(',');
    for (const scene of scenes) {
      for (const rate of rates) {
        const quiet = await waitQuiet({ label: `frames ${scene} ${rate}x${REDUCED ? ' rm' : ''}`, maxMin: Number(process.env.P013_MAX_WAIT_MIN_NEXT ?? 15) });
        const runs = [];
        for (let i = 1; i <= RUNS; i++) {
          const before = machineState();
          try {
            const r = await SCENES[scene](browser, rate);
            runs.push({ i, load1: before.load1, ...r });
            const brief = Object.entries(r)
              .map(([k, v]) => (v && v.p95 != null ? `${k}: fps=${v.fps} p50=${v.p50} p95=${v.p95} jank=${v.jankPct}% lt=${v.longTasks}/${v.longTaskMs}ms busy=${v.mainBusyPct}%${v.compositor ? ` comp=${v.compositor.fps}fps drop=${v.compositor.droppedPct}%` : ''}` : `${k}: ${JSON.stringify(v)}`))
              .join(' | ');
            console.log(`[frames] ${scene} ${rate}x #${i} load=${before.load1} ${brief}`);
          } catch (e) {
            console.log(`[frames] ${scene} ${rate}x #${i} FAILED ${e.message}`);
            runs.push({ i, error: e.message });
          }
        }
        const ok = runs.filter((r) => !r.error);
        const parts = ok.length ? Object.keys(ok[0]).filter((k) => typeof ok[0][k] === 'object' && ok[0][k] && (ok[0][k].p95 != null || ok[0][k].readyMs != null)) : [];
        const summary = {};
        for (const part of parts) {
          const xs = ok.map((r) => r[part]).filter((x) => x && !x.error);
          const fields = Object.keys(xs[0]).filter((k) => typeof xs[0][k] === 'number');
          summary[part] = Object.fromEntries(fields.map((f) => [f, r1(median(xs.map((x) => x[f])))]));
          if (xs[0].compositor) summary[part].compositorFps = r1(median(xs.map((x) => x.compositor?.fps)));
          if (xs[0].compositor) summary[part].compositorDroppedPct = r1(median(xs.map((x) => x.compositor?.droppedPct)));
          if (xs[0].p95 != null) summary[part].p95Spread = spread(xs.map((x) => x.p95));
        }
        existing.batches[`${scene}:${rate}x${REDUCED ? ':rm' : ''}`] = { scene, rate, reducedMotion: REDUCED, quiet, loadAfter: machineState(), median: summary, runs };
        writeJSON(OUT, existing);
      }
    }
  }
} finally {
  await browser.close();
}
console.log(`[runtime] → ${OUT}`);
}
