// P0-09: run every quest's solution_code in Node Pyodide and check it passes the quest's own validation.
//
//   npx tsx check.ts                               # 0.29.3, modes fresh+prod, 3 unseeded runs + 20 seeds
//   npx tsx check.ts --pyodide 0.29.3,0.27.5       # also the worker's CDN version
//   npx tsx check.ts --runs 20 --seeds 0           # flakiness as students see it (unseeded)
//   npx tsx check.ts --patch patches/b09-fix.json  # try a content fix
//   npx tsx check.ts --only 7-1                    # one quest
//
// Exit code 1 when any unit is FAIL / FLAKY / NO_SOLUTION (the CI gate).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, loadavg } from 'node:os';
import { parseArgs } from 'node:util';
import { BLOCKED_MODULES } from '../../src/lib/pyodide/constants.ts';
import { Sandbox, PROPOSED_EXTRA_BLOCKED, REPO, WORKER_FILE, type Mode } from './lib/sandbox.ts';
import { checkUnit, loadFixture, toUnits, type Patch, type UnitResult } from './lib/content.ts';
import { describeRule } from './lib/validators.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    pyodide: { type: 'string', default: '0.29.3' },
    mode: { type: 'string', default: 'fresh,prod' },
    runs: { type: 'string', default: '3' },
    seeds: { type: 'string', default: '20' },
    patch: { type: 'string', multiple: true, default: [] },
    only: { type: 'string' },
    fixture: { type: 'string', default: join(HERE, 'fixtures/quests.json') },
    json: { type: 'string' },
    'no-extra-blocked': { type: 'boolean', default: false },
  },
});

const versions = args.pyodide!.split(',');
const modes = args.mode!.split(',') as Mode[];
const runs = Number(args.runs);
const seeds = Array.from({ length: Number(args.seeds) }, (_, i) => i);
const patches: Patch[] = args.patch!.flatMap((p) => JSON.parse(readFileSync(resolve(p), 'utf8')));

const tStart = performance.now();
const cpu0 = process.cpuUsage();
const load0 = loadavg()[0];

