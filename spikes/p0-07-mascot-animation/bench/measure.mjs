// P0-07 런타임 비용 측정
// 사용: node bench/measure.mjs [--reps 3] [--rates 1,4,6] [--scenes single,busy] [--cands a,b] [--out results/raw/x.json] [--net slow4g] [--dur 6000]
// 후보·스로틀·장면을 교차(A B C A B C…)로 반복. 매 실행 새 컨텍스트.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, loadavg } from 'node:os';
import { launch, BASE } from './pw.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const REPS = +arg('reps', 3);
const RATES = arg('rates', '1,4,6').split(',').map(Number);
const SCENES = arg('scenes', 'single,busy').split(',');
const CANDS = arg('cands', 'rig,lottie-svg,lottie-canvas,dotlottie,rive-avatar,rive-birb').split(',');
const OUT = arg('out', null);
const NET = arg('net', null);
const DUR = +arg('dur', 6000);
const WARM = +arg('warm', 1500);
const DPR = +arg('dpr', 2);

const b = await launch();
const rows = [];
const t0 = Date.now();
for (let rep = 0; rep < REPS; rep++) {
  for (const rate of RATES) {
    for (const scene of SCENES) {
      for (const c of CANDS) {
        const ctx = await b.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: DPR });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        if (NET === 'slow4g') {
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', {
            offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
          });
        }
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const load1 = loadavg()[0];
        await page.goto(`${BASE}/bench.html?c=${c}&scene=${scene}&dur=${DUR}&warm=${WARM}`);
        await page.waitForFunction(() => document.title === 'measuring' || document.title === 'done', null, { timeout: 120000 });
        const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
        await page.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
        const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
        const res = await page.evaluate(() => window.__result);
        const heap = await cdp.send('Runtime.getHeapUsage');
        const span = m1.Timestamp - m0.Timestamp;
        const row = {
          rep, rate, scene, c, net: NET, load1, errors,
          ...res,
          cpu: {
            span,
            task: (m1.TaskDuration - m0.TaskDuration) / span,
            script: (m1.ScriptDuration - m0.ScriptDuration) / span,
            layout: (m1.LayoutDuration - m0.LayoutDuration) / span,
            style: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / span,
          },
          heapUsed: heap.usedSize,
        };
        rows.push(row);
        const d = res.deltas ?? [];
        const s = [...d].sort((a, b) => a - b);
        const med = s[Math.floor(s.length / 2)];
        const p95 = s[Math.floor(s.length * 0.95)];
        console.log(
          `rep${rep} ${rate}x ${scene.padEnd(6)} ${c.padEnd(13)} fps=${(d.length / (DUR / 1000)).toFixed(1).padStart(5)} med=${med?.toFixed(1)} p95=${p95?.toFixed(1)} task=${(row.cpu.task * 100).toFixed(0)}% first=${res.marks?.allFirst?.toFixed(0)}ms lt=${res.longtasks?.length} load=${load1.toFixed(1)} ${errors.length ? 'ERR ' + errors[0] : ''}${res.error ? 'ERR ' + res.error : ''}`,
        );
        await ctx.close();
      }
    }
  }
}
await b.close();
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), cpus: cpus().length, model: cpus()[0].model, minutes: (Date.now() - t0) / 60000, rows }));
}
