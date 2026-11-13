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
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  last_sign_in_at timestamptz
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT NULL::uuid $f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT 'service_role'::text $f$;
-- pgcrypto(Supabase 는 extensions 스키마에 기본 설치) 대역: 00043 자기 검증이 부름. 콘텐츠 도구라 난수 품질은 상관없음
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql VOLATILE AS
  $f$ SELECT substring(decode(md5(random()::text) || md5(random()::text), 'hex') FROM 1 FOR $1) $f$;
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
  worlds: Record<string, unknown>[];
  stages: Record<string, unknown>[];
  quests: Record<string, unknown>[];
  answer_keys: Record<string, unknown>[];
}

// created_at·updated_at 은 실행 시각이라 비교에서 뺀다. jsonb 는 키 순서가 정규화되어 나온다.
// stages.world 는 world_id 대신 월드 slug (빌드 행과 같은 모양). 정렬은 (월드 order, 스테이지 order)이고 world_order 는 빼고 내보냄
const SNAPSHOT_SQL = `
SELECT json_build_object(
  'worlds', (SELECT coalesce(json_agg(row_to_json(w) ORDER BY w."order"), '[]'::json) FROM (
    SELECT slug, "order", title, theme, description, unlock_rule FROM public.worlds) w),
  'stages', (SELECT coalesce(json_agg(to_jsonb(s) - 'world_order' ORDER BY s.world_order, s."order"), '[]'::json) FROM (
    SELECT s.id, w.slug AS world, w."order" AS world_order, s."order", s.title, s.theme_name, s.description, s.is_final
      FROM public.stages s JOIN public.worlds w ON w.id = s.world_id) s),
  'quests', (SELECT coalesce(json_agg(to_jsonb(q) - 'world_order' ORDER BY q.world_order, q.stage_order, q."order"), '[]'::json) FROM (
    SELECT q.id, q.stage_id, w."order" AS world_order, s."order" AS stage_order, q."order", q.title, q.concept,
           q.quest_type, q.quiz_kind, q.is_mobile_friendly,
           q.prompt_skeleton, q.validation_type, q.expected_output, q.xp_reward
      FROM public.quests q JOIN public.stages s ON s.id = q.stage_id JOIN public.worlds w ON w.id = s.world_id) q),
  'answer_keys', (SELECT coalesce(json_agg(row_to_json(k) ORDER BY k.quest_id), '[]'::json) FROM (
    SELECT quest_id, expected_output, hints, solution_code, steps, quiz_answer
      FROM public.quest_answer_keys) k)
)::text AS j`;

export interface ReplayOptions {
  /** 마이그레이션 번호 상한 (예: '00005'). 작업 중인 다른 마이그레이션을 빼고 싶을 때 */
  migrationsUpTo?: string;
  /** 마이그레이션 다음에 순서대로 실행할 SQL 텍스트 (seed 등) */
  seeds: { name: string; sql: string }[];
  /**
   * 마이그레이션·seed 의 줄바꿈을 모두 CRLF 로 바꿔 실행 (B39).
   * Windows 에서 SQL Editor 에 붙여넣으면 이렇게 바뀌므로, 결과가 LF 로 실행한 것과 같아야 함
   */
  crlf?: boolean;
}

/** 줄바꿈을 모두 CRLF 로 (이미 CRLF 인 줄은 그대로) */
export function toCrlf(sql: string): string {
  return sql.replace(/\r?\n/g, '\r\n');
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
    const text = options.crlf ? toCrlf : (sql: string) => sql;
    for (const file of files) {
      await runStep(db, file, text(readFileSync(file, 'utf8')));
    }
    for (const seed of options.seeds) {
      await runStep(db, seed.name, text(seed.sql));
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
