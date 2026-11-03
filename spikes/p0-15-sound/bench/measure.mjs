// Playwright 측정 (소리는 못 듣지만 상태 전이·디코드 시간·start() 호출 시점·콘솔 오류는 잴 수 있다)
// 사용: npm run serve (다른 터미널) → node bench/measure.mjs [chromium firefox webkit] [--quick]
// 결과: results/<browser>.json, 콘솔 요약
import { chromium, firefox, webkit } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3115';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const names = args.filter((a) => !a.startsWith('--'));
const TARGETS = names.length ? names : ['chromium', 'firefox', 'webkit'];
const SFX = ['tap', 'correct', 'wrong', 'coin', 'star', 'run', 'blip', 'unlock', 'bug', 'chest', 'levelup', 'celebrate'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launch(name) {
  if (name === 'chromium') {
    // 데스크톱 Chrome 기본 정책과 같게 (사용자 활성화 필요)
    return chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] });
  }
  if (name === 'firefox') {
    // Firefox 릴리스 기본값: 소리 있는 자동재생 차단 + Web Audio도 차단
    return firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 1, 'media.autoplay.block-webaudio': true } });
  }
  // Linux에서 시스템 라이브러리가 없으면 WK_EXECUTABLE로 래퍼 경로를 지정 (보고서 §8 참고)
  return webkit.launch(process.env.WK_EXECUTABLE ? { executablePath: process.env.WK_EXECUTABLE } : {});
}

function stats(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, median: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +s.at(-1).toFixed(2), min: +s[0].toFixed(2) };
}

function attachConsole(page, bucket) {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') bucket.push(`${m.type()}: ${m.text().slice(0, 240)}`);
  });
  page.on('pageerror', (e) => bucket.push(`pageerror: ${String(e).slice(0, 240)}`));
}

/** 제스처별 첫 start() 지연 (같은 gestureTs의 첫 start만) */
function latencies(P, filter = () => true) {
  const seen = new Set();
  const out = [];
  for (const s of P.starts) {
    if (s.gestureTs === null || seen.has(s.gestureTs) || !filter(s)) continue;
    seen.add(s.gestureTs);
    out.push(s.t - s.gestureTs);
  }
  return out;
}

