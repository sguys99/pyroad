#!/usr/bin/env node
// CRLF 붙여넣기 회귀 점검 (B39). run.sh 가 RLS_CRLF=1 일 때 호출합니다.
//
// Windows 에서 Supabase SQL Editor 에 붙여넣으면 줄바꿈이 모두 CRLF 로 바뀝니다. run.sh 는 운영 재현 DB 에
// 운영 붙여넣기용 묶음(scripts/release/build-release-sql.mjs)을 CRLF 로 바꿔 그대로 적용하고, 이 스크립트로
//   scan    : 적용한 DB 의 public 테이블 텍스트·jsonb 값, CHECK·기본값 정의, COMMENT 에 \r 이 한 글자도 없는지 확인하고
//             콘텐츠 테이블·닉네임 CHECK 의 스냅샷을 파일로 남김
//   compare : LF 로 적용한 DB(저장소 마이그레이션 + seed 로 db reset)의 스냅샷이 위 파일과 같은지 확인
//
// 사용: node crlf.mjs scan <scenario> <snapshot.json> | node crlf.mjs compare <scenario> <snapshot.json>
// 환경 변수: RLS_DB_CONTAINER (필수), RLS_RESULTS (결과 JSON Lines, 선택)
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const [, , cmd, scenario, snapshotFile] = process.argv;
const DB = process.env.RLS_DB_CONTAINER;
const RESULTS = process.env.RLS_RESULTS;
if (!DB || !['scan', 'compare'].includes(cmd) || !scenario || !snapshotFile) {
  console.error('사용: RLS_DB_CONTAINER=… node crlf.mjs scan|compare <scenario> <snapshot.json>');
  process.exit(2);
}

