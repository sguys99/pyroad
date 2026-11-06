// 렌더 비용 재측정 (P0-07 §4.3 하네스와 같은 방식): CPU 스로틀 × 후보 교차 반복, rAF 간격으로 fps·p95, CDP TaskDuration으로 메인 스레드 %
//   cd design/prototypes && npm run build -- rig-review
//   (cd ../../spikes/p0-07-mascot-animation && node bench/serve.mjs &)   # 비교용 스파이크 리그 (포트 3107, 선택)
//   node src/rig-review/bench.mjs --reps 3 --rates 4,6 --scenes single,busy [--old]
// 후보: new-a(A, 춤) · new-ab(A×B) · new-b(B, 필터·12fps) · new-lite(A, lite) · --old면 old-rig(스파이크 A, 소품 끔)
import { cpus, loadavg } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, '..', '..', '..', '..', 'package.json'));
const { chromium } = require('playwright');
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const REPS = +arg('reps', 3);
const RATES = arg('rates', '4,6').split(',').map(Number);
const SCENES = arg('scenes', 'single,busy').split(',');
const DUR = +arg('dur', 5000);
const WARM = +arg('warm', 1500);
const PORT = 4327;
const CANDS = {
  'new-a': { style: 'A', tier: 'full' },
  'new-ab': { style: 'AB', tier: 'full' },
  'new-b': { style: 'B', tier: 'full' },
  'new-lite': { style: 'A', tier: 'lite' },
};
// --idle: 대기 CPU (파이뱀 idle, 장면 single만)
if (process.argv.includes('--idle')) {
  for (const k of Object.keys(CANDS)) delete CANDS[k];
  Object.assign(CANDS, {
    'idle-a': { style: 'A', tier: 'full', state: 'idle' },
    'idle-ab': { style: 'AB', tier: 'full', state: 'idle' },
    'idle-lite': { style: 'AB', tier: 'lite', state: 'idle' },
    'idle-minimal': { style: 'AB', tier: 'minimal', state: 'idle' },
  });
}
const names = Object.keys(CANDS);
if (process.argv.includes('--old')) names.push('old-rig');

const server = await startServer(PORT);
const b = await chromium.launch();
const rows = [];
try {
  for (let rep = 0; rep < REPS; rep++)
    for (const rate of RATES)
      for (const scene of SCENES)
        for (const c of names) {
          if (c === 'old-rig' && scene === 'busy') continue; // 스파이크 busy는 폭죽 포함이라 장면이 다름
          const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
          const page = await ctx.newPage();
          const cdp = await ctx.newCDPSession(page);
          await cdp.send('Performance.enable');
          await cdp.send('Emulation.setCPUThrottlingRate', { rate });
          const load1 = loadavg()[0];
          if (c === 'old-rig') {
            await page.goto(`http://127.0.0.1:3107/bench.html?c=rig&scene=single&dur=${DUR}&warm=${WARM}`);
          } else {
            await ctx.addInitScript((cfg) => {
              window.__benchConfig = cfg;
              try {
                localStorage.setItem('pyroad-proto-chrome-collapsed', '1');
              } catch {}
            }, { scene, warm: WARM, dur: DUR, ...CANDS[c] });
            await page.goto(`http://127.0.0.1:${PORT}/rig-review.html#bench`);
          }
          await page.waitForFunction(() => document.title === 'measuring' || document.title === 'done', null, { timeout: 120000 });
          const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
          await page.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
          const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
          const res = await page.evaluate(() => window.__result);
          const d = [...res.deltas].sort((x, y) => x - y);
          const fps = (1000 * d.length) / d.reduce((s, x) => s + x, 0);
          const p95 = d[Math.floor(d.length * 0.95)];
          const task = (m1.TaskDuration - m0.TaskDuration) / (m1.Timestamp - m0.Timestamp);
          rows.push({ rep, rate, scene, c, fps, p95, task, long: res.longtasks.length, load1 });
          console.log(`${rep} ${rate}x ${scene} ${c}: ${fps.toFixed(1)}fps p95 ${p95.toFixed(0)}ms main ${(task * 100).toFixed(0)}% long ${res.longtasks.length} (load ${load1.toFixed(1)})`);
          await ctx.close();
        }
} finally {
  await b.close();
  server.close();
}

const med = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
console.log(`\n| 후보 | 장면 | ${RATES.map((r) => `${r}× fps [최소–최대]`).join(' | ')} | ${RATES.map((r) => `${r}× p95(ms)`).join(' | ')} | ${RATES.map((r) => `${r}× 메인 %`).join(' | ')} |`);
console.log(`|---|---|${RATES.map(() => '---:').join('|')}|${RATES.map(() => '---:').join('|')}|${RATES.map(() => '---:').join('|')}|`);
for (const scene of SCENES)
  for (const c of names) {
    const by = (r) => rows.filter((x) => x.c === c && x.scene === scene && x.rate === r);
    if (!by(RATES[0]).length) continue;
    const fpsCells = RATES.map((r) => {
      const f = by(r).map((x) => x.fps);
      return `${med(f).toFixed(1)} [${Math.min(...f).toFixed(1)}–${Math.max(...f).toFixed(1)}]`;
    });
    const p95 = RATES.map((r) => med(by(r).map((x) => x.p95)).toFixed(0));
    const task = RATES.map((r) => (med(by(r).map((x) => x.task)) * 100).toFixed(0));
    console.log(`| ${c} | ${scene} | ${fpsCells.join(' | ')} | ${p95.join(' | ')} | ${task.join(' | ')} |`);
  }
const loads = rows.map((r) => r.load1);
console.log(`\n실행 ${rows.length}회, load(1분) 중앙값 ${med(loads).toFixed(1)} [${Math.min(...loads).toFixed(1)}–${Math.max(...loads).toFixed(1)}], ${cpus().length} vCPU`);
