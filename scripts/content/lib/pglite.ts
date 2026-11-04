// 콘텐츠 도구용 메모리 Postgres (PGlite, WASM). docker·로컬 Supabase 스택 없이
// 저장소의 마이그레이션과 seed SQL을 그대로 실행하고, 콘텐츠 테이블을 JSON으로 읽어 온다.
// 출발점: spikes/p0-09-solution-check/extract.mjs (P0-09에서 docker postgres:17과 결과가 같음을 확인)

import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './paths';

const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase/migrations');

// 마이그레이션이 기대하는 Supabase 기본 객체의 최소 대역 (역할, auth 스키마)
const SUPABASE_STUB = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT 'service_role'::text $f$;
`;

/** supabase/migrations/*.sql 를 이름 순으로. `upTo`(예: '00005')를 주면 그 번호까지만 */
export function migrationFiles(upTo?: string): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{5}_.*\.sql$/.test(f))
    .filter((f) => !upTo || f.slice(0, 5) <= upTo)
    .sort()
    .map((f) => join(MIGRATIONS_DIR, f));
}

export interface ContentSnapshot {
  stages: Record<string, unknown>[];
  quests: Record<string, unknown>[];
  answer_keys: Record<string, unknown>[];
}

// created_at·updated_at 은 실행 시각이라 비교에서 뺀다. jsonb 는 키 순서가 정규화되어 나온다.
const SNAPSHOT_SQL = `
SELECT json_build_object(
  'stages', (SELECT coalesce(json_agg(row_to_json(s) ORDER BY s."order"), '[]'::json) FROM (
    SELECT id, "order", title, theme_name, description, is_final FROM public.stages) s),
  'quests', (SELECT coalesce(json_agg(row_to_json(q) ORDER BY q.stage_order, q."order"), '[]'::json) FROM (
    SELECT q.id, q.stage_id, s."order" AS stage_order, q."order", q.title, q.concept,
           q.prompt_skeleton, q.validation_type, q.expected_output, q.xp_reward
      FROM public.quests q JOIN public.stages s ON s.id = q.stage_id) q),
  'answer_keys', (SELECT coalesce(json_agg(row_to_json(k) ORDER BY k.quest_id), '[]'::json) FROM (
    SELECT quest_id, expected_output, hints, solution_code, steps, quiz_answer
      FROM public.quest_answer_keys) k)
)::text AS j`;

export interface ReplayOptions {
  /** 마이그레이션 번호 상한 (예: '00005'). 작업 중인 다른 마이그레이션을 빼고 싶을 때 */
  migrationsUpTo?: string;
  /** 마이그레이션 다음에 순서대로 실행할 SQL 텍스트 (seed 등) */
  seeds: { name: string; sql: string }[];
}

export interface ReplayResult {
  snapshot: ContentSnapshot;
  migrations: string[];
  engine: string;
}

/** 새 메모리 DB에 stub → migrations → seeds 를 실행하고 콘텐츠 테이블 스냅샷을 돌려준다 */
export async function replay(options: ReplayOptions): Promise<ReplayResult> {
  const db = new PGlite();
  await db.waitReady;
  try {
    // 마이그레이션의 NOTICE(정답 개수 자기 검증 등)는 화면에 찍지 않는다
    await db.exec(`SET client_min_messages = warning;`);
    await db.exec(SUPABASE_STUB);
    const files = migrationFiles(options.migrationsUpTo);
    for (const file of files) {
      await runStep(db, file, readFileSync(file, 'utf8'));
    }
    for (const seed of options.seeds) {
      await runStep(db, seed.name, seed.sql);
    }
    const { rows } = await db.query<{ j: string }>(SNAPSHOT_SQL);
    const engine = (await db.query<{ v: string }>('SELECT version() AS v'))
      .rows[0].v;
    return {
      snapshot: JSON.parse(rows[0].j) as ContentSnapshot,
      migrations: files.map((f) => f.slice(MIGRATIONS_DIR.length + 1)),
      engine: engine.split(',')[0],
    };
  } finally {
    await db.close();
  }
}

async function runStep(db: PGlite, name: string, sql: string) {
  try {
    await db.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[pglite] ${name} 실행 실패: ${message}`);
  }
}
