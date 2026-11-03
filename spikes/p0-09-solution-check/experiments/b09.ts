// B09 experiment: project 7-1 step 3 under randomness, and why "just seed random in production" is fragile.
//   npx tsx experiments/b09.ts [--pyodide 0.29.3] [--n 200]

import { parseArgs } from 'node:util';
import { Sandbox } from '../lib/sandbox.ts';
import { loadFixture, toUnits } from '../lib/content.ts';
import { verdict, type Rule } from '../lib/validators.ts';
import { readFileSync } from 'node:fs';

const { values: a } = parseArgs({ options: { pyodide: { type: 'string', default: '0.29.3' }, n: { type: 'string', default: '200' } } });
const N = Number(a.n);
const fixture = loadFixture(new URL('../fixtures/quests.json', import.meta.url).pathname);
const unit = toUnits(fixture).find((u) => u.key === '7-1#3')!;
const patched: Rule = JSON.parse(readFileSync(new URL('../patches/proposed-content-fixes.json', import.meta.url), 'utf8')).find((p: any) => p.key === '7-1#3').rule;

const canonical = unit.solution!;
const variants: Record<string, string> = {
  canonical,
  // same logic, the two random draws in the other order (a perfectly correct student answer)
  swapped: canonical.replace(
    'secret = random.randint(1, 10)\nguess = int(random.randint(1, 10))',
    'guess = int(random.randint(1, 10))\nsecret = random.randint(1, 10)',
  ),
  // follows hint level_3 literally: print("더 ___!") -> "더 커요!" / "더 작아요!"
  hint_wording: canonical.replace('비밀 숫자가 추측보다 커요!', '더 커요!').replace('비밀 숫자가 추측보다 작아요!', '더 작아요!'),
};
if (variants.swapped === canonical) throw new Error('swap failed');

const sb = await Sandbox.create({ version: a.pyodide!, mode: 'prod' }); // the real worker file
const pass = async (code: string, rule: Rule, seed: number | 'entropy') => verdict(rule, await sb.run(code, { seed }), code).passed;

// 1) as students experience it
let ok = 0;
const outs: Record<string, number> = {};
for (let i = 0; i < N; i++) {
  const r = await sb.run(canonical, { seed: 'entropy' });
  if (verdict(unit.rule, r, canonical).passed) ok++;
  const line = r.stdout.trim().replace(/\d+/g, '#');
  outs[line] = (outs[line] ?? 0) + 1;
}
console.log(`[1] unseeded x${N}, current rule ${JSON.stringify(unit.rule)}: pass ${ok}/${N} = ${((100 * ok) / N).toFixed(1)}%  (theory 45%)`);
console.log('    outputs:', outs);

// 2) seeded = deterministic, so CI can detect the problem reproducibly
const seeds = Array.from({ length: 100 }, (_, i) => i);
const perSeed: Record<string, boolean[]> = {};
for (const [name, code] of Object.entries(variants)) {
  perSeed[name] = [];
  for (const s of seeds) perSeed[name].push(await pass(code, unit.rule, s));
}
for (const [name, r] of Object.entries(perSeed)) console.log(`[2] seeds 0..99, current rule, ${name.padEnd(12)}: pass ${r.filter(Boolean).length}/100`);

// 3) policy "seed random with a fixed per-quest seed in production": pick seeds where canonical passes
const good = seeds.filter((s) => perSeed.canonical[s]);
const swappedFailsOnGood = good.filter((s) => !perSeed.swapped[s]).length;
console.log(`[3] fixed-seed policy: canonical passes on ${good.length}/100 seeds; on those seeds the equally-correct "swapped" answer still fails ${swappedFailsOnGood}/${good.length}; "hint_wording" fails ${good.filter((s) => !perSeed.hint_wording[s]).length}/${good.length}`);

// 4) proposed rule
for (const [name, code] of Object.entries(variants)) {
  let p = 0;
  for (const s of seeds) if (await pass(code, patched, s)) p++;
  let u = 0;
  for (let i = 0; i < 50; i++) if (await pass(code, patched, 'entropy')) u++;
  console.log(`[4] proposed rule, ${name.padEnd(12)}: seeds ${p}/100, unseeded ${u}/50`);
}
const neg = await sb.run(unit.initialCode, { seed: 'entropy' });
console.log(`[4] proposed rule, untouched carried-over code (step 2 answer) passes? ${verdict(patched, neg, unit.initialCode).passed}`);
await sb.close();