function psql(sql) {
  const r = spawnSync(
    'docker',
    ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-q', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`psql 실패: ${(r.stderr || '').trim().split('\n')[0]}`);
  return r.stdout.replace(/\n$/, '');
}

let failed = 0;
const EXPECT_LABEL = { 'CR-1': 'none', 'CR-2': 'none', 'CR-3': 'snapshot', 'CR-4': 'same' };
function record(id, op, ok, actual, detail) {
  const row = { scenario, group: 'B39', id, role: 'postgres', op, expect: EXPECT_LABEL[id], actual, status: ok ? 'PASS' : 'FAIL', detail };
  if (!ok) failed = 1;
  console.log(`${row.status} ${id} ${op} — ${actual}${detail ? ` (${detail})` : ''}`);
  if (RESULTS) appendFileSync(RESULTS, JSON.stringify(row) + '\n');
}

// public 테이블의 텍스트·jsonb 컬럼마다 \r 이 든 행 수. jsonb 는 ::text 가 \r 을 "\r" 로 이스케이프하므로 문자열 값을 풀어서 봄
const CR_COLUMNS_SQL = `
SELECT c.table_name, c.column_name, c.data_type
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
 WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
   AND (c.data_type IN ('text', 'character varying', 'character', 'json', 'jsonb')
        OR (c.data_type = 'ARRAY' AND c.udt_name IN ('_text', '_varchar')))
 ORDER BY 1, 2`;

const ident = (s) => `"${s.replace(/"/g, '""')}"`;
function crCountExpr({ table, column, type }) {
  const col = ident(column);
  const cond =
    type === 'json' || type === 'jsonb'
      ? `EXISTS (SELECT 1 FROM jsonb_path_query(${col}::jsonb, 'strict $.**') v
                  WHERE jsonb_typeof(v) = 'string' AND strpos(v #>> '{}', chr(13)) > 0)
         OR EXISTS (SELECT 1 FROM jsonb_path_query(${col}::jsonb, 'strict $.**') v, jsonb_object_keys(
                  CASE WHEN jsonb_typeof(v) = 'object' THEN v ELSE '{}'::jsonb END) k WHERE strpos(k, chr(13)) > 0)`
      : `strpos(${col}::text, chr(13)) > 0`;
  return `SELECT ${sqlLit(`${table}.${column}`)} AS col, count(*) AS n FROM public.${ident(table)} WHERE ${cond}`;
}
const sqlLit = (s) => `'${s.replace(/'/g, "''")}'`;

// 콘텐츠 테이블(시각 컬럼 제외)과 닉네임 CHECK·users 기본값. 정렬을 고정해 JSON 으로 비교
const SNAPSHOT_SQL = `
SELECT json_build_object(
  -- 월드 2·3(P5-03 seed)의 id 는 gen_random_uuid() 기본값이라 DB마다 다름 → slug 로 비교 (1월드 고정 id 는 stages.world_id 가 비교됨, P5-14)
  'worlds', (SELECT json_agg(to_jsonb(x) - 'id' - 'created_at' - 'updated_at' ORDER BY x.slug) FROM public.worlds x),
  'stages', (SELECT json_agg(to_jsonb(x) - 'created_at' - 'updated_at' ORDER BY x.id) FROM public.stages x),
  'quests', (SELECT json_agg(to_jsonb(x) - 'created_at' - 'updated_at' ORDER BY x.id) FROM public.quests x),
  'quest_answer_keys', (SELECT json_agg(to_jsonb(x) - 'created_at' - 'updated_at' ORDER BY x.quest_id)
                          FROM public.quest_answer_keys x),
  'users_nickname_chars', (SELECT pg_get_constraintdef(oid) FROM pg_constraint
                            WHERE conrelid = 'public.users'::regclass AND conname = 'users_nickname_chars'),
  'users_defaults', (SELECT json_object_agg(a.attname, pg_get_expr(d.adbin, d.adrelid) ORDER BY a.attname)
                       FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
                      WHERE d.adrelid = 'public.users'::regclass)
)::text`;

function snapshot() {
  return JSON.parse(psql(SNAPSHOT_SQL));
}

if (cmd === 'scan') {
  const cols = psql(CR_COLUMNS_SQL)
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [table, column, type] = l.split('|');
      return { table, column, type };
    });
  const counts = psql(cols.map(crCountExpr).join('\nUNION ALL\n') + ';')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('|'))
    .filter(([, n]) => Number(n) > 0);
  record(
    'CR-1',
    `public 테이블 텍스트·jsonb 컬럼 ${cols.length}개에 \\r 이 든 값`,
    counts.length === 0,
    counts.length ? 'found' : 'none',
    counts.map(([c, n]) => `${c}=${n}`).join(', '),
  );

  const defs = psql(`
SELECT 'constraint ' || conrelid::regclass || '.' || conname FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace AND strpos(pg_get_constraintdef(oid), chr(13)) > 0
UNION ALL
SELECT 'default ' || adrelid::regclass || '.' || adnum FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid
 WHERE c.relnamespace = 'public'::regnamespace AND strpos(pg_get_expr(adbin, adrelid), chr(13)) > 0
UNION ALL
SELECT 'comment ' || classoid::regclass || ' ' || objoid FROM pg_description WHERE strpos(description, chr(13)) > 0;`)
    .split('\n')
    .filter(Boolean);
  record(
    'CR-2',
    'public CHECK·기본값 정의, COMMENT 에 \\r',
    defs.length === 0,
    defs.length ? 'found' : 'none',
    defs.slice(0, 10).join(', '),
  );

  const snap = snapshot();
  writeFileSync(snapshotFile, JSON.stringify(snap));
  const n = (k) => (snap[k] ?? []).length;
  record(
    'CR-3',
    '콘텐츠 행이 있음 (CRLF 적용 결과 스냅샷)',
    n('quests') > 0 && n('quest_answer_keys') === n('quests') && n('stages') > 0 && Boolean(snap.users_nickname_chars),
    'snapshot',
    `worlds ${n('worlds')} · stages ${n('stages')} · quests ${n('quests')} · quest_answer_keys ${n('quest_answer_keys')}`,
  );
} else {
  const crlf = JSON.parse(readFileSync(snapshotFile, 'utf8'));
  const lf = snapshot();
  const diff = Object.keys({ ...crlf, ...lf }).filter((k) => !isDeepStrictEqual(crlf[k], lf[k]));
  let detail = '';
  for (const k of diff) {
    const a = crlf[k];
    const b = lf[k];
    if (Array.isArray(a) && Array.isArray(b)) {
      const i = a.findIndex((r, j) => !isDeepStrictEqual(r, b[j]));
      const keys = i < 0 ? [] : Object.keys({ ...a[i], ...b[i] }).filter((c) => !isDeepStrictEqual(a[i]?.[c], b[i]?.[c]));
      detail += `${k}: ${a.length}↔${b.length}행, 첫 차이 #${i} ${keys.join(',')}; `;
    } else detail += `${k}; `;
  }
  record(
    'CR-4',
    'CRLF 묶음으로 적용한 운영 재현 DB = LF 로 적용한 DB (worlds·stages·quests·quest_answer_keys·닉네임 CHECK·users 기본값)',
    diff.length === 0,
    diff.length ? 'differs' : 'same',
    detail.trim(),
  );
}
process.exit(failed);
