// P0-16 검증: ① 기준선(단계 고정)으로 정답 단계 정하기 ② 자동 감지가 얼마나 빨리·정확히 정착하는지
// 사용: node bench/validate.mjs [--reps 3] [--rates 1,4,6,10] [--phase oracle,detect,jank,signals] [--out results/raw/validate.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadavg } from 'node:os';
import { chromium } from 'playwright-core';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = 'http://127.0.0.1:3107';
const REPS = +arg('reps', 3);
const RATES = arg('rates', '1,4,6,10').split(',').map(Number);
const PHASES = arg('phase', 'oracle,detect,jank,signals').split(',');
const OUT = arg('out', null);
const DETECT_MS = +arg('detect-ms', 20000);
// 하드웨어 프로필 (addInitScript로 navigator 덮어쓰기)
const PROFILES = {
  pc: null, // 실제 값 (20코어, deviceMemory 32: Chromium 151 헤드리스 실측)
  chromebook: { hardwareConcurrency: 2, deviceMemory: 4 }, // 셀러론 2코어 4GB 크롬북
  weak: { hardwareConcurrency: 2, deviceMemory: 2 },
  ipad: { hardwareConcurrency: 4, deviceMemory: undefined, ua: 'Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1' },
};

const b = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
async function open({ rate, profile, qs = '', reduced = false, saveData = false }) {
  const prof = PROFILES[profile];
  const ctx = await b.newContext({
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 2,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    ...(prof?.ua ? { userAgent: prof.ua } : {}),
  });
  if (prof || saveData) {
    await ctx.addInitScript(([p, sd]) => {
      if (p) {
        Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: () => p.hardwareConcurrency, configurable: true });
        Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => p.deviceMemory, configurable: true });
      }
      if (sd) Object.defineProperty(Navigator.prototype, 'connection', { get: () => ({ saveData: true, effectiveType: '4g' }), configurable: true });
    }, [prof, saveData]);
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto(`${BASE}/?${qs}`);
  return { ctx, page, errors };
}
/** 페이지에서 ms 동안 rAF 간격 수집 → 놓친 프레임 비율(60fps 기준), p90 */
async function sampleFrames(page, ms) {
  return page.evaluate(
    (ms) =>
      new Promise((res) => {
        const d = [];
        let last = 0;
        const t0 = performance.now();
        let loaf = 0;
        try {
          new PerformanceObserver((l) => (loaf += l.getEntries().length)).observe({ type: 'long-animation-frame' });
        } catch {}
        const f = (t) => {
          if (last) d.push(t - last);
          last = t;
          if (t - t0 < ms) requestAnimationFrame(f);
          else {
            const span = d.reduce((a, b) => a + b, 0);
            const s = [...d].sort((a, b) => a - b);
            res({ fps: (d.length * 1000) / span, drop: Math.max(0, 1 - d.length / (span / (1000 / 60))), p90: s[Math.floor(s.length * 0.9)], loaf });
          }
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}
const out = { at: new Date().toISOString(), oracle: [], detect: [], jank: [], signals: [] };
const L = () => loadavg()[0].toFixed(1);

for (let rep = 0; rep < REPS; rep++) {
  if (PHASES.includes('oracle')) {
    for (const rate of RATES) {
      for (const [scene, tier] of ['heavy', 'light'].flatMap((sc) => ['full', 'lite', 'minimal'].map((t) => [sc, t]))) {
        const { ctx, page, errors } = await open({ rate, profile: 'pc', qs: `force=${tier}${scene === 'light' ? '&light=1' : ''}` });
        await page.waitForTimeout(2500);
        const s = await sampleFrames(page, 6000);
        out.oracle.push({ rep, rate, scene, tier, ...s, load: +L(), errors });
        console.log(`oracle rep${rep} ${rate}x ${scene} ${tier.padEnd(7)} fps=${s.fps.toFixed(1)} drop=${(s.drop * 100).toFixed(0)}% p90=${s.p90.toFixed(1)} loaf=${s.loaf} load=${L()}`);
        await ctx.close();
      }
    }
  }
  if (PHASES.includes('detect')) {
    for (const rate of RATES) {
      for (const [scene, profile] of [...Object.keys(PROFILES).map((p) => ['heavy', p]), ['light', 'pc']]) {
        const { ctx, page, errors } = await open({ rate, profile, qs: scene === 'light' ? 'light=1' : '' });
        await page.waitForTimeout(DETECT_MS);
        const r = await page.evaluate(() => ({ log: window.__p016.log, signals: window.__p016.signals }));
        const after = await sampleFrames(page, 3000);
        out.detect.push({ rep, rate, scene, profile, ...r, after, load: +L(), errors });
        console.log(`detect rep${rep} ${rate}x ${scene} ${profile.padEnd(10)} ${r.log.map((e) => `${e.t}ms:${e.tier}`).join(' → ')} | 이후 drop=${(after.drop * 100).toFixed(0)}% load=${L()}`);
        await ctx.close();
      }
    }
  }
  if (PHASES.includes('jank')) {
    // 1×에서 긴 작업 주입 (가벼운 장면에서 오탐이 나는지): lite 고정 장면 위에서 감지기만 켬 → 의미 없음.
    // 그래서 'pc' 1×에서 jank=1로 자동 모드 실행, 기준선(jank 없음)과 비교
    for (const jank of [0, 1]) {
      const { ctx, page, errors } = await open({ rate: 1, profile: 'pc', qs: `jank=${jank}&light=1` });
      await page.waitForTimeout(14000);
      const r = await page.evaluate(() => window.__p016.log);
      out.jank.push({ rep, jank, log: r, load: +L(), errors });
      console.log(`jank rep${rep} jank=${jank} ${r.map((e) => `${e.t}ms:${e.tier}`).join(' → ')} load=${L()}`);
      await ctx.close();
    }
  }
  if (PHASES.includes('signals') && rep === 0) {
    for (const [name, o] of [['reduced-motion', { reduced: true }], ['saveData', { saveData: true }], ['weak(hc2,dm2)', { profile: 'weak' }], ['ipad UA (hc4)', { profile: 'ipad' }]]) {
      const { ctx, page, errors } = await open({ rate: 1, profile: o.profile ?? 'pc', reduced: o.reduced, saveData: o.saveData });
      await page.waitForTimeout(4000);
      const r = await page.evaluate(() => ({ log: window.__p016.log, signals: window.__p016.signals, html: { motion: document.documentElement.dataset.motion, reduced: document.documentElement.dataset.reduced } }));
      out.signals.push({ name, ...r, errors });
      console.log(`signals ${name.padEnd(16)} ${JSON.stringify(r.log.map((e) => e.tier))} html=${JSON.stringify(r.html)} sig=${JSON.stringify(r.signals)}`);
      await ctx.close();
    }
  }
}
await b.close();
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
}