// ---------------------------------------------------------------- drift guards
const warnings: string[] = [];
const workerSrc = readFileSync(WORKER_FILE, 'utf8');
const cdnVersion = workerSrc.match(/pyodide\/v([\d.]+)\//)?.[1];
const workerBlocked = [...(workerSrc.match(/BLOCKED_MODULES = new Set\(\[([\s\S]*?)\]\)/)?.[1].matchAll(/'(\w+)'/g) ?? [])].map((m) => m[1]);
if (JSON.stringify([...workerBlocked].sort()) !== JSON.stringify([...BLOCKED_MODULES].sort()))
  warnings.push(`worker BLOCKED_MODULES != src/lib/pyodide/constants.ts`);
for (const v of versions) if (v !== cdnVersion) warnings.push(`checking with Pyodide ${v} but the browser worker loads ${cdnVersion} from the CDN (B26)`);

const fixture = loadFixture(args.fixture!);
const sources = (fixture.meta.sources ?? {}) as Record<string, string>;
for (const [p, h] of Object.entries(sources)) {
  const now = createHash('sha256').update(readFileSync(join(REPO, p), 'utf8')).digest('hex').slice(0, 16);
  if (now !== h) warnings.push(`fixture is stale: ${p} changed since extract (run: node extract.mjs)`);
}
let units = toUnits(fixture, patches);
if (args.only) units = units.filter((u) => u.key === args.only || u.questKey === args.only);

console.log(`P0-09 solution check: ${units.length} units from ${fixture.quests.length} quests | runs=${runs} seeds=${seeds.length} | ${cpus().length} cpus, load ${load0.toFixed(1)}`);
if (patches.length) console.log(`patches: ${patches.map((p) => `${p.key} -> ${describeRule(p.rule)}`).join('; ')}`);
for (const w of warnings) console.log(`WARN ${w}`);

// ---------------------------------------------------------------- run
type Combo = { version: string; mode: Mode; loadMs: number; python: string; rssMB: number; wasmHeapMB: number | null; wallMs: number; results: UnitResult[] };
const combos: Combo[] = [];
for (const version of versions) {
  for (const mode of modes) {
    const t0 = performance.now();
    const sb = await Sandbox.create({ version, mode, extraBlocked: mode === 'fresh' && !args['no-extra-blocked'] ? PROPOSED_EXTRA_BLOCKED : [] });
    const st = await sb.stats();
    const results: UnitResult[] = [];
    for (const u of units) results.push(await checkUnit(sb, u, { runs, seeds }));
    const end = await sb.stats();
    await sb.close();
    const c: Combo = { version, mode, loadMs: st.loadMs, python: st.python, rssMB: end.rssMB, wasmHeapMB: end.wasmHeapMB, wallMs: performance.now() - t0, results };
    combos.push(c);
    const bad = results.filter((r) => r.status !== 'PASS');
    console.log(`\n== Pyodide ${version} (Python ${c.python}) mode=${mode}: load ${c.loadMs.toFixed(0)} ms, wall ${(c.wallMs / 1000).toFixed(1)} s, rss ${c.rssMB.toFixed(0)} MB, wasm heap ${c.wasmHeapMB?.toFixed(0)} MB -> ${results.length - bad.length}/${results.length} PASS`);
    for (const r of bad) console.log(`   ${r.status.padEnd(11)} ${r.key.padEnd(6)} ${r.title}  unseeded ${r.runs.passed}/${r.runs.total} ${JSON.stringify(r.runs.reasons)}  seeded ${r.seeded.passed}/${r.seeded.total} failed seeds=[${r.seeded.failedSeeds.join(',')}]`);
  }
}

// ---------------------------------------------------------------- table
const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
const comboName = (c: Combo) => `${c.version}/${c.mode}`;
console.log(`\n${pad('unit', 7)} ${pad('title', 26)} ${pad('rule', 36)} ${combos.map((c) => pad(comboName(c), 15)).join(' ')} notes`);
for (let i = 0; i < units.length; i++) {
  const u = units[i];
  const cells = combos.map((c) => {
    const r = c.results[i];
    const n = r.runs.total + r.seeded.total;
    const p = r.runs.passed + r.seeded.passed;
    return pad(r.status === 'PASS' ? `PASS ${p}/${n}` : `${r.status} ${p}/${n}`, 15);
  });
  const notes = [...new Set(combos.flatMap((c) => c.results[i].warnings))];
  console.log(`${pad(u.key, 7)} ${pad(u.title, 26)} ${pad(describeRule(u.rule), 36)} ${cells.join(' ')} ${notes.join(' / ')}`);
}

// ---------------------------------------------------------------- cross-version / cross-mode
const diffs: string[] = [];
for (let i = 0; i < units.length; i++) {
  for (const mode of modes) {
    const cs = combos.filter((c) => c.mode === mode);
    for (const c of cs.slice(1)) {
      const a = cs[0].results[i], b = c.results[i];
      if (a.runs.distinctStdout === 1 && b.runs.distinctStdout === 1 && a.firstStdout !== b.firstStdout)
        diffs.push(`${units[i].key} ${mode}: stdout ${cs[0].version} ${JSON.stringify(a.firstStdout)} vs ${c.version} ${JSON.stringify(b.firstStdout)}`);
      if (JSON.stringify(a.seededStdout) !== JSON.stringify(b.seededStdout))
        diffs.push(`${units[i].key} ${mode}: seeded stdout differs between ${cs[0].version} and ${c.version}`);
      if (a.status !== b.status) diffs.push(`${units[i].key} ${mode}: status ${cs[0].version}=${a.status} ${c.version}=${b.status}`);
    }
  }
  for (const v of versions) {
    const [f, p] = ['fresh', 'prod'].map((m) => combos.find((c) => c.version === v && c.mode === m)?.results[i]);
    if (f && p && f.status !== p.status) diffs.push(`${units[i].key} ${v}: fresh=${f.status} prod=${p.status}`);
  }
}
if (combos.length > 1) console.log(`\ncross-version / cross-mode differences: ${diffs.length ? '\n  ' + diffs.join('\n  ') : 'none'}`);

// ---------------------------------------------------------------- timing
const allMs = combos.flatMap((c) => c.results.flatMap((r) => r.ms)).sort((a, b) => a - b);
const q = (p: number) => allMs[Math.min(allMs.length - 1, Math.floor(p * allMs.length))] ?? 0;
const cpu = process.cpuUsage(cpu0);
const wall = performance.now() - tStart;
console.log(`\ntiming: total wall ${(wall / 1000).toFixed(1)} s, process cpu ${((cpu.user + cpu.system) / 1e6).toFixed(1)} s, solution runs ${allMs.length} (median ${q(0.5).toFixed(1)} ms, p95 ${q(0.95).toFixed(1)} ms, max ${q(1).toFixed(1)} ms), load avg ${load0.toFixed(1)} -> ${loadavg()[0].toFixed(1)}`);

const failing = combos.flatMap((c) => c.results.filter((r) => r.status !== 'PASS').map((r) => `${comboName(c)} ${r.key} ${r.status}`));
const out = args.json ?? join(HERE, 'results', `check-${versions.join('+')}-${modes.join('+')}-r${runs}-s${seeds.length}${patches.length ? '-patched' : ''}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ args, warnings, loadavg: [load0, loadavg()[0]], wallMs: wall, cpuMs: (cpu.user + cpu.system) / 1000, combos, diffs, failing }, null, 2));
console.log(`result: ${failing.length ? `FAIL (${failing.length})` : 'ALL PASS'} -> ${out}`);
process.exitCode = failing.length ? 1 : 0;
