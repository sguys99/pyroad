// 첫 탭(=잠금 해제와 동시) 효과음 지연: predecode(OfflineAudioContext 사전 디코드) 켬/끔 비교, 브라우저당 각 3회
// 사용: node bench/first-tap.mjs  (WK_EXECUTABLE 지원)
import { chromium, firefox, webkit } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE ?? 'http://127.0.0.1:3115';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = (n) =>
  n === 'chromium'
    ? chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] })
    : n === 'firefox'
      ? firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 1, 'media.autoplay.block-webaudio': true } })
      : webkit.launch(process.env.WK_EXECUTABLE ? { executablePath: process.env.WK_EXECUTABLE } : {});

const out = {};
for (const name of ['chromium', 'firefox', 'webkit']) {
  const browser = await launch(name);
  out[name] = { version: browser.version() };
  for (const pre of ['1', '0']) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const warn = [];
      page.on('console', (m) => (m.type() === 'warning' || m.type() === 'error') && warn.push(m.text().slice(0, 120)));
      await page.goto(`${BASE}/?engine=webaudio&predecode=${pre}`);
      await sleep(1500); // 페이지 유휴 시간 (prefetch/predecode)
      await page.click('#sfx button[data-sfx="correct"]');
      await sleep(800);
      const P = await page.evaluate(() => structuredClone(window.__p015));
      const g = P.gestures[0];
      const s = P.starts.find((x) => x.gestureTs === g.ts);
      runs.push({ firstStartMs: s ? +(s.t - g.ts).toFixed(1) : null, decodedBeforeGesture: P.decodes.filter((d) => d.t < g.ts).length, warnings: warn.length });
      await ctx.close();
    }
    out[name][pre === '1' ? 'predecode' : 'noPredecode'] = runs;
  }
  console.log(name, JSON.stringify(out[name]));
  await browser.close();
}
writeFileSync(`${ROOT}/results/first-tap.json`, JSON.stringify(out, null, 1));
