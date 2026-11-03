// P0-09 extractor: SQL (migration + seed) -> JSON fixture, with no external DB.
//
// Loads the real SQL files into an in-memory Postgres (PGlite, WASM) and SELECTs the
// quests back as JSON. No regex parsing of SQL.
//
//   node extract.mjs            # PGlite only
//   node extract.mjs --docker   # also replay in postgres:17-alpine and compare (cross-check)
//
// Output: fixtures/quests.json (slim: only what the solution runner needs)

import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const SQL_FILES = {
  migration1: 'supabase/migrations/00001_v0.1.0_initial_schema.sql',
  migration2: 'supabase/migrations/00002_v0.3.1_security_hotfix.sql',
  seed: 'supabase/seed.sql',
};
const sql = Object.fromEntries(
  Object.entries(SQL_FILES).map(([k, p]) => [k, readFileSync(join(REPO, p), 'utf8')]),
);

// Minimal stand-in for what Supabase provides before migrations run.
const AUTH_STUB = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT 'service_role'::text $f$;
`;

const COUNT_SQL = `
SELECT json_build_object(
  'quests', (SELECT count(*) FROM public.quests),
  'with_solution', (SELECT count(*) FROM public.quests WHERE prompt_skeleton ? 'solution_code'),
  'project_steps', (SELECT count(*) FROM public.quests q, jsonb_array_elements(q.prompt_skeleton->'steps') s),
  'project_steps_with_solution', (SELECT count(*) FROM public.quests q, jsonb_array_elements(q.prompt_skeleton->'steps') s WHERE s ? 'solution_code')
)::text AS j`;

const SNAPSHOT_SQL = `
SELECT coalesce(json_agg(row_to_json(x) ORDER BY x.stage_order, x."order"), '[]'::json)::text AS j FROM (
  SELECT q.id, s."order" AS stage_order, s.title AS stage_title, q."order", q.title, q.concept,
         q.validation_type, q.expected_output, q.xp_reward, q.prompt_skeleton
  FROM public.quests q JOIN public.stages s ON s.id = q.stage_id
) x`;

// The exact order of operations matters (bug B08):
//   fresh DB      = migration -> seed           (Section 6 UPDATEs hit 0 rows)
//   intended DB   = migration -> seed -> migration again (Section 6 re-applied)
const PLAN = [
  ['stub', AUTH_STUB],
  ['migration1', sql.migration1],
  ['migration2', sql.migration2],
  ['seed', sql.seed],
  ['@fresh', null],
  ['migration1 (re-run)', sql.migration1],
  ['@intended', null],
];

async function replayPGlite() {
  const t0 = performance.now();
  const db = new PGlite();
  await db.waitReady;
  const tReady = performance.now();
  const snaps = {};
  for (const [name, text] of PLAN) {
    if (text) await db.exec(text);
    else {
      const c = await db.query(COUNT_SQL);
      const s = await db.query(SNAPSHOT_SQL);
      snaps[name] = { counts: JSON.parse(c.rows[0].j), quests: JSON.parse(s.rows[0].j) };
    }
  }
  const version = (await db.query('SELECT version() AS v')).rows[0].v;
  await db.close();
  return { snaps, version, ms: { init: tReady - t0, total: performance.now() - t0 } };
}

function replayDocker() {
  const name = 'p0-09-pg';
  const run = (args, input) =>
    execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const psql = (text) =>
    run(['exec', '-i', '-e', 'PGOPTIONS=-c client_min_messages=warning', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-f', '-'], text);
  const t0 = performance.now();
  try { run(['rm', '-f', name]); } catch { /* not running */ }
  // No host port is published: psql runs inside the container via `docker exec`.
  run(['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_PASSWORD=spike', 'postgres:17-alpine']);
  try {
    for (let i = 0; i < 60; i++) {
      try { run(['exec', name, 'pg_isready', '-U', 'postgres', '-q']); psql('SELECT 1'); break; }
      catch { execFileSync('sleep', ['0.5']); }
    }
    const snaps = {};
    for (const [step, text] of PLAN) {
      if (text) psql(text);
      else snaps[step] = { counts: JSON.parse(psql(COUNT_SQL).trim()), quests: JSON.parse(psql(SNAPSHOT_SQL).trim()) };
    }
    const version = psql('SELECT version()').trim();
    return { snaps, version, ms: { total: performance.now() - t0 } };
  } finally {
    try { run(['rm', '-f', name]); } catch { /* ignore */ }
  }
}

function diffSkeleton(a, b, path = '') {
  // keys whose values differ between two prompt_skeleton objects (shallow-ish, for reporting)
  const out = [];
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const va = a?.[k], vb = b?.[k];
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    if (va && vb && typeof va === 'object' && typeof vb === 'object') out.push(...diffSkeleton(va, vb, `${path}${k}.`));
    else out.push(`${path}${k}`);
  }
  return out;
}

function slim(q) {
  const ps = q.prompt_skeleton ?? {};
  return {
    id: q.id,
    key: `${q.stage_order}-${q.order}`,
    stage_order: q.stage_order,
    order: q.order,
    title: q.title,
    validation_type: q.validation_type,
    expected_output: q.expected_output,
    starter_code: ps.starter_code ?? null,
    solution_code: ps.solution_code ?? null,
    steps: Array.isArray(ps.steps)
      ? ps.steps.map((s) => ({
          step_number: s.step_number,
          validation_type: s.validation_type,
          expected_output: s.expected_output,
          starter_code: s.starter_code ?? null,
          solution_code: s.solution_code ?? null,
        }))
      : null,
  };
}

const useDocker = process.argv.includes('--docker');
const pg = await replayPGlite();
const { snaps } = pg;

// B08 evidence: what Section 6 of the migration changes, and what a fresh DB loses.
const freshById = Object.fromEntries(snaps['@fresh'].quests.map((q) => [q.id, q]));
const lostOnFreshDb = snaps['@intended'].quests
  .map((q) => ({ key: `${q.stage_order}-${q.order}`, changed: diffSkeleton(freshById[q.id]?.prompt_skeleton, q.prompt_skeleton) }))
  .filter((x) => x.changed.length > 0);

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const fixture = {
  meta: {
    generated_by: 'spikes/p0-09-solution-check/extract.mjs',
    engine: pg.version,
    sources: Object.fromEntries(Object.entries(SQL_FILES).map(([k, p]) => [p, sha(sql[k])])),
    order_of_operations: PLAN.map(([n]) => n),
    counts: { fresh_db: snaps['@fresh'].counts, intended: snaps['@intended'].counts },
    lost_on_fresh_db: lostOnFreshDb,
  },
  quests: snaps['@intended'].quests.map(slim),
};

mkdirSync(join(HERE, 'fixtures'), { recursive: true });
writeFileSync(join(HERE, 'fixtures/quests.json'), JSON.stringify(fixture, null, 2) + '\n');

console.log(`engine: ${pg.version.split(',')[0]}`);
console.log(`PGlite: init ${pg.ms.init.toFixed(0)} ms, full replay ${pg.ms.total.toFixed(0)} ms`);
console.log('fresh DB (migration -> seed):', JSON.stringify(snaps['@fresh'].counts));
console.log('intended (… -> migration again):', JSON.stringify(snaps['@intended'].counts));
const changedFields = {};
for (const x of lostOnFreshDb) for (const f of x.changed) changedFields[f] = (changedFields[f] ?? 0) + 1;
console.log(`quests whose prompt_skeleton differs fresh vs intended: ${lostOnFreshDb.length}`, JSON.stringify(changedFields));
console.log(`wrote fixtures/quests.json (${fixture.quests.length} quests)`);

if (useDocker) {
  const dk = replayDocker();
  const same = (n) => JSON.stringify(dk.snaps[n]) === JSON.stringify(snaps[n]);
  console.log(`docker: ${dk.version.split(',')[0]} (${dk.ms.total.toFixed(0)} ms incl. container start)`);
  console.log(`cross-check PGlite vs postgres:17  fresh=${same('@fresh') ? 'IDENTICAL' : 'DIFFERENT'}  intended=${same('@intended') ? 'IDENTICAL' : 'DIFFERENT'}`);
  if (!same('@fresh') || !same('@intended')) process.exitCode = 1;
}
