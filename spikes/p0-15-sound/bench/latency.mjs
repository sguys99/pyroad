// 집중 지연 측정: 효과음 프리로드 후 버튼 N회 클릭, 엔진을 번갈아 2라운드.
//  - eventToStart: pointerdown 이벤트 timeStamp → AudioBufferSourceNode.start() 호출 (입력 파이프라인 + 엔진)
//  - handlerToStart: 핸들러 진입 → start() 호출 (엔진 자체 오버헤드)
// 사용: node bench/latency.mjs [chromium firefox webkit]  (WK_EXECUTABLE 지원)
import { chromium, firefox, webkit } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3115';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const names = process.argv.slice(2);
const TARGETS = names.length ? names : ['chromium', 'firefox', 'webkit'];
const N = 40;
const SFX = ['tap', 'correct', 'wrong', 'coin', 'star', 'run', 'blip', 'unlock'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = (n) =>
  n === 'chromium'
    ? chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] })
    : n === 'firefox'
      ? firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 1, 'media.autoplay.block-webaudio': true } })
      : webkit.launch(process.env.WK_EXECUTABLE ? { executablePath: process.env.WK_EXECUTABLE } : {});

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  return { n: s.length, median: +q(0.5).toFixed(2), p90: +q(0.9).toFixed(2), max: +s.at(-1).toFixed(3) };
}

async function round(browser, engine) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?engine=${engine}`);
  await page.click('#sfx button[data-sfx="tap"]'); // 잠금 해제 + 프리로드 시작
  await sleep(2500);
  const startIdx = await page.evaluate(() => window.__p015.gestures.length);
  for (let i = 0; i < N; i++) {
    await page.click(`#sfx button[data-sfx="${SFX[i % SFX.length]}"]`);
    await sleep(80);
  }
  await sleep(300);
  const P = await page.evaluate(() => structuredClone(window.__p015));
  await ctx.close();
  const ev = [];
  const hd = [];
  for (const g of P.gestures.slice(startIdx)) {
    const s = P.starts.find((x) => x.gestureTs === g.ts);
    if (!s) continue;
    ev.push(s.t - g.ts);
    hd.push(s.t - g.handlerAt);
  }
  return { ev, hd, missing: N - ev.length };
}

const out = {};
for (const name of TARGETS) {
  const browser = await launch(name);
  const acc = { webaudio: { ev: [], hd: [], missing: 0 }, howler: { ev: [], hd: [], missing: 0 } };
  for (let r = 0; r < 2; r++) {
    for (const e of ['webaudio', 'howler']) {
      const x = await round(browser, e);
      acc[e].ev.push(...x.ev);
      acc[e].hd.push(...x.hd);
      acc[e].missing += x.missing;
    }
  }
  out[name] = { version: browser.version() };
  for (const e of Object.keys(acc)) {
    out[name][e] = { eventToStart: stats(acc[e].ev), handlerToStart: stats(acc[e].hd), missing: acc[e].missing };
  }
  console.log(name, JSON.stringify(out[name]));
  await browser.close();
}
writeFileSync(`${ROOT}/results/latency.json`, JSON.stringify(out, null, 1));
