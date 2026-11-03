// P0-06 데모 자동 검증 + 측정 + 스크린샷.
//   node test/run-demo.mjs            (서버가 없으면 3106 포트로 직접 띄우고 끝나면 끔)
// 환경 변수
//   PW_CORE   playwright(-core) 모듈 경로. 기본 'playwright'(저장소 1.58.2).
//             설치된 브라우저 리비전이 다르면 그 리비전에 맞는 playwright-core 경로를 지정.
//   SKIP      쉼표 목록: cross,versions,throttle,mobile,rm 중 건너뛸 것
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.dirname(HERE);
const REPO = path.resolve(SPIKE, '../..');
const IMG = path.join(REPO, 'docs/spikes/img');
const OUT = path.join(HERE, 'out');
const BASE = 'http://127.0.0.1:3106/';
const SKIP = new Set((process.env.SKIP || '').split(',').filter(Boolean));
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const pw = await import(process.env.PW_CORE || 'playwright');
const { chromium, firefox, webkit } = pw.default || pw;

// ------------------------------------------------------------------ server
let server = null;
async function up() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}
if (!(await up())) {
  server = spawn(process.execPath, [path.join(SPIKE, 'server.mjs')], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await new Promise((r) => setTimeout(r, 100));
}
const results = { when: new Date().toISOString(), runs: {}, notes: [] };
const log = (...a) => console.log(...a);

async function newPage(browser, opts = {}, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t = Date.now();
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__demo && (window.__demo.phase === 'ready' || window.__demo.phase === 'error'), null, { timeout: 180000 });
  const init = await page.evaluate(() => window.__demo.init);
  return { ctx, page, errors, init, initWallMs: Date.now() - t };
}

async function setSpeed(page, idx) {
  await page.evaluate((s) => {
    const el = /** @type {HTMLInputElement} */ (document.getElementById('speed'));
    el.value = String(s);
    el.dispatchEvent(new Event('input'));
  }, idx);
}

async function waitDone(page, timeout = 120000) {
  await page.waitForFunction(() => ['idle', 'ready', 'error'].includes(window.__demo.phase), null, { timeout });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const d = window.__demo;
    const r = d.lastResult;
    return {
      phase: d.phase,
      metrics: d.metrics,
      stdout: r?.stdout, stderr: r?.stderr,
      turtle: r?.turtle && { ...r.turtle, turtles: r.turtle.turtles.slice(0, 3) },
      check: d.lastCheck && { ok: d.lastCheck.ok, reasons: d.lastCheck.results.flatMap((x) => x.reasons) },
      stats: d.renderer.getStats(),
      bubble: document.getElementById('bubble').textContent,
    };
  });
}

/** 예제 실행 → 완료까지 대기 */
async function runSample(page, id, speedIdx, { code } = {}) {
  await page.evaluate(async ([id, code]) => {
    await window.__demo.loadSample(id);
    if (code) /** @type {HTMLTextAreaElement} */ (document.getElementById('code')).value = code;
  }, [id, code]);
  await setSpeed(page, speedIdx);
  await page.click('#run');
  await waitDone(page);
  return snapshot(page);
}

async function shotStage(page, name) {
  const file = path.join(IMG, `P0-06-${name}.png`);
  await page.locator('.stage-card').screenshot({ path: file });
  return file;
}

