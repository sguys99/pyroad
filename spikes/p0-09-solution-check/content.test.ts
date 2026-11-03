// P1-13 shape: every quest's solution passes its own validation (Vitest + Node Pyodide).
//   ../../node_modules/.bin/vitest run --config vitest.config.ts
//   CONTENT_PATCH=patches/proposed-content-fixes.json ../../node_modules/.bin/vitest run --config vitest.config.ts
//   PYODIDE_VERSION=0.27.5 ...

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Sandbox, PROPOSED_EXTRA_BLOCKED } from './lib/sandbox.ts';
import { checkUnit, loadFixture, toUnits, type Patch } from './lib/content.ts';

const patches: Patch[] = process.env.CONTENT_PATCH ? JSON.parse(readFileSync(process.env.CONTENT_PATCH, 'utf8')) : [];
const units = toUnits(loadFixture(join(__dirname, 'fixtures/quests.json')), patches);
const SEEDS = Array.from({ length: 10 }, (_, i) => i); // deterministic: same seeds on every CI run

let sb: Sandbox;
beforeAll(async () => {
  sb = await Sandbox.create({ version: process.env.PYODIDE_VERSION ?? '0.29.3', mode: 'fresh', extraBlocked: PROPOSED_EXTRA_BLOCKED });
});
afterAll(async () => sb?.close());

describe.each(units)('$key $title', (u) => {
  it('has solution_code (B08)', () => {
    expect(u.solution, 'solution_code missing').toBeTruthy();
  });

  it('solution passes its own validation for every seed', async () => {
    const r = await checkUnit(sb, u, { runs: 1, seeds: SEEDS });
    expect({ status: r.status, failedSeeds: r.seeded.failedSeeds, stderr: r.firstStderr }).toEqual({ status: 'PASS', failedSeeds: [], stderr: '' });
    if (r.questRulePasses !== null) expect(r.questRulePasses, 'last step must satisfy the quest-level rule').toBe(true);
  });

  it('untouched starter / carried-over code does not pass', async () => {
    const r = await checkUnit(sb, { ...u, solution: null }, { runs: 0, seeds: [] });
    expect(r.initialPasses ?? false).toBe(false);
  });
});