async function engineRun(browser, engine, { cpu = 1, touch = false, idleTest = false } = {}) {
  const ctx = await browser.newContext(touch ? { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } } : {});
  const page = await ctx.newPage();
  const consoleMsgs = [];
  attachConsole(page, consoleMsgs);
  if (cpu > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  const r = { engine, cpu, touch, steps: {} };
  await page.goto(`${BASE}/?engine=${engine}`);
  await sleep(800);
  const P0 = await page.evaluate(() => structuredClone(window.__p015));
  r.steps.beforeGesture = {
    ctxCreated: P0.ctxCreated,
    notes: P0.notes,
    hasAudioSession: await page.evaluate(() => 'audioSession' in navigator),
    userActivationApi: await page.evaluate(() => 'userActivation' in navigator),
  };

  // 1) 첫 제스처: 탭 효과음 버튼
  const sel = (id) => `#sfx button[data-sfx="${id}"]`;
  if (touch) await page.tap(sel('tap'));
  else await page.click(sel('tap'));
  await sleep(1200);
  let P = await page.evaluate(() => structuredClone(window.__p015));
  const g0 = P.gestures[0];
  const running = [...P.ctxCreated.filter((c) => c.state === 'running').map((c) => c.t), ...P.states.filter((s) => s.state === 'running').map((s) => s.t)];
  const coreDecodes = P.metrics.filter((m) => m.type === 'decode');
  r.steps.firstGesture = {
    gestureType: g0?.type,
    ctxCreatedInGesture: P.ctxCreated.map((c) => c.inGesture),
    ctxCount: P.ctxCreated.length,
    ctxInitialState: P.ctxCreated.map((c) => c.state),
    sampleRate: P.ctxCreated.at(-1)?.sampleRate,
    baseLatency: P.ctxCreated.at(-1)?.baseLatency,
    gestureToRunningMs: running.length && g0 ? +(Math.min(...running) - g0.ts).toFixed(2) : null,
    firstStartMs: P.starts[0] && g0 ? +(P.starts[0].t - g0.ts).toFixed(2) : null,
    firstSoundPlayed: P.starts.some((s) => s.gestureTs === g0?.ts),
    drops: P.metrics.filter((m) => m.type === 'drop'),
    decodesSoFar: P.decodes.length,
    lastDecodeAfterGestureMs: P.decodes.length && g0 ? +(Math.max(...P.decodes.map((d) => d.t)) - g0.ts).toFixed(1) : null,
    audioSessionType: await page.evaluate(() => navigator.audioSession?.type ?? null),
  };
  await sleep(QUICK ? 800 : 2000);

  // 2) 디코드 (파일별)
  P = await page.evaluate(() => structuredClone(window.__p015));
  r.steps.decode = {
    api: stats(P.decodes.filter((d) => !d.error).map((d) => d.ms)),
    errors: P.decodes.filter((d) => d.error).map((d) => d.error),
    perFile: P.metrics.filter((m) => m.type === 'decode').map((m) => ({ id: m.id, src: m.src.split('/').pop(), ms: +m.ms.toFixed(2), bytes: m.bytes, duration: +m.duration.toFixed(3) })),
    count: P.decodes.length,
  };

  // 3) 반복 클릭 지연 (pointerdown → AudioBufferSourceNode.start 호출)
  const reps = QUICK ? 12 : 30;
  for (let i = 0; i < reps; i++) {
    const id = SFX[i % SFX.length];
    if (touch) await page.tap(sel(id));
    else await page.click(sel(id));
    await sleep(120);
  }
  await sleep(500);
  P = await page.evaluate(() => structuredClone(window.__p015));
  const g0ts = P.gestures[0]?.ts;
  r.steps.latency = {
    pointerdownToStart: stats(latencies(P, (s) => s.gestureTs !== g0ts && !['star3', 'coin-burst'].includes(s.gestureId))),
    missing: P.gestures.filter((g) => g.ts !== g0ts && !P.starts.some((s) => s.gestureTs === g.ts)).length,
    debug: await page.evaluate(() => window.__engine.debug()),
  };

  // 4) 코인 10연타 (30ms 간격) → 동시 재생 상한 6
  const before = P.starts.length;
  await page.click('#coins');
  const samples = [];
  for (let i = 0; i < 6; i++) {
    await sleep(60);
    samples.push(await page.evaluate(() => { const d = window.__engine.debug(); return d.voicesById ? d.voicesById.coin ?? 0 : d.voices; }));
  }
  await sleep(400);
  P = await page.evaluate(() => structuredClone(window.__p015));
  r.steps.coinBurst = { starts: P.starts.length - before, voicesSampled: samples, errors: consoleMsgs.length };

  // 5) BGM: 켜기 → 월드1 → 월드2 크로스페이드
  await page.click('#bgm-on');
  await page.click('#bgm-world1');
  await sleep(1500);
  const w1 = await page.evaluate(() => ({ snap: window.__engine.getSnapshot(), dbg: window.__engine.debug() }));
  await page.click('#bgm-world2');
  await sleep(400);
  const mid = await page.evaluate(() => window.__engine.debug());
  await sleep(1000);
  const w2 = await page.evaluate(() => ({ snap: window.__engine.getSnapshot(), dbg: window.__engine.debug() }));
  P = await page.evaluate(() => structuredClone(window.__p015));
  r.steps.bgm = {
    world1: { playing: w1.snap.playingBgm, dbg: w1.dbg },
    crossfadeAt400ms: mid,
    world2: { playing: w2.snap.playingBgm, dbg: w2.dbg },
    bgmPlayingMetrics: P.metrics.filter((m) => m.type === 'bgm-playing'),
    bgmErrors: P.metrics.filter((m) => m.type === 'decode-error'),
  };

  // 6) 가시성: hidden → BGM 정지 + suspend / visible → 복귀
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(700);
  const hidden = await page.evaluate(() => ({ snap: window.__engine.getSnapshot(), dbg: window.__engine.debug() }));
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(1200);
  const visible = await page.evaluate(() => ({ snap: window.__engine.getSnapshot(), dbg: window.__engine.debug() }));
  r.steps.visibility = {
    hidden: { state: hidden.snap.state, playingBgm: hidden.snap.playingBgm, ctxState: hidden.dbg.ctxState, bgm: hidden.dbg.bgmGains },
    visible: { state: visible.snap.state, playingBgm: visible.snap.playingBgm, ctxState: visible.dbg.ctxState, bgm: visible.dbg.bgmGains },
  };

  // 7) 음소거
  await page.click('#mute');
  await sleep(300);
  const muted = await page.evaluate(() => window.__engine.getSnapshot());
  const n0 = (await page.evaluate(() => window.__p015.starts.length));
  await page.click(sel('correct'));
  await sleep(200);
  const n1 = (await page.evaluate(() => window.__p015.starts.length));
  await page.click('#mute');
  r.steps.mute = { playingBgmWhileMuted: muted.playingBgm, startsWhileMuted: n1 - n0, persisted: await page.evaluate((k) => localStorage.getItem(k), 'p015:sound:' + engine) };

  // 8) (선택) 30초 무음 후 첫 소리 지연: Howler autoSuspend 영향
  if (idleTest) {
    await page.click('#bgm-stop');
    await page.click('#bgm-on');
    await sleep(31500);
    const before2 = await page.evaluate(() => window.__p015.starts.length);
    const ctxStateBefore = await page.evaluate(() => window.__engine.debug().ctxState);
    await page.click(sel('correct'));
    await sleep(800);
    P = await page.evaluate(() => structuredClone(window.__p015));
    const g = P.gestures.at(-1);
    const st = P.starts.slice(before2).find((s) => s.gestureTs === g.ts);
    r.steps.afterIdle31s = { ctxStateBefore, latencyMs: st ? +(st.t - g.ts).toFixed(2) : null };
  }

  r.console = consoleMsgs;
  await ctx.close();
  return r;
}