const INSTANT = 6, X8 = 5, X1 = 2;
const browser = await chromium.launch();
try {
  // ---------------------------------------------------------------- 1. chromium 데스크톱
  const d = await newPage(browser, {}, '?pyodide=local');
  results.chromium = { version: browser.version(), init: d.init, initWallMs: d.initWallMs };
  log('chromium', browser.version(), 'init', d.init);
  const p = d.page;

  for (const id of ['square', 'star', 'flower', 'hangul', 'race', 'bars']) {
    const r = await runSample(p, id, X8);
    results.runs[id] = r;
    log(id.padEnd(8), 'check', r.check?.ok, 'cmds', r.turtle?.commands, 'exec', Math.round(r.metrics.execMs), 'firstInk', Math.round(r.metrics.firstInkMs), 'idle', Math.round(r.metrics.idleMs), r.stderr || '');
    if (id === 'star') await p.screenshot({ path: path.join(IMG, 'P0-06-demo.png') });
    if (['flower', 'hangul', 'race', 'bars'].includes(id)) await shotStage(p, id);
  }

  // 1-2. 나선: 1배속 애니메이션 FPS·첫 선 시간 (5초 관찰 후 바로 완성)
  {
    await p.evaluate(() => window.__demo.loadSample('spiral'));
    await setSpeed(p, X1);
    await p.click('#run');
    await p.waitForTimeout(2500);
    await shotStage(p, 'spiral-anim');
    await p.waitForTimeout(2500);
    const mid = await snapshot(p);
    await p.click('#skip');
    await waitDone(p);
    const fin = await snapshot(p);
    results.runs.spiral = { ...fin, statsAt5s: mid.stats, firstInkMs: mid.metrics.firstInkMs };
    await shotStage(p, 'spiral');
    log('spiral  ', 'firstInk', Math.round(mid.metrics.firstInkMs), 'fps', mid.stats.avgFps.toFixed(1), 'p95', mid.stats.p95FrameMs.toFixed(1), 'max', mid.stats.maxFrameMs.toFixed(1), 'work p95', mid.stats.p95WorkMs.toFixed(2));
  }

  // 1-3. CPU 4배 느리게 (저사양 기기 흉내)
  if (!SKIP.has('throttle')) {
    const cdp = await d.ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.evaluate(() => window.__demo.loadSample('spiral'));
    await setSpeed(p, X1);
    await p.click('#run');
    await p.waitForTimeout(5000);
    const mid = await snapshot(p);
    await p.click('#skip');
    await waitDone(p);
    results.runs.spiral_cpu4x = { statsAt5s: mid.stats, firstInkMs: mid.metrics.firstInkMs, execMs: (await snapshot(p)).metrics.execMs };
    log('spiral@4x', 'firstInk', Math.round(mid.metrics.firstInkMs), 'fps', mid.stats.avgFps.toFixed(1), 'p95', mid.stats.p95FrameMs.toFixed(1), 'work p95', mid.stats.p95WorkMs.toFixed(2));
    // 무거운 예제도 4배 느리게
    const h = await runSample(p, 'heavy', INSTANT);
    results.runs.heavy_cpu4x = { metrics: h.metrics, stats: h.stats };
    log('heavy@4x', 'exec', Math.round(h.metrics.execMs), 'firstInk', Math.round(h.metrics.firstInkMs), 'idle', Math.round(h.metrics.idleMs));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }

  // 1-4. 무거운 프로그램 (1만 걸음 = 명령 2만 개), 바로 그리기
  {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await runSample(p, 'heavy', INSTANT));
    const r = runs[runs.length - 1];
    const rerender = await p.evaluate(() => {
      const t = performance.now();
      window.__demo.renderer._layout();
      return performance.now() - t;
    });
    const exp = await p.evaluate(async () => {
      const t = performance.now();
      const b = await window.__demo.renderer.exportPNG({ width: 512, height: 512 });
      const ms = performance.now() - t;
      const svg = window.__demo.renderer.exportSVG();
      return { pngBytes: b.size, pngMs: ms, svgBytes: svg.length };
    });
    results.runs.heavy = { runs: runs.map((x) => ({ metrics: x.metrics, commands: x.turtle.commands, chars: x.turtle.chars, messages: x.turtle.messages })), stats: r.stats, rerenderMs: rerender, export: exp };
    await p.locator('.stage-card').screenshot({ path: path.join(OUT, 'heavy.png') });
    log('heavy   ', runs.map((x) => `exec ${Math.round(x.metrics.execMs)} firstInk ${Math.round(x.metrics.firstInkMs)} result ${Math.round(x.metrics.resultMs)} idle ${Math.round(x.metrics.idleMs)}`).join(' | '), 'cmds', r.turtle.commands, 'msgs', r.turtle.messages, 'chars', r.turtle.chars, 'rerender', rerender.toFixed(1), 'export', JSON.stringify(exp));
  }

  // 1-5. 무한 반복 (그림): 명령 한도로 멈춤
  {
    const r = await runSample(p, 'forever', INSTANT);
    results.runs.forever = r;
    log('forever ', 'result', Math.round(r.metrics.resultMs), 'idle', Math.round(r.metrics.idleMs), 'cmds', r.turtle?.commands, 'limit', r.turtle?.limit_hit, (r.stderr || '').split('\n').pop());
    await p.screenshot({ path: path.join(IMG, 'P0-06-forever.png') });
  }

  // 1-6. 오타 에러
  {
    const r = await runSample(p, 'errors', X8);
    results.runs.errors = r;
    log('errors  ', JSON.stringify(r.stderr));
    await p.locator('.editor-card').screenshot({ path: path.join(IMG, 'P0-06-error.png') });
  }

  // 1-7. 무한 반복 (그림 없음): 5초 제한 → 워커 재시작 → 다시 실행 가능
  {
    await p.evaluate(() => window.__demo.loadSample('forever_silent'));
    await setSpeed(p, X8);
    const t = Date.now();
    await p.click('#run');
    await p.waitForFunction(() => window.__demo.metrics.timeout === true, null, { timeout: 20000 });
    const stoppedMs = Date.now() - t;
    const bubbleText = await p.locator('#bubble').textContent();
    await p.waitForFunction(() => window.__demo.phase === 'ready', null, { timeout: 120000 });
    const readyMs = Date.now() - t;
    const again = await runSample(p, 'square', INSTANT);
    results.runs.forever_silent = { stoppedMs, readyAgainMs: readyMs, bubble: bubbleText, afterRestartOk: again.check?.ok };
    log('silent  ', 'stopped', stoppedMs, 'ready again', readyMs, 'square after restart', again.check?.ok);
  }

  // 1-8. stream vs batch (첫 선까지 시간) — batch는 ?stream=0
  {
    const b = await newPage(browser, {}, '?pyodide=local&stream=0');
    const rows = [];
    for (let i = 0; i < 3; i++) rows.push(await runSample(b.page, 'heavy', INSTANT));
    const spiral = await runSample(b.page, 'spiral', INSTANT);
    results.runs.heavy_batch = rows.map((x) => ({ metrics: x.metrics, chars: x.turtle.chars, messages: x.turtle.messages }));
    results.runs.spiral_batch = { metrics: spiral.metrics };
    const s2 = await runSample(p, 'spiral', INSTANT);
    results.runs.spiral_stream_instant = { metrics: s2.metrics };
    log('batch   ', rows.map((x) => `exec ${Math.round(x.metrics.execMs)} firstInk ${Math.round(x.metrics.firstInkMs)} idle ${Math.round(x.metrics.idleMs)}`).join(' | '));
    log('spiral instant: stream firstInk', Math.round(s2.metrics.firstInkMs), 'batch firstInk', Math.round(spiral.metrics.firstInkMs));
    await b.ctx.close();
  }

  // 1-9. 썸네일 내보내기 (P11-06)
  {
    await runSample(p, 'flower', INSTANT);
    const data = await p.evaluate(async () => {
      const b = await window.__demo.renderer.exportPNG({ width: 400, height: 400, fit: 'content', padding: 24 });
      const buf = new Uint8Array(await b.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
      return btoa(s);
    });
    fs.writeFileSync(path.join(IMG, 'P0-06-export-thumb.png'), Buffer.from(data, 'base64'));
    results.thumbBytes = Buffer.from(data, 'base64').length;
  }

  // 1-10. CPython 교차 검증 (Pyodide 안에서 실행한 shim vs CPython TNavigator)
  if (!SKIP.has('cross')) {
    const oracle = JSON.parse(execFileSync('python3', ['-I', path.join(HERE, 'crosscheck.py'), '--json'], { encoding: 'utf8' }));
    results.cross = { cpython: oracle.python, programs: {} };
    for (const [name, prog] of Object.entries(oracle.programs)) {
      const r = await runSample(p, 'square', INSTANT, { code: prog.src });
      const cmds = await p.evaluate(() => window.__demo.lastCommands.filter((c) => c[0] === 'm' && c[1] === 0).map((c) => [c[2], c[3]]));
      const line = (r.stdout || '').split('\n').find((l) => l.startsWith('RESULT')) || '';
      const vals = line.split(' ').slice(1).map(Number);
      const finalDiff = Math.max(...vals.map((v, i) => Math.abs(v - prog.final[i])));
      const t0 = r.turtle.turtles[0];
      const stateDiff = Math.max(Math.abs(t0.x - prog.final[0]), Math.abs(t0.y - prog.final[1]), Math.abs(t0.heading - prog.final[2]));
      let traceDiff = 0;
      for (let i = 0; i < Math.min(cmds.length, prog.trace.length); i++) {
        traceDiff = Math.max(traceDiff, Math.abs(cmds[i][0] - prog.trace[i][0]), Math.abs(cmds[i][1] - prog.trace[i][1]));
      }
      results.cross.programs[name] = { steps: prog.steps, streamMoves: cmds.length, finalDiff, stateDiff, traceDiff, stderr: r.stderr };
      log('cross   ', name.padEnd(12), 'steps', prog.steps, cmds.length, 'final', finalDiff.toExponential(2), 'state', stateDiff.toExponential(2), 'trace(2dp)', traceDiff.toFixed(4));
    }
  }
  // 1-11. API 투어: 거의 모든 지원 API를 한 번씩 (렌더러 콘솔 에러 없는지)
  {
    const code = fs.readFileSync(path.join(HERE, 'api_tour.py'), 'utf8');
    const r = await runSample(p, 'square', X8, { code });
    results.apiTour = { stderr: r.stderr, stdoutLines: (r.stdout || '').split('\n').length, commands: r.turtle?.commands };
    await p.locator('.stage-card').screenshot({ path: path.join(OUT, 'api-tour.png') });
    log('apiTour ', r.turtle?.commands, 'cmds', r.stderr ? 'ERR ' + r.stderr : 'ok');
  }
  results.chromium.consoleErrors = d.errors;
  await d.ctx.close();

  // ---------------------------------------------------------------- 2. 모바일 360
  if (!SKIP.has('mobile')) {
    const m = await newPage(browser, { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, '?pyodide=local');
    const r = await runSample(m.page, 'flower', INSTANT);
    await m.page.evaluate(() => window.scrollTo(0, 0));
    await m.page.waitForTimeout(200);
    await m.page.screenshot({ path: path.join(IMG, 'P0-06-mobile.png') });
    results.mobile = { check: r.check?.ok, errors: m.errors, dpr: 2 };
    log('mobile  ', r.check?.ok, m.errors);
    await m.ctx.close();
  }

  // ---------------------------------------------------------------- 3. prefers-reduced-motion
  if (!SKIP.has('rm')) {
    const rm = await newPage(browser, { reducedMotion: 'reduce' }, '?pyodide=local');
    const speed = await rm.page.evaluate(() => /** @type {HTMLInputElement} */ (document.getElementById('speed')).value);
    await rm.page.evaluate(() => window.__demo.loadSample('spiral'));
    await rm.page.click('#run');
    await waitDone(rm.page);
    const r = await snapshot(rm.page);
    results.reducedMotion = { sliderIndex: speed, idleMs: r.metrics.idleMs, firstInkMs: r.metrics.firstInkMs };
    log('reduced ', 'slider', speed, 'idle', Math.round(r.metrics.idleMs));
    await rm.ctx.close();
  }

  // ---------------------------------------------------------------- 4. Pyodide 버전별 (chromium)
  if (!SKIP.has('versions')) {
    results.versions = {};
    const oracle = JSON.parse(execFileSync('python3', ['-I', path.join(HERE, 'crosscheck.py'), '--json'], { encoding: 'utf8' }));
    for (const q of ['?pyodide=root', '?pyodide=cdn&ver=0.27.5', '?pyodide=cdn&ver=314.0.7']) {
      const v = await newPage(browser, {}, q);
      if (v.init?.status !== 'ready') { results.versions[q] = { error: v.errors }; log('version ', q, 'FAILED', v.errors); await v.ctx.close(); continue; }
      const star = await runSample(v.page, 'star', INSTANT);
      const prog = oracle.programs.circles;
      const r = await runSample(v.page, 'square', INSTANT, { code: prog.src });
      const t0 = r.turtle.turtles[0];
      const diff = Math.max(Math.abs(t0.x - prog.final[0]), Math.abs(t0.y - prog.final[1]), Math.abs(t0.heading - prog.final[2]));
      results.versions[q] = { init: v.init, initWallMs: v.initWallMs, starOk: star.check?.ok, circlesDiff: diff, errors: v.errors };
      log('version ', q.padEnd(26), v.init.version, 'py', v.init.python, 'init', v.init.ms, 'star', star.check?.ok, 'circlesDiff', diff.toExponential(2), v.errors.length ? v.errors : '');
      await v.ctx.close();
    }
    // classic worker + importScripts 로 314 로드 가능한지
    const c = await newPage(browser, {}, '?pyodide=local');
    results.classicWorker = await c.page.evaluate(() => new Promise((res) => {
      const base = location.origin + '/pyodide/local/';
      const src = `try { importScripts('${base}pyodide.js'); loadPyodide({ indexURL: '${base}' }).then(p => postMessage('ok ' + p.version), e => postMessage('err ' + e)); } catch (e) { postMessage('err ' + e); }`;
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = (e) => { res(e.data); w.terminate(); };
      w.onerror = (e) => res('onerror ' + e.message);
      setTimeout(() => res('timeout'), 60000);
    }));
    log('classic worker (314 importScripts):', results.classicWorker);
    await c.ctx.close();
  }
} finally {
  await browser.close();
}

// ---------------------------------------------------------------- 5. Firefox / WebKit 스모크
if (!SKIP.has('xbrowser')) {
  results.xbrowser = {};
  for (const [name, bt] of [['firefox', firefox], ['webkit', webkit]]) {
    let b;
    try {
      b = await bt.launch();
      const x = await newPage(b, {}, '?pyodide=local');
      const out = { version: b.version(), init: x.init };
      for (const id of ['square', 'star', 'hangul']) {
        const r = await runSample(x.page, id, X8);
        out[id] = { check: r.check?.ok, idleMs: Math.round(r.metrics.idleMs), stderr: r.stderr };
      }
      if (name === 'webkit') await shotStage(x.page, 'webkit-hangul');
      out.consoleErrors = x.errors;
      results.xbrowser[name] = out;
      log(name, out.version, 'init', x.init?.ms, JSON.stringify(out));
    } catch (e) {
      results.xbrowser[name] = { error: String(e).slice(0, 500) };
      log(name, 'ERROR', String(e).slice(0, 300));
    } finally {
      await b?.close();
    }
  }
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
log('\nresults ->', path.join(OUT, 'results.json'));
for (const f of fs.readdirSync(IMG).filter((f) => f.startsWith('P0-06-'))) log(f, Math.round(fs.statSync(path.join(IMG, f)).size / 1024) + 'KB');
if (server) server.kill('SIGTERM');