async function activationProbe(browser) {
  // 터치에서 어떤 이벤트가 사용자 활성화인지 (navigator.userActivation.isActive)
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/gap.html`);
  const res = await page.evaluate(() => {
    const out = [];
    for (const t of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'click']) {
      window.addEventListener(t, (e) => out.push(`${t}(${e.pointerType ?? '-'}):${navigator.userActivation ? navigator.userActivation.isActive : 'n/a'}`), { capture: true });
    }
    window.__act = out;
    return 'userActivation' in navigator;
  });
  await page.tap('#run').catch(() => {});
  await sleep(300);
  const seq = await page.evaluate(() => window.__act);
  await ctx.close();
  return { hasUserActivation: res, sequence: seq };
}

async function probeBeforeGesture(browser) {
  // 페이지 스크립트가 제스처 없이 AudioContext·<audio>를 시작해 보는 결과 (gap.html?probe=1)
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const msgs = [];
  attachConsole(page, msgs);
  await page.goto(`${BASE}/gap.html?probe=1`);
  await page.waitForFunction(() => window.__probe, null, { timeout: 5000 }).catch(() => {});
  const probe = await page.evaluate(() => window.__probe ?? null);
  await ctx.close();
  return { ...probe, console: msgs };
}

async function gapRun(browser, cpu = 1, opts = {}) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const msgs = [];
  attachConsole(page, msgs);
  if (cpu > 1) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await page.goto(`${BASE}/gap.html`);
  await page.click('#run'); // 제스처 (runGap은 클릭 핸들러에서 시작)
  await page.waitForFunction(() => window.__gap?.done === true, null, { timeout: 180000 }).catch(() => {});
  const r = await page.evaluate(() => structuredClone(window.__gap));
  await ctx.close();
  void opts;
  return { ...r, console: msgs };
}

async function reactRun(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const msgs = [];
  attachConsole(page, msgs);
  await page.goto(`${BASE}/react.html`);
  await sleep(500);
  const before = await page.evaluate(() => ({ ctx: window.__p015.ctxCreated.length, text: document.getElementById('r-state')?.textContent }));
  await page.click('#r-run');
  await sleep(800);
  await page.click('#r-bgm');
  await page.click('#r-w1');
  await sleep(1500);
  const w1 = await page.evaluate(() => document.getElementById('r-state')?.textContent);
  await page.click('#r-w2');
  await sleep(1500);
  const w2 = await page.evaluate(() => document.getElementById('r-state')?.textContent);
  await page.click('#r-leave');
  await sleep(1200);
  const left = await page.evaluate(() => document.getElementById('r-state')?.textContent);
  const P = await page.evaluate(() => structuredClone(window.__p015));
  await ctx.close();
  return { before, ctxCount: P.ctxCreated.length, ctxInGesture: P.ctxCreated.map((c) => c.inGesture), starts: P.starts.length, w1, w2, left, console: msgs };
}

mkdirSync(`${ROOT}/results`, { recursive: true });
for (const name of TARGETS) {
  const browser = await launch(name);
  const out = { browser: name, version: browser.version(), at: new Date().toISOString() };
  console.log(`\n=== ${name} ${out.version}`);
  const step = async (key, fn) => {
    const t = Date.now();
    try {
      out[key] = await fn();
    } catch (e) {
      out[key] = { error: String(e).slice(0, 400) };
    }
    console.log(`  ${key} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  };
  await step('probeBeforeGesture', () => probeBeforeGesture(browser));
  if (name !== 'firefox') await step('activationProbe', () => activationProbe(browser));
  await step('webaudio', () => engineRun(browser, 'webaudio'));
  await step('howler', () => engineRun(browser, 'howler', { idleTest: !QUICK }));
  await step('howlerEager', () => engineRun(browser, 'howler-eager'));
  if (name !== 'firefox') await step('webaudioTouch', () => engineRun(browser, 'webaudio', { touch: true }));
  if (name === 'chromium' && !QUICK) {
    await step('webaudioCpu4x', () => engineRun(browser, 'webaudio', { cpu: 4 }));
    await step('gapCpu4x', () => gapRun(browser, 4));
  }
  await step('react', () => reactRun(browser));
  if (!QUICK) await step('gap', () => gapRun(browser));
  writeFileSync(`${ROOT}/results/${name}.json`, JSON.stringify(out, null, 1));
  await browser.close();
}
console.log('\ndone');
