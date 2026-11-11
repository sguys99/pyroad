#!/usr/bin/env node
// pyRoad RLS·권한 회귀 점검 러너 (P1-20)
// 출발점: spikes/p0-08-answer-keys/checks.mjs (P0-08). 기대값은 expectations.mjs 에 따로 둡니다.
// 사용: node supabase/tests/checks.mjs <scenario>   (run.sh 가 환경 변수를 채워서 호출)
//
// 환경 변수
//   RLS_API_URL           로컬 API (예: http://127.0.0.1:54521). 루프백 주소가 아니면 중단
//   RLS_ANON_KEY          로컬 anon 키 (supabase status -o env)
//   RLS_SERVICE_ROLE_KEY  로컬 service_role 키
//   RLS_DB_CONTAINER      DB 컨테이너 이름 (예: supabase_db_pyroad)
//   RLS_RESULTS           결과를 덧붙일 JSON Lines 파일 (선택)
//   RLS_UPDATE_SNAPSHOTS  1 이면 snapshots/*.txt 를 현재 DB 상태로 다시 씀
//
// 각 점검은 { scenario, group, id, role, op, expect, actual, status } 한 줄을 남깁니다.
// status: PASS | GAP(known-gap 그대로) | PENDING(requires 객체 없음) | INFO | FAIL
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPECT } from './expectations.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = must('RLS_API_URL');
const ANON = must('RLS_ANON_KEY');
const SERVICE = must('RLS_SERVICE_ROLE_KEY');
const DB = must('RLS_DB_CONTAINER');
const RESULTS = process.env.RLS_RESULTS;
const UPDATE_SNAPSHOTS = process.env.RLS_UPDATE_SNAPSHOTS === '1';
const scenario = process.argv[2];

function must(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env ${name}`);
    process.exit(2);
  }
  return v;
}

// 운영 DB 보호: 로컬 스택에만 요청
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(API).hostname)) {
  console.error(
    `RLS_API_URL 이 로컬 주소가 아닙니다: ${API} (운영 DB 에는 접속하지 않음)`,
  );
  process.exit(2);
}

// ── 시나리오 ──────────────────────────────────────────────
// 점검 목록과 기대값은 모든 시나리오에서 같습니다 (00003 이후 두 권한 기본값이 같은 결과가 되어야 함).
// prodData: 운영처럼 solution_code 가 채워진 데이터 (B08 점검 대상 아님)
const SCENARIOS = {
  local: { label: '빠른 모드: pyroad 로컬 스택 (신규 기본값)' },
  fresh_legacy: {
    label: '새 DB, 새 테이블 자동 노출 켜짐 (운영과 같은 legacy 기본값)',
  },
  fresh_newdefault: { label: '새 DB, 자동 노출 꺼짐 (CLI 신규 기본값)' },
  prod_replay: {
    label:
      '운영 재현: 핫픽스 전 00001 + seed + Section 6 → 00002~ 를 SQL Editor 처럼 적용',
    prodData: true,
  },
};
const S = SCENARIOS[scenario];
if (!S) {
  console.error(
    `unknown scenario ${scenario}. one of: ${Object.keys(SCENARIOS).join(', ')}`,
  );
  process.exit(2);
}

// Supabase 가 관리하는 스키마 (앱 객체가 아님)
const MANAGED_SCHEMAS = `('pg_catalog', 'information_schema', 'pg_toast', 'auth', 'storage', 'realtime', '_realtime',
  'extensions', 'graphql', 'vault', 'pgsodium', 'pgsodium_masks', 'supabase_functions', 'supabase_migrations',
  'net', 'cron', 'pgbouncer', '_analytics', '_supavisor', 'pgtle')`;
const APP_SCHEMA = (alias) =>
  `${alias}.nspname not in ${MANAGED_SCHEMAS} and ${alias}.nspname not like 'pg\\_%'`;

// ── 공통 도구 ─────────────────────────────────────────────
function psql(sql) {
  const r = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      DB,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return {
    ok: r.status === 0,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
  };
}
function one(sql) {
  const r = psql(sql);
  if (!r.ok) throw new Error(firstLine(r.err));
  return r.out;
}
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** psql 에서 역할을 바꿔 실행 (트랜잭션은 항상 ROLLBACK) */
function psqlAs(role, uid, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role });
  return psql(
    `BEGIN;\nSET LOCAL ROLE ${role};\nSET LOCAL request.jwt.claims = '${claims}';\n${sql}\nROLLBACK;\n`,
  );
}
/** psqlAs 와 같지만 COMMIT (다른 트랜잭션의 RPC 가 결과를 봐야 하는 점검용. 점검 전용 사용자에만 씀) */
function psqlAsCommit(role, uid, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role });
  return psql(
    `BEGIN;\nSET LOCAL ROLE ${role};\nSET LOCAL request.jwt.claims = '${claims}';\n${sql}\nCOMMIT;\n`,
  );
}
function classifySql(r) {
  if (r.ok)
    return {
      actual: 'allowed',
      detail: r.out.split('\n').slice(0, 3).join(' | '),
    };
  if (/permission denied|row-level security/i.test(r.err))
    return { actual: 'denied', detail: firstLine(r.err) };
  return { actual: 'error', detail: firstLine(r.err) };
}
/** psql 쓰기 (RETURNING 결과가 있으면 실제로 쓴 것) */
function classifySqlWrite(r) {
  const c = classifySql(r);
  if (c.actual !== 'allowed') return c;
  return r.out
    ? { actual: 'written', detail: c.detail }
    : { actual: 'no-op', detail: '0행 (RLS)' };
}
const firstLine = (s) =>
  (s || '').split('\n').find((l) => l.startsWith('ERROR')) ||
  (s || '').split('\n')[0];

async function rest(
  method,
  path,
  { as = 'anon', body, prefer, headers = {} } = {},
) {
  const auth = as === 'anon' ? ANON : as === 'service' ? SERVICE : as.token;
  const key = as === 'service' ? SERVICE : ANON;
  const h = { apikey: key, Authorization: `Bearer ${auth}`, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (prefer) h.Prefer = prefer;
  const res = await fetch(API + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, headers: res.headers };
}
const errCode = (r) =>
  r.json && typeof r.json === 'object' && !Array.isArray(r.json)
    ? r.json.code
    : undefined;
const errMsg = (r) =>
  r.json && typeof r.json === 'object' && !Array.isArray(r.json)
    ? r.json.message
    : '';

function classifyRead(r) {
  if (r.status === 401 || r.status === 403 || errCode(r) === '42501')
    return {
      actual: 'denied',
      detail: `${r.status} ${errCode(r) ?? ''} ${errMsg(r) ?? ''}`.trim(),
    };
  if (r.status >= 200 && r.status < 300) {
    if (Array.isArray(r.json))
      return {
        actual: r.json.length ? 'allowed' : 'empty',
        detail: `${r.status} rows=${r.json.length}`,
      };
    return { actual: 'allowed', detail: `${r.status}` };
  }
  if (
    errCode(r) === '42703' ||
    errCode(r) === 'PGRST204' ||
    /column .* does not exist/i.test(errMsg(r))
  )
    return {
      actual: 'no-column',
      detail: `${r.status} ${errCode(r)} ${errMsg(r)}`,
    };
  return {
    actual: `error`,
    detail: `${r.status} ${errCode(r) ?? ''} ${errMsg(r) ?? ''}`.trim(),
  };
}

/** 쓰기 요청 후 DB 에서 실제로 반영됐는지 확인 (verifySql 이 't' 면 반영) */
async function classifyWrite(reqPromise, verifySql) {
  const r = await reqPromise;
  const written = one(verifySql) === 't';
  const base = `${r.status} ${errCode(r) ?? ''} ${errMsg(r) ?? ''}`.trim();
  if (written) return { actual: 'written', detail: base };
  if (r.status === 401 || r.status === 403 || errCode(r) === '42501')
    return { actual: 'denied', detail: base };
  if (r.status >= 200 && r.status < 300)
    return { actual: 'no-op', detail: `${base} (RLS 로 0행)` };
  return { actual: 'error', detail: base };
}

/** 뷰 쓰기: 00014 부터 display_name 은 계산 컬럼이라 PostgREST 가 0A000(갱신할 수 없는 뷰 컬럼)으로 거부 = 막힘 */
async function classifyViewWrite(reqPromise, verifySql) {
  const c = await classifyWrite(reqPromise, verifySql);
  return c.actual === 'error' && /\b0A000\b/.test(c.detail)
    ? { actual: 'denied', detail: c.detail }
    : c;
}

/** quests 응답에서 정답이 섞인 행 수 */
function classifyLeak(r) {
  const c = classifyRead(r);
  if (c.actual !== 'allowed') return c;
  const leaks = r.json.filter((q) => {
    const steps = Array.isArray(q.steps) ? q.steps : [];
    return (
      (q.expected_output && q.expected_output !== '') ||
      (q.hints && Object.keys(q.hints).length) ||
      q.sol ||
      steps.some((s) => s.expected_output || s.hints || s.solution_code)
    );
  }).length;
  return leaks
    ? { actual: 'leaks', detail: `${leaks}/${r.json.length}행에 정답` }
    : { actual: 'no-answers', detail: `rows=${r.json.length}` };
}

// 결과 분류 → 보안(deny)/열림(allow) 집합. 배열 또는 판정 함수
const READ = { deny: ['denied', 'empty', 'no-column'], allow: ['allowed'] };
const WRITE = { deny: ['denied', 'no-op'], allow: ['written'] };
const SQLW = { deny: ['denied', 'no-op'], allow: ['written'] };
const LEAK = { deny: ['no-answers', 'denied', 'no-column'], allow: ['leaks'] };
const NONE = { deny: ['none'], allow: (a) => a !== 'none' && a !== 'error' };
const hit = (set, actual) =>
  typeof set === 'function' ? set(actual) : (set ?? []).includes(actual);

// ── 점검 실행기 ───────────────────────────────────────────
const results = [];
const requireCache = new Map();
function requirementMet(req) {
  if (!requireCache.has(req)) {
    let sql;
    if (req.endsWith('()')) {
      const [schema, fn] = req.slice(0, -2).split('.');
      sql = `select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = ${sqlStr(schema)} and p.proname = ${sqlStr(fn)})`;
    } else {
      const parts = req.split('.');
      sql =
        parts.length === 3
          ? `select exists (select 1 from information_schema.columns where table_schema = ${sqlStr(parts[0])} and table_name = ${sqlStr(parts[1])} and column_name = ${sqlStr(parts[2])})`
          : `select to_regclass(${sqlStr(req)}) is not null`;
    }
    requireCache.set(req, one(sql) === 't');
  }
  return requireCache.get(req);
}

/**
 * spec: { group, id, role, op, deny, allow, run }
 *   deny/allow: 결과(actual) 중 "막힘"/"열림"으로 볼 값
 *   run(): { actual, detail }
 */
async function check(spec) {
  const { group, id, role, op } = spec;
  const e = EXPECT[id];
  const row = { scenario, group, id, role, op, expect: e?.expect ?? '?' };
  if (e?.flipIn) row.flipIn = e.flipIn;
  if (e?.activateIn) row.activateIn = e.activateIn;
  if (!e) {
    Object.assign(row, {
      actual: '-',
      status: 'FAIL',
      detail: 'expectations.mjs 에 기대값이 없음',
    });
  } else if (e.requires && !requirementMet(e.requires)) {
    Object.assign(row, {
      actual: '-',
      status: 'PENDING',
      detail: `${e.requires} 없음${e.activateIn ? ` (${e.activateIn} 이후 자동 활성화)` : ''}`,
    });
  } else {
    let out;
    try {
      out = await spec.run();
    } catch (err) {
      out = {
        actual: 'exception',
        detail: String(err?.stack || err).split('\n')[0],
      };
    }
    row.actual = out.actual;
    row.detail = out.detail ?? '';
    const isDeny = hit(spec.deny, out.actual);
    const isAllow = hit(spec.allow, out.actual);
    if (e.expect === 'info') row.status = 'INFO';
    else if (e.expect === 'deny' || e.expect === 'snapshot')
      row.status = isDeny ? 'PASS' : 'FAIL';
    else if (e.expect === 'allow') row.status = isAllow ? 'PASS' : 'FAIL';
    else if (e.expect === 'known-gap') {
      if (isAllow) row.status = 'GAP';
      else {
        row.status = 'FAIL';
        if (isDeny)
          row.detail = `구멍이 막힘 → expectations.mjs 의 '${id}' 를 expect: 'deny' 로 바꾸세요${e.flipIn ? ` (${e.flipIn})` : ''}. ${row.detail}`;
      }
    } else {
      row.status = 'FAIL';
      row.detail = `알 수 없는 expect '${e.expect}'`;
    }
  }
  results.push(row);
  const tag = row.flipIn ? ` [${row.flipIn}]` : '';
  console.log(
    `${row.status.padEnd(7)} ${id.padEnd(7)} ${role} :: ${op} → ${row.actual}${tag}${row.detail ? `  (${row.detail})` : ''}`,
  );
}

/** 카탈로그 쿼리 결과를 snapshots/<name>.txt 와 비교 */
function snapshot(name, sql) {
  return () => {
    const file = join(HERE, 'snapshots', `${name}.txt`);
    const now = one(sql).split('\n').filter(Boolean);
    const header = [
      `# ${name}: supabase/tests/checks.mjs 가 만든 스냅샷. 직접 고치지 말고`,
      '# 의도한 권한 변경이면 RLS_UPDATE_SNAPSHOTS=1 npm run test:rls 로 다시 만들고 diff 를 리뷰하세요.',
    ];
    if (UPDATE_SNAPSHOTS) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, [...header, ...now].join('\n') + '\n');
      return { actual: 'match', detail: `갱신함 (${now.length}줄)` };
    }
    let saved;
    try {
      saved = readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#'));
    } catch {
      return {
        actual: 'missing',
        detail: `${file} 없음 → RLS_UPDATE_SNAPSHOTS=1 로 생성`,
      };
    }
    const added = now.filter((l) => !saved.includes(l));
    const removed = saved.filter((l) => !now.includes(l));
    if (!added.length && !removed.length)
      return { actual: 'match', detail: `${now.length}줄` };
    for (const l of removed) console.log(`        - ${l}`);
    for (const l of added) console.log(`        + ${l}`);
    return {
      actual: 'diff',
      detail: `+${added.length} -${removed.length} (위 diff 확인. 의도한 변경이면 RLS_UPDATE_SNAPSHOTS=1)`,
    };
  };
}

// ── 테스트 사용자 ─────────────────────────────────────────
// 로그인(토큰 발급)은 alice 한 명만 합니다. Auth 로그인 rate limit(5분 30회)을 아끼기 위해서입니다.
const RUN = Date.now().toString(36);
async function createUser(name, fullName, { signIn = false } = {}) {
  const email = `${name}.${scenario}.${RUN}@example.com`.replace(/_/g, '-');
  const password = `pw-${RUN}-${name}-Aa1!`;
  const c = await rest('POST', '/auth/v1/admin/users', {
    as: 'service',
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    },
  });
  if (c.status >= 300)
    throw new Error(
      `create user ${name}: ${c.status} ${JSON.stringify(c.json)}`,
    );
  const u = { name, id: c.json.id };
  if (!signIn) return u;
  const t = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const tj = await t.json();
  if (!tj.access_token)
    throw new Error(
      `sign in ${name}: ${t.status} ${JSON.stringify(tj)}${t.status === 429 ? ' (Auth rate limit: 5분 뒤 다시 실행)' : ''}`,
    );
  u.token = tj.access_token;
  return u;
}

const Q1 = 'b1000000-0000-0000-0000-000000000001'; // 1-1 첫 번째 인사
const Q2 = 'b1000000-0000-0000-0000-000000000002'; // 1-2
const Q3 = 'b1000000-0000-0000-0000-000000000003'; // 1-4
const Q_PROJECT = 'b1000000-0000-0000-0000-000000000022'; // 7-1 프로젝트
const STAGE1 = 'a1000000-0000-0000-0000-000000000001';
/** 콘텐츠 seed(생성물)의 quest_type 별 퀘스트 수. 기대값을 숫자로 박지 않고 seed 에서 셈 (build.ts 가 quest_type 을 한 줄에 씀) */
const seedQuestCount = (type) =>
  readFileSync(join(HERE, '..', 'seed.sql'), 'utf8').match(new RegExp(`^  '${type}',\\r?$`, 'gm'))?.length ?? 0;

// ── 그룹 ──────────────────────────────────────────────────
async function groupEnv() {
  await check({
    group: 'env',
    id: 'ENV-1',
    role: 'postgres',
    op: 'public 새 테이블의 anon 기본 권한 (새 테이블 자동 노출)',
    run: () => {
      const acl = one(
        `select coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'r'`,
      );
      const m = acl.match(/anon=([^/]*)\//);
      return {
        actual: m && m[1].includes('r') ? 'on' : 'off',
        detail: `postgres 기본 ACL(테이블) anon=${m ? m[1] : '(없음)'}`,
      };
    },
  });
  await check({
    group: 'env',
    id: 'ENV-2',
    role: 'postgres',
    op: 'public 새 함수의 anon EXECUTE 기본 권한',
    run: () => {
      const acl = one(
        `select coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'`,
      );
      return {
        actual: /anon=X/.test(acl) ? 'on' : 'off',
        detail: acl || '(없음: PUBLIC EXECUTE 기본값)',
      };
    },
  });
}

async function groupView(u) {
  await check({
    group: 'view',
    id: 'B03-1',
    role: 'anon',
    op: 'GET /user_profiles_public?select=*',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', '/rest/v1/user_profiles_public?select=*')),
  });
  await check({
    group: 'view',
    id: 'B03-2',
    role: 'anon(psql)',
    op: 'SET ROLE anon; SELECT count(*) FROM user_profiles_public',
    ...READ,
    run: async () =>
      classifySql(
        psqlAs(
          'anon',
          null,
          'SELECT count(*) FROM public.user_profiles_public;',
        ),
      ),
  });
  await check({
    group: 'view',
    id: 'B03-3',
    role: 'authenticated',
    op: 'GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url(NULL)·avatar_skin 뿐 (P3-13)',
    ...READ,
    run: async () => {
      const r = await rest('GET', '/rest/v1/user_profiles_public?select=*', {
        as: u.alice,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const keys = Object.keys(r.json[0]).sort().join(',');
      return keys === 'avatar_skin,avatar_url,display_name,id'
        ? { actual: 'allowed', detail: `rows=${r.json.length}, cols=${keys}` }
        : { actual: 'extra-columns', detail: keys };
    },
  });
  await check({
    group: 'view',
    id: 'B03-4',
    role: 'authenticated',
    op: 'GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼)',
    ...READ,
    run: async () =>
      classifyRead(
        await rest('GET', '/rest/v1/user_profiles_public?select=total_xp', {
          as: u.alice,
        }),
      ),
  });
  await check({
    group: 'view',
    id: 'B03-5',
    role: 'authenticated',
    op: 'PATCH /user_profiles_public?id=eq.<다른 사용자> {display_name}',
    ...WRITE,
    run: () =>
      classifyViewWrite(
        rest('PATCH', `/rest/v1/user_profiles_public?id=eq.${u.bob.id}`, {
          as: u.alice,
          body: { display_name: '해킹됨' },
          prefer: 'return=minimal',
        }),
        `select display_name = '해킹됨' from public.users where id = '${u.bob.id}'`,
      ),
  });
  await check({
    group: 'view',
    id: 'B03-6',
    role: 'anon',
    op: 'PATCH /user_profiles_public?id=eq.<사용자> {display_name}',
    ...WRITE,
    run: () =>
      classifyViewWrite(
        rest('PATCH', `/rest/v1/user_profiles_public?id=eq.${u.bob.id}`, {
          body: { display_name: '익명해킹' },
          prefer: 'return=minimal',
        }),
        `select display_name = '익명해킹' from public.users where id = '${u.bob.id}'`,
      ),
  });
  await check({
    group: 'view',
    id: 'B03-7',
    role: 'authenticated',
    op: 'DELETE /user_profiles_public?id=eq.<다른 사용자> (users 행 삭제 → 진행·뱃지 연쇄 삭제)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/user_profiles_public?id=eq.${u.carol.id}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.users where id = '${u.carol.id}')`,
      ),
  });
  await check({
    group: 'view',
    id: 'B03-7b',
    role: 'anon',
    op: 'DELETE /user_profiles_public?id=eq.<사용자>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/user_profiles_public?id=eq.${u.dan.id}`, {
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.users where id = '${u.dan.id}')`,
      ),
  });
  await check({
    group: 'view',
    id: 'B03-8',
    role: 'postgres',
    op: 'user_profiles_public 의 anon/authenticated/PUBLIC 권한',
    deny: ['authenticated:SELECT'],
    allow: (a) => a !== 'authenticated:SELECT',
    run: () => {
      const v =
        one(`select coalesce(string_agg(grantee || ':' || privs, ' ' order by grantee), '') from (
      select grantee, string_agg(privilege_type, ',' order by privilege_type) privs
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'user_profiles_public' and grantee in ('anon', 'authenticated', 'PUBLIC')
       group by grantee) t`);
      return { actual: v, detail: v };
    },
  });
  await check({
    group: 'view',
    id: 'B03-11',
    role: 'service_role',
    op: 'GET /user_profiles_public?select=*',
    ...READ,
    run: async () =>
      classifyRead(
        await rest('GET', '/rest/v1/user_profiles_public?select=*', {
          as: 'service',
        }),
      ),
  });
  await check({
    group: 'view',
    id: 'VIEW-1',
    role: 'postgres',
    op: '앱 스키마의 모든 뷰: anon/authenticated 의 INSERT·UPDATE·DELETE·TRUNCATE 권한',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(format('%s.%s %s:%s', n.nspname, c.relname, r.rolname, p.priv), ', ' order by 1), '')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        cross join (values ('anon'), ('authenticated')) r(rolname)
        cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p(priv)
       where c.relkind in ('v', 'm') and ${APP_SCHEMA('n')}
         and has_table_privilege(r.rolname, c.oid, p.priv)`);
      return { actual: v ? 'writable' : 'none', detail: v || '(없음)' };
    },
  });
  await check({
    group: 'view',
    id: 'VIEW-2',
    role: 'postgres',
    op: 'security_invoker 가 아닌 뷰 (기반 테이블 RLS 를 우회)',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(format('%s.%s', n.nspname, c.relname), ',' order by 1), '')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'v' and ${APP_SCHEMA('n')}
         and not coalesce(c.reloptions::text[] && array['security_invoker=true', 'security_invoker=on', 'security_invoker=1'], false)`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });

  // ── 공개 프로필 테이블 (B34, 00018): 뷰가 security_invoker 로 읽는 테이블 ──
  const PPT = '/rest/v1/user_public_profiles';
  await check({
    group: 'view',
    id: 'PP-1',
    role: 'anon',
    op: 'GET /user_public_profiles?select=*',
    ...READ,
    run: async () => classifyRead(await rest('GET', `${PPT}?select=*`)),
  });
  await check({
    group: 'view',
    id: 'PP-2',
    role: 'authenticated',
    op: 'PATCH /user_public_profiles?user_id=eq.<다른 사용자> {public_name} · DELETE …<다른 사용자> · POST {user_id: 새 id}',
    deny: ['denied', 'no-op'],
    allow: ['written'],
    run: async () => {
      const patch = await classifyWrite(
        rest('PATCH', `${PPT}?user_id=eq.${u.bob.id}`, {
          as: u.alice,
          body: { public_name: '사칭이름' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_public_profiles where user_id = '${u.bob.id}' and public_name = '사칭이름')`,
      );
      const del = await classifyWrite(
        rest('DELETE', `${PPT}?user_id=eq.${u.bob.id}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.user_public_profiles where user_id = '${u.bob.id}')`,
      );
      const ins = await classifyWrite(
        rest('POST', PPT, {
          as: u.alice,
          body: { user_id: '00000000-0000-0000-0000-0000000000aa', public_name: 'x' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_public_profiles where user_id = '00000000-0000-0000-0000-0000000000aa')`,
      );
      const all = [patch, del, ins];
      const written = all.some((c) => c.actual === 'written');
      const ok = all.every((c) => WRITE.deny.includes(c.actual));
      return {
        actual: written ? 'written' : ok ? 'denied' : 'error',
        detail: `PATCH ${patch.detail} · DELETE ${del.detail} · POST ${ins.detail}`,
      };
    },
  });
  await check({
    group: 'view',
    id: 'PP-3',
    role: 'authenticated',
    op: '동기화 트리거: 가입 → 모험가NNNN · 닉네임 변경(P3-11 처럼 UPDATE (nickname) 을 준 authenticated) → 공개 이름·뷰 · 공개 프로필 직접 UPDATE 거부 · 닉네임 지우면 자리표시자',
    ...OK,
    run: async () => {
      const x = await createUser('pp3', '공개실명');
      return sqlCheck(`
        DO $$
        BEGIN
          IF (SELECT public_name FROM public.user_public_profiles WHERE user_id = '${x.id}')
             IS DISTINCT FROM public.placeholder_display_name('${x.id}') THEN
            RAISE EXCEPTION '가입 직후 공개 이름이 자리표시자가 아님';
          END IF;
        END $$;
        GRANT UPDATE (nickname) ON public.users TO authenticated;
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub": "${x.id}", "role": "authenticated"}';
        UPDATE public.users SET nickname = '공개코딩' WHERE id = '${x.id}';
        DO $$
        BEGIN
          IF (SELECT display_name FROM public.user_profiles_public WHERE id = '${x.id}') IS DISTINCT FROM '공개코딩' THEN
            RAISE EXCEPTION '닉네임을 바꿨는데 뷰 이름이 그대로';
          END IF;
          BEGIN
            UPDATE public.user_public_profiles SET public_name = '직접' WHERE user_id = '${x.id}';
            RAISE EXCEPTION '공개 프로필 직접 UPDATE 가 허용됨';
          EXCEPTION WHEN insufficient_privilege THEN NULL;
          END;
        END $$;
        RESET ROLE;
        UPDATE public.users SET nickname = NULL WHERE id = '${x.id}';
        DO $$
        BEGIN
          IF (SELECT public_name FROM public.user_public_profiles WHERE user_id = '${x.id}')
             IS DISTINCT FROM public.placeholder_display_name('${x.id}') THEN
            RAISE EXCEPTION '닉네임을 지웠는데 자리표시자로 돌아가지 않음';
          END IF;
        END $$;`);
    },
  });
  await check({
    group: 'view',
    id: 'PP-4',
    role: 'postgres',
    op: 'users 행 중 공개 프로필 행이 없거나 이름 ≠ coalesce(nickname, placeholder_display_name) 인 수',
    deny: ['0'],
    allow: (a) => a !== '0' && a !== 'exception',
    run: () => {
      const v = one(`select count(*) from public.users u
        left join public.user_public_profiles p on p.user_id = u.id
       where p.public_name is distinct from coalesce(u.nickname, public.placeholder_display_name(u.id))`);
      return { actual: v, detail: `${v}명 / 전체 ${one('select count(*) from public.users')}명` };
    },
  });
  await check({
    group: 'view',
    id: 'PP-5',
    role: 'authenticated',
    op: '공개 아바타 동기화 (P3-13, 00021): avatar_config.skin(P3-11 처럼 UPDATE (avatar_config) 를 준 authenticated) → avatar_skin·뷰 · 모르는 값·다른 키는 공개 안 됨 · 직접 UPDATE 거부 · CHECK',
    ...OK,
    run: async () => {
      const x = await createUser('pp5', '공개스킨');
      return sqlCheck(`
        GRANT UPDATE (avatar_config) ON public.users TO authenticated;
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub": "${x.id}", "role": "authenticated"}';
        DO $$
        BEGIN
          IF (SELECT avatar_skin FROM public.user_profiles_public WHERE id = '${x.id}') IS NOT NULL THEN
            RAISE EXCEPTION '가입 직후 스킨이 NULL 이 아님';
          END IF;
        END $$;
        UPDATE public.users SET avatar_config = '{"skin": "sky", "hat": "crown"}' WHERE id = '${x.id}';
        DO $$
        BEGIN
          IF (SELECT avatar_skin FROM public.user_profiles_public WHERE id = '${x.id}') IS DISTINCT FROM 'sky'
             OR (SELECT avatar_url FROM public.user_profiles_public WHERE id = '${x.id}') IS NOT NULL THEN
            RAISE EXCEPTION '스킨을 골랐는데 뷰 avatar_skin 이 sky 가 아님 (또는 사진이 보임)';
          END IF;
          BEGIN
            UPDATE public.user_public_profiles SET avatar_skin = 'berry' WHERE user_id = '${x.id}';
            RAISE EXCEPTION '공개 프로필 avatar_skin 직접 UPDATE 가 허용됨';
          EXCEPTION WHEN insufficient_privilege THEN NULL;
          END;
        END $$;
        UPDATE public.users SET avatar_config = '{"skin": "<b>gold</b>"}' WHERE id = '${x.id}';
        DO $$
        BEGIN
          IF (SELECT avatar_skin FROM public.user_profiles_public WHERE id = '${x.id}') IS NOT NULL THEN
            RAISE EXCEPTION '모르는 스킨 값이 공개됨';
          END IF;
        END $$;
        RESET ROLE;
        DO $$
        BEGIN
          BEGIN
            UPDATE public.user_public_profiles SET avatar_skin = 'gold' WHERE user_id = '${x.id}';
            RAISE EXCEPTION 'CHECK 가 모르는 스킨을 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          IF EXISTS (SELECT 1 FROM public.users u JOIN public.user_public_profiles p ON p.user_id = u.id
                      WHERE p.avatar_skin IS DISTINCT FROM public.public_avatar_skin(u.avatar_config)) THEN
            RAISE EXCEPTION '공개 스킨이 avatar_config 와 다른 행이 있음';
          END IF;
        END $$;`);
    },
  });
  await check({
    group: 'view',
    id: 'NM-1',
    role: 'postgres',
    op: '기존 사용자 실명·사진 정리 (P3-13 ③ 00022): 옛 트리거가 복사한 display_name·avatar_url 행에 00022 를 다시 적용 → 자리표시자·빈 값, 닉네임·공개 이름은 그대로',
    ...OK,
    run: async () => {
      const x = await createUser('nm1', '정실명');
      const mig = readFileSync(
        join(HERE, '../migrations/00022_clear_legacy_real_names.sql'),
        'utf8',
      );
      return sqlCheck(`
        UPDATE public.users SET display_name = '정실명', avatar_url = 'https://lh3.googleusercontent.com/a/nm1', nickname = '정리확인'
         WHERE id = '${x.id}';
        ${mig}
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM public.users
                      WHERE display_name IS DISTINCT FROM public.placeholder_display_name(id)
                         OR avatar_url IS DISTINCT FROM '') THEN
            RAISE EXCEPTION '실명·사진이 남은 행이 있음';
          END IF;
          IF (SELECT nickname FROM public.users WHERE id = '${x.id}') IS DISTINCT FROM '정리확인'
             OR (SELECT display_name FROM public.user_profiles_public WHERE id = '${x.id}') IS DISTINCT FROM '정리확인' THEN
            RAISE EXCEPTION '닉네임·공개 이름이 바뀜';
          END IF;
        END $$;`);
    },
  });
}

async function groupNotice(u) {
  // alice 소유 공지 1개 (예전 정책이면 alice 가 수정·삭제 가능했던 형태)
  const own = one(
    `insert into public.notices (user_id, title, content) values ('${u.alice.id}', 'alice-own', 'x') returning id`,
  );
  const admin = one(
    `insert into public.notices (user_id, title, content) values ('${u.bob.id}', '관리자 공지', 'x') returning id`,
  );
  await check({
    group: 'notice',
    id: 'B02-1',
    role: 'anon',
    op: 'GET /notices?select=* + count=exact (notice/page.tsx, 공지는 공개)',
    ...READ,
    run: async () =>
      classifyRead(
        await rest(
          'GET',
          '/rest/v1/notices?select=*&order=created_at.desc&offset=0&limit=10',
          { prefer: 'count=exact' },
        ),
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-2',
    role: 'authenticated',
    op: 'POST /notices {user_id: 본인}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/notices', {
          as: u.alice,
          body: {
            user_id: u.alice.id,
            title: `fake-notice-${RUN}`,
            content: '가짜 공지',
          },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.notices where title = 'fake-notice-${RUN}')`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-3',
    role: 'authenticated(psql)',
    op: 'SET ROLE authenticated; INSERT INTO notices (user_id = auth.uid())',
    ...SQLW,
    run: async () =>
      classifySqlWrite(
        psqlAs(
          'authenticated',
          u.alice.id,
          `INSERT INTO public.notices (user_id, title, content) VALUES (auth.uid(), 'psql-notice', 'x') RETURNING id;`,
        ),
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-4',
    role: 'authenticated',
    op: 'PATCH /notices?id=eq.<본인 소유 공지>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/notices?id=eq.${own}`, {
          as: u.alice,
          body: { title: '변조됨' },
          prefer: 'return=minimal',
        }),
        `select title = '변조됨' from public.notices where id = '${own}'`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-5',
    role: 'authenticated',
    op: 'DELETE /notices?id=eq.<본인 소유 공지>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/notices?id=eq.${own}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.notices where id = '${own}')`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-6',
    role: 'authenticated',
    op: 'PATCH /notices?id=eq.<다른 사람 공지>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/notices?id=eq.${admin}`, {
          as: u.alice,
          body: { title: '변조됨2' },
          prefer: 'return=minimal',
        }),
        `select title = '변조됨2' from public.notices where id = '${admin}'`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-7',
    role: 'anon',
    op: 'POST /notices',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/notices', {
          body: {
            user_id: u.alice.id,
            title: `anon-notice-${RUN}`,
            content: 'x',
          },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.notices where title = 'anon-notice-${RUN}')`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-8',
    role: 'service_role',
    op: 'POST /notices (/api/notice 관리자 경로)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/notices', {
          as: 'service',
          body: {
            user_id: u.bob.id,
            title: `service-notice-${RUN}`,
            content: 'x',
          },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.notices where title = 'service-notice-${RUN}')`,
      ),
  });
  await check({
    group: 'notice',
    id: 'B02-9',
    role: 'postgres',
    op: 'notices 정책 목록 (쓰기 정책 없음)',
    deny: ['notices_select_public'],
    allow: (a) => a !== 'notices_select_public',
    run: () => {
      const v = one(
        `select coalesce(string_agg(policyname, ',' order by policyname), '') from pg_policies where schemaname = 'public' and tablename = 'notices'`,
      );
      return { actual: v, detail: v };
    },
  });
}

async function groupWrite(u) {
  const progressPatch = (id, op, body, verify, quest = Q1) =>
    check({
      group: 'write',
      id,
      role: 'authenticated',
      op,
      ...WRITE,
      run: () =>
        classifyWrite(
          rest(
            'PATCH',
            `/rest/v1/user_progress?user_id=eq.${u.alice.id}&quest_id=eq.${quest}`,
            { as: u.alice, body, prefer: 'return=minimal' },
          ),
          `select ${verify} from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${quest}'`,
        ),
    });

  await check({
    group: 'write',
    id: 'B04-1',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<본인> {total_xp: 999999, current_level: 5}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { total_xp: 999999, current_level: 5 },
          prefer: 'return=minimal',
        }),
        `select total_xp = 999999 from public.users where id = '${u.alice.id}'`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-2',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<본인> {golden_keys: 99}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { golden_keys: 99 },
          prefer: 'return=minimal',
        }),
        `select golden_keys = 99 from public.users where id = '${u.alice.id}'`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-3',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<다른 사용자> {total_xp: 1}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.bob.id}`, {
          as: u.alice,
          body: { total_xp: 1 },
          prefer: 'return=minimal',
        }),
        `select total_xp = 1 from public.users where id = '${u.bob.id}'`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-4',
    role: 'authenticated',
    op: 'POST /user_progress (upsert) {7-1 최종 프로젝트, status: completed}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_progress?on_conflict=user_id,quest_id', {
          as: u.alice,
          body: {
            user_id: u.alice.id,
            quest_id: Q_PROJECT,
            status: 'completed',
            completed_at: new Date().toISOString(),
          },
          prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        `select exists (select 1 from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q_PROJECT}' and status = 'completed')`,
      ),
  });
  await progressPatch(
    'B04-4b',
    'PATCH /user_progress?quest_id=eq.<진행 중> {status: completed}',
    { status: 'completed', completed_at: new Date().toISOString() },
    `status = 'completed'`,
    Q2,
  );
  await check({
    group: 'write',
    id: 'B04-5',
    role: 'authenticated',
    op: 'POST /user_badges {badge_type: project_builder}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_badges', {
          as: u.alice,
          body: { user_id: u.alice.id, badge_type: 'project_builder' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_badges where user_id = '${u.alice.id}' and badge_type = 'project_builder')`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-5b',
    role: 'authenticated',
    op: 'DELETE /user_badges?badge_type=eq.first_code (본인 뱃지 삭제)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest(
          'DELETE',
          `/rest/v1/user_badges?user_id=eq.${u.alice.id}&badge_type=eq.first_code`,
          { as: u.alice, prefer: 'return=minimal' },
        ),
        `select not exists (select 1 from public.user_badges where user_id = '${u.alice.id}' and badge_type = 'first_code')`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-6',
    role: 'authenticated',
    op: 'POST /user_badges {user_id: 다른 사용자}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_badges', {
          as: u.alice,
          body: { user_id: u.bob.id, badge_type: 'streak_3' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_badges where user_id = '${u.bob.id}' and badge_type = 'streak_3')`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-7',
    role: 'authenticated(psql)',
    op: 'SET ROLE authenticated; UPDATE users SET total_xp = 123456 WHERE id = auth.uid()',
    ...SQLW,
    run: async () =>
      classifySqlWrite(
        psqlAs(
          'authenticated',
          u.alice.id,
          `UPDATE public.users SET total_xp = 123456 WHERE id = auth.uid() RETURNING total_xp;`,
        ),
      ),
  });
  await check({
    group: 'write',
    id: 'B04-8',
    role: 'authenticated',
    op: 'GET /users?select=custom_api_keys (본인 API 키 평문 조회, B13)',
    ...READ,
    run: async () =>
      classifyRead(
        await rest(
          'GET',
          `/rest/v1/users?select=custom_api_keys&id=eq.${u.alice.id}`,
          { as: u.alice },
        ),
      ),
  });
  await check({
    group: 'write',
    id: 'B04-9',
    role: 'authenticated',
    op: 'GET /users?select=id → 본인 행만',
    deny: ['own-only'],
    allow: ['others-visible'],
    run: async () => {
      const r = await rest('GET', '/rest/v1/users?select=id', { as: u.alice });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      return r.json.length === 1 && r.json[0].id === u.alice.id
        ? { actual: 'own-only', detail: 'rows=1' }
        : { actual: 'others-visible', detail: `rows=${r.json.length}` };
    },
  });
  await check({
    group: 'write',
    id: 'B04-10',
    role: 'authenticated',
    op: 'PATCH /user_progress?user_id=eq.<다른 사용자> {code_submitted}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest(
          'PATCH',
          `/rest/v1/user_progress?user_id=eq.${u.bob.id}&quest_id=eq.${Q1}`,
          {
            as: u.alice,
            body: { code_submitted: 'hacked' },
            prefer: 'return=minimal',
          },
        ),
        `select code_submitted = 'hacked' from public.user_progress where user_id = '${u.bob.id}' and quest_id = '${Q1}'`,
      ),
  });
  await progressPatch(
    'B04-11',
    'PATCH /user_progress {hints_used: 0} (힌트 사용 기록 지우기, B05)',
    { hints_used: 0 },
    'hints_used = 0',
  );
  await progressPatch(
    'B04-12',
    'PATCH /user_progress {used_golden_key: false} (황금키 사용 기록 지우기, B05)',
    { used_golden_key: false },
    'used_golden_key = false',
  );
  await check({
    group: 'write',
    id: 'B04-13',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<본인> {coins: 99999}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { coins: 99999 },
          prefer: 'return=minimal',
        }),
        `select coins = 99999 from public.users where id = '${u.alice.id}'`,
      ),
  });
  await progressPatch(
    'B04-14',
    'PATCH /user_progress {stars: 3}',
    { stars: 3 },
    'stars = 3',
  );
  await progressPatch(
    'B04-15',
    'PATCH /user_progress {best_stars: 3}',
    { best_stars: 3 },
    'best_stars = 3',
  );
  await progressPatch(
    'B04-16',
    'PATCH /user_progress {attempts: 1}',
    { attempts: 1 },
    'attempts = 1',
  );
  await progressPatch(
    'B04-17',
    'PATCH /user_progress {earned_xp: 99999}',
    { earned_xp: 99999 },
    'earned_xp = 99999',
  );
  await progressPatch(
    'B04-27',
    'PATCH /user_progress {solved_directly_at: now} (황금키 퀘스트 직접 풀이 표시 위조, P8-05)',
    { solved_directly_at: '2026-01-01T00:00:00Z' },
    'solved_directly_at is not null',
  );
  await check({
    group: 'write',
    id: 'B04-18',
    role: 'authenticated',
    op: 'POST /user_progress {user_id: 다른 사용자}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_progress', {
          as: u.alice,
          body: { user_id: u.bob.id, quest_id: Q3, code_submitted: 'x' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_progress where user_id = '${u.bob.id}' and quest_id = '${Q3}')`,
      ),
  });
  // P1-01: users 는 UPDATE (preferred_provider) 만. 허용 컬럼에 서버 값을 섞어도 요청 전체가 거부됨
  await check({
    group: 'write',
    id: 'B04-19',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<본인> {display_name} (UPDATE 권한이 없는 프로필 컬럼)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { display_name: 'renamed-by-client' },
          prefer: 'return=minimal',
        }),
        `select display_name = 'renamed-by-client' from public.users where id = '${u.alice.id}'`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-20',
    role: 'authenticated',
    op: 'PATCH /users?id=eq.<본인> {preferred_provider, golden_keys: 77} (허용 컬럼에 서버 값 섞기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { preferred_provider: 'gemini', golden_keys: 77 },
          prefer: 'return=minimal',
        }),
        `select golden_keys = 77 from public.users where id = '${u.alice.id}'`,
      ),
  });
  await check({
    group: 'write',
    id: 'B04-21',
    role: 'authenticated(psql)',
    op: 'SET ROLE authenticated; INSERT INTO users (id) (가입은 트리거만)',
    ...SQLW,
    run: async () =>
      classifySqlWrite(
        psqlAs(
          'authenticated',
          u.alice.id,
          `INSERT INTO public.users (id) VALUES (auth.uid()) ON CONFLICT (id) DO UPDATE SET golden_keys = 66 RETURNING id;`,
        ),
      ),
  });

  // ── P1-04: 진행 행은 진행 저장 컬럼만 (00011) ──
  await check({
    group: 'write',
    id: 'B04-22',
    role: 'authenticated',
    op: 'POST /user_progress (upsert) {code_submitted, hints_used: 0, status: in_progress} (이전 앱 auto-save payload)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_progress?on_conflict=user_id,quest_id', {
          as: u.alice,
          body: {
            user_id: u.alice.id,
            quest_id: Q1,
            code_submitted: 'print("old app")',
            hints_used: 0,
            status: 'in_progress',
          },
          prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        `select hints_used = 0 or code_submitted = 'print("old app")' from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q1}'`,
      ),
  });
  // 아래 셋은 점검 전용 사용자로 실제 완료(service_role RPC)한 뒤 시도합니다
  const completedUser = async (name) => {
    const x = await createUser(name, name);
    const r = await rpc('complete_quest', {
      p_user_id: x.id,
      p_quest_id: Q1,
      p_submission: submission(),
    });
    if (r.status >= 300)
      throw new Error(`complete_quest ${r.status} ${JSON.stringify(r.json)}`);
    return { ...x, xp: userRow(x.id).total_xp };
  };
  await check({
    group: 'write',
    id: 'B04-23',
    role: 'authenticated(psql)',
    op: 'UPDATE user_progress SET quest_id = <다른 퀘스트> WHERE <완료 행> (완료를 다른 퀘스트로 옮기기)',
    ...SQLW,
    run: async () => {
      const x = await completedUser('b0423');
      return classifySqlWrite(
        psqlAs(
          'authenticated',
          x.id,
          `UPDATE public.user_progress SET quest_id = '${Q_LAST1}' WHERE user_id = auth.uid() AND quest_id = '${Q1}' RETURNING quest_id;`,
        ),
      );
    },
  });
  /** 클라이언트 권한으로 완료 기록을 지우거나 되돌린 뒤 다시 완료 → XP 가 다시 들어오면 구멍 */
  const replayCheck = (id, op, sql) =>
    check({
      group: 'write',
      id,
      role: 'authenticated(psql)',
      op,
      deny: ['denied'],
      allow: ['xp-twice', 'written'],
      run: async () => {
        const x = await completedUser(id.toLowerCase().replace('-', ''));
        const w = classifySqlWrite(psqlAsCommit('authenticated', x.id, sql));
        const again = await rpc('complete_quest', {
          p_user_id: x.id,
          p_quest_id: Q1,
          p_submission: submission(),
        });
        const xp = userRow(x.id).total_xp;
        if (xp > x.xp)
          return {
            actual: 'xp-twice',
            detail: `XP ${x.xp} → ${xp} (쓰기: ${w.actual})`,
          };
        if (w.actual === 'written')
          return { actual: 'written', detail: `쓰기는 됨, XP 그대로 ${xp}` };
        return {
          actual: w.actual === 'denied' ? 'denied' : w.actual,
          detail: `${w.detail}; 다시 완료 → already_completed=${again.json?.already_completed}, XP ${xp}`,
        };
      },
    });
  await replayCheck(
    'B04-24',
    'DELETE FROM user_progress (완료 행) → 다시 complete_quest → XP 한 번만',
    `DELETE FROM public.user_progress WHERE user_id = auth.uid() AND quest_id = '${Q1}' RETURNING 1;`,
  );
  await replayCheck(
    'B04-25',
    "UPDATE user_progress SET status = 'in_progress' (완료 되돌리기) → 다시 complete_quest → XP 한 번만",
    `UPDATE public.user_progress SET status = 'in_progress', completed_at = NULL WHERE user_id = auth.uid() AND quest_id = '${Q1}' RETURNING 1;`,
  );
  await check({
    group: 'write',
    id: 'B04-26',
    role: 'authenticated(psql)',
    op: 'SET ROLE authenticated; UPDATE user_progress SET hints_used = 0 (B05)',
    ...SQLW,
    run: async () =>
      classifySqlWrite(
        psqlAs(
          'authenticated',
          u.alice.id,
          `UPDATE public.user_progress SET hints_used = 0 WHERE user_id = auth.uid() RETURNING hints_used;`,
        ),
      ),
  });
}

// ── 사용자 API 키 테이블 (B13: service_role 전용, 00007) ──
async function groupApiKeys(u) {
  const T = '/rest/v1/user_api_keys';
  const UK = (id, role, op, cls, run) =>
    check({ group: 'apikey', id, role, op, ...cls, run });
  const EMBED = { deny: ['denied', 'error', 'empty'], allow: ['allowed'] };
  const row = (uid, provider, ct) => ({
    user_id: uid,
    provider,
    key_version: 1,
    iv: 'AAAAAAAAAAAAAAAA',
    auth_tag: 'AAAAAAAAAAAAAAAAAAAAAA==',
    ciphertext: ct,
  });
  const exists = (where) =>
    `select exists (select 1 from public.user_api_keys where ${where})`;

  await UK('UK-1', 'anon', `GET ${T}?select=*`, READ, async () =>
    classifyRead(await rest('GET', `${T}?select=*`)),
  );
  await UK(
    'UK-2',
    'authenticated',
    `GET ${T}?select=*&user_id=eq.<본인> (본인 암호문)`,
    READ,
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=*&user_id=eq.${u.alice.id}`, {
          as: u.alice,
        }),
      ),
  );
  await UK(
    'UK-3',
    'authenticated',
    'GET /users?select=id,user_api_keys(*) (임베딩 우회)',
    EMBED,
    async () => {
      const r = await rest(
        'GET',
        `/rest/v1/users?select=id,user_api_keys(*)&id=eq.${u.alice.id}`,
        { as: u.alice },
      );
      const c = classifyRead(r);
      if (c.actual === 'allowed') {
        const k = r.json[0]?.user_api_keys;
        if (!k || (Array.isArray(k) && !k.length))
          return { actual: 'empty', detail: c.detail };
      }
      return c;
    },
  );
  await UK('UK-4', 'authenticated', `POST ${T} {user_id: 본인}`, WRITE, () =>
    classifyWrite(
      rest('POST', T, {
        as: u.alice,
        body: row(u.alice.id, 'gemini', 'Y2xpZW50'),
        prefer: 'return=minimal',
      }),
      exists(`user_id = '${u.alice.id}' and provider = 'gemini'`),
    ),
  );
  await UK(
    'UK-5',
    'authenticated',
    `PATCH ${T}?user_id=eq.<본인> {ciphertext}`,
    WRITE,
    () =>
      classifyWrite(
        rest('PATCH', `${T}?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { ciphertext: 'aGFja2Vk' },
          prefer: 'return=minimal',
        }),
        exists(`ciphertext = 'aGFja2Vk'`),
      ),
  );
  await UK('UK-6', 'authenticated', `DELETE ${T}?user_id=eq.<본인>`, WRITE, () =>
    classifyWrite(
      rest('DELETE', `${T}?user_id=eq.${u.alice.id}`, {
        as: u.alice,
        prefer: 'return=minimal',
      }),
      `select not exists (select 1 from public.user_api_keys where user_id = '${u.alice.id}' and provider = 'openai')`,
    ),
  );
  await UK('UK-7', 'anon', `POST ${T} {user_id: 다른 사용자}`, WRITE, () =>
    classifyWrite(
      rest('POST', T, {
        body: row(u.bob.id, 'gemini', 'YW5vbg=='),
        prefer: 'return=minimal',
      }),
      exists(`user_id = '${u.bob.id}' and provider = 'gemini'`),
    ),
  );
  await UK(
    'UK-8',
    'authenticated(psql)',
    'SET ROLE authenticated; SELECT * FROM user_api_keys',
    READ,
    async () =>
      classifySql(
        psqlAs(
          'authenticated',
          u.alice.id,
          'SELECT * FROM public.user_api_keys LIMIT 1;',
        ),
      ),
  );
  await UK(
    'UK-9',
    'anon(psql)',
    'SET ROLE anon; SELECT count(*) FROM user_api_keys',
    READ,
    async () =>
      classifySql(
        psqlAs('anon', null, 'SELECT count(*) FROM public.user_api_keys;'),
      ),
  );
  await UK(
    'UK-10',
    'authenticated',
    'GET /rest/v1/ (OpenAPI 에 user_api_keys 노출)',
    { deny: ['hidden', 'denied'], allow: ['listed'] },
    async () => {
      const r = await rest('GET', '/rest/v1/', {
        as: u.alice,
        headers: { Accept: 'application/openapi+json' },
      });
      if (r.status === 401 || r.status === 403)
        return { actual: 'denied', detail: `${r.status}` };
      const paths = Object.keys(r.json?.paths ?? {});
      return {
        actual: paths.includes('/user_api_keys') ? 'listed' : 'hidden',
        detail: `${r.status} paths=${paths.length}`,
      };
    },
  );
  await UK(
    'UK-11',
    'service_role',
    `GET ${T}?select=provider,key_version,iv,auth_tag,ciphertext&user_id=eq.<본인> (apiKeys.ts loadUserApiKeys)`,
    READ,
    async () =>
      classifyRead(
        await rest(
          'GET',
          `${T}?select=provider,key_version,iv,auth_tag,ciphertext&user_id=eq.${u.alice.id}`,
          { as: 'service' },
        ),
      ),
  );
  await UK(
    'UK-12',
    'service_role',
    `POST ${T}?on_conflict=user_id,provider (upsert, apiKeys.ts saveUserApiKey)`,
    WRITE,
    () =>
      classifyWrite(
        rest('POST', `${T}?on_conflict=user_id,provider`, {
          as: 'service',
          body: { ...row(u.alice.id, 'openai', 'c2VydmljZQ=='), updated_at: new Date().toISOString() },
          prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        exists(`user_id = '${u.alice.id}' and provider = 'openai' and ciphertext = 'c2VydmljZQ=='`),
      ),
  );
  await UK(
    'UK-13',
    'service_role',
    'auth.admin.deleteUser → user_api_keys 행도 삭제 (ON DELETE CASCADE, 탈퇴)',
    { deny: ['kept'], allow: ['deleted'] },
    async () => {
      const x = await createUser('uk13', '탈퇴');
      one(
        `insert into public.user_api_keys (user_id, provider, key_version, iv, auth_tag, ciphertext) values ('${x.id}', 'openai', 1, 'AAAA', 'AAAA', 'AAAA')`,
      );
      const r = await rest('DELETE', `/auth/v1/admin/users/${x.id}`, {
        as: 'service',
      });
      const left = one(
        `select count(*) from public.user_api_keys where user_id = '${x.id}'`,
      );
      return {
        actual: left === '0' ? 'deleted' : 'kept',
        detail: `${r.status} rows=${left}`,
      };
    },
  );
}

async function groupAnswer(u) {
  await check({
    group: 'answer',
    id: 'B07-1',
    role: 'anon',
    op: 'GET /quests?select=id (quests 는 로그인 사용자만)',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', '/rest/v1/quests?select=id')),
  });
  await check({
    group: 'answer',
    id: 'B07-2',
    role: 'authenticated',
    op: 'GET /quests?select=id,expected_output',
    ...LEAK,
    run: async () =>
      classifyLeak(
        await rest('GET', '/rest/v1/quests?select=id,expected_output', {
          as: u.alice,
        }),
      ),
  });
  await check({
    group: 'answer',
    id: 'B07-3',
    role: 'authenticated',
    op: 'GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps',
    ...LEAK,
    run: async () =>
      classifyLeak(
        await rest(
          'GET',
          '/rest/v1/quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps',
          { as: u.alice },
        ),
      ),
  });
  await check({
    group: 'answer',
    id: 'B07-4',
    role: 'authenticated',
    op: 'GET /quests?select=*',
    ...READ,
    run: async () =>
      classifyRead(
        await rest('GET', '/rest/v1/quests?select=*', { as: u.alice }),
      ),
  });
  if (S.prodData) {
    await check({
      group: 'answer',
      id: 'B08-0',
      role: 'postgres',
      op: '운영 재현 데이터의 solution_code 가 있는 퀘스트 수',
      run: () => ({ actual: solutionCount(), detail: '' }),
    });
  } else {
    await check({
      group: 'answer',
      id: 'B08-1',
      role: 'postgres',
      op: '새 DB (마이그레이션 → seed) 에서 solution_code 가 있는 코드·프로젝트 퀘스트 수 (퀴즈는 정답 코드가 없음)',
      deny: ['present'],
      allow: ['missing'],
      run: () => {
        const n = solutionCount();
        const total = one(`select count(*) from public.quests where quest_type <> 'quiz'`);
        return {
          actual: n === '0' ? 'missing' : n === total ? 'present' : 'partial',
          detail: `${total}개 중 ${n}개`,
        };
      },
    });
  }

  // ── 정답 테이블 (P1-02 에서 생기면 활성화) ──
  const T = '/rest/v1/quest_answer_keys';
  const AK = (id, role, op, cls, run) =>
    check({ group: 'answer', id, role, op, ...cls, run });
  await AK('AK-1', 'anon', `GET ${T}?select=*`, READ, async () =>
    classifyRead(await rest('GET', `${T}?select=*`)),
  );
  await AK('AK-2', 'authenticated', `GET ${T}?select=*`, READ, async () =>
    classifyRead(await rest('GET', `${T}?select=*`, { as: u.alice })),
  );
  await AK(
    'AK-3',
    'authenticated',
    `GET ${T}?select=quest_id&quest_id=eq.<1-1>`,
    READ,
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=quest_id&quest_id=eq.${Q1}`, {
          as: u.alice,
        }),
      ),
  );
  // 임베딩 우회: 권한이 없으면 관계 자체가 안 보여 PGRST200(error)이 나는 것도 막힌 것으로 봄
  const EMBED = { deny: ['denied', 'error', 'empty'], allow: ['allowed'] };
  await AK(
    'AK-4',
    'authenticated',
    'GET /quests?select=id,quest_answer_keys(*) (임베딩 우회)',
    EMBED,
    async () => {
      const r = await rest(
        'GET',
        `/rest/v1/quests?select=id,quest_answer_keys(*)&id=eq.${Q1}`,
        { as: u.alice },
      );
      const c = classifyRead(r);
      if (c.actual === 'allowed') {
        const k = r.json[0]?.quest_answer_keys;
        if (!k || (Array.isArray(k) && !k.length))
          return { actual: 'empty', detail: c.detail };
      }
      return c;
    },
  );
  await AK(
    'AK-5',
    'authenticated',
    `GET ${T}?select=quest_id,quests(id) (역방향 임베딩)`,
    EMBED,
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=quest_id,quests(id)`, { as: u.alice }),
      ),
  );
  await AK(
    'AK-6',
    'authenticated',
    `POST ${T} (upsert) {quest_id: 1-1, expected_output}`,
    WRITE,
    () =>
      classifyWrite(
        rest('POST', `${T}?on_conflict=quest_id`, {
          as: u.alice,
          body: { quest_id: Q1, expected_output: 'HACKED' },
          prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        `select exists (select 1 from public.quest_answer_keys where expected_output = 'HACKED')`,
      ),
  );
  await AK('AK-7', 'authenticated', `PATCH ${T}?quest_id=eq.<1-1>`, WRITE, () =>
    classifyWrite(
      rest('PATCH', `${T}?quest_id=eq.${Q1}`, {
        as: u.alice,
        body: { expected_output: 'HACKED2' },
        prefer: 'return=minimal',
      }),
      `select exists (select 1 from public.quest_answer_keys where expected_output = 'HACKED2')`,
    ),
  );
  await AK(
    'AK-8',
    'authenticated',
    `DELETE ${T}?quest_id=eq.<1-1>`,
    WRITE,
    () =>
      classifyWrite(
        rest('DELETE', `${T}?quest_id=eq.${Q1}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.quest_answer_keys where quest_id = '${Q1}')`,
      ),
  );
  await AK('AK-9', 'anon', `POST ${T}`, WRITE, () =>
    classifyWrite(
      rest('POST', T, {
        body: { quest_id: Q1, expected_output: 'HACKED3' },
        prefer: 'return=minimal',
      }),
      `select exists (select 1 from public.quest_answer_keys where expected_output = 'HACKED3')`,
    ),
  );
  await AK(
    'AK-10',
    'service_role',
    `GET ${T}?select=*&quest_id=eq.<1-1> (채점·황금키·튜터 서버 경로)`,
    READ,
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=*&quest_id=eq.${Q1}`, { as: 'service' }),
      ),
  );
  await AK(
    'AK-11',
    'service_role',
    `PATCH ${T}?quest_id=eq.<1-1> (콘텐츠 도구 경로)`,
    WRITE,
    async () => {
      const before = one(
        `select hints::text from public.quest_answer_keys where quest_id = '${Q1}'`,
      );
      try {
        return await classifyWrite(
          rest('PATCH', `${T}?quest_id=eq.${Q1}`, {
            as: 'service',
            body: { hints: { level_1: 'svc-edit' } },
            prefer: 'return=minimal',
          }),
          `select hints->>'level_1' = 'svc-edit' from public.quest_answer_keys where quest_id = '${Q1}'`,
        );
      } finally {
        psql(
          `update public.quest_answer_keys set hints = ${sqlStr(before)}::jsonb where quest_id = '${Q1}'`,
        );
      }
    },
  );
  await AK(
    'AK-12',
    'anon(psql)',
    'SET ROLE anon; SELECT count(*) FROM quest_answer_keys',
    READ,
    async () =>
      classifySql(
        psqlAs('anon', null, 'SELECT count(*) FROM public.quest_answer_keys;'),
      ),
  );
  await AK(
    'AK-13',
    'authenticated(psql)',
    'SET ROLE authenticated; SELECT * FROM quest_answer_keys',
    READ,
    async () =>
      classifySql(
        psqlAs(
          'authenticated',
          u.alice.id,
          'SELECT * FROM public.quest_answer_keys LIMIT 1;',
        ),
      ),
  );
  await AK(
    'AK-14',
    'service_role(psql)',
    'SET ROLE service_role; SELECT count(*) FROM quest_answer_keys',
    READ,
    async () =>
      classifySql(
        psqlAs(
          'service_role',
          null,
          'SELECT count(*) FROM public.quest_answer_keys;',
        ),
      ),
  );
  const openapi = (as) => async () => {
    const r = await rest('GET', '/rest/v1/', {
      as,
      headers: { Accept: 'application/openapi+json' },
    });
    if (r.status === 401 || r.status === 403)
      return { actual: 'denied', detail: `${r.status}` };
    const paths = Object.keys(r.json?.paths ?? {});
    return {
      actual: paths.includes('/quest_answer_keys') ? 'listed' : 'hidden',
      detail: `${r.status} paths=${paths.length}`,
    };
  };
  const OPENAPI = { deny: ['hidden', 'denied'], allow: ['listed'] };
  await AK(
    'AK-15',
    'anon',
    'GET /rest/v1/ (OpenAPI 에 quest_answer_keys 노출)',
    OPENAPI,
    openapi('anon'),
  );
  await AK(
    'AK-16',
    'authenticated',
    'GET /rest/v1/ (OpenAPI, 로그인 사용자)',
    OPENAPI,
    openapi(u.alice),
  );
  // 데이터: 모든 퀘스트의 정답이 quest_answer_keys 에 있고 quests 에는 남지 않음 (00005 + seed 정답 보정, B08)
  //   코드·프로젝트 퀘스트는 expected_output·hints·정답 코드, 퀴즈(P7-01)는 quiz_answer (B49)
  await check({
    group: 'answer',
    id: 'AK-17',
    role: 'postgres',
    op: 'quest_answer_keys 데이터: 코드·프로젝트 퀘스트마다 expected_output·hints·정답 코드(또는 모든 단계 정답 코드), 퀴즈마다 quiz_answer, quests 에 남은 정답 0',
    deny: ['separated'],
    allow: ['left-in-quests', 'missing'],
    run: () => {
      const [total, eo, hints, sol, stepSol, left, quizTotal, quizKey] = one(
        `select (select count(*) from public.quests where quest_type <> 'quiz'),
                count(*) filter (where q.quest_type <> 'quiz' and k.expected_output <> ''),
                count(*) filter (where q.quest_type <> 'quiz' and k.hints <> '{}'::jsonb),
                count(*) filter (where q.quest_type <> 'quiz' and k.solution_code is not null
                  or (jsonb_typeof(q.prompt_skeleton->'steps') = 'array'
                      and jsonb_array_length(q.prompt_skeleton->'steps') > 0
                      and (select count(*) from jsonb_array_elements(k.steps) s where s ? 'solution_code')
                          = jsonb_array_length(q.prompt_skeleton->'steps'))),
                (select count(*) from public.quest_answer_keys k2, jsonb_array_elements(k2.steps) s where s ? 'solution_code'),
                (select count(*) from public.quests
                  where expected_output <> '' or prompt_skeleton ?| array['hints', 'solution_code']
                     or jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))')),
                (select count(*) from public.quests where quest_type = 'quiz'),
                count(*) filter (where q.quest_type = 'quiz' and k.quiz_answer is not null)
           from public.quests q join public.quest_answer_keys k on k.quest_id = q.id`,
      )
        .split('|')
        .map(Number);
      const detail = `코드·프로젝트 ${total} · expected_output ${eo} · hints ${hints} · 정답 코드 ${sol} (단계 정답 ${stepSol}) · 퀴즈 ${quizTotal} · quiz_answer ${quizKey} · quests 에 남은 정답 ${left}`;
      if (left > 0) return { actual: 'left-in-quests', detail };
      const complete =
        total > 0 && eo === total && hints === total && sol === total && quizKey === quizTotal;
      return { actual: complete ? 'separated' : 'missing', detail };
    },
  });
}

/** solution_code 가 있는 퀘스트 수 (quests 와, 있으면 quest_answer_keys 합산) */
function solutionCount() {
  const keys = requirementMet('public.quest_answer_keys')
    ? `or exists (select 1 from public.quest_answer_keys k where k.quest_id = q.id
         and (k.solution_code is not null or jsonb_path_exists(k.steps, '$[*].solution_code')))`
    : '';
  return one(
    `select count(*) from public.quests q where q.prompt_skeleton ? 'solution_code'
       or jsonb_path_exists(q.prompt_skeleton, '$.steps[*].solution_code') ${keys}`,
  );
}

async function groupRpc(u) {
  // P1-03 보상 RPC 는 service_role 전용 (00006). anon/authenticated 가 부르면 42501
  const calls = [
    [
      'RPC-1',
      'anon',
      'complete_quest',
      {
        p_user_id: u.alice.id,
        p_quest_id: Q1,
        p_submission: { code: 'print(1)', passed: true },
      },
    ],
    [
      'RPC-2',
      u.alice,
      'complete_quest',
      {
        p_user_id: u.alice.id,
        p_quest_id: Q1,
        p_submission: { code: 'print(1)', passed: true },
      },
    ],
    [
      'RPC-3',
      u.alice,
      'use_golden_key',
      { p_user_id: u.alice.id, p_quest_id: Q2 },
    ],
    [
      'RPC-4',
      u.alice,
      'reset_progress',
      { p_user_id: u.bob.id, p_scope: 'all' },
    ],
    [
      'RPC-5',
      'anon',
      'reset_progress',
      { p_user_id: u.bob.id, p_scope: 'all' },
    ],
    [
      'RPC-7',
      u.alice,
      'record_hint',
      { p_user_id: u.alice.id, p_quest_id: Q2, p_level: 1 },
    ],
    [
      'CN-1',
      'anon',
      'grant_coins',
      { p_user_id: u.alice.id, p_source: 'quest', p_ref: 'rls', p_amount: 99999 },
    ],
    [
      'CN-2',
      u.alice,
      'grant_coins',
      { p_user_id: u.alice.id, p_source: 'quest', p_ref: 'rls', p_amount: 99999 },
    ],
    [
      'CN-3',
      u.alice,
      'spend_coins',
      { p_user_id: u.bob.id, p_ref: 'rls', p_amount: 1 },
    ],
    [
      'CN-3b',
      u.alice,
      'coin_apply',
      { p_user_id: u.alice.id, p_source: 'quest', p_ref: 'rls', p_delta: 99999 },
    ],
    [
      'CH-1',
      u.alice,
      'open_stage_chest',
      { p_user_id: u.alice.id, p_stage_id: STAGE1 },
    ],
    [
      'CH-1b',
      'anon',
      'open_stage_chest',
      { p_user_id: u.alice.id, p_stage_id: STAGE1 },
    ],
    [
      'DM-1',
      u.alice,
      'claim_daily_mission',
      { p_user_id: u.alice.id, p_day: '2026-11-11', p_mission_id: 'quest_1' },
    ],
    [
      'DM-1b',
      'anon',
      'daily_missions_today',
      { p_user_id: u.alice.id, p_quiz_ids: [] },
    ],
    [
      'DM-1c',
      u.alice,
      'daily_mission_progress',
      { p_user_id: u.alice.id, p_day: '2026-11-11', p_kind: 'quest_clear', p_quiz_ids: [] },
    ],
    [
      'AT-1',
      u.alice,
      'stamp_attendance',
      { p_user_id: u.alice.id },
    ],
    [
      'AT-1b',
      'anon',
      'world_daily_status',
      { p_user_id: u.alice.id },
    ],
    [
      'AT-1c',
      u.alice,
      'settle_streak_shields',
      { p_user_id: u.alice.id },
    ],
    [
      'AC-1',
      u.alice,
      'evaluate_achievements',
      { p_user_id: u.alice.id },
    ],
    [
      'AC-1b',
      'anon',
      'claim_achievement',
      { p_user_id: u.alice.id, p_achievement_id: 'first_code' },
    ],
    [
      'AC-1c',
      u.alice,
      'achievement_progress',
      { p_user_id: u.alice.id },
    ],
    [
      'SET-1',
      u.alice,
      'patch_user_settings',
      { p_user_id: u.alice.id, p_patch: { sound: { muted: true } } },
    ],
  ];
  for (const [id, as, fn, body] of calls) {
    const role = as === 'anon' ? 'anon' : 'authenticated';
    await check({
      group: 'rpc',
      id,
      role,
      op: `POST /rpc/${fn}${as === 'anon' ? '' : ' {p_user_id: 본인/다른 사용자}'}`,
      deny: ['denied'],
      allow: ['allowed', 'empty'],
      run: async () =>
        classifyRead(await rest('POST', `/rest/v1/rpc/${fn}`, { as, body })),
    });
  }
  await check({
    group: 'rpc',
    id: 'RPC-6',
    role: 'postgres',
    op: '00006·00010·00011 함수(보상 규칙·RPC·트리거) 중 anon/authenticated 가 EXECUTE 할 수 있는 것',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('quest_xp', 'level_for_xp', 'has_three_day_streak', 'decide_new_badges',
                           'is_stage_unlocked', 'complete_quest', 'use_golden_key', 'reset_progress',
                           'user_progress_protect_earned_xp', 'record_hint', 'user_progress_lock_keys',
                           'submit_quiz_answer', 'grant_coins', 'spend_coins', 'coin_apply',
                           'coin_balance_mismatches', 'users_protect_coins', 'coin_reward', 'grant_star_coins',
                           'grant_level_up_coins', 'code_quest_stars', 'is_solution_copy',
                           'stage_chest_goal', 'open_stage_chest', 'daily_mission_progress',
                           'daily_mission_target', 'daily_mission_possible', 'daily_mission_list',
                           'daily_missions_today', 'claim_daily_mission', 'streak_learning_days',
                           'current_streak', 'settle_streak_shields', 'world_daily_status', 'stamp_attendance',
                           'achievement_progress', 'evaluate_achievements', 'claim_achievement')
         and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  await check({
    group: 'rpc',
    id: 'SET-2',
    role: 'service_role',
    op: 'patch_user_settings (P2-14, 00020): motion·sound 를 동시에 바꿔도 둘 다 남음 · 다른 키 400 · 없는 사용자 false',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: async () => {
      const x = await createUser('rpc9', '설정갱신');
      const motion = { tier: 'minimal', reduced: 'on' };
      const sound = {
        version: 1,
        muted: true,
        master: 0.5,
        sfx: { enabled: false, volume: 0.3 },
        bgm: { enabled: true, volume: 0.2 },
        voice: { enabled: true, volume: 0.9 },
        updatedAt: 1,
      };
      // 앱이 두 절을 연달아 바꾸는 상황: 두 요청을 동시에 보냄 (읽고-합쳐-쓰기였다면 한쪽이 사라질 수 있음)
      const [a, b] = await Promise.all([
        rpc('patch_user_settings', { p_user_id: x.id, p_patch: { motion } }),
        rpc('patch_user_settings', { p_user_id: x.id, p_patch: { sound } }),
      ]);
      if (a.status !== 200 || b.status !== 200 || a.json !== true || b.json !== true)
        return { actual: 'error', detail: `${a.status}/${b.status} ${errMsg(a)} ${errMsg(b)}` };
      const bad = await rpc('patch_user_settings', { p_user_id: x.id, p_patch: { theme: { dark: true } } });
      const notObj = await rpc('patch_user_settings', { p_user_id: x.id, p_patch: { sound: 1 } });
      const missing = await rpc('patch_user_settings', {
        p_user_id: '00000000-0000-0000-0000-00000000dead',
        p_patch: { motion },
      });
      // jsonb 는 키 순서를 바꾸므로 DB 에서 jsonb 로 비교
      const same = one(
        `select settings = ${sqlStr(JSON.stringify({ motion, sound }))}::jsonb from public.users where id = '${x.id}'`,
      );
      return (
        (same === 't'
          ? null
          : {
              actual: 'mismatch',
              detail: one(`select settings::text from public.users where id = '${x.id}'`),
            }) ||
        compare(
          '거부',
          { bad: 400, badMsg: 'invalid_settings_key', notObj: 400, missing: false },
          { bad: bad.status, badMsg: errMsg(bad), notObj: notObj.status, missing: missing.json },
        ) || { actual: 'ok', detail: 'motion·sound 둘 다 남음, 다른 키·객체 아닌 값 거부' }
      );
    },
  });
}

// ── reward: 보상 RPC 동작 (P1-03, B05·B06·B11·B12) ──────────────
// API Route 처럼 service_role 로 RPC 를 부르고 DB 결과를 확인합니다. 점검마다 새 사용자를 씁니다.
const OK = { deny: ['mismatch', 'error'], allow: ['ok'] };
const STAGE2 = 'a1000000-0000-0000-0000-000000000002';
const Q_STAGE2 = 'b1000000-0000-0000-0000-000000000004'; // 2-1
const Q_LAST1 = 'b1000000-0000-0000-0000-000000000026'; // 1-7 (75 XP)
// 기존 뱃지 5종은 P8-09(00036)부터 같은 id 업적. complete_quest 응답의 업적(new_achievements) 중 5종을 예전 순서로
// new_badges 로 다시 적어, 아래 뱃지 점검들이 "옮겨진 업적이 예전 뱃지 규칙대로 나오는지"를 그대로 확인함
const LEGACY_BADGES = ['first_code', 'hint_master', 'stage_clear', 'project_builder', 'streak_3'];
const legacyBadges = (list) =>
  LEGACY_BADGES.filter((id) => (list ?? []).some((a) => a.id === id));
const rpc = async (fn, body) => {
  const r = await rest('POST', `/rest/v1/rpc/${fn}`, { as: 'service', body });
  if (fn === 'complete_quest' && r.status === 200 && r.json)
    r.json = { ...r.json, new_badges: legacyBadges(r.json.new_achievements) };
  return r;
};
const submission = (passed = true) => ({ code: 'print(1)', passed });
/** 기대값 표 비교: 다른 항목만 detail 로 */
function compare(label, expected, actual) {
  const diffs = Object.keys(expected).filter(
    (k) => JSON.stringify(expected[k]) !== JSON.stringify(actual[k]),
  );
  return diffs.length
    ? {
        actual: 'mismatch',
        detail: diffs
          .map(
            (k) =>
              `${label}.${k}: 기대 ${JSON.stringify(expected[k])} / 실제 ${JSON.stringify(actual[k])}`,
          )
          .join('; '),
      }
    : null;
}
const userRow = (id) =>
  JSON.parse(
    one(
      `select json_build_object('total_xp', total_xp, 'level', current_level, 'golden_keys', golden_keys,
         'badges', coalesce((select json_agg(achievement_id order by achievement_id) from public.user_achievements
                              where user_id = u.id and achievement_id in (${LEGACY_BADGES.map(sqlStr).join(', ')})), '[]'),
         'badge_rows', (select count(*) from public.user_achievements
                         where user_id = u.id and achievement_id in (${LEGACY_BADGES.map(sqlStr).join(', ')})))
         from public.users u where id = '${id}'`,
    ),
  );
const progressRow = (uid, qid) => {
  const v = one(
    `select json_build_object('status', status, 'earned_xp', earned_xp, 'hints_used', hints_used, 'used_golden_key', used_golden_key)
       from public.user_progress where user_id = '${uid}' and quest_id = '${qid}'`,
  );
  return v ? JSON.parse(v) : null;
};
// complete_quest 로 끝내는 퀘스트 (코드·프로젝트). 퀴즈는 보너스라 submit_quiz_answer 로만 풀고 클리어 계산에서 빠짐 (00026, Q60)
const stageQuests = (stageId) =>
  one(
    `select string_agg(id::text, ',' order by "order") from public.quests where stage_id = '${stageId}' and quest_type <> 'quiz'`,
  ).split(',');

async function groupReward() {
  const rules = JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'reward-rules.json'), 'utf8'),
  );

  await check({
    group: 'reward',
    id: 'RW-1',
    role: 'postgres',
    op: 'reward-rules.json 대조표 = SQL 규칙 함수 (quest_xp·level_for_xp·current_streak·coin_reward·code_quest_stars·stage_chest_goal)',
    ...OK,
    run: () => {
      const cases = [
        ...rules.xp.map((c) => [
          `xp ${c.base}/${c.hints}/${c.golden}`,
          `public.quest_xp(${c.base}, ${c.hints}, ${c.golden})::text`,
          String(c.xp),
        ]),
        ...rules.level.map((c) => [
          `level ${c.total}`,
          `public.level_for_xp(${c.total})::text`,
          String(c.level),
        ]),
        ...rules.streak_days.map((c) => [
          `streak_days ${c.name}`,
          `public.current_streak(array[${c.days.map(sqlStr).join(',')}]::date[], '${c.today}')::text`,
          String(c.streak),
        ]),
        ...rules.coins.map((c) => [
          `coins ${c.kind}/${c.n ?? ''}`,
          `public.coin_reward('${c.kind}', ${c.n ?? 'null'})::text`,
          String(c.coins),
        ]),
        ...rules.stars.map((c) => [
          `stars ${c.hints}/${c.golden}`,
          `public.code_quest_stars(${c.hints}, ${c.golden})::text`,
          String(c.stars),
        ]),
        ...rules.chest_goal.map((c) => [
          `chest_goal ${c.code_quests}`,
          `public.stage_chest_goal(${c.code_quests})::text`,
          String(c.goal),
        ]),
      ];
      const got = one(
        cases.map(([, expr]) => `select ${expr};`).join('\n'),
      ).split('\n');
      const bad = cases
        .map(([name, , want], i) => [name, want, got[i]])
        .filter(([, want, g]) => want !== g)
        .map(([name, want, g]) => `${name}: 기대 ${want} / SQL ${g}`);
      return bad.length
        ? { actual: 'mismatch', detail: bad.join('; ') }
        : { actual: 'ok', detail: `${cases.length}개 일치` };
    },
  });

  await check({
    group: 'reward',
    id: 'RW-2',
    role: 'service_role',
    op: '같은 퀘스트 complete_quest 를 동시에 8번 → XP·뱃지 1번만 (B06)',
    ...OK,
    run: async () => {
      const x = await createUser('rw2', '동시완료');
      const rs = await Promise.all(
        Array.from({ length: 8 }, () =>
          rpc('complete_quest', {
            p_user_id: x.id,
            p_quest_id: Q1,
            p_submission: submission(),
          }),
        ),
      );
      const bad = rs.find((r) => r.status !== 200);
      if (bad)
        return { actual: 'error', detail: `${bad.status} ${errMsg(bad)}` };
      const fresh = rs.filter((r) => r.json.already_completed === false);
      return (
        compare('응답', { fresh: 1 }, { fresh: fresh.length }) ||
        compare('지급', { xp_gained: 75, new_badges: ['first_code', 'hint_master'] }, fresh[0].json) ||
        compare(
          'users',
          { total_xp: 75, badges: ['first_code', 'hint_master'], badge_rows: 2 },
          userRow(x.id),
        ) ||
        compare('progress', { status: 'completed', earned_xp: 75 }, progressRow(x.id, Q1)) || {
          actual: 'ok',
          detail: '8회 중 지급 1회, total_xp 75, 뱃지 2개',
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-3',
    role: 'service_role',
    op: '같은 코드 퀘스트 use_golden_key 를 동시에 5번 → 황금키 1개만 차감',
    ...OK,
    run: async () => {
      const x = await createUser('rw3', '동시황금키');
      const rs = await Promise.all(
        Array.from({ length: 5 }, () =>
          rpc('use_golden_key', { p_user_id: x.id, p_quest_id: Q2 }),
        ),
      );
      const bad = rs.find((r) => r.status !== 200);
      if (bad)
        return { actual: 'error', detail: `${bad.status} ${errMsg(bad)}` };
      return (
        compare(
          '차감',
          { charged: 1 },
          { charged: rs.filter((r) => r.json.charged).length },
        ) ||
        compare('users', { golden_keys: 2 }, userRow(x.id)) ||
        compare('progress', { used_golden_key: true, status: 'in_progress' }, progressRow(x.id, Q2)) || {
          actual: 'ok',
          detail: '5회 중 차감 1회 (3 → 2)',
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-4',
    role: 'service_role',
    op: 'B05·B11·Q25: 힌트 수·황금키는 DB 값 (요청의 hints_used:0·used_golden_key:false 무시), 황금키 첫 완료는 뱃지 없음',
    ...OK,
    run: async () => {
      const x = await createUser('rw4', '서버값');
      one(`insert into public.user_progress (user_id, quest_id, status, hints_used) values ('${x.id}', '${Q1}', 'in_progress', 2)`);
      const lie = { code: 'x', passed: true, hints_used: 0, used_golden_key: false };
      // 첫 완료를 황금키로 (Q25: first_code·hint_master 모두 없음) → 그다음 처음 직접 푼 퀘스트에서 first_code
      const g = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: Q2 });
      const b = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q2, p_submission: lie });
      const a = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q1, p_submission: lie });
      for (const r of [g, b, a])
        if (r.status !== 200)
          return { actual: 'error', detail: `${r.status} ${errMsg(r)}` };
      return (
        compare('황금키', { xp_gained: 0, new_badges: [], used_golden_key: true }, b.json) ||
        compare('힌트 2회', { xp_gained: 50, new_badges: ['first_code'] }, a.json) ||
        compare('users', { total_xp: 50, golden_keys: 2, badges: ['first_code'] }, userRow(x.id)) ||
        compare('progress', { earned_xp: 0 }, progressRow(x.id, Q2)) || {
          actual: 'ok',
          detail: '황금키 첫 완료 → 0 XP·뱃지 없음, 힌트 2회 → 50 XP(1.5배 아님)·처음 직접 푼 완료라 first_code',
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-5',
    role: 'service_role',
    op: 'B05: 잠긴 스테이지의 complete_quest·use_golden_key 거부, 채점 미통과(passed:false) 거부',
    ...OK,
    run: async () => {
      const x = await createUser('rw5', '잠금');
      const c = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q_STAGE2, p_submission: submission() });
      const g = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: Q_STAGE2 });
      const n = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q1, p_submission: submission(false) });
      const got = {
        complete: `${c.status} ${errMsg(c)}`,
        golden: `${g.status} ${errMsg(g)}`,
        not_passed: `${n.status} ${errMsg(n)}`,
      };
      return (
        compare(
          '응답',
          { complete: '403 stage_locked', golden: '403 stage_locked', not_passed: '422 not_passed' },
          got,
        ) ||
        compare('users', { total_xp: 0, golden_keys: 3, badge_rows: 0 }, userRow(x.id)) ||
        compare(
          'progress',
          { rows: '0' },
          { rows: one(`select count(*) from public.user_progress where user_id = '${x.id}'`) },
        ) || { actual: 'ok', detail: '403 stage_locked ×2, 422 not_passed, 진행 행 없음' }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-6',
    role: 'service_role',
    op: '스테이지 1 을 모두 완료 → stage_cleared·stage_clear 뱃지·황금키 3·다음 스테이지 열림',
    ...OK,
    run: async () => {
      const x = await createUser('rw6', '스테이지');
      const qs = stageQuests(STAGE1);
      one(`update public.users set golden_keys = 1 where id = '${x.id}'`);
      let last;
      for (const q of qs) {
        last = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
        if (last.status !== 200)
          return { actual: 'error', detail: `${q}: ${last.status} ${errMsg(last)}` };
      }
      const unlocked = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: Q_STAGE2 });
      return (
        compare(
          '마지막 응답',
          { next_quest_id: null, golden_keys: 3, new_badges: ['stage_clear'], level_after: 3 },
          last.json,
        ) ||
        compare(
          'stage_cleared',
          // concepts 는 스테이지의 모든 퀘스트(퀴즈 포함) 개념 (complete_quest 의 stage_cleared)
          { stage_id: STAGE1, order: 1, concepts: Number(one(`select count(*) from public.quests where stage_id = '${STAGE1}'`)) },
          { ...last.json.stage_cleared, concepts: last.json.stage_cleared?.concepts?.length },
        ) ||
        compare('스테이지 2 황금키', { status: 200 }, { status: unlocked.status }) || {
          actual: 'ok',
          detail: `${qs.length}개 완료 → stage_clear, 황금키 1 → 3, total_xp ${last.json.total_xp}`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-7',
    role: 'service_role',
    op: 'B12 스테이지 리셋: earned_xp 합으로 재계산(황금키 0 XP 과다 차감 없음), 업적(옛 stage_clear)은 남음 (P8-09)',
    ...OK,
    run: async () => {
      const x = await createUser('rw7', '리셋');
      const s1 = stageQuests(STAGE1);
      const s2 = stageQuests(STAGE2);
      // 스테이지 1: 첫 퀘스트는 황금키(0 XP), 나머지는 힌트 0 (1.5배)
      await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: s1[0] });
      for (const q of s1)
        await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
      for (const q of s2.slice(0, 2))
        await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
      const stage1Xp = Number(
        one(`select sum(earned_xp) from public.user_progress p join public.quests q on q.id = p.quest_id
              where p.user_id = '${x.id}' and q.stage_id = '${STAGE1}'`),
      );
      const before = userRow(x.id);
      const r2 = await rpc('reset_progress', { p_user_id: x.id, p_scope: 'stage', p_stage_id: STAGE2 });
      const after2 = userRow(x.id);
      const r1 = await rpc('reset_progress', { p_user_id: x.id, p_scope: 'stage', p_stage_id: STAGE1 });
      const after1 = userRow(x.id);
      for (const r of [r2, r1])
        if (r.status !== 200)
          return { actual: 'error', detail: `${r.status} ${errMsg(r)}` };
      return (
        compare('준비', { stage1Xp: 0 + 5 * 75 + 113 }, { stage1Xp }) ||
        compare(
          '스테이지 2 리셋',
          {
            total_xp: stage1Xp,
            golden_keys: before.golden_keys,
            badges: ['first_code', 'hint_master', 'stage_clear'],
          },
          after2,
        ) ||
        compare('스테이지 2 리셋 응답', { removed_badges: [], removed_quests: 2 }, r2.json) ||
        // P8-09: 뱃지는 업적이 되어 진행 초기화로 지우지 않음 (user_badges 에 더 쓰지 않아 removed_badges 도 빈 목록)
        compare('스테이지 1 리셋', { total_xp: 0, level: 1, badges: ['first_code', 'hint_master', 'stage_clear'] }, after1) ||
        compare('스테이지 1 리셋 응답', { removed_badges: [] }, r1.json) || {
          actual: 'ok',
          detail: `스테이지 2 리셋 → total_xp ${before.total_xp} → ${stage1Xp} / 스테이지 1 리셋 → 0, 업적(옛 stage_clear)은 남음 (P8-09)`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-8',
    role: 'service_role',
    op: 'B12 전체 리셋: 진행 삭제, XP 0, 황금키 3 복구, 업적(옛 뱃지)은 남음 (P8-09)',
    ...OK,
    run: async () => {
      const x = await createUser('rw8', '전체리셋');
      await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: Q1 });
      await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q1, p_submission: submission() });
      await rpc('complete_quest', { p_user_id: x.id, p_quest_id: Q2, p_submission: submission() });
      const r = await rpc('reset_progress', { p_user_id: x.id, p_scope: 'all' });
      if (r.status !== 200)
        return { actual: 'error', detail: `${r.status} ${errMsg(r)}` };
      return (
        // P8-09: 업적(옛 뱃지)은 진행 초기화 뒤에도 남음 (Q2 첫 완료의 first_code·hint_master)
        compare('users', { total_xp: 0, level: 1, golden_keys: 3, badge_rows: 2 }, userRow(x.id)) ||
        compare(
          'progress',
          { rows: '0' },
          { rows: one(`select count(*) from public.user_progress where user_id = '${x.id}'`) },
        ) || { actual: 'ok', detail: '황금키 2 → 3, XP·진행 0, 업적 2개 남음' }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-9',
    role: 'authenticated',
    op: 'psql INSERT/upsert user_progress {earned_xp: 99999} → 트리거가 0/이전 값으로 (B04-17 의 INSERT 경로)',
    ...SQLW,
    run: async () => {
      const x = await createUser('rw9', '획득XP');
      const r = psqlAs(
        'authenticated',
        x.id,
        `insert into public.user_progress (user_id, quest_id, earned_xp) values ('${x.id}', '${Q1}', 99999);
         insert into public.user_progress (user_id, quest_id, earned_xp) values ('${x.id}', '${Q1}', 88888)
           on conflict (user_id, quest_id) do update set earned_xp = excluded.earned_xp;
         select 1 from public.user_progress where user_id = '${x.id}' and earned_xp > 0;`,
      );
      return classifySqlWrite(r);
    },
  });

  await check({
    group: 'reward',
    id: 'RW-10',
    role: 'postgres',
    op: '00006 재실행: 이전 앱이 완료한 행(earned_xp 0)을 규칙대로 백필, 이미 채운 행·황금키 행은 그대로 (멱등)',
    ...OK,
    run: async () => {
      const x = await createUser('rw10', '백필');
      const file = readFileSync(
        join(HERE, '..', 'migrations', '00006_quest_reward_rpc.sql'),
        'utf8',
      );
      // 이전 앱처럼 사용자 클라이언트 경로로 완료된 행을 postgres 로 직접 만든다 (earned_xp 0)
      const r = psql(`BEGIN;
        insert into public.user_progress (user_id, quest_id, status, hints_used, used_golden_key, completed_at) values
          ('${x.id}', '${Q1}', 'completed', 0, false, now()),
          ('${x.id}', '${Q2}', 'completed', 1, false, now()),
          ('${x.id}', '${Q3}', 'completed', 0, true, now()),
          ('${x.id}', '${Q_LAST1}', 'completed', 3, false, now());
        update public.user_progress set earned_xp = 1 where user_id = '${x.id}' and quest_id = '${Q_LAST1}';
        ${file}
        select string_agg(earned_xp::text, ',' order by q."order") from public.user_progress p
          join public.quests q on q.id = p.quest_id where p.user_id = '${x.id}';
        ROLLBACK;`);
      if (!r.ok) return { actual: 'error', detail: firstLine(r.err) };
      const got = r.out.split('\n').filter(Boolean).pop();
      // Q1(1-1) 힌트 0 → 75, Q2(1-2) 힌트 1 → 63, Q3(1-4) 황금키 → 0, Q_LAST1(1-7) 이미 1 → 그대로
      return (
        compare('earned_xp (퀘스트 순서)', { v: '75,63,0,1' }, { v: got }) || {
          actual: 'ok',
          detail: `${got} (트랜잭션 ROLLBACK)`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-11',
    role: 'service_role',
    op: 'record_hint (P1-04): 새 행 in_progress · 코드 퀘스트 GREATEST · 프로젝트 누적 · 완료 뒤 그대로 · 잘못된 단계 400',
    ...OK,
    run: async () => {
      const x = await createUser('rw11', '힌트기록');
      const hint = async (qid, level) => {
        const r = await rpc('record_hint', {
          p_user_id: x.id,
          p_quest_id: qid,
          p_level: level,
        });
        return r.status < 300
          ? r.json
          : { status: r.status, message: errMsg(r) };
      };
      const steps = [];
      steps.push(['Q1 L2 (새 행)', await hint(Q1, 2), { recorded: true, hints_used: 2, status: 'in_progress' }]);
      steps.push(['Q1 L1 (낮은 단계)', await hint(Q1, 1), { recorded: false, hints_used: 2 }]);
      steps.push(['Q1 L3', await hint(Q1, 3), { recorded: true, hints_used: 3 }]);
      steps.push(['프로젝트 L1', await hint(Q_PROJECT, 1), { hints_used: 1 }]);
      steps.push(['프로젝트 L1 다음 단계', await hint(Q_PROJECT, 1), { hints_used: 2 }]);
      steps.push(['L4', await hint(Q1, 4), { status: 400, message: 'invalid_arguments' }]);
      const done = await rpc('complete_quest', {
        p_user_id: x.id,
        p_quest_id: Q1,
        p_submission: submission(),
      });
      // 힌트 3회 → 기본 XP (1-1 은 50)
      steps.push(['완료', done.json, { hints_used: 3, xp_gained: 50 }]);
      steps.push(['완료 뒤 L1', await hint(Q1, 1), { recorded: false, hints_used: 3, status: 'completed' }]);
      for (const [label, got, want] of steps) {
        const m = compare(label, want, got ?? {});
        if (m) return m;
      }
      const row = progressRow(x.id, Q1);
      return (
        compare('Q1 진행 행', { status: 'completed', hints_used: 3, earned_xp: 50 }, row) || {
          actual: 'ok',
          detail: `${steps.length}단계 일치`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-12',
    role: 'service_role',
    op: 'Q25: 황금키로 스테이지 마지막 퀘스트 → 클리어(잠금 해제·황금키 3)는 되고 stage_clear 없음, 다음 스테이지를 직접 풀어 클리어하면 stage_clear',
    ...OK,
    run: async () => {
      const x = await createUser('rw12', '황금키클리어');
      const s1 = stageQuests(STAGE1);
      const s2 = stageQuests(STAGE2);
      const done = async (q, golden = false) => {
        if (golden) {
          const g = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: q });
          if (g.status !== 200) throw new Error(`golden ${q}: ${g.status} ${errMsg(g)}`);
        }
        const r = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
        if (r.status !== 200) throw new Error(`complete ${q}: ${r.status} ${errMsg(r)}`);
        return r.json;
      };
      let last1, last2, golden2;
      try {
        for (const q of s1.slice(0, -1)) await done(q);
        last1 = await done(s1[s1.length - 1], true);
        // 스테이지 2: 첫 퀘스트는 황금키, 나머지는 직접 → 마지막을 직접 풀어 클리어
        golden2 = await done(s2[0], true);
        for (const q of s2.slice(1)) last2 = await done(q);
      } catch (e) {
        return { actual: 'error', detail: e.message };
      }
      return (
        compare(
          '스테이지 1 마지막 (황금키)',
          { xp_gained: 0, new_badges: [], golden_keys: 3, used_golden_key: true, stage_order: 1 },
          { ...last1, stage_order: last1.stage_cleared?.order },
        ) ||
        compare('스테이지 2 첫 퀘스트 (황금키)', { xp_gained: 0, new_badges: [], stage_cleared: null }, golden2) ||
        compare(
          '스테이지 2 마지막 (직접)',
          { new_badges: ['stage_clear'], golden_keys: 3, stage_order: 2 },
          { ...last2, stage_order: last2.stage_cleared?.order },
        ) ||
        compare('users', { badges: ['first_code', 'hint_master', 'stage_clear'] }, userRow(x.id)) || {
          actual: 'ok',
          detail: `스테이지 1(${s1.length}개, 마지막 황금키) 클리어 → 뱃지 없음 · 스테이지 2(${s2.length}개, 첫 퀘스트 황금키) 직접 클리어 → stage_clear`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-13',
    role: 'service_role',
    op: 'Q25: 3일 연속은 직접 푼 완료일만 (그제 직접 · 어제 황금키 · 오늘 직접 → streak_3 없음)',
    ...OK,
    run: async () => {
      const x = await createUser('rw13', '연속');
      const s1 = stageQuests(STAGE1);
      const at = (q, daysAgo) =>
        one(`update public.user_progress set completed_at = now() - interval '${daysAgo} days'
              where user_id = '${x.id}' and quest_id = '${q}'`);
      const a = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: s1[0], p_submission: submission() });
      at(s1[0], 2);
      const g = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: s1[1] });
      const b = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: s1[1], p_submission: submission() });
      at(s1[1], 1);
      const c = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: s1[2], p_submission: submission() });
      for (const r of [a, g, b, c])
        if (r.status !== 200)
          return { actual: 'error', detail: `${r.status} ${errMsg(r)}` };
      return (
        compare('그제 (직접)', { new_badges: ['first_code', 'hint_master'] }, a.json) ||
        compare('어제 (황금키)', { new_badges: [] }, b.json) ||
        compare('오늘 (직접)', { new_badges: [] }, c.json) ||
        compare('users', { badges: ['first_code', 'hint_master'] }, userRow(x.id)) || {
          actual: 'ok',
          detail: '완료일 3일 연속이지만 어제가 황금키 완료라 streak_3 없음',
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-14',
    role: 'service_role',
    op: 'B20 (00028): users.current_level 은 total_xp 에서만 — 다른 레벨을 써도 트리거가 level_for_xp(total_xp) 로 맞춤',
    ...OK,
    run: async () => {
      const x = await createUser('rw14', '레벨');
      one(`update public.users set total_xp = 3480, current_level = 2 where id = '${x.id}'`);
      const a = one(`select current_level from public.users where id = '${x.id}'`);
      one(`update public.users set current_level = 50 where id = '${x.id}'`);
      const b = one(`select current_level from public.users where id = '${x.id}'`);
      return (
        compare('3480 XP 에 Lv 2 를 써도 / Lv 50 만 바꿔도', { a: '10', b: '10' }, { a, b }) || {
          actual: 'ok',
          detail: '3480 XP → Lv 10 (쓴 값 2·50 무시)',
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-15',
    role: 'postgres',
    op: 'P8-02 (00029) 리허설: 옛 곡선 레벨의 기존 사용자 → 레벨이 내려가지 않게 XP 보정·나머지는 새 곡선 레벨, 두 번 실행해도 같음',
    ...OK,
    run: async () => {
      const names = ['zero', 'lv2', 'lv4', 'lv5', 'up', 'cheat', 'exact'];
      const xs = [];
      for (const n of names) xs.push(await createUser(`rw15${n}`, '재계산'));
      const file = readFileSync(
        join(HERE, '..', 'migrations', '00029_level_recalc.sql'),
        'utf8',
      );
      // 00028 이전 상태(옛 곡선 [0, 100, 300, 600, 1000] 의 current_level)를 트리거를 끄고 만든다. cheat = 옛 앱 직접 쓰기(B04)
      const before = [
        [0, 1],
        [150, 2],
        [700, 4],
        [1000, 5],
        [2000, 5],
        [50, 5],
        [1210, 5],
      ];
      const ids = xs.map((x) => `'${x.id}'`).join(',');
      const state = `select string_agg(u.total_xp || ':' || u.current_level || ':' || coalesce(a.xp_before::text, '-'), ',' order by u.total_xp, a.xp_before nulls first)
          from (select * from public.users where id in (${ids})) u
          left join public.level_curve_adjustments a on a.user_id = u.id;`;
      const r = psql(`BEGIN;
        ALTER TABLE public.users DISABLE TRIGGER trg_users_sync_level;
        ${xs.map((x, i) => `update public.users set total_xp = ${before[i][0]}, current_level = ${before[i][1]} where id = '${x.id}';`).join('\n')}
        ALTER TABLE public.users ENABLE TRIGGER trg_users_sync_level;
        ${file}
        ${state}
        ${file}
        ${state}
        ROLLBACK;`);
      if (!r.ok) return { actual: 'error', detail: firstLine(r.err) };
      const [first, second] = r.out.split('\n').filter(Boolean).slice(-2);
      // 0 → Lv1 · 50(cheat Lv5) → Lv1 그대로 · 150 → 200 Lv2 · 700 → 830 Lv4 · 1000 → 1210 Lv5 · 1210 Lv5 그대로 · 2000 → Lv6
      const want = '0:1:-,50:1:-,200:2:150,830:4:700,1210:5:-,1210:5:1000,2000:6:-';
      return (
        compare('두 번 실행 결과 (xp:레벨:보정 전 xp)', { first: want, second: want }, { first, second }) || {
          actual: 'ok',
          detail: '보정 3명(150·700·1000 XP), 2000 XP 는 Lv 6, 다시 실행해도 같음',
        }
      );
    },
  });
  await check({
    group: 'reward',
    id: 'RW-16',
    role: 'anon',
    op: 'GET /level_curve_adjustments (P8-02 보정 근거는 service_role 전용)',
    ...READ,
    run: async () => classifyRead(await rest('GET', '/rest/v1/level_curve_adjustments?select=*')),
  });
}

// ── coins: 코인 원장·잔액 (P8-03, ① 00030) ──────────────────────
const coins = (id) => one(`select coins from public.users where id = '${id}'`);
const mismatches = (id) =>
  one(`select count(*) from public.coin_balance_mismatches() where user_id = '${id}'`);
async function groupCoins(u) {
  await check({
    group: 'coins',
    id: 'CN-4',
    role: 'service_role',
    op: 'grant_coins·spend_coins: 같은 키는 한 번만(동시 호출 포함) · 잔액 부족 PT402 · 잘못된 인자 PT400 · 잔액 = 원장 합',
    ...OK,
    run: async () => {
      const x = await createUser('cn4', '코인');
      const g = (source, ref, amount) =>
        rpc('grant_coins', { p_user_id: x.id, p_source: source, p_ref: ref, p_amount: amount });
      const sp = (ref, amount) => rpc('spend_coins', { p_user_id: x.id, p_ref: ref, p_amount: amount });
      const g1 = await g('quest', 'q-1', 10);
      const g2 = await g('quest', 'q-1', 10);
      const same = await Promise.all([g('star', 'q-1:1', 5), g('star', 'q-1:1', 5), g('star', 'q-1:1', 5)]);
      const s1 = await sp('shop:a', 12);
      const s2 = await sp('shop:b', 4);
      const s3 = await sp('shop:a', 12);
      const bad = await Promise.all([
        g('spend', 'x', 1),
        g('bogus', 'x', 1),
        g('quest', 'x', 0),
        g('quest', '', 1),
        sp('x', -5),
        rpc('grant_coins', { p_user_id: '00000000-0000-0000-0000-000000000000', p_source: 'quest', p_ref: 'x', p_amount: 1 }),
      ]);
      const v = (r) => (r.status === 200 ? `${r.json.applied}:${r.json.delta}:${r.json.coins}` : `${errCode(r)}:${errMsg(r)}`);
      return (
        compare(
          'CN-4',
          {
            g1: 'true:10:10',
            g2: 'false:0:10',
            same: 1,
            s1: 'true:-12:3',
            s2: 'PT402:not_enough_coins',
            s3: 'false:0:3',
            bad: 'PT400,PT400,PT400,PT400,PT400,PT404',
            coins: '3',
            rows: '3',
            mismatches: '0',
          },
          {
            g1: v(g1),
            g2: v(g2),
            same: same.filter((r) => r.status === 200 && r.json.applied).length,
            s1: v(s1),
            s2: v(s2),
            s3: v(s3),
            bad: bad.map(errCode).join(','),
            coins: coins(x.id),
            rows: one(`select count(*) from public.coin_ledger where user_id = '${x.id}'`),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: '10 지급 → 같은 키 0 → 별 5 동시 3번 중 1번 → 12 차감 → 4 차감 거부, 잔액 3 = 원장 합' }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'CN-5',
    role: 'postgres',
    op: 'users.coins 직접 쓰기: service_role·postgres 는 coins_ledger_only 오류, authenticated(psql) 는 값이 버려짐, 새 행은 0',
    ...OK,
    run: async () => {
      const x = await createUser('cn5', '코인직접');
      const sr = await rest('PATCH', `/rest/v1/users?id=eq.${x.id}`, {
        as: 'service',
        body: { coins: 500 },
        prefer: 'return=minimal',
      });
      const pg = psql(`update public.users set coins = 500 where id = '${x.id}';`);
      const au = psqlAs(
        'authenticated',
        x.id,
        `update public.users set coins = 500 where id = auth.uid() returning coins;`,
      );
      // ③ 00008 뒤에는 UPDATE 권한이 없어 42501, ①만이면 트리거가 이전 값(0)을 남김
      const auKept = au.ok ? au.out === '0' : /permission denied/i.test(au.err);
      return (
        compare(
          'CN-5',
          { sr: 'coins_ledger_only', pg: true, auKept: true, coins: '0' },
          {
            sr: errMsg(sr),
            pg: /coins_ledger_only/.test(pg.err),
            auKept,
            coins: coins(x.id),
          },
        ) ?? { actual: 'ok', detail: '원장 없이 잔액을 바꾸는 경로 없음 (authenticated 는 ③ 뒤 42501, ①만이면 트리거가 무시)' }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'CN-6',
    role: 'authenticated',
    op: 'coin_ledger: 비로그인 읽기 · 남의 원장 읽기 · 본인 원장 INSERT/DELETE',
    ...WRITE,
    run: async () => {
      one(`select public.coin_apply('${u.bob.id}', 'quest', 'cn6', 7)`);
      one(`select public.coin_apply('${u.alice.id}', 'quest', 'cn6', 7)`);
      const anon = classifyRead(await rest('GET', '/rest/v1/coin_ledger?select=*'));
      if (anon.actual === 'allowed') return { actual: 'written', detail: `anon 읽기 ${anon.detail}` };
      const others = await rest('GET', `/rest/v1/coin_ledger?select=user_id&user_id=eq.${u.bob.id}`, { as: u.alice });
      if (others.status !== 200 || others.json.length !== 0)
        return { actual: 'written', detail: `남의 원장 ${others.status} rows=${others.json?.length}` };
      const own = await rest('GET', `/rest/v1/coin_ledger?select=delta`, { as: u.alice });
      if (own.status !== 200 || own.json.length !== 1)
        return { actual: 'error', detail: `본인 원장 ${own.status} rows=${own.json?.length}` };
      const ins = await classifyWrite(
        rest('POST', '/rest/v1/coin_ledger', {
          as: u.alice,
          body: { user_id: u.alice.id, delta: 99999, balance_after: 99999, source: 'quest', ref: 'hack' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.coin_ledger where user_id = '${u.alice.id}' and ref = 'hack')`,
      );
      if (ins.actual === 'written') return ins;
      return classifyWrite(
        rest('DELETE', `/rest/v1/coin_ledger?user_id=eq.${u.alice.id}`, { as: u.alice, prefer: 'return=minimal' }),
        `select not exists (select 1 from public.coin_ledger where user_id = '${u.alice.id}')`,
      );
    },
  });
  await check({
    group: 'coins',
    id: 'CN-7',
    role: 'service_role',
    op: '리셋은 코인을 회수하지 않고, 같은 퀘스트 키는 리셋 뒤에도 다시 지급 안 됨(재풀이 coins_earned 0) · B55 스테이지 리셋은 퀘스트 밖 XP 를 남김',
    ...OK,
    run: async () => {
      const x = await createUser('cn7', '코인리셋');
      const s1 = stageQuests(STAGE1);
      const s2 = stageQuests(STAGE2);
      for (const q of [...s1, s2[0]])
        await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
      // complete_quest 가 이미 준 첫 완료 코인 (P8-04) → 같은 키 grant_coins 는 0
      const dup = await rpc('grant_coins', { p_user_id: x.id, p_source: 'quest', p_ref: s2[0], p_amount: 10 });
      const c0 = coins(x.id);
      // 퀘스트 밖 XP (P8-02 레벨 보정·P8-07 미션 같은 것). earned_xp 에는 없음
      const base = Number(one(`update public.users set total_xp = total_xp + 15 where id = '${x.id}' returning total_xp`));
      const s2Xp = Number(one(`select earned_xp from public.user_progress where user_id = '${x.id}' and quest_id = '${s2[0]}'`));
      const rs = await rpc('reset_progress', { p_user_id: x.id, p_scope: 'stage', p_stage_id: STAGE2 });
      const redo = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: s2[0], p_submission: submission() });
      const ra = await rpc('reset_progress', { p_user_id: x.id, p_scope: 'all' });
      const redoAll = [];
      for (const q of s1)
        redoAll.push((await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() })).json?.coins_earned);
      return (
        compare(
          'CN-7',
          {
            dup: false,
            stageXp: base - s2Xp,
            redo: '0:' + c0,
            allXp: 0,
            redoAll: 0,
            coins: c0,
            mismatches: '0',
          },
          {
            dup: dup.json?.applied,
            stageXp: rs.json?.total_xp,
            redo: `${redo.json?.coins_earned}:${redo.json?.coins_balance}`,
            allXp: ra.json?.total_xp,
            redoAll: redoAll.reduce((n, c) => n + (c ?? 99), 0),
            coins: coins(x.id),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: `스테이지 리셋 XP ${base} → ${base - s2Xp} (미션 15 XP 유지), 코인 ${c0} 유지·재풀이(레벨 업 포함) 0` }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'CN-8',
    role: 'service_role',
    op: 'complete_quest 코인 (P8-04): 첫 완료 10 · 같은 퀘스트 다시·동시 8번 1회 · 황금키 완료 0 · 응답 coins_earned·coins_balance·level_ups',
    ...OK,
    run: async () => {
      const x = await createUser('cn8', '완료코인');
      const s1 = stageQuests(STAGE1);
      const done = (q) => rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
      const many = await Promise.all(Array.from({ length: 8 }, () => done(s1[0])));
      const again = await done(s1[0]);
      // 황금키: 마지막 단계 정답을 본 뒤 통과 없이 완료 → XP 0 · 코인 0
      const gk = await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: s1[1] });
      const golden = await done(s1[1]);
      // 레벨 업: Lv 2 문턱(200) 바로 아래에서 완료 → level_ups [{2, 20}], coins_earned = 10 + 20
      one(`update public.users set total_xp = 199 where id = '${x.id}'`);
      const up = await done(s1[2]);
      const fresh = many.filter((r) => r.status === 200 && r.json.already_completed === false);
      const st = requirementMet('public.code_quest_stars()') ? 15 : 0;
      return (
        compare(
          'CN-8',
          {
            // 첫 완료 10 + 별 ⭐3 코인 15 (P8-05 00032 가 있으면). 황금키 완료는 별 코인도 0
            fresh: 1,
            first: `${10 + st}:${10 + st}:[]`,
            again: `true:0:${10 + st}`,
            gk: 200,
            golden: `true:0:0:${10 + st}`,
            up: `${30 + st}:${40 + 2 * st}:[{"coins":20,"level":2}]`,
            rows: String(st ? 9 : 3),
            mismatches: '0',
          },
          {
            fresh: fresh.length,
            first: fresh[0] && `${fresh[0].json.coins_earned}:${fresh[0].json.coins_balance}:${JSON.stringify(fresh[0].json.level_ups)}`,
            again: `${again.json?.already_completed}:${again.json?.coins_earned}:${again.json?.coins_balance}`,
            gk: gk.status,
            golden: `${golden.json?.used_golden_key}:${golden.json?.xp_gained}:${golden.json?.coins_earned}:${golden.json?.coins_balance}`,
            up: `${up.json?.coins_earned}:${up.json?.coins_balance}:${JSON.stringify(up.json?.level_ups)}`,
            rows: one(`select count(*) from public.coin_ledger where user_id = '${x.id}'`),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: `동시 8번 → 10+별 ${st} 한 번, 황금키 0, Lv 2 도착 +20 (원장 = 잔액)` }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'CN-10',
    role: 'postgres',
    op: 'grant_level_up_coins: 여러 레벨을 한 번에 넘으면 지나간 레벨마다(5레벨마다 100) · 다시 넘어도 0 · 내려가거나 같으면 빈 배열',
    ...OK,
    run: async () => {
      const x = await createUser('cn10', '레벨코인');
      const lv = (from, to) => one(`select public.grant_level_up_coins('${x.id}', ${from}, ${to})::text`);
      const jump = lv(1, 6);
      const again = lv(3, 7);
      const down = lv(7, 3);
      const top = lv(49, 60);
      return (
        compare(
          'CN-10',
          {
            jump: JSON.stringify([2, 3, 4, 5, 6].map((l) => ({ coins: l === 5 ? 100 : 20, level: l }))),
            again: JSON.stringify([4, 5, 6, 7].map((l) => ({ coins: l === 7 ? 20 : 0, level: l }))),
            down: '[]',
            top: '[{"coins":100,"level":50}]',
            coins: '300',
            mismatches: '0',
          },
          {
            jump: JSON.stringify(JSON.parse(jump)),
            again: JSON.stringify(JSON.parse(again)),
            down,
            top: JSON.stringify(JSON.parse(top)),
            coins: coins(x.id),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: 'Lv 1→6 = 20·20·20·100·20, 다시 3→7 은 Lv 7 만 20, 50 넘김 없음' }
      );
    },
  });

  // ── 별점 (P8-05, 00032) ──
  const starRow = (uid, qid) =>
    JSON.parse(
      one(`select json_build_object('stars', stars, 'best', best_stars, 'today', stars_judged_on = public.kst_today(),
             'attempts', attempts, 'direct', solved_directly_at is not null, 'xp', earned_xp)
             from public.user_progress where user_id = '${uid}' and quest_id = '${qid}'`),
    );
  const noXp = (r) => {
    delete r.xp;
    return r;
  };
  const lvCoins = (r) => (r.json?.level_ups ?? []).reduce((n, l) => n + l.coins, 0);
  const done = (uid, qid, extra = {}) =>
    rpc('complete_quest', { p_user_id: uid, p_quest_id: qid, p_submission: { ...submission(), ...extra } });
  await check({
    group: 'coins',
    id: 'SR-1',
    role: 'service_role',
    op: '첫 완료 별 = code_quest_stars(DB 힌트, 황금키): 힌트 0 ⭐3 · 1회 ⭐2 · 2회 ⭐1 · 황금키 ⭐1, best_stars·판정일·별 코인(별 번호마다 5, 황금키 0)',
    ...OK,
    run: async () => {
      const x = await createUser('st1', '첫별');
      const [a, b, c, d] = stageQuests(STAGE1);
      await rpc('record_hint', { p_user_id: x.id, p_quest_id: b, p_level: 1 });
      await rpc('record_hint', { p_user_id: x.id, p_quest_id: c, p_level: 2 });
      await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: d });
      const rs = [];
      for (const q of [a, b, c, d]) rs.push(await done(x.id, q));
      return (
        compare(
          'SR-1',
          {
            res: ['3:3:3', '2:2:2', '1:1:1', '1:1:1'],
            coins: [25, 20, 15, 0],
            rows: [
              { stars: 3, best: 3, today: true, attempts: 1, direct: false },
              { stars: 2, best: 2, today: true, attempts: 1, direct: false },
              { stars: 1, best: 1, today: true, attempts: 1, direct: false },
              { stars: 1, best: 1, today: true, attempts: 1, direct: false },
            ],
            mismatches: '0',
          },
          {
            res: rs.map((r) => `${r.json?.stars}:${r.json?.best_stars}:${r.json?.new_stars}`),
            coins: rs.map((r) => r.json?.coins_earned - lvCoins(r)),
            rows: [a, b, c, d].map((q) => noXp(starRow(x.id, q))),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: '⭐3 +25 · ⭐2 +20 · ⭐1 +15 · 황금키 ⭐1 +0' }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'SR-2',
    role: 'service_role',
    op: '다시 풀기(retry, Q64): 판정한 날은 연습(무변화, mode practice) · 다음 날부터 복습 도전 ⭐3·best 갱신·새 별 번호만 코인·XP 0 · retry 없음/통과 못함은 그대로 · 동시 4번도 1회',
    ...OK,
    run: async () => {
      const x = await createUser('st2', '다시별');
      const [a, b] = stageQuests(STAGE1);
      await rpc('record_hint', { p_user_id: x.id, p_quest_id: a, p_level: 3 });
      await rpc('record_hint', { p_user_id: x.id, p_quest_id: b, p_level: 1 });
      await done(x.id, a);
      await done(x.id, b);
      const xp0 = userRow(x.id).total_xp;
      const plain = await done(x.id, a);
      // 같은 날(첫 완료 판정일) 다시 풀기 = 연습
      const sameDay = await done(x.id, a, { retry: true });
      // 하루 지난 것처럼 판정일을 어제(KST)로
      one(`update public.user_progress set stars_judged_on = public.kst_today() - 1 where user_id = '${x.id}'`);
      const failed = await done(x.id, a, { retry: true, passed: false });
      const retry = await done(x.id, a, { retry: true });
      const again = await done(x.id, a, { retry: true });
      const many = await Promise.all(Array.from({ length: 4 }, () => done(x.id, b, { retry: true })));
      const fmt = (r) =>
        `${r.json?.already_completed}:${r.json?.stars}:${r.json?.best_stars}:${r.json?.new_stars}:${r.json?.xp_gained}:${r.json?.coins_earned}:${r.json?.mode ?? ''}`;
      return (
        compare(
          'SR-2',
          {
            plain: 'true:0:1:0:0:0:',
            sameDay: 'true:0:1:0:0:0:practice',
            failed: 'true:0:1:0:0:0:',
            retry: 'true:3:3:2:0:10:review',
            again: 'true:0:3:0:0:0:practice',
            many: ['true:0:3:0:0:0:practice', 'true:0:3:0:0:0:practice', 'true:0:3:0:0:0:practice', 'true:3:3:1:0:5:review'],
            row: { stars: 3, best: 3, today: true, attempts: 2, direct: false },
            xp: xp0,
            mismatches: '0',
          },
          {
            plain: fmt(plain),
            sameDay: fmt(sameDay),
            failed: fmt(failed),
            retry: fmt(retry),
            again: fmt(again),
            many: many.map(fmt).sort(),
            row: noXp(starRow(x.id, a)),
            xp: userRow(x.id).total_xp,
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: '같은 날 연습 → 다음 날 ⭐1 → ⭐3(+2별 10코인, XP 그대로) → 다시 연습, 동시 4번 중 한 번만 +5' }
      );
    },
  });
  await check({
    group: 'coins',
    id: 'SR-3',
    role: 'service_role',
    op: '황금키 퀘스트를 (다음 날부터) 처음 직접 풀면 그때 XP·첫 완료 코인·별 코인 1..3·뱃지(first_code·hint_master), 같은 날·정답 그대로는 아무것도, 그 뒤는 연습',
    ...OK,
    run: async () => {
      const x = await createUser('st3', '직접풀이');
      const [a] = stageQuests(STAGE1);
      await rpc('use_golden_key', { p_user_id: x.id, p_quest_id: a });
      const golden = await done(x.id, a);
      const sameDay = await done(x.id, a, { retry: true });
      one(`update public.user_progress set stars_judged_on = public.kst_today() - 1 where user_id = '${x.id}'`);
      const solution = one(`select solution_code from public.quest_answer_keys where quest_id = '${a}'`);
      const copy = await done(x.id, a, { retry: true, code: `${solution}\n# 내가 썼어요\n` });
      const direct = await done(x.id, a, { retry: true });
      const again = await done(x.id, a, { retry: true });
      const xpWant = Number(one(`select public.quest_xp(xp_reward, 0, false) from public.quests where id = '${a}'`));
      const fmt = (r) =>
        `${r.json?.solved_directly}:${r.json?.solution_copy}:${r.json?.new_stars}:${r.json?.xp_gained}:${r.json?.coins_earned - lvCoins(r)}:${JSON.stringify(r.json?.new_badges)}`;
      return (
        compare(
          'SR-3',
          {
            golden: 'false:false:1:0:0:[]',
            sameDay: 'false:false:0:0:0:[]',
            copy: 'false:true:0:0:0:[]',
            direct: `true:false:2:${xpWant}:25:["first_code","hint_master"]`,
            again: 'false:false:0:0:0:[]',
            row: { stars: 3, best: 3, today: true, attempts: 2, direct: true, xp: xpWant },
            badges: ['first_code', 'hint_master'],
            mismatches: '0',
          },
          {
            golden: fmt(golden),
            sameDay: fmt(sameDay),
            copy: fmt(copy),
            direct: fmt(direct),
            again: fmt(again),
            row: starRow(x.id, a),
            badges: userRow(x.id).badges,
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: `황금키 0 → 정답 복사 0 → 직접 풀이 +${xpWant} XP·25코인·뱃지 2 → 다시 0` }
      );
    },
  });

  // ── 보물상자 (P8-06, 00033) ──
  await check({
    group: 'coins',
    id: 'CH-2',
    role: 'service_role',
    op: 'open_stage_chest: 별 합계 목표 미달 409 · 목표 도달 → 30코인(원장 chest/<stage_id>) · 동시 4번도 1회 · 리셋 뒤 다시 열어도 0 · 없는 스테이지 404',
    ...OK,
    run: async () => {
      const x = await createUser('ch2', '보물상자');
      const qs = stageQuests(STAGE1);
      const goal = Number(one(`select public.stage_chest_goal(${qs.length})`));
      const need = Math.ceil(goal / 3); // 힌트 없이 첫 완료 = ⭐3
      const open = (stage = STAGE1) => rpc('open_stage_chest', { p_user_id: x.id, p_stage_id: stage });
      for (const q of qs.slice(0, need - 1)) await done(x.id, q);
      const short = await open();
      await done(x.id, qs[need - 1]);
      const many = await Promise.all(Array.from({ length: 4 }, () => open()));
      const before = coins(x.id);
      await rpc('reset_progress', { p_user_id: x.id, p_scope: 'all' });
      const afterReset = await open();
      const missing = await open('a1000000-0000-0000-0000-0000000000ff');
      const fresh = many.filter((r) => r.status === 200 && r.json.already_opened === false);
      return (
        compare(
          'CH-2',
          {
            short: `409:not_enough_stars`,
            many: [200, 200, 200, 200],
            fresh: `1:30:${goal}`,
            afterReset: `200:true:0:${before}`,
            missing: 404,
            rows: '1',
            mismatches: '0',
          },
          {
            short: `${short.status}:${errMsg(short)}`,
            many: many.map((r) => r.status),
            fresh: `${fresh.length}:${fresh[0]?.json.coins_earned}:${fresh[0]?.json.goal}`,
            afterReset: `${afterReset.status}:${afterReset.json?.already_opened}:${afterReset.json?.coins_earned}:${afterReset.json?.coins_balance}`,
            missing: missing.status,
            rows: one(`select count(*) from public.coin_ledger where user_id = '${x.id}' and source = 'chest'`),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: `목표 ${goal}⭐: ${need - 1}개(⭐${(need - 1) * 3}) 거부 → ${need}개 +30 한 번 → 리셋 뒤 0` }
      );
    },
  });
}

// ── 데일리 미션 (P8-07, ① 00034) ──
async function groupMissions(u) {
  const today = () => one(`select public.kst_today()::text`);
  const ago = (n) => one(`select (public.kst_today() - ${n})::text`);
  const stageQuizzes = (stageId) =>
    one(
      `select string_agg(id::text, ',' order by "order") from public.quests where stage_id = '${stageId}' and quest_type = 'quiz'`,
    ).split(',');
  const today_ = (id, quiz) => rpc('daily_missions_today', { p_user_id: id, p_quiz_ids: quiz });
  const ids = (r) => (r.json?.missions ?? []).map((m) => m.id);
  // KST 자정 기준 시각: '<날짜> 00:00:00+09' 에서 초를 더하고 뺌
  const at = (day, sec = 0) => `('${day} 00:00:00+09'::timestamptz + interval '${sec} seconds')`;

  await check({
    group: 'missions',
    id: 'DM-1d',
    role: 'authenticated',
    op: 'user_daily_missions: 남의 행 읽기 · 비로그인 읽기 · 본인 행 INSERT · daily_missions 읽기 (본인 배정 읽기만 열림, 쓰기는 RPC)',
    ...WRITE,
    run: async () => {
      one(`insert into public.user_daily_missions (user_id, day, mission_ids) values
             ('${u.bob.id}', '2026-01-01', '{quest_1}'), ('${u.alice.id}', '2026-01-01', '{quest_1}') on conflict do nothing`);
      const others = await rest('GET', `/rest/v1/user_daily_missions?select=user_id&user_id=eq.${u.bob.id}`, { as: u.alice });
      if (others.status !== 200 || others.json.length !== 0)
        return { actual: 'written', detail: `남의 배정 ${others.status} rows=${others.json?.length}` };
      const own = await rest('GET', '/rest/v1/user_daily_missions?select=day', { as: u.alice });
      if (own.status !== 200 || own.json.length < 1) return { actual: 'error', detail: `본인 배정 ${own.status}` };
      const anon = classifyRead(await rest('GET', '/rest/v1/user_daily_missions?select=*'));
      if (anon.actual === 'allowed') return { actual: 'written', detail: `anon 읽기 ${anon.detail}` };
      const pool = classifyRead(await rest('GET', '/rest/v1/daily_missions?select=*', { as: u.alice }));
      if (pool.actual === 'allowed') return { actual: 'written', detail: `미션 풀 읽기 ${pool.detail}` };
      return classifyWrite(
        rest('POST', '/rest/v1/user_daily_missions', {
          as: u.alice,
          body: { user_id: u.alice.id, day: '2026-01-02', mission_ids: ['quest_3'] },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_daily_missions where user_id = '${u.alice.id}' and day = '2026-01-02')`,
      );
    },
  });
  await check({
    group: 'missions',
    id: 'DM-2',
    role: 'service_role',
    op: '배정: 읽기만이면 assigned false · 결정적(다시 불러도·행을 지우고 다시 배정해도 같음) · 할 수 있는 것만(새 학생은 복습 없음, 퀴즈 없으면 퀴즈 미션 없음) · 퀘스트 미션 첫 칸 · 오늘의 퀴즈 목록 고정(퀴즈 퀘스트만)',
    ...OK,
    run: async () => {
      const x = await createUser('dm2', '미션배정');
      const qz = stageQuizzes(STAGE1);
      const peek = await today_(x.id, null);
      const first = await today_(x.id, [...qz, Q1]);
      const again = await today_(x.id, []);
      one(`delete from public.user_daily_missions where user_id = '${x.id}'`);
      const redo = await today_(x.id, [...qz, Q1]);
      // 퀴즈 없음 → 퀴즈 그룹 빠짐, 복습할 것 없음 → 퀘스트·힌트 없이 2개
      const y = await createUser('dm2b', '미션퀴즈없음');
      const noQuiz = await today_(y.id, []);
      // 어제 판정한 별 1개 퀘스트가 있으면 복습 미션이 들어옴 (퀴즈 없음 → 퀘스트·힌트·복습 3개)
      const z = await createUser('dm2c', '미션복습');
      one(`insert into public.user_progress (user_id, quest_id, status, completed_at, best_stars, stars, stars_judged_on, code_submitted)
           values ('${z.id}', '${Q1}', 'completed', now() - interval '2 days', 1, 1, public.kst_today() - 1, '')`);
      const review = await today_(z.id, []);
      const groups = (r) => (r.json?.missions ?? []).map((m) => m.kind).join(',');
      return (
        compare(
          'DM-2',
          {
            peek: false,
            first: 3,
            firstKind: 'quest_clear',
            quiz: qz.slice(0, 3),
            again: ids(first),
            againQuiz: qz.slice(0, 3),
            redo: ids(first),
            noQuiz: 'quest_clear,no_hint',
            review: true,
            progress0: true,
          },
          {
            peek: peek.json?.assigned,
            first: ids(first).length,
            firstKind: first.json?.missions?.[0]?.kind,
            quiz: first.json?.quiz_ids,
            again: ids(again),
            againQuiz: again.json?.quiz_ids,
            redo: ids(redo),
            noQuiz: groups(noQuiz),
            review: groups(review).split(',').includes('review') && ids(review).length === 3,
            progress0: (first.json?.missions ?? []).every((m) => m.progress === 0 && m.claimed === false),
          },
        ) ?? { actual: 'ok', detail: `오늘 ${ids(first).join(',')} · 퀴즈 ${qz.length}개 중 3개 고정` }
      );
    },
  });

  await check({
    group: 'missions',
    id: 'DM-3',
    role: 'postgres',
    op: '진행 판정은 기존 기록에서 KST 날짜로: 자정 정각은 오늘, 1초 전은 어제 · 황금키 완료 빼고 · 힌트 쓴 완료는 힌트 없이에서 빼고 · 복습(코드 판정일·퀴즈 review) · 오늘의 퀴즈(정답 또는 3번째 오답) · 퀴즈 맞히기',
    ...OK,
    run: async () => {
      const x = await createUser('dm3', '미션판정');
      const d = today();
      const y = ago(1);
      const [a, b, c, e] = stageQuests(STAGE1);
      const [qz1, qz2, qz3] = stageQuizzes(STAGE1);
      one(`insert into public.user_progress (user_id, quest_id, status, completed_at, hints_used, used_golden_key, best_stars, stars, stars_judged_on, code_submitted) values
        ('${x.id}', '${a}', 'completed', ${at(d)}, 0, false, 3, 3, '${d}', ''),
        ('${x.id}', '${b}', 'completed', ${at(d, -1)}, 0, false, 3, 3, '${d}', ''),
        ('${x.id}', '${c}', 'completed', ${at(d, 60)}, 0, true, 1, 1, '${d}', ''),
        ('${x.id}', '${e}', 'completed', ${at(d, 120)}, 2, false, 1, 1, '${d}', '')`);
      one(`insert into public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct, created_at) values
        ('${x.id}', '${qz1}', 'first', 1, '{}', true, ${at(d)}),
        ('${x.id}', '${qz2}', 'first', 3, '{}', false, ${at(d, -1)}),
        ('${x.id}', '${qz3}', 'review', 2, '{}', false, ${at(d, 30)}),
        ('${x.id}', '${qz3}', 'review', 3, '{}', false, ${at(d, 40)})`);
      const p = (day, kind, quiz = []) =>
        Number(
          one(`select public.daily_mission_progress('${x.id}', '${day}', '${kind}', '{${quiz.join(',')}}'::uuid[])`),
        );
      return (
        compare(
          'DM-3',
          {
            clearToday: 2,
            clearYesterday: 1,
            noHintToday: 1,
            reviewToday: 2,
            dailyToday: 1,
            dailyYesterday: 1,
            correctToday: 1,
            correctYesterday: 0,
          },
          {
            clearToday: p(d, 'quest_clear'),
            clearYesterday: p(y, 'quest_clear'),
            noHintToday: p(d, 'no_hint'),
            reviewToday: p(d, 'review'),
            dailyToday: p(d, 'daily_quiz', [qz1, qz2]),
            dailyYesterday: p(y, 'daily_quiz', [qz1, qz2]),
            correctToday: p(d, 'quiz_correct'),
            correctYesterday: p(y, 'quiz_correct'),
          },
        ) ?? { actual: 'ok', detail: `오늘 ${d}: 자정 정각 완료는 오늘, 23:59:59 완료는 어제` }
      );
    },
  });

  await check({
    group: 'missions',
    id: 'DM-4',
    role: 'service_role',
    op: '받기: 미달 409 · 배정에 없음 404 · 기한 밖 410 · 동시 4번도 코인·XP 15 한 번(원장 mission/<날짜>:<id>) · 레벨을 넘으면 레벨 업 코인 · 어제 달성·안 받은 것은 pending 에 남고 받을 수 있음 · 잔액 = 원장 합',
    ...OK,
    run: async () => {
      const x = await createUser('dm4', '미션받기');
      const d = today();
      const y = ago(1);
      const [a, b] = stageQuests(STAGE1);
      await today_(x.id, []);
      one(`update public.user_daily_missions set mission_ids = '{quest_1,quest_3,no_hint_1}' where user_id = '${x.id}'`);
      await rpc('complete_quest', { p_user_id: x.id, p_quest_id: a, p_submission: submission() });
      const claim = (id, day = d) => rpc('claim_daily_mission', { p_user_id: x.id, p_day: day, p_mission_id: id });
      const short = await claim('quest_3');
      const notMine = await claim('review_1');
      const old = await claim('quest_1', ago(7));
      const future = await claim('quest_1', one(`select (public.kst_today() + 1)::text`));
      const xp0 = Number(one(`select total_xp from public.users where id = '${x.id}'`));
      const many = await Promise.all(Array.from({ length: 4 }, () => claim('quest_1')));
      const fresh = many.filter((r) => r.status === 200 && r.json.already_claimed === false);
      const xp1 = Number(one(`select total_xp from public.users where id = '${x.id}'`));
      // 레벨 2 문턱(200) 바로 아래에서 받으면 레벨 업 코인
      one(`update public.users set total_xp = 190 where id = '${x.id}'`);
      const lv = await claim('no_hint_1');
      // 어제 배정 + 어제 완료 → pending → 받기
      one(`insert into public.user_daily_missions (user_id, day, mission_ids) values ('${x.id}', '${y}', '{quest_1}')`);
      one(`insert into public.user_progress (user_id, quest_id, status, completed_at, code_submitted)
           values ('${x.id}', '${b}', 'completed', ${at(y, 3600)}, '')`);
      const pend = await today_(x.id, null);
      const past = await claim('quest_1', y);
      const pend2 = await today_(x.id, null);
      return (
        compare(
          'DM-4',
          {
            short: '409:mission_not_done',
            notMine: '404:mission_not_found',
            old: '410:mission_expired',
            future: '410:mission_expired',
            many: [200, 200, 200, 200],
            fresh: '1:10:15',
            xp: 15,
            lv: '15:35:2:20',
            pend: `${y}:quest_1`,
            past: '200:false:10',
            pend2: 0,
            rows: '3',
            refs: `${y}:quest_1,${d}:no_hint_1,${d}:quest_1`,
            mismatches: '0',
          },
          {
            short: `${short.status}:${errMsg(short)}`,
            notMine: `${notMine.status}:${errMsg(notMine)}`,
            old: `${old.status}:${errMsg(old)}`,
            future: `${future.status}:${errMsg(future)}`,
            many: many.map((r) => r.status),
            fresh: `${fresh.length}:${fresh[0]?.json.mission_coins}:${fresh[0]?.json.xp_earned}`,
            xp: xp1 - xp0,
            lv: `${lv.json?.mission_coins}:${lv.json?.coins_earned}:${lv.json?.level_after}:${lv.json?.level_ups?.[0]?.coins}`,
            pend: (pend.json?.pending ?? []).map((m) => `${m.day}:${m.id}`).join(','),
            past: `${past.status}:${past.json?.already_claimed}:${past.json?.mission_coins}`,
            pend2: pend2.json?.pending?.length,
            rows: one(`select count(*) from public.coin_ledger where user_id = '${x.id}' and source = 'mission'`),
            refs: one(`select string_agg(ref, ',' order by ref) from public.coin_ledger where user_id = '${x.id}' and source = 'mission'`),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: '미달·남의 미션·기한 밖 거부, 한 번만 코인+XP 15, 레벨 2 넘으며 +20, 어제 것 받기' }
      );
    },
  });
}

// ── 출석·스트릭 방패 (P8-08, ① 00035) ──
async function groupAttendance(u) {
  const ago = (n) => one(`select (public.kst_today() - ${n})::text`);
  const noonKst = (day) => `('${day} 12:00:00+09'::timestamptz)`;
  const stamp = (id) => rpc('stamp_attendance', { p_user_id: id });
  const status = (id) => rpc('world_daily_status', { p_user_id: id });
  // 지난 출석 = 원장 attendance/<날짜> (도장 RPC 는 오늘만 찍으므로 grant_coins 로 같은 키를 만듦)
  const pastStamps = async (id, days) => {
    for (const n of days)
      await rpc('grant_coins', { p_user_id: id, p_source: 'attendance', p_ref: ago(n), p_amount: 5 });
  };
  const setShields = (id, n) =>
    one(`insert into public.user_streak_shields (user_id, shields) values ('${id}', ${n})
           on conflict (user_id) do update set shields = excluded.shields`);
  const learnedOn = (id, quest, day, golden = false) =>
    one(`insert into public.user_progress (user_id, quest_id, status, completed_at, used_golden_key, code_submitted)
           values ('${id}', '${quest}', 'completed', ${noonKst(day)}, ${golden}, '')`);
  const shieldRows = (id) =>
    one(`select coalesce(string_agg(day::text, ',' order by day), '') from public.streak_shield_days where user_id = '${id}'`);
  const held = (id) => Number(one(`select coalesce((select shields from public.user_streak_shields where user_id = '${id}'), 0)`));

  await check({
    group: 'attendance',
    id: 'AT-1d',
    role: 'authenticated',
    op: 'user_streak_shields·streak_shield_days: 남의 행 읽기 · 비로그인 읽기 · 본인 행 INSERT·UPDATE (본인 행 읽기만 열림, 쓰기는 RPC)',
    ...WRITE,
    run: async () => {
      setShields(u.bob.id, 1);
      setShields(u.alice.id, 1);
      one(`insert into public.streak_shield_days (user_id, day) values ('${u.bob.id}', '2026-01-01') on conflict do nothing`);
      const others = await rest('GET', `/rest/v1/user_streak_shields?select=user_id&user_id=eq.${u.bob.id}`, { as: u.alice });
      if (others.status !== 200 || others.json.length !== 0)
        return { actual: 'written', detail: `남의 방패 ${others.status} rows=${others.json?.length}` };
      const otherDays = await rest('GET', `/rest/v1/streak_shield_days?select=day&user_id=eq.${u.bob.id}`, { as: u.alice });
      if (otherDays.status !== 200 || otherDays.json.length !== 0)
        return { actual: 'written', detail: `남의 방패 날 ${otherDays.status} rows=${otherDays.json?.length}` };
      const own = await rest('GET', '/rest/v1/user_streak_shields?select=shields', { as: u.alice });
      if (own.status !== 200 || own.json.length !== 1) return { actual: 'error', detail: `본인 방패 ${own.status}` };
      for (const t of ['user_streak_shields', 'streak_shield_days']) {
        const anon = classifyRead(await rest('GET', `/rest/v1/${t}?select=*`));
        if (anon.actual === 'allowed') return { actual: 'written', detail: `anon ${t} ${anon.detail}` };
      }
      const upd = await classifyWrite(
        rest('PATCH', `/rest/v1/user_streak_shields?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { shields: 2 },
          prefer: 'return=minimal',
        }),
        `select shields = 2 from public.user_streak_shields where user_id = '${u.alice.id}'`,
      );
      if (upd.actual === 'written') return { actual: 'written', detail: `본인 방패 UPDATE ${upd.detail}` };
      return classifyWrite(
        rest('POST', '/rest/v1/streak_shield_days', {
          as: u.alice,
          body: { user_id: u.alice.id, day: '2026-01-02' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.streak_shield_days where user_id = '${u.alice.id}' and day = '2026-01-02')`,
      );
    },
  });

  await check({
    group: 'attendance',
    id: 'AT-2',
    role: 'service_role',
    op: '출석 도장: 하루 한 번(원장 attendance/<KST 오늘>, 동시 4번도 1회) · 누적 7회 사이클(끊겨도 진행 유지, 8번째는 1일째) · 7일째 30코인 + 방패 1(가득 2개면 0) · 상태 칸·사이클 · 잔액 = 원장',
    ...OK,
    run: async () => {
      const x = await createUser('at2', '출석도장');
      const peek = await status(x.id);
      const many = await Promise.all(Array.from({ length: 4 }, () => stamp(x.id)));
      const fresh = many.filter((r) => r.status === 200 && r.json.already_stamped === false);
      const again = await stamp(x.id);
      const after = await status(x.id);
      // 지난 출석 6번(띄엄띄엄) → 오늘이 7일째 상자
      const y = await createUser('at2b', '출석상자');
      await pastStamps(y.id, [20, 11, 9, 5, 3, 2]);
      const before7 = await status(y.id);
      const chest = await stamp(y.id);
      // 방패가 가득(2)이면 7일째 상자는 코인만
      const z = await createUser('at2c', '출석방패가득');
      await pastStamps(z.id, [6, 5, 4, 3, 2, 1]);
      setShields(z.id, 2);
      const full = await stamp(z.id);
      // 7번 다 찍었으면 오늘은 새 사이클 1일째
      const w = await createUser('at2d', '출석새사이클');
      await pastStamps(w.id, [7, 6, 5, 4, 3, 2, 1]);
      const cycle = await stamp(w.id);
      const wStatus = await status(w.id);
      return (
        compare(
          'AT-2',
          {
            peek: `false:1:0`,
            many: [200, 200, 200, 200],
            fresh: `1:1:5`,
            again: `true:0:1`,
            after: `true:1:${ago(0)}`,
            before7: `false:7:6`,
            chest: `7:30:1:1`,
            full: `7:30:0:2`,
            cycle: `1:5`,
            wCycle: `1:${ago(0)}`,
            ref: ago(0),
            mismatches: '0:0:0:0',
          },
          {
            peek: `${peek.json?.attendance?.stamped_today}:${peek.json?.attendance?.day_n}:${peek.json?.attendance?.cycle?.length}`,
            many: many.map((r) => r.status),
            fresh: `${fresh.length}:${fresh[0]?.json.day_n}:${fresh[0]?.json.coins_earned}`,
            again: `${again.json?.already_stamped}:${again.json?.coins_earned}:${again.json?.day_n}`,
            after: `${after.json?.attendance?.stamped_today}:${after.json?.attendance?.day_n}:${after.json?.attendance?.cycle?.join(',')}`,
            before7: `${before7.json?.attendance?.stamped_today}:${before7.json?.attendance?.day_n}:${before7.json?.attendance?.cycle?.length}`,
            chest: `${chest.json?.day_n}:${chest.json?.coins_earned}:${chest.json?.shield_granted}:${chest.json?.shields}`,
            full: `${full.json?.day_n}:${full.json?.coins_earned}:${full.json?.shield_granted}:${full.json?.shields}`,
            cycle: `${cycle.json?.day_n}:${cycle.json?.coins_earned}`,
            wCycle: `${wStatus.json?.attendance?.day_n}:${wStatus.json?.attendance?.cycle?.join(',')}`,
            ref: one(`select ref from public.coin_ledger where user_id = '${x.id}' and source = 'attendance'`),
            mismatches: [x, y, z, w].map((v) => mismatches(v.id)).join(':'),
          },
        ) ?? { actual: 'ok', detail: '하루 1회 5코인, 띄엄띄엄 6번 뒤 7일째 30+방패, 가득이면 방패 0, 8번째는 1일째' }
      );
    },
  });

  await check({
    group: 'attendance',
    id: 'AT-3',
    role: 'service_role',
    op: '방패 정산(다음 방문): 하루 공백 1개로 메움·다시 불러도 그대로 · 이틀 공백 2개 · 모자라면 안 씀 · 방패 0 · 오늘 이미 풀었어도 어제 메움 · 동시 4번도 1개 · 학습일(퀴즈 끝냄 포함, 황금키 완료 제외)',
    ...OK,
    run: async () => {
      const [qa, qb, qc] = stageQuests(STAGE1);
      const quiz = one(
        `select id from public.quests where stage_id = '${STAGE1}' and quest_type = 'quiz' order by "order" limit 1`,
      );
      const mk = async (tag, learned, shields) => {
        const v = await createUser(`at3${tag}`, `방패${tag}`);
        learned.forEach((n, i) => learnedOn(v.id, [qa, qb, qc][i], ago(n)));
        if (shields !== null) setShields(v.id, shields);
        return v;
      };
      const st = (r) =>
        `${r.json?.streak?.days}:${r.json?.streak?.today}:${r.json?.streak?.shields}:${(r.json?.streak?.filled ?? []).length}`;
      const one1 = await mk('a', [2], 1);
      const r1 = await status(one1.id);
      const r1b = await status(one1.id);
      const two = await mk('b', [3], 2);
      const r2 = await status(two.id);
      const short = await mk('c', [3], 1);
      const r3 = await status(short.id);
      const none = await mk('d', [2], null);
      const r4 = await status(none.id);
      const todayToo = await mk('e', [2, 0], 1);
      const r5 = await status(todayToo.id);
      const race = await mk('f', [2], 2);
      const r6 = await Promise.all(Array.from({ length: 4 }, () => status(race.id)));
      // 퀴즈를 어제 끝냄(3번째 오답) = 학습일, 황금키 완료는 학습일 아님
      const q = await createUser('at3g', '방패퀴즈');
      one(`insert into public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct, created_at)
           values ('${q.id}', '${quiz}', 'first', 3, '{}', false, ${noonKst(ago(1))})`);
      learnedOn(q.id, qa, ago(0), true);
      const r7 = await status(q.id);
      return (
        compare(
          'AT-3',
          {
            one: `2:false:0:1`,
            oneRows: ago(1),
            oneAgain: `2:false:0:0`,
            two: `3:false:0:2`,
            twoRows: `${ago(2)},${ago(1)}`,
            short: `0:false:1:0`,
            none: `0:false:0:0`,
            todayToo: `3:true:0:1`,
            race: '1:1',
            raceDays: 2,
            quiz: `1:false`,
            noRows: '',
          },
          {
            one: st(r1),
            oneRows: shieldRows(one1.id),
            oneAgain: st(r1b),
            two: st(r2),
            twoRows: shieldRows(two.id),
            short: st(r3),
            none: st(r4),
            todayToo: st(r5),
            race: `${held(race.id)}:${shieldRows(race.id).split(',').length}`,
            raceDays: r6[0].json?.streak?.days,
            quiz: `${r7.json?.streak?.days}:${r7.json?.streak?.today}`,
            noRows: shieldRows(short.id) + shieldRows(none.id),
          },
        ) ?? { actual: 'ok', detail: '1일 공백 1개·2일 공백 2개로 메움, 모자람·0개는 그대로, 동시 1회, 퀴즈 끝낸 날 학습일' }
      );
    },
  });
}

// ── account: 탈퇴 (B28) ─────────────────────────────────────
// 클라이언트에는 users DELETE 권한·정책이 없고(00008), 탈퇴는 /api/account/delete 가 auth.admin.deleteUser 로
// auth.users 를 지워 public 의 사용자 데이터를 ON DELETE CASCADE 로 함께 지움. 분석 기록은 users 를 참조하지 않아
// 앱이 HMAC 익명 ID 로 지움(P1-17). 새 사용자 테이블이 FK·cascade 를 빠뜨리면 B28-1·2 가 FAIL
// 앱의 HMAC 익명 ID (src/lib/analytics/server.ts anonymizeUserId 와 같은 식). 점검 전용 salt
const AN_SALT = 'rls-test-salt-not-a-secret';
const analyticsAnonId = (userId) =>
  createHmac('sha256', AN_SALT)
    .update(`pyroad:analytics:user:${userId}`)
    .digest('base64url')
    .slice(0, 22);

async function groupAccount(u) {
  await check({
    group: 'account',
    id: 'B28-1',
    role: 'postgres',
    op: '사용자(auth.users·users·user_public_profiles)를 가리키는 FK 중 ON DELETE CASCADE 가 아닌 것 + FK 없는 사용자 열 (*user_id·reporter_id)',
    ...NONE,
    run: () => {
      const v = one(`with targets as (
          select r from (values (to_regclass('auth.users')), (to_regclass('public.users')),
                                (to_regclass('public.user_public_profiles'))) t(r) where r is not null),
        fk as (
          select c.conrelid, c.conname, c.confdeltype, a.attname
            from pg_constraint c
            join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
           where c.contype = 'f' and c.confrelid in (select r from targets) and ${APP_SCHEMA('n')})
        select coalesce(string_agg(x, ', ' order by x), '') from (
          select format('%s.%s %s (on delete %s)', conrelid::regclass, attname, conname, confdeltype) x
            from fk
           where confdeltype <> 'c'
             and not (conrelid = 'public.board_reports'::regclass and attname = 'target_user_id' and confdeltype = 'n')
          union all
          select format('%s.%s (users FK 없음)', c.oid::regclass, a.attname)
            from pg_attribute a
            join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
           where c.relkind in ('r', 'p') and ${APP_SCHEMA('n')} and a.attnum > 0 and not a.attisdropped
             and (a.attname ~ '(^|_)user_id$' or a.attname = 'reporter_id')
             and not exists (select 1 from fk where fk.conrelid = c.oid and fk.attname = a.attname)
        ) s`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });

  await check({
    group: 'account',
    id: 'B28-2',
    role: 'service_role',
    op: '탈퇴(/api/account/delete: auth.admin.deleteUser → HMAC 분석 기록 삭제) 뒤 public·auth 의 모든 uuid 열과 analytics_events 에 그 사용자 값이 남지 않음',
    deny: ['left', 'error'],
    allow: ['clean'],
    run: async () => {
      const x = await createUser('b28', '탈퇴실명');
      const anonId = analyticsAnonId(x.id);
      // 사용자 데이터가 들어가는 모든 테이블에 1행 이상 (postgres 로 직접 = 권한과 무관)
      const fx = psql(`
        insert into public.user_progress (user_id, quest_id, status, code_submitted) values ('${x.id}', '${Q1}', 'in_progress', 'print(1)');
        insert into public.user_badges (user_id, badge_type) values ('${x.id}', 'first_code');
        insert into public.user_achievements (user_id, achievement_id) values ('${x.id}', 'first_code');
        insert into public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct) values ('${x.id}', '${Q1}', 'first', 1, '{}', false);
        insert into public.user_api_keys (user_id, provider, key_version, iv, auth_tag, ciphertext) values ('${x.id}', 'openai', 1, 'AAAA', 'AAAA', 'AAAA');
        insert into public.api_rate_limits (user_id, bucket, minute_start, day) values ('${x.id}', 'tutor:hint', now(), public.kst_today());
        update public.users set nickname = '탈퇴코딩' where id = '${x.id}';
        with p as (insert into public.board_posts (user_id, title, content) values ('${x.id}', 'b28 post', 'x') returning id)
          insert into public.board_comments (post_id, user_id, content) select id, '${u.bob.id}', 'bob on b28 post' from p;
        insert into public.board_comments (post_id, user_id, content) values ('${u.postId}', '${x.id}', 'b28 on bob post');
        insert into public.board_reports (reporter_id, target_type, target_id, target_user_id, reason)
          values ('${x.id}', 'post', '${u.postId}', '${u.bob.id}', 'other');
        insert into public.board_reports (reporter_id, target_type, target_id, target_user_id, reason)
          select '${u.bob.id}', 'post', id, '${x.id}', 'abuse' from public.board_posts where user_id = '${x.id}';
        insert into public.analytics_events (name, actor, anon_id, source, props, device)
          values ('quest_start', 'user', '${anonId}', 'server', '{}', 'desktop');
      `);
      if (!fx.ok) return { actual: 'error', detail: `픽스처: ${firstLine(fx.err)}` };
      const xPost = one(`select id from public.board_posts where user_id = '${x.id}'`);

      // = src/app/api/account/delete/route.ts: admin.deleteUser → deleteUserAnalytics (HMAC)
      const del = await rest('DELETE', `/auth/v1/admin/users/${x.id}`, { as: 'service' });
      const an = await rest(
        'DELETE',
        `/rest/v1/analytics_events?actor=eq.user&anon_id=eq.${anonId}`,
        { as: 'service', prefer: 'return=minimal' },
      );
      if (del.status >= 300 || an.status >= 300)
        return { actual: 'error', detail: `deleteUser ${del.status} · analytics ${an.status}` };

      // 남은 값 찾기: public·auth 의 모든 테이블의 모든 uuid 열 + HMAC 익명 ID + 탈퇴한 아이 글에 달린 다른 아이의 댓글
      const left = one(`do $$
        declare r record; n bigint; v text := '';
        begin
          for r in select c.oid::regclass as rel, a.attname
                     from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace s on s.oid = c.relnamespace
                    where c.relkind in ('r', 'p') and s.nspname in ('public', 'auth')
                      and a.attnum > 0 and not a.attisdropped and a.atttypid = 'uuid'::regtype
          loop
            execute format('select count(*) from %s where %I = $1', r.rel, r.attname) into n using '${x.id}'::uuid;
            if n > 0 then v := v || format('%s.%s=%s ', r.rel, r.attname, n); end if;
          end loop;
          select count(*) into n from public.analytics_events where anon_id = '${anonId}';
          if n > 0 then v := v || format('analytics_events.anon_id(HMAC)=%s ', n); end if;
          if exists (select 1 from public.board_comments where post_id = '${xPost}') then
            v := v || '탈퇴한 아이 글의 댓글 ';
          end if;
          perform set_config('b28.left', v, false);
        end $$;
        select current_setting('b28.left')`);
      // 다른 아이가 한 신고 기록은 남고 탈퇴한 아이를 가리키지 않음 (target_user_id SET NULL, 의도)
      const kept = one(
        `select count(*) from public.board_reports where reporter_id = '${u.bob.id}' and target_id = '${xPost}' and target_user_id is null`,
      );
      return {
        actual: left.trim() ? 'left' : 'clean',
        detail: left.trim()
          ? `남음: ${left.trim()}`
          : `deleteUser ${del.status} · 모든 uuid 열 0 · HMAC 기록 0 · 다른 아이의 신고 ${kept}건은 target_user_id NULL 로 남음`,
      };
    },
  });

  await check({
    group: 'account',
    id: 'B28-3',
    role: 'authenticated',
    op: 'DELETE /users?id=eq.<본인> (클라이언트 직접 탈퇴)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.users where id = '${u.alice.id}')`,
      ),
  });
}

async function groupApp(u) {
  // 앱이 실제로 보내는 PostgREST 쿼리 (src/ 기준, 2026-11-04). 권한 작업 뒤에도 동작해야 함
  // 지금 사용자 클라이언트로 서버 값(XP·완료·뱃지)을 쓰는 경로는 write 그룹의 known-gap 이 함께 기록합니다.
  const reads = [
    [
      'APP-1',
      'quest/[questId]/page.tsx quests',
      `/rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type,xp_reward,created_at,stage:stages(id,title,order,theme_name)&id=eq.${Q1}`,
    ],
    [
      'APP-2',
      'world/page.tsx stages (P1-08: 월드 order 임베딩, 정렬은 getStageStatuses)',
      '/rest/v1/stages?select=id,world_id,order,title,theme_name,description,is_final,created_at,world:worlds(order),quests(id,order)',
    ],
    [
      'APP-3',
      'world·profile user_progress',
      `/rest/v1/user_progress?select=quest_id,status&user_id=eq.${u.alice.id}`,
    ],
    [
      'APP-4',
      'world·profile users + 공개 프로필 (P3-13 OWN_PROFILE_SELECT: 실명·사진 컬럼 안 읽음)',
      `/rest/v1/users?select=id,total_xp,current_level,coins,user_public_profiles(public_name,avatar_skin)&id=eq.${u.alice.id}`,
    ],
    [
      'APP-5',
      'profile/page.tsx user_achievements (P8-09: 뱃지 → 업적)',
      `/rest/v1/user_achievements?select=achievement_id,achieved_at&user_id=eq.${u.alice.id}`,
    ],
    [
      'APP-17',
      'profile/page.tsx achievements (P8-09 업적 정의)',
      '/rest/v1/achievements?select=id,name,icon,tier,sort,hidden&order=sort',
    ],
    [
      'APP-6',
      'profile/page.tsx stages (P1-08: 월드 order 임베딩, 정렬은 sortStages)',
      '/rest/v1/stages?select=id,order,title,world:worlds(order),quests(id)',
    ],
    [
      'APP-7',
      'quest/[questId]/page.tsx users',
      `/rest/v1/users?select=total_xp,current_level,golden_keys&id=eq.${u.alice.id}`,
    ],
    [
      'APP-8',
      'quest/[questId]/page.tsx user_progress',
      `/rest/v1/user_progress?select=*&user_id=eq.${u.alice.id}&quest_id=eq.${Q1}`,
    ],
    [
      'APP-9',
      '퀘스트 읽기 (예전 checkBadges.ts)',
      `/rest/v1/quests?select=stage_id&id=eq.${Q1}`,
    ],
    [
      'APP-10',
      '퀘스트 읽기 (예전 checkBadges.ts)',
      `/rest/v1/quests?select=id&stage_id=eq.${STAGE1}`,
    ],
    [
      'APP-11',
      '퀘스트 읽기 (예전 checkBadges.ts)',
      `/rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.${Q1}`,
    ],
    [
      'APP-16',
      'loadWorldMapData.ts user_seen_unlocks (P5-05: 본인 행만, RLS 에 맡겨 user_id 필터 없음)',
      '/rest/v1/user_seen_unlocks?select=user_id,stage_id',
    ],
    [
      'APP-15',
      '(protected)/layout.tsx 온보딩 관문 + 움직임·사운드 설정 + 보호자 동의 상태 (P3-11·P3-15 loadOwnUserRow)',
      `/rest/v1/users?select=settings,onboarded_at,age_band,guardian_consented_at,consent_deadline&id=eq.${u.alice.id}`,
    ],
  ];
  // 보고서에 매번 바뀌는 uuid 가 남지 않게 자리표시자로 바꿈
  const shortPath = (path) =>
    decodeURIComponent(path)
      .replace('/rest/v1', '')
      .replaceAll(u.alice.id, '<본인>')
      .replaceAll(Q1, '<1-1>')
      .replaceAll(STAGE1, '<스테이지1>');
  for (const [id, where, path] of reads) {
    await check({
      group: 'app',
      id,
      role: 'authenticated',
      op: `${where} → GET ${shortPath(path)}`,
      ...READ,
      run: async () => {
        const r = await rest('GET', path, { as: u.alice });
        const c = classifyRead(r);
        if ((id === 'APP-2' || id === 'APP-6') && c.actual === 'allowed') {
          const bad = r.json.filter((s) => s.world?.order !== 1);
          if (bad.length)
            return { actual: 'world-missing', detail: `${bad.length}행에 world.order 없음` };
        }
        if (id === 'APP-4' && c.actual === 'allowed') {
          const pub = r.json[0]?.user_public_profiles;
          if (!pub || typeof pub.public_name !== 'string' || !('avatar_skin' in pub))
            return { actual: 'profile-missing', detail: JSON.stringify(r.json[0]).slice(0, 160) };
        }
        if (id === 'APP-16' && c.actual === 'allowed') {
          const others = r.json.filter((x) => x.user_id !== u.alice.id);
          if (others.length) return { actual: 'leak', detail: `남의 행 ${others.length}` };
        }
        if (id === 'APP-1' && c.actual === 'allowed') {
          const sk = r.json[0].prompt_skeleton;
          if (typeof sk?.starter_code !== 'string')
            return {
              actual: 'skeleton-broken',
              detail: Object.keys(sk ?? {}).join(','),
            };
        }
        return c;
      },
    });
  }
  await check({
    group: 'app',
    id: 'APP-12',
    role: 'authenticated',
    op: 'checkBadges.ts → HEAD /user_progress?select=* + count=exact (head: true)',
    ...READ,
    run: async () => {
      const r = await rest(
        'HEAD',
        `/rest/v1/user_progress?select=*&user_id=eq.${u.alice.id}&status=eq.completed`,
        { as: u.alice, prefer: 'count=exact' },
      );
      return r.status >= 200 && r.status < 300 && r.headers.get('content-range')
        ? {
            actual: 'allowed',
            detail: `${r.status} content-range=${r.headers.get('content-range')}`,
          }
        : {
            actual: r.status === 401 || r.status === 403 ? 'denied' : 'error',
            detail: `${r.status}`,
          };
    },
  });
  await check({
    group: 'app',
    id: 'APP-13',
    role: 'authenticated',
    op: 'board/page.tsx → GET /board_posts?select=*,user_profiles_public!…(display_name,avatar_skin),board_comments(count) + count=exact (작성자 = 모험가NNNN, P1-18·P3-13)',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        '/rest/v1/board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_skin),board_comments(count)&order=created_at.desc&offset=0&limit=10',
        { as: u.alice, prefer: 'count=exact' },
      );
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const name = r.json[0]?.user_profiles_public?.display_name;
      if (!name)
        return {
          actual: 'author-missing',
          detail: JSON.stringify(r.json[0]).slice(0, 120),
        };
      // 픽스처 작성자(bob·alice)는 닉네임이 없으므로 자리표시자여야 함 (실명 박밥·김앨리스가 아님, P1-18)
      if (!/^모험가\d{4}$/.test(name))
        return { actual: 'real-name', detail: name };
      if (!('avatar_skin' in r.json[0].user_profiles_public))
        return { actual: 'avatar-missing', detail: JSON.stringify(r.json[0].user_profiles_public) };
      return c;
    },
  });
  await check({
    group: 'app',
    id: 'APP-14',
    role: 'authenticated',
    op: 'board/[postId]/page.tsx → GET /board_comments?select=*,user_profiles_public!…(display_name,avatar_skin)',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        `/rest/v1/board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_skin)&post_id=eq.${u.postId}&order=created_at.asc`,
        { as: u.alice },
      );
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const name = r.json[0]?.user_profiles_public?.display_name;
      if (!name)
        return {
          actual: 'author-missing',
          detail: JSON.stringify(r.json[0]).slice(0, 120),
        };
      // 픽스처 작성자(bob·alice)는 닉네임이 없으므로 자리표시자여야 함 (실명 박밥·김앨리스가 아님, P1-18)
      if (!/^모험가\d{4}$/.test(name))
        return { actual: 'real-name', detail: name };
      if (!('avatar_skin' in r.json[0].user_profiles_public))
        return { actual: 'avatar-missing', detail: JSON.stringify(r.json[0].user_profiles_public) };
      return c;
    },
  });

  // ── 사용자 클라이언트 쓰기 (정상 경로) ──
  const upsert = (questId, body) =>
    rest('POST', '/rest/v1/user_progress?on_conflict=user_id,quest_id', {
      as: u.alice,
      body: { user_id: u.alice.id, quest_id: questId, ...body },
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  await check({
    group: 'app',
    id: 'APP-W1',
    role: 'authenticated',
    op: 'QuestShell.tsx auto-save → upsert user_progress {code_submitted} (기존 행 → 힌트 수 그대로, 새 행 → status in_progress)',
    ...WRITE,
    run: async () => {
      // 서버 값(힌트 수·황금키·상태)은 payload 에 없으므로 그대로여야 함
      const server = `hints_used || ',' || used_golden_key || ',' || status`;
      const before = one(
        `select ${server} from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q1}'`,
      );
      const existing = await classifyWrite(
        upsert(Q1, { code_submitted: 'print("w1")' }),
        `select code_submitted = 'print("w1")' and ${server} = ${sqlStr(before)} from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q1}'`,
      );
      if (existing.actual !== 'written')
        return { ...existing, detail: `기존 행: ${existing.detail}` };
      return classifyWrite(
        upsert(Q_LAST1, { code_submitted: 'print("w1 new")' }),
        `select status = 'in_progress' and hints_used = 0 and code_submitted = 'print("w1 new")' from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q_LAST1}'`,
      );
    },
  });
  await check({
    group: 'app',
    id: 'APP-W2',
    role: 'authenticated',
    op: 'ProjectQuestShell.tsx 진행 저장 → upsert user_progress {code_submitted, current_step, step_submissions} (새 행 → 같은 행 갱신)',
    ...WRITE,
    run: async () => {
      const qid = Q3;
      const first = await classifyWrite(
        upsert(qid, {
          code_submitted: 'a',
          current_step: 0,
          step_submissions: ['a'],
        }),
        `select exists (select 1 from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${qid}')`,
      );
      if (first.actual !== 'written')
        return { ...first, detail: `새 행: ${first.detail}` };
      return classifyWrite(
        upsert(qid, {
          code_submitted: 'b',
          current_step: 1,
          step_submissions: ['a', 'b'],
        }),
        `select current_step = 1 and code_submitted = 'b' from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${qid}'`,
      );
    },
  });
  await check({
    group: 'app',
    id: 'APP-W3',
    role: 'authenticated',
    op: 'api/settings PATCH → PATCH /users?id=eq.<본인> {preferred_provider}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { preferred_provider: 'openai' },
          prefer: 'return=minimal',
        }),
        `select preferred_provider = 'openai' from public.users where id = '${u.alice.id}'`,
      ),
  });
  // 게시판 쓰기: P1-18 부터 API Route 가 금칙어 검사 후 service_role 로 씀 (사용자 클라이언트 쓰기는 ③ 00015 가 막음, BW-*)
  const title = `app-post-${RUN}`;
  await check({
    group: 'app',
    id: 'APP-W4',
    role: 'service_role',
    op: 'api/board/posts POST → POST /board_posts {user_id: 본인} (service_role)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/board_posts', {
          as: 'service',
          body: { user_id: u.alice.id, title, content: '안녕' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_posts where title = ${sqlStr(title)})`,
      ),
  });
  const myPost = one(
    `select coalesce((select id::text from public.board_posts where title = ${sqlStr(title)}), '')`,
  );
  await check({
    group: 'app',
    id: 'APP-W5',
    role: 'service_role',
    op: 'api/board/posts/[postId] PATCH → PATCH /board_posts?id=eq.<본인 글>&user_id=eq.<본인> (service_role)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/board_posts?id=eq.${myPost}&user_id=eq.${u.alice.id}`, {
          as: 'service',
          body: { content: '고쳤어요' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_posts where id::text = ${sqlStr(myPost)} and content = '고쳤어요')`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W6',
    role: 'service_role',
    op: 'api/board/comments POST → POST /board_comments {user_id: 본인} (service_role)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/board_comments', {
          as: 'service',
          body: {
            post_id: u.postId,
            user_id: u.alice.id,
            content: `app-comment-${RUN}`,
          },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_comments where content = 'app-comment-${RUN}')`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W7',
    role: 'service_role',
    op: 'api/board/comments/[commentId] DELETE → DELETE /board_comments?id=eq.<본인 댓글>&user_id=eq.<본인> (service_role)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest(
          'DELETE',
          `/rest/v1/board_comments?content=eq.app-comment-${RUN}&user_id=eq.${u.alice.id}`,
          { as: 'service', prefer: 'return=minimal' },
        ),
        `select not exists (select 1 from public.board_comments where content = 'app-comment-${RUN}')`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W8',
    role: 'service_role',
    op: 'api/board/posts/[postId] DELETE → DELETE /board_posts?id=eq.<본인 글>&user_id=eq.<본인> (service_role)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/board_posts?id=eq.${myPost}&user_id=eq.${u.alice.id}`, {
          as: 'service',
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.board_posts where id::text = ${sqlStr(myPost)})`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W9',
    role: 'authenticated',
    op: 'PATCH /board_posts?id=eq.<다른 사람 글> (라우트 검사 우회)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/board_posts?id=eq.${u.postId}`, {
          as: u.alice,
          body: { content: '남의 글 변조' },
          prefer: 'return=minimal',
        }),
        `select content = '남의 글 변조' from public.board_posts where id = '${u.postId}'`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W10',
    role: 'authenticated',
    op: 'DELETE /user_progress?user_id=eq.<본인>&quest_id=in.(…) (이전 api/account/reset 경로)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest(
          'DELETE',
          `/rest/v1/user_progress?user_id=eq.${u.alice.id}&quest_id=in.(${Q3})`,
          { as: u.alice, prefer: 'return=minimal' },
        ),
        `select not exists (select 1 from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q3}')`,
      ),
  });

  // ── 서버(service_role) 경로 ──
  // 정답은 src/lib/quest/answerKeys.ts 의 fetchAnswerKeyRow 로 읽고(APP-S4), quests 행은 폴백용으로 같이 읽음 (P1-02)
  const svc = [
    [
      'APP-S1',
      'api/tutor/helpers.ts',
      `/rest/v1/quests?select=*,stage:stages(id,title,order,theme_name)&id=eq.${Q1}`,
    ],
    [
      'APP-S2',
      'api/quest/validate/route.ts',
      `/rest/v1/quests?select=validation_type,expected_output,prompt_skeleton&id=eq.${Q1}`,
    ],
    [
      'APP-S3',
      'api/quest/golden-key/route.ts',
      `/rest/v1/quests?select=id,prompt_skeleton,stage_id&id=eq.${Q1}`,
    ],
    [
      'APP-S4',
      'lib/quest/answerKeys.ts (validate·golden-key·tutor)',
      `/rest/v1/quest_answer_keys?select=expected_output,hints,solution_code,steps&quest_id=eq.${Q1}`,
    ],
  ];
  for (const [id, where, path] of svc) {
    await check({
      group: 'app',
      id,
      role: 'service_role',
      op: `${where} → GET ${shortPath(path)}`,
      ...READ,
      run: async () => classifyRead(await rest('GET', path, { as: 'service' })),
    });
  }
}

// 의도한 Advisors WARN (이름:스키마.객체). 늘릴 때는 이유를 함께 적음
const ADVISOR_WARN_ALLOWED = [
  'function_search_path_mutable:public.kst_date', // P1-08: 인라인되도록 SET search_path 대신 pg_catalog. 명시
];
/** supabase db advisors 를 로컬 DB(RLS_DB_URL)에 실행 → { rows } | { error } */
function advisorsReport() {
  const url = process.env.RLS_DB_URL;
  if (!url) return { error: 'RLS_DB_URL 없음 (run.sh 로 실행)' };
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname))
    return { error: `RLS_DB_URL 이 로컬 주소가 아님 (운영 DB 에는 접속하지 않음)` };
  const dbUrl = url + (url.includes('?') ? '&' : '?') + 'sslmode=disable';
  const r = spawnSync(
    'supabase',
    ['db', 'advisors', '--db-url', dbUrl, '--type', 'all', '--level', 'info', '-o', 'json'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) return { error: `supabase db advisors 실패: ${firstLine(r.stderr || String(r.error ?? ''))}` };
  try {
    const out = (r.stdout || '').trim();
    return { rows: out ? JSON.parse(out) : [] };
  } catch (e) {
    return { error: `JSON 해석 실패: ${String(e).split('\n')[0]}` };
  }
}

async function groupStatic() {
  await check({
    group: 'static',
    id: 'ST-1',
    role: 'postgres',
    op: 'RLS 가 꺼진 앱 테이블',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(format('%s.%s', n.nspname, c.relname), ',' order by 1), '')
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p') and ${APP_SCHEMA('n')} and not c.relrowsecurity`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  const definer = (
    trigger,
  ) => `select coalesce(string_agg(format('%s.%s', n.nspname, p.proname), ',' order by 1), '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where p.prosecdef and ${APP_SCHEMA('n')}
       and p.prorettype ${trigger ? '=' : '<>'} 'trigger'::regtype
       and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`;
  await check({
    group: 'static',
    id: 'ST-2',
    role: 'postgres',
    op: 'anon/authenticated 가 RPC 로 실행할 수 있는 SECURITY DEFINER 함수 (트리거 제외)',
    ...NONE,
    run: () => {
      const v = one(definer(false));
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  await check({
    group: 'static',
    id: 'ST-3',
    role: 'postgres',
    op: 'anon/authenticated 가 EXECUTE 권한을 가진 SECURITY DEFINER 트리거 함수',
    ...NONE,
    run: () => {
      const v = one(definer(true));
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  await check({
    group: 'static',
    id: 'ST-4',
    role: 'postgres',
    op: 'search_path 가 고정되지 않은 SECURITY DEFINER 함수',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(format('%s.%s', n.nspname, p.proname), ',' order by 1), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosecdef and ${APP_SCHEMA('n')}
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  await check({
    group: 'static',
    id: 'ST-5',
    role: 'postgres',
    op: 'auth.uid()/auth.role() 를 (select …) 로 감싸지 않은 정책 수 (B34)',
    deny: ['0'],
    allow: (a) => a !== '0',
    run: () => {
      const v = one(`select count(*) from pg_policies
       where schemaname = 'public'
         and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'SELECT auth\\.(uid|role)\\(\\)', '', 'g') ~ 'auth\\.(uid|role)\\(\\)'`);
      return { actual: v, detail: `${v}개` };
    },
  });
  await check({
    group: 'static',
    id: 'ST-6',
    role: 'postgres',
    op: 'search_path 가 고정되지 않은 public 함수 (Advisors function_search_path_mutable. 인라인용 kst_date 는 예외)',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by 1), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'kst_date'
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
         and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });

  // B34: Supabase Advisors 와 같은 규칙(CLI 내장 splinter)을 로컬 DB 에 실행. 운영 Advisors 는 Auth 설정 경고
  // (auth_leaked_password_protection 등)도 내지만 그건 DB 가 아니라 대시보드 설정이라 여기서는 안 나옴
  const advisors = advisorsReport();
  const advRows = (level) =>
    advisors.rows
      ? advisors.rows
          .filter((x) => x.level === level)
          .map((x) => `${x.name}:${x.metadata?.schema ?? ''}.${x.metadata?.name ?? ''}`)
          .sort()
      : [];
  await check({
    group: 'static',
    id: 'ST-7',
    role: 'postgres',
    op: 'supabase db advisors (security·performance) ERROR',
    ...NONE,
    run: () =>
      advisors.rows
        ? { actual: advRows('ERROR').join(',') || 'none', detail: advRows('ERROR').join(', ') || '(없음)' }
        : { actual: 'error', detail: advisors.error },
  });
  await check({
    group: 'static',
    id: 'ST-8',
    role: 'postgres',
    op: `supabase db advisors WARN (의도한 것 제외: ${ADVISOR_WARN_ALLOWED.join(', ')})`,
    ...NONE,
    run: () => {
      if (!advisors.rows) return { actual: 'error', detail: advisors.error };
      const v = advRows('WARN').filter((x) => !ADVISOR_WARN_ALLOWED.includes(x));
      return { actual: v.join(',') || 'none', detail: v.join(', ') || `(없음. 의도한 WARN ${advRows('WARN').length}건)` };
    },
  });
  await check({
    group: 'static',
    id: 'ST-9',
    role: 'postgres',
    op: 'supabase db advisors INFO (기록)',
    deny: [],
    allow: [],
    run: () => {
      if (!advisors.rows) return { actual: 'error', detail: advisors.error };
      const counts = {};
      for (const x of advRows('INFO')) {
        const k = x.split(':')[0];
        counts[k] = (counts[k] ?? 0) + 1;
      }
      const v = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ');
      return { actual: String(advRows('INFO').length), detail: v || '(없음)' };
    },
  });

  const snap = (id, op, name, sql) =>
    check({
      group: 'static',
      id,
      role: 'postgres',
      op,
      deny: ['match'],
      allow: [],
      run: snapshot(name, sql),
    });
  await snap(
    'SNAP-1',
    'anon/authenticated 가 실행할 수 있는 SECURITY DEFINER 함수 목록 = snapshots/definer_functions.txt',
    'definer_functions',
    `select format('%s.%s(%s) returns %s | execute: %s | %s', n.nspname, p.proname,
        pg_get_function_identity_arguments(p.oid), p.prorettype::regtype,
        concat_ws(',', case when has_function_privilege('anon', p.oid, 'EXECUTE') then 'anon' end,
                       case when has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'authenticated' end),
        coalesce((select string_agg(c, ',') from unnest(p.proconfig) c where c like 'search_path=%'), 'search_path 미설정'))
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where p.prosecdef and ${APP_SCHEMA('n')}
        and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
      order by 1`,
  );
  await snap(
    'SNAP-2',
    'anon/authenticated 의 테이블·뷰·컬럼 권한 = snapshots/table_privileges.txt',
    'table_privileges',
    `with privs(p) as (
       select unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
         || case when current_setting('server_version_num')::int >= 170000 then array['MAINTAIN'] else '{}'::text[] end))
     select line from (
       select format('%s.%s (%s, rls=%s) %s: %s', n.nspname, c.relname,
                case c.relkind when 'r' then 'table' when 'p' then 'table' when 'v' then 'view' when 'm' then 'matview' else c.relkind::text end,
                case when c.relrowsecurity then 'on' else 'off' end, r.rolname,
                coalesce((select string_agg(p, ',' order by p) from privs where has_table_privilege(r.rolname, c.oid, p)), '-')) line
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         cross join (values ('anon'), ('authenticated')) r(rolname)
        where c.relkind in ('r', 'p', 'v', 'm') and ${APP_SCHEMA('n')}
       union all
       select format('%s.%s.%s column %s: %s', n.nspname, c.relname, a.attname, g.rolname,
                string_agg(x.privilege_type, ',' order by x.privilege_type))
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
         cross join lateral aclexplode(a.attacl) x
         join pg_roles g on g.oid = x.grantee
        where a.attacl is not null and ${APP_SCHEMA('n')} and g.rolname in ('anon', 'authenticated')
        group by n.nspname, c.relname, a.attname, g.rolname
     ) t order by 1`,
  );
  await snap(
    'SNAP-3',
    'RLS 정책 목록 = snapshots/rls_policies.txt',
    'rls_policies',
    `select format('%s.%s %s [%s %s to %s] using (%s) check (%s)', schemaname, tablename, policyname,
        permissive, cmd, array_to_string(roles, ','), coalesce(qual, '-'), coalesce(with_check, '-'))
       from pg_policies where schemaname not in ${MANAGED_SCHEMAS} order by 1`,
  );
}

// ── schema: P1-08 스키마 확장 (00012) ─────────────────────────
// ── 업적 (P8-09, ① 00036) ──
async function groupAchievements(u) {
  const evaluate = (id) => rpc('evaluate_achievements', { p_user_id: id });
  const claim = (id, a) => rpc('claim_achievement', { p_user_id: id, p_achievement_id: a });
  const complete = (id, q, extra = {}) =>
    rpc('complete_quest', { p_user_id: id, p_quest_id: q, p_submission: { ...submission(), ...extra } });
  const ids = (r) => (r.json?.new_achievements ?? []).map((a) => a.id).join(',');
  const owned = (id) =>
    one(`select coalesce(string_agg(achievement_id || ':' || (claimed_at is not null), ',' order by achievement_id), '')
           from public.user_achievements where user_id = '${id}'`);
  // 시드 1스테이지 객관식 퀴즈 하나: 정답·오답 보기
  const mc = JSON.parse(
    one(`select json_build_object('id', q.id, 'right', k.quiz_answer->'accepted'->0,
           'wrong', (select o->'id' from jsonb_array_elements(q.prompt_skeleton->'quiz'->'options') o
                      where o->'id' <> k.quiz_answer->'accepted'->0 limit 1))
           from public.quests q join public.quest_answer_keys k on k.quest_id = q.id
          where q.stage_id = '${STAGE1}' and q.quiz_kind = 'multiple_choice' order by q."order" limit 1`),
  );

  await check({
    group: 'achievements',
    id: 'AC-1d',
    role: 'authenticated',
    op: 'achievements·user_achievements: 정의는 로그인 사용자 읽기만, 남의 업적·비로그인 읽기 · 본인 업적 INSERT·받은 시각 UPDATE (쓰기는 RPC)',
    ...WRITE,
    run: async () => {
      one(`insert into public.user_achievements (user_id, achievement_id) values ('${u.bob.id}', 'first_code'), ('${u.alice.id}', 'first_code')
             on conflict do nothing`);
      const defs = await rest('GET', '/rest/v1/achievements?select=id', { as: u.alice });
      if (defs.status !== 200 || defs.json.length < 30) return { actual: 'error', detail: `정의 읽기 ${defs.status} rows=${defs.json?.length}` };
      const others = await rest('GET', `/rest/v1/user_achievements?select=user_id&user_id=eq.${u.bob.id}`, { as: u.alice });
      if (others.status !== 200 || others.json.length !== 0)
        return { actual: 'written', detail: `남의 업적 ${others.status} rows=${others.json?.length}` };
      const own = await rest('GET', '/rest/v1/user_achievements?select=achievement_id', { as: u.alice });
      if (own.status !== 200 || own.json.length !== 1) return { actual: 'error', detail: `본인 업적 ${own.status}` };
      for (const t of ['achievements', 'user_achievements']) {
        const anon = classifyRead(await rest('GET', `/rest/v1/${t}?select=*`));
        if (anon.actual === 'allowed') return { actual: 'written', detail: `anon ${t} ${anon.detail}` };
      }
      const upd = await classifyWrite(
        rest('PATCH', `/rest/v1/user_achievements?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { claimed_at: new Date().toISOString() },
          prefer: 'return=minimal',
        }),
        `select claimed_at is not null from public.user_achievements where user_id = '${u.alice.id}' and achievement_id = 'first_code'`,
      );
      if (upd.actual === 'written') return { actual: 'written', detail: `받은 시각 UPDATE ${upd.detail}` };
      const def = await classifyWrite(
        rest('PATCH', '/rest/v1/achievements?id=eq.first_code', {
          as: u.alice,
          body: { goal: 99 },
          prefer: 'return=minimal',
        }),
        `select goal = 99 from public.achievements where id = 'first_code'`,
      );
      if (def.actual === 'written') return { actual: 'written', detail: `정의 UPDATE ${def.detail}` };
      return classifyWrite(
        rest('POST', '/rest/v1/user_achievements', {
          as: u.alice,
          body: { user_id: u.alice.id, achievement_id: 'level_50' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_achievements where user_id = '${u.alice.id}' and achievement_id = 'level_50')`,
      );
    },
  });

  await check({
    group: 'achievements',
    id: 'AC-2',
    role: 'service_role',
    op: '판정: 첫 완료(힌트 0) → 첫 코드·힌트 마스터·반짝 별 세 개(브론즈 10코인, sort 순) · 다시 판정 0개 · 동시 4번도 한 번 · 황금키 완료는 지표에 안 셈 · 진행도 · 판정 시간',
    ...OK,
    run: async () => {
      const x = await createUser('ac2', '업적판정');
      const first = await complete(x.id, Q1);
      const again = await evaluate(x.id);
      const many = await Promise.all(Array.from({ length: 4 }, () => evaluate(x.id)));
      // 황금키로 완료한 퀘스트는 퀘스트 수·힌트 없이에 안 셈 (Q25)
      const y = await createUser('ac2b', '업적황금키');
      await rpc('use_golden_key', { p_user_id: y.id, p_quest_id: Q1 });
      const golden = await complete(y.id, Q1);
      const prog = JSON.parse(
        one(`select json_object_agg(achievement_id, progress || '/' || goal) from public.achievement_progress('${x.id}')
               where achievement_id in ('first_code', 'quests_10', 'quests_all', 'stars_10', 'streak_3')`),
      );
      // 스테이지 1을 다 푼 사용자의 판정 시간 (퀘스트 완료 지연, postgres 직접)
      for (const q of stageQuests(STAGE1).slice(1)) await complete(x.id, q);
      const ms = Number(
        one(`do $$ declare t timestamptz := clock_timestamp();
             begin perform public.evaluate_achievements('${x.id}');
                   perform set_config('ac.ms', round(extract(epoch from clock_timestamp() - t) * 1000, 1)::text, false); end $$;
             select current_setting('ac.ms')`),
      );
      const total = stageQuests(STAGE1).length;
      return (
        compare(
          'AC-2',
          {
            first: 'first_code,hint_master,three_star_1',
            tiers: 'bronze:10,bronze:10,bronze:10',
            again: '',
            many: '',
            golden: '',
            goldenOwned: '',
            prog: { first_code: '1/1', quests_10: '1/10', quests_all: `1/${one("select count(*) from public.quests where quest_type <> 'quiz'")}`, stars_10: '3/10', streak_3: '1/3' },
            fast: true,
          },
          {
            first: ids(first),
            tiers: (first.json?.new_achievements ?? []).map((a) => `${a.tier}:${a.coins}`).join(','),
            again: (again.json ?? []).map((a) => a.id).join(','),
            many: many.flatMap((r) => r.json ?? []).map((a) => a.id).join(','),
            golden: ids(golden),
            goldenOwned: owned(y.id),
            prog,
            fast: ms < 50,
          },
        ) ?? { actual: 'ok', detail: `첫 완료 업적 3개, 반복·동시 0, 황금키 0, 스테이지 1(${total}개) 뒤 판정 ${ms}ms` }
      );
    },
  });

  await check({
    group: 'achievements',
    id: 'AC-3',
    role: 'service_role',
    op: '실패 칭찬: 에러 뒤 통과(had_error) → 첫 에러 친구 · 황금키 완료면 아님 · 퀴즈 틀린 뒤 맞힘 → 다시 일어서기(퀴즈 API 뒤 판정) · 힌트 보고 끝까지 → 힌트 친구',
    ...OK,
    run: async () => {
      const x = await createUser('ac3', '실패칭찬');
      const err = await complete(x.id, Q1, { had_error: true });
      const flag = one(`select overcame_error from public.user_progress where user_id = '${x.id}' and quest_id = '${Q1}'`);
      await rpc('record_hint', { p_user_id: x.id, p_quest_id: Q2, p_level: 1 });
      const hint = await complete(x.id, Q2);
      const wrong = await rpc('submit_quiz_answer', { p_user_id: x.id, p_quest_id: mc.id, p_answer: mc.wrong });
      const right = await rpc('submit_quiz_answer', { p_user_id: x.id, p_quest_id: mc.id, p_answer: mc.right });
      const quizWon = await evaluate(x.id);
      const y = await createUser('ac3b', '황금키에러');
      await rpc('use_golden_key', { p_user_id: y.id, p_quest_id: Q1 });
      await complete(y.id, Q1, { had_error: true });
      return (
        compare(
          'AC-3',
          {
            err: true,
            flag: 't',
            hint: true,
            quiz: '200:200:false:true',
            quizWon: 'comeback_1,quiz_1',
            goldenFlag: 'f',
          },
          {
            err: ids(err).split(',').includes('error_1'),
            flag,
            hint: ids(hint).split(',').includes('hint_finish_1'),
            quiz: `${wrong.status}:${right.status}:${wrong.json?.correct}:${right.json?.correct}`,
            quizWon: (quizWon.json ?? []).map((a) => a.id).sort().join(','),
            goldenFlag: one(`select overcame_error from public.user_progress where user_id = '${y.id}' and quest_id = '${Q1}'`),
          },
        ) ?? { actual: 'ok', detail: '에러 뒤 통과·힌트 끝까지·퀴즈 다시 맞힘 업적, 황금키 완료는 에러 칭찬 없음' }
      );
    },
  });

  await check({
    group: 'achievements',
    id: 'AC-4',
    role: 'service_role',
    op: '받기: 안 얻은 업적 409 · 브론즈 10코인(원장 achievement/<id>) · 동시 4번도 한 번 · 다시 0 · 진행 초기화 뒤에도 업적·받음 남음, 다시 판정해도 새 업적 아님 · 잔액 = 원장',
    ...OK,
    run: async () => {
      const x = await createUser('ac4', '업적받기');
      const no = await claim(x.id, 'quests_30');
      const unknown = await claim(x.id, 'no_such');
      await complete(x.id, Q1);
      const many = await Promise.all(Array.from({ length: 4 }, () => claim(x.id, 'first_code')));
      const fresh = many.filter((r) => r.status === 200 && r.json.already_claimed === false);
      const again = await claim(x.id, 'first_code');
      await rpc('reset_progress', { p_user_id: x.id, p_scope: 'all' });
      const afterReset = owned(x.id);
      const redo = await complete(x.id, Q1);
      return (
        compare(
          'AC-4',
          {
            no: '409:achievement_not_earned',
            unknown: 409,
            many: [200, 200, 200, 200],
            fresh: '1:10',
            again: 'true:0',
            ledger: 'first_code:10',
            afterReset: 'first_code:true,hint_master:false,three_star_1:false',
            redo: '',
            mismatches: '0',
          },
          {
            no: `${no.status}:${errMsg(no)}`,
            unknown: unknown.status,
            many: many.map((r) => r.status),
            fresh: `${fresh.length}:${fresh[0]?.json.coins_earned}`,
            again: `${again.json?.already_claimed}:${again.json?.coins_earned}`,
            ledger: one(`select string_agg(ref || ':' || delta, ',') from public.coin_ledger where user_id = '${x.id}' and source = 'achievement'`),
            afterReset,
            redo: ids(redo),
            mismatches: mismatches(x.id),
          },
        ) ?? { actual: 'ok', detail: '안 얻은 업적 거부, 한 번만 10코인, 리셋 뒤에도 남고 다시 축하하지 않음' }
      );
    },
  });

  await check({
    group: 'achievements',
    id: 'AC-5',
    role: 'service_role',
    op: '이관: 00036 을 다시 실행하면 user_badges 5종이 같은 id 업적으로(achieved_at = earned_at, 받기 가능), 이미 있으면 그대로 · 받기 10코인',
    ...OK,
    run: async () => {
      const x = await createUser('ac5', '뱃지이관');
      one(`insert into public.user_badges (user_id, badge_type, earned_at) values
             ('${x.id}', 'streak_3', '2026-10-01 10:00+09'), ('${x.id}', 'project_builder', '2026-10-02 10:00+09')`);
      const sql = readFileSync(join(HERE, '..', 'migrations', '00036_achievements.sql'), 'utf8');
      const m1 = psql(sql);
      const m2 = psql(sql);
      if (!m1.ok || !m2.ok) return { actual: 'error', detail: firstLine(m1.err || m2.err) };
      const rows = one(`select string_agg(achievement_id || ':' || to_char(achieved_at at time zone 'Asia/Seoul', 'MM-DD') || ':' || (claimed_at is null), ',' order by achievement_id)
                          from public.user_achievements where user_id = '${x.id}'`);
      const got = await claim(x.id, 'project_builder');
      return (
        compare(
          'AC-5',
          { rows: 'project_builder:10-02:true,streak_3:10-01:true', claim: '200:30' },
          { rows, claim: `${got.status}:${got.json?.coins_earned}` },
        ) ?? { actual: 'ok', detail: '뱃지 2개 → 업적 2개(얻은 날 그대로, 받기 가능), 두 번 실행해도 그대로, 실버 30코인' }
      );
    },
  });

  // ── 소급 보상 (P8-11, ① 00037) ──
  await check({
    group: 'achievements',
    id: 'RT-1',
    role: 'postgres',
    op: '00037 리허설: 옛 상태(힌트 0/1/2·황금키·퀴즈 별 일부 받음·뱃지 이관·레벨 보정) → 별·퀘스트·별·레벨 업 코인·조용한 업적, 두 번 실행 같음, 되돌리기',
    ...OK,
    run: async () => {
      const names = ['h0', 'h1', 'h2', 'gold', 'quiz', 'badge', 'lv'];
      const xs = [];
      for (const n of names) xs.push(await createUser(`rt1${n}`, '소급'));
      const id = Object.fromEntries(names.map((n, i) => [n, xs[i].id]));
      const qz = one(`select id from public.quests where stage_id = '${STAGE1}' and quest_type = 'quiz' order by "order" limit 1`);
      const file = readFileSync(join(HERE, '..', 'migrations', '00037_retro_rewards.sql'), 'utf8');
      const rollback = readFileSync(join(HERE, '..', 'rollback', '00037_retro_rewards.rollback.sql'), 'utf8');
      const done = `'2026-10-01 10:00+09'`;
      // P8-05 이전 완료 행: best_stars 0 · 판정일 없음. 퀴즈는 00026 이 별을 적었고 별 1 코인만 받은 상태(00031 이전 판정 + 일부)
      const code = (who, hints, golden = false) =>
        `insert into public.user_progress (user_id, quest_id, status, hints_used, used_golden_key, completed_at)
           values ('${id[who]}', '${Q1}', 'completed', ${hints}, ${golden}, ${done});`;
      const setup = `
        ${code('h0', 0)} ${code('h1', 1)} ${code('h2', 2)} ${code('gold', 0, true)} ${code('badge', 0)}
        insert into public.user_progress (user_id, quest_id, status, completed_at, stars, best_stars, stars_judged_on, attempts)
          values ('${id.quiz}', '${qz}', 'completed', '2026-10-05 10:00+09', 2, 2, '2026-10-05', 1);
        select public.coin_apply('${id.quiz}', 'star', '${qz}:1', 5);
        insert into public.user_badges (user_id, badge_type, earned_at) values ('${id.badge}', 'first_code', ${done});
        insert into public.user_achievements (user_id, achievement_id, achieved_at) values ('${id.badge}', 'first_code', ${done});
        update public.users set total_xp = 1210 where id = '${id.lv}';
        insert into public.level_curve_adjustments (user_id, level_before, xp_before, xp_after) values ('${id.lv}', 5, 1000, 1210);
        select public.coin_apply('${id.lv}', 'level_up', '2', 20);
        -- 같은 트랜잭션이라 created_at 이 소급과 같아지지 않게 (운영에서는 다른 트랜잭션)
        update public.coin_ledger set created_at = created_at - interval '1 day' where user_id in (${xs.map((x) => `'${x.id}'`).join(',')});`;
      const list = names.map((n, i) => `('${id[n]}'::uuid, '${n}', ${i})`).join(',');
      const progress = (alias) =>
        `coalesce((select p.best_stars || '/' || coalesce(to_char(p.stars_judged_on, 'MM-DD'), '-') || '/' || p.attempts
                     from public.user_progress p where p.user_id = ${alias}.id limit 1), '-')`;
      const state = `select string_agg(n.name || ':' || u.coins || ':' || ${progress('u')} || ':' ||
            coalesce((select string_agg(r.stars || '/' || r.coins, ';') from public.retro_rewards r where r.user_id = u.id), '-'), ',' order by n.ord)
          || '|' || (select count(*) from public.coin_balance_mismatches())
          || '|' || (select string_agg(to_char(achieved_at at time zone 'Asia/Seoul', 'MM-DD') || ':' || (claimed_at is null), ',')
                       from public.user_achievements where user_id = '${id.badge}' and achievement_id = 'first_code')
          || '|' || (select count(*) > 0 from public.user_achievements where user_id = '${id.h0}' and claimed_at is null)
          || '|' || (select count(*) from public.coin_ledger where source = 'achievement' and user_id in (select id from (values ${list}) v(id, name, ord)))
          from (values ${list}) n(id, name, ord) join public.users u on u.id = n.id;`;
      const after = `select string_agg(n.name || ':' || u.coins, ',' order by n.ord) || '|' || (select count(*) from public.coin_balance_mismatches())
            || '|' || (to_regclass('public.retro_rewards') is null)
          from (values ${list}) n(id, name, ord) join public.users u on u.id = n.id;`;
      const r = psql(`BEGIN;\n${setup}\n${file}\n${state}\n${file}\n${state}\n${rollback}\n${after}\nROLLBACK;`);
      if (!r.ok) return { actual: 'error', detail: firstLine(r.err) };
      const [first, second, back] = r.out.split('\n').filter(Boolean).slice(-3);
      // 코인: 퀘스트 10 + 별 번호마다 5 (황금키 0) · 퀴즈는 별 2만(별 1은 받음) · Lv 5 = 레벨 3·4(20)·5(100), 레벨 2는 받음
      const want =
        'h0:25:3/10-01/1:3/25,h1:20:2/10-01/1:2/20,h2:15:1/10-01/1:1/15,gold:0:1/10-01/1:-,' +
        'quiz:10:2/10-05/1:1/5,badge:25:3/10-01/1:3/25,lv:160:-:0/140|0|10-01:true|true|0';
      return (
        compare(
          'RT-1 (이름:잔액:별/판정일/시도:소급 별/코인 | 어긋남 | 이관 업적 | 조용한 업적 | 업적 코인)',
          { first: want, second: want, back: 'h0:0,h1:0,h2:0,gold:0,quiz:5,badge:0,lv:20|0|true' },
          { first, second, back },
        ) ?? { actual: 'ok', detail: '힌트 0/1/2 → ⭐3/2/1 + 25/20/15코인, 황금키 ⭐1·0코인, 퀴즈 새 별만, 레벨 업 140, 두 번째 실행 같음, 되돌리면 소급분만 빠짐' }
      );
    },
  });
  await check({
    group: 'achievements',
    id: 'RT-2',
    role: 'authenticated',
    op: 'retro_rewards: 본인 행 읽기만 · 남의 행·비로그인 읽기 · 본인 seen_at·coins UPDATE · INSERT (닫기는 /api/retro/seen service_role)',
    ...WRITE,
    run: async () => {
      one(`insert into public.retro_rewards (user_id, granted_at, stars, coins) values
             ('${u.alice.id}', '2026-11-01', 3, 25), ('${u.bob.id}', '2026-11-01', 1, 15) on conflict do nothing`);
      try {
        return await rt2();
      } finally {
        one(`delete from public.retro_rewards where user_id in ('${u.alice.id}', '${u.bob.id}')`);
      }
    },
  });
  async function rt2() {
    const own = await rest('GET', '/rest/v1/retro_rewards?select=user_id,stars,coins', { as: u.alice });
    if (own.status !== 200 || own.json.length !== 1 || own.json[0].user_id !== u.alice.id)
      return { actual: 'written', detail: `본인·남의 행 ${own.status} ${JSON.stringify(own.json)}` };
    const anon = classifyRead(await rest('GET', '/rest/v1/retro_rewards?select=*'));
    if (anon.actual === 'allowed') return { actual: 'written', detail: `anon ${anon.detail}` };
    const upd = await classifyWrite(
      rest('PATCH', `/rest/v1/retro_rewards?user_id=eq.${u.alice.id}`, {
        as: u.alice,
        body: { seen_at: new Date().toISOString(), coins: 9999 },
        prefer: 'return=minimal',
      }),
      `select seen_at is not null or coins = 9999 from public.retro_rewards where user_id = '${u.alice.id}'`,
    );
    if (upd.actual === 'written') return upd;
    return classifyWrite(
      rest('POST', '/rest/v1/retro_rewards', {
        as: u.alice,
        body: { user_id: u.alice.id, granted_at: '2026-11-02', stars: 1, coins: 5 },
        prefer: 'return=minimal',
      }),
      `select exists (select 1 from public.retro_rewards where user_id = '${u.alice.id}' and granted_at = '2026-11-02')`,
    );
  }
}

// psql 트랜잭션 안에서 검사하고 되돌림. DO 블록이 기대와 다르면 예외 → 'mismatch'
function sqlCheck(sql) {
  const r = psql(`BEGIN;\n${sql}\nSELECT 'ok';\nROLLBACK;\n`);
  if (r.ok) return { actual: 'ok', detail: r.out.split('\n').slice(-1)[0] };
  return { actual: 'mismatch', detail: firstLine(r.err) };
}
const PYTHON_ISLAND = 'c1000000-0000-0000-0000-000000000001';
const STAGE7 = 'a1000000-0000-0000-0000-000000000007';

async function groupSchema(u) {
  // 월드: 로그인 사용자만 조회 (stages·quests 와 같은 원칙), 쓰기는 service_role
  await check({
    group: 'schema',
    id: 'WD-1',
    role: 'anon',
    op: 'GET /worlds',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', '/rest/v1/worlds?select=*')),
  });
  await check({
    group: 'schema',
    id: 'WD-2',
    role: 'authenticated',
    op: 'GET /worlds (1월드 python-island)',
    ...READ,
    run: async () => {
      const r = await rest('GET', '/rest/v1/worlds?select=id,slug,order,unlock_rule', {
        as: u.alice,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const w = r.json.find((x) => x.slug === 'python-island');
      return w?.id === PYTHON_ISLAND && w.order === 1 && w.unlock_rule?.type === 'open'
        ? c
        : { actual: 'mismatch', detail: JSON.stringify(r.json) };
    },
  });
  await check({
    group: 'schema',
    id: 'WD-3',
    role: 'authenticated',
    op: 'POST /worlds · PATCH /worlds {title}',
    ...WRITE,
    run: async () => {
      const ins = await classifyWrite(
        rest('POST', '/rest/v1/worlds', {
          as: u.alice,
          body: { slug: 'hack-world', order: 99, title: 'x', theme: 'x' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.worlds where slug = 'hack-world')`,
      );
      if (ins.actual === 'written') return ins;
      const upd = await classifyWrite(
        rest('PATCH', `/rest/v1/worlds?id=eq.${PYTHON_ISLAND}`, {
          as: u.alice,
          body: { title: 'hacked' },
          prefer: 'return=minimal',
        }),
        `select title = 'hacked' from public.worlds where id = '${PYTHON_ISLAND}'`,
      );
      return upd.actual === 'written'
        ? upd
        : { actual: ins.actual, detail: `POST ${ins.detail} · PATCH ${upd.detail}` };
    },
  });
  await check({
    group: 'schema',
    id: 'WD-4',
    role: 'postgres',
    op: '스테이지 world_id·quest_type 백필 (7개 → 1월드, 7-1 project · code·quiz 는 seed 와 같은 수, quiz_kind·모바일은 퀴즈만)',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$ BEGIN
        IF (SELECT count(*) FROM public.stages WHERE world_id <> '${PYTHON_ISLAND}') > 0
           OR (SELECT count(*) FROM public.stages) <> 7 THEN
          RAISE EXCEPTION 'stages: 1월드가 아닌 스테이지 또는 7개가 아님';
        END IF;
        IF (SELECT string_agg(id::text, ',') FROM public.quests WHERE quest_type = 'project') <> '${Q_PROJECT}'
           OR (SELECT count(*) FROM public.quests WHERE quest_type = 'code') <> ${seedQuestCount('code')}
           OR (SELECT count(*) FROM public.quests WHERE quest_type = 'quiz') <> ${seedQuestCount('quiz')}
           OR EXISTS (SELECT 1 FROM public.quests
                       WHERE (quiz_kind IS NOT NULL) <> (quest_type = 'quiz') OR is_mobile_friendly <> (quest_type = 'quiz')) THEN
          RAISE EXCEPTION 'quests: quest_type·quiz_kind·is_mobile_friendly 가 기대와 다름';
        END IF;
      END $$;`),
  });
  await check({
    group: 'schema',
    id: 'WD-5',
    role: 'postgres',
    op: '2월드 스테이지(order 1) 추가 → UNIQUE(world_id, order) 허용, 1월드 마지막 스테이지를 깨야 열림, 리셋은 (월드, 스테이지) 순서',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`
        INSERT INTO public.worlds (id, "order", slug, title, theme)
        VALUES ('c1000000-0000-0000-0000-0000000000ff', 99, 'rls-world-2', '시험 월드', 'test');
        INSERT INTO public.stages (id, world_id, "order", title, theme_name)
        VALUES ('a1000000-0000-0000-0000-0000000000ff', 'c1000000-0000-0000-0000-0000000000ff', 1, '시험 스테이지', 'test');
        INSERT INTO public.quests (id, stage_id, "order", title, concept, validation_type, quest_type)
        VALUES ('b1000000-0000-0000-0000-0000000000ff', 'a1000000-0000-0000-0000-0000000000ff', 1, '시험', 'x', 'contains', 'code');
        DO $$
        DECLARE
          v_uid UUID := '${u.dan.id}';
          v_r   JSONB;
        BEGIN
          IF public.is_stage_unlocked(v_uid, 'a1000000-0000-0000-0000-0000000000ff') THEN
            RAISE EXCEPTION '2월드 첫 스테이지가 처음부터 열림';
          END IF;
          INSERT INTO public.user_progress (user_id, quest_id, status, completed_at)
          SELECT v_uid, q.id, 'completed', now() FROM public.quests q WHERE q.stage_id = '${STAGE7}'
          ON CONFLICT (user_id, quest_id) DO UPDATE SET status = 'completed';
          IF NOT public.is_stage_unlocked(v_uid, 'a1000000-0000-0000-0000-0000000000ff') THEN
            RAISE EXCEPTION '1월드 마지막 스테이지를 깼는데 2월드 첫 스테이지가 잠김';
          END IF;
          IF NOT public.is_stage_unlocked(v_uid, '${STAGE1}') THEN
            RAISE EXCEPTION '1월드 첫 스테이지가 잠김';
          END IF;
          INSERT INTO public.user_progress (user_id, quest_id, status, completed_at)
          VALUES (v_uid, 'b1000000-0000-0000-0000-0000000000ff', 'completed', now());
          -- 2월드 스테이지 리셋: 1월드 진행은 그대로
          v_r := public.reset_progress(v_uid, 'stage', 'a1000000-0000-0000-0000-0000000000ff');
          IF (v_r->>'removed_quests')::int <> 1
             OR NOT EXISTS (SELECT 1 FROM public.user_progress WHERE user_id = v_uid AND quest_id = '${Q_PROJECT}') THEN
            RAISE EXCEPTION '2월드 리셋이 1월드 진행을 지움: %', v_r;
          END IF;
          -- 1월드 7스테이지 리셋: 뒤의 2월드 스테이지도 함께
          INSERT INTO public.user_progress (user_id, quest_id, status, completed_at)
          VALUES (v_uid, 'b1000000-0000-0000-0000-0000000000ff', 'completed', now());
          v_r := public.reset_progress(v_uid, 'stage', '${STAGE7}');
          IF jsonb_array_length(v_r->'reset_stages') <> 2
             OR EXISTS (SELECT 1 FROM public.user_progress WHERE user_id = v_uid AND quest_id = 'b1000000-0000-0000-0000-0000000000ff') THEN
            RAISE EXCEPTION '1월드 리셋이 뒤 월드 스테이지를 함께 리셋하지 않음: %', v_r;
          END IF;
        END $$;`),
  });
  await check({
    group: 'schema',
    id: 'WD-6',
    role: 'postgres',
    op: 'stages UNIQUE: 같은 월드 안 order 중복은 거부',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$ BEGIN
        BEGIN
          INSERT INTO public.stages (world_id, "order", title, theme_name) VALUES ('${PYTHON_ISLAND}', 1, '중복', 'x');
          RAISE EXCEPTION '같은 월드에 order 1 스테이지가 두 개 들어감';
        EXCEPTION WHEN unique_violation THEN NULL;
        END;
      END $$;`),
  });

  // 퀴즈 시도: 클라이언트는 쓸 수 없고 본인 것만 읽음
  one(`insert into public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct) values
        ('${u.alice.id}', '${Q1}', 'first', 1, '"opt_a"', false),
        ('${u.bob.id}', '${Q1}', 'first', 1, '"opt_b"', true)`);
  await check({
    group: 'schema',
    id: 'QA-1',
    role: 'authenticated',
    op: 'POST /quiz_attempts {is_correct: true} (시도 위조)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/quiz_attempts', {
          as: u.alice,
          body: { user_id: u.alice.id, quest_id: Q2, mode: 'first', attempt_no: 1, answer: 'x', is_correct: true },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.quiz_attempts where user_id = '${u.alice.id}' and quest_id = '${Q2}')`,
      ),
  });
  await check({
    group: 'schema',
    id: 'QA-2',
    role: 'authenticated',
    op: 'PATCH /quiz_attempts {is_correct: true} · DELETE /quiz_attempts (본인 행)',
    ...WRITE,
    run: async () => {
      const upd = await classifyWrite(
        rest('PATCH', `/rest/v1/quiz_attempts?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { is_correct: true },
          prefer: 'return=minimal',
        }),
        `select coalesce(bool_or(is_correct), false) from public.quiz_attempts where user_id = '${u.alice.id}'`,
      );
      if (upd.actual === 'written') return upd;
      const del = await classifyWrite(
        rest('DELETE', `/rest/v1/quiz_attempts?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.quiz_attempts where user_id = '${u.alice.id}')`,
      );
      return del.actual === 'written'
        ? del
        : { actual: upd.actual, detail: `PATCH ${upd.detail} · DELETE ${del.detail}` };
    },
  });
  await check({
    group: 'schema',
    id: 'QA-3',
    role: 'authenticated(psql)',
    op: 'SET ROLE authenticated; INSERT INTO quiz_attempts',
    ...SQLW,
    run: async () =>
      classifySqlWrite(
        psqlAs(
          'authenticated',
          u.alice.id,
          `INSERT INTO public.quiz_attempts (user_id, quest_id, mode, attempt_no, answer, is_correct)
           VALUES (auth.uid(), '${Q2}', 'first', 1, '"x"', true) RETURNING id;`,
        ),
      ),
  });
  await check({
    group: 'schema',
    id: 'QA-4',
    role: 'anon',
    op: 'GET /quiz_attempts',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', '/rest/v1/quiz_attempts?select=*')),
  });
  await check({
    group: 'schema',
    id: 'QA-5',
    role: 'authenticated',
    op: 'GET /quiz_attempts → 본인 행만 (다른 사용자 시도는 안 보임)',
    deny: ['others-visible'],
    allow: ['own-only'],
    run: async () => {
      const r = await rest('GET', '/rest/v1/quiz_attempts?select=user_id,mode,attempt_no,is_correct', {
        as: u.alice,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      return r.json.every((x) => x.user_id === u.alice.id)
        ? { actual: 'own-only', detail: `rows=${r.json.length}` }
        : { actual: 'others-visible', detail: `rows=${r.json.length}` };
    },
  });

  // 프로필 컬럼: 클라이언트 UPDATE 권한 없음 (UI 를 만드는 P3-11·P2-15 에서 GRANT)
  const userPatch = (id, op, body, verify) =>
    check({
      group: 'schema',
      id,
      role: 'authenticated',
      op,
      ...WRITE,
      run: () =>
        classifyWrite(
          rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
            as: u.alice,
            body,
            prefer: 'return=minimal',
          }),
          `select ${verify} from public.users where id = '${u.alice.id}'`,
        ),
    });
  await userPatch('PF-1', 'PATCH /users?id=eq.<본인> {nickname}', { nickname: '파이썬왕' }, `nickname is not distinct from '파이썬왕'`);
  await userPatch(
    'PF-2',
    'PATCH /users?id=eq.<본인> {settings}',
    { settings: { sound: { muted: true } } },
    `settings = '{"sound": {"muted": true}}'::jsonb`,
  );
  await userPatch(
    'PF-3',
    'PATCH /users?id=eq.<본인> {avatar_config, grade}',
    { avatar_config: { hat: 'crown' }, grade: 3 },
    `grade is not distinct from 3`,
  );
  await userPatch(
    'PF-4',
    'PATCH /users?id=eq.<본인> {last_login_provider, last_login_at} (서버 값)',
    { last_login_provider: 'naver', last_login_at: '2000-01-01T00:00:00Z' },
    `last_login_provider is not distinct from 'naver'`,
  );
  await check({
    group: 'schema',
    id: 'PF-5',
    role: 'postgres',
    op: '새 사용자 users.settings 기본값 = §2.2 형태 (sound P0-15 · motion auto/system), avatar_config {}',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$
      DECLARE v RECORD;
      BEGIN
        SELECT settings, avatar_config, nickname, grade INTO v FROM public.users WHERE id = '${u.carol.id}';
        IF v.settings->'sound'->>'version' <> '1' OR v.settings->'sound'->'sfx'->>'enabled' <> 'true'
           OR v.settings->'sound'->'bgm'->>'enabled' <> 'false'
           OR v.settings->'motion' <> '{"tier": "auto", "reduced": "system"}'::jsonb
           OR v.avatar_config <> '{}'::jsonb OR v.nickname IS NOT NULL OR v.grade IS NOT NULL THEN
          RAISE EXCEPTION '기본값이 다름: settings=% avatar=% nickname=% grade=%', v.settings, v.avatar_config, v.nickname, v.grade;
        END IF;
      END $$;`),
  });

  // 닉네임 글자 규칙 (§12-Q14): KS X 1001 완성형 2,350자 + 영문·숫자, 2~10자, 대소문자 무시 유일
  await check({
    group: 'schema',
    id: 'NK-1',
    role: 'postgres',
    op: "users_nickname_chars 의 한글 = convert_to(…, 'EUC_KR') 가 되는 완성형 (가~힣 11,172자 전수 비교 → 2,350자)",
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`
        CREATE FUNCTION pg_temp.euckr(t TEXT) RETURNS BOOLEAN LANGUAGE plpgsql AS $f$
        BEGIN PERFORM convert_to(t, 'EUC_KR'); RETURN true; EXCEPTION WHEN OTHERS THEN RETURN false; END $f$;
        DO $$
        DECLARE v_re TEXT; v_ok INT; v_ksx INT; v_diff INT;
        BEGIN
          SELECT substring(pg_get_constraintdef(oid) FROM $r$~ '(.*)'::text$r$) INTO v_re
            FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_nickname_chars';
          SELECT count(*) FILTER (WHERE ch ~ v_re), count(*) FILTER (WHERE pg_temp.euckr(ch)),
                 count(*) FILTER (WHERE (ch ~ v_re) <> pg_temp.euckr(ch))
            INTO v_ok, v_ksx, v_diff
            FROM (SELECT chr(cp) AS ch FROM generate_series(44032, 55203) cp) h;
          IF v_ok <> 2350 OR v_ksx <> 2350 OR v_diff <> 0 THEN
            RAISE EXCEPTION 'CHECK 허용 %자, EUC-KR %자, 다른 글자 %', v_ok, v_ksx, v_diff;
          END IF;
        END $$;`),
  });
  await check({
    group: 'schema',
    id: 'NK-2',
    role: 'postgres',
    op: '닉네임 CHECK: 파이썬꿈나무·Py123·가나 허용 / 똠방·햏·가·😀가·가 나·11자·제로폭 문자 거부',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$
      DECLARE v TEXT;
      BEGIN
        FOREACH v IN ARRAY ARRAY['파이썬꿈나무', 'Py123', '가나', '모험가1234'] LOOP
          UPDATE public.users SET nickname = v WHERE id = '${u.carol.id}';
        END LOOP;
        FOREACH v IN ARRAY ARRAY['똠방', '햏자', '가', '😀가', '가 나', '가나다라마바사아자차카', E'가\\u200B나', 'ㄱㄴ', '가-나'] LOOP
          BEGIN
            UPDATE public.users SET nickname = v WHERE id = '${u.carol.id}';
            RAISE EXCEPTION '거부해야 할 닉네임이 저장됨: %', v;
          EXCEPTION WHEN check_violation THEN NULL;
          END;
        END LOOP;
      END $$;`),
  });
  await check({
    group: 'schema',
    id: 'NK-3',
    role: 'postgres',
    op: '닉네임 유일 (대소문자 무시): PyRoad 가 있으면 pyroad 거부',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$ BEGIN
        UPDATE public.users SET nickname = 'PyRoad' WHERE id = '${u.carol.id}';
        BEGIN
          UPDATE public.users SET nickname = 'pyroad' WHERE id = '${u.dan.id}';
          RAISE EXCEPTION '대소문자만 다른 닉네임이 저장됨';
        EXCEPTION WHEN unique_violation THEN NULL;
        END;
      END $$;`),
  });

  // KST 함수: 경계값 + 인라인 (SET search_path 가 없어 식으로 펼쳐짐)
  await check({
    group: 'schema',
    id: 'KST-1',
    role: 'postgres',
    op: 'kst_date 경계값(UTC 15:00 = KST 다음 날)·kst_today = kst_date(now())·인라인(EXPLAIN 에 kst_date 없음)',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () => {
      const r = sqlCheck(`DO $$ BEGIN
        IF public.kst_date('2026-11-03 14:59:59.999+00') <> DATE '2026-11-03'
           OR public.kst_date('2026-11-03 15:00:00+00') <> DATE '2026-11-04'
           OR public.kst_date('2026-12-31 15:00:00+00') <> DATE '2027-01-01'
           OR public.kst_today() <> (now() AT TIME ZONE 'Asia/Seoul')::date THEN
          RAISE EXCEPTION 'KST 날짜가 다름';
        END IF;
      END $$;`);
      if (r.actual !== 'ok') return r;
      const plan = one(
        `explain (verbose, costs off) select public.kst_date(created_at) from public.stages`,
      );
      return /timezone\('Asia\/Seoul'/.test(plan) && !/kst_date/.test(plan)
        ? { actual: 'ok', detail: '인라인됨' }
        : { actual: 'mismatch', detail: plan.split('\n').join(' | ') };
    },
  });
  await check({
    group: 'schema',
    id: 'RPC-8',
    role: 'postgres',
    op: '00012 함수(KST·스테이지 잠금·리셋·진행 보호 트리거) 중 anon/authenticated 가 EXECUTE 할 수 있는 것',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('kst_date', 'kst_today', 'has_three_day_streak', 'is_stage_unlocked', 'reset_progress',
                           'user_progress_protect_earned_xp')
         and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
}

// ── auth: 가입·로그인 트리거 (B24, B16, 00013) ──────────────────
async function groupAuthTriggers(u) {
  await check({
    group: 'auth',
    id: 'B16-1',
    role: 'postgres',
    op: '가입 트리거가 provider 이름(full_name)·사진을 공개 display_name·avatar_url 에 복사하는가 (alice: full_name 김앨리스)',
    deny: ['not-copied'],
    allow: ['copied'],
    run: () => {
      const v = one(
        `select display_name || '|' || coalesce(avatar_url, '') from public.users where id = '${u.alice.id}'`,
      );
      const [name, avatar] = v.split('|');
      if (name === '김앨리스') return { actual: 'copied', detail: name };
      return /^모험가\d{4}$/.test(name) && avatar === ''
        ? { actual: 'not-copied', detail: `display_name=${name}` }
        : { actual: 'mismatch', detail: v };
    },
  });
  await check({
    group: 'auth',
    id: 'B16-2',
    role: 'postgres',
    op: 'Kakao·Naver 가입(auth.users INSERT): 실명·닉네임·사진 미복사, nickname NULL, last_login_provider 정규화, 이메일 없어도 가입',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`
        INSERT INTO auth.users (id, raw_app_meta_data, raw_user_meta_data, last_sign_in_at) VALUES
          ('d1000000-0000-0000-0000-0000000000a1', '{"provider": "kakao", "providers": ["kakao"]}',
           '{"iss": "https://kapi.kakao.com", "name": "홍길동", "full_name": "홍길동", "avatar_url": "https://k.kakaocdn.net/a.jpg"}', now()),
          ('d1000000-0000-0000-0000-0000000000a2', '{"provider": "custom:naver"}', '{"iss": "https://nid.naver.com"}', NULL),
          ('d1000000-0000-0000-0000-0000000000a3', '{"provider": "google"}',
           '{"iss": "https://accounts.google.com", "full_name": "Kim Real", "picture": "https://lh3.googleusercontent.com/x"}', now());
        DO $$
        DECLARE v RECORD;
        BEGIN
          FOR v IN SELECT u.*, a.raw_app_meta_data->>'provider' AS p
                     FROM public.users u JOIN auth.users a ON a.id = u.id
                    WHERE u.id::text LIKE 'd1000000-%' LOOP
            IF v.display_name !~ '^모험가[0-9]{4}$' OR v.avatar_url <> '' OR v.nickname IS NOT NULL
               OR v.last_login_provider IS DISTINCT FROM (CASE v.p WHEN 'custom:naver' THEN 'naver' ELSE v.p END)
               OR v.display_name <> public.placeholder_display_name(v.id) THEN
              RAISE EXCEPTION '가입 행이 다름: % % % %', v.display_name, v.avatar_url, v.nickname, v.last_login_provider;
            END IF;
          END LOOP;
          IF (SELECT count(*) FROM public.users WHERE id::text LIKE 'd1000000-%') <> 3 THEN
            RAISE EXCEPTION '가입 행 수가 3이 아님';
          END IF;
        END $$;`),
  });
  await check({
    group: 'auth',
    id: 'B24-1',
    role: 'postgres',
    op: '로그인(alice, GoTrue 비밀번호 로그인) 뒤 users.last_login_at = auth.users.last_sign_in_at',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () => {
      const v = one(
        `select (u.last_login_at = a.last_sign_in_at)::text || ' ' || coalesce(a.last_sign_in_at::text, 'null')
           from public.users u join auth.users a on a.id = u.id where u.id = '${u.alice.id}'`,
      );
      return v.startsWith('true ')
        ? { actual: 'ok', detail: v.slice(5) }
        : { actual: 'mismatch', detail: v };
    },
  });
  await check({
    group: 'auth',
    id: 'B24-2',
    role: 'postgres',
    op: '로그인 트리거: 이번 로그인 identity 의 iss 로 last_login_provider (연결 계정 Kakao 로그인 → kakao, 모르는 iss → 유지, 메타데이터만 바뀌면 무시)',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$
      DECLARE
        v_uid UUID := '${u.dan.id}';
        v_at  TIMESTAMPTZ := now() + interval '1 minute';
        v RECORD;
      BEGIN
        UPDATE auth.users
           SET raw_user_meta_data = raw_user_meta_data || '{"iss": "https://kapi.kakao.com"}', last_sign_in_at = v_at
         WHERE id = v_uid;
        SELECT last_login_at, last_login_provider INTO v FROM public.users WHERE id = v_uid;
        IF v.last_login_at <> v_at OR v.last_login_provider IS DISTINCT FROM 'kakao' THEN
          RAISE EXCEPTION 'Kakao 로그인 뒤: % %', v.last_login_at, v.last_login_provider;
        END IF;
        UPDATE auth.users
           SET raw_user_meta_data = raw_user_meta_data || '{"iss": "https://unknown.example"}', last_sign_in_at = v_at + interval '1 minute'
         WHERE id = v_uid;
        SELECT last_login_at, last_login_provider INTO v FROM public.users WHERE id = v_uid;
        IF v.last_login_provider IS DISTINCT FROM 'kakao' OR v.last_login_at <> v_at + interval '1 minute' THEN
          RAISE EXCEPTION '모르는 iss 로그인 뒤: % %', v.last_login_at, v.last_login_provider;
        END IF;
        UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"iss": "https://accounts.google.com"}' WHERE id = v_uid;
        IF (SELECT last_login_provider FROM public.users WHERE id = v_uid) IS DISTINCT FROM 'kakao' THEN
          RAISE EXCEPTION '로그인 없이 메타데이터만 바뀌었는데 provider 가 바뀜';
        END IF;
      END $$;`),
  });

  // P3-06: GoTrue 가 실제로 만드는 모양(spikes/p0-04-kakao/e2e/observed S3·S6·S14, docs/spikes/P0-03 §4)으로 가입·로그인
  await check({
    group: 'auth',
    id: 'SU-1',
    role: 'postgres',
    op: '가입(실측 메타데이터 7종: Google·Kakao 동의/미동의·custom:kakao·custom:naver id_token 클레임만·이름 모르는 OIDC·email) → 모험가NNNN, 사진 빈 값, nickname NULL, provider 정규화(모르면 NULL), 메타데이터 값이 공개 필드·공개 프로필·뷰에 없음',
    ...OK,
    run: () =>
      sqlCheck(`
        CREATE TEMP TABLE su1 (id UUID, email TEXT, app JSONB, meta JSONB, signed TIMESTAMPTZ, want TEXT) ON COMMIT DROP;
        INSERT INTO su1 VALUES
          ('d2000000-0000-0000-0000-000000000001', 'su1-kid@gmail.example',
           '{"provider": "google", "providers": ["google"]}',
           '{"iss": "https://accounts.google.com", "sub": "1098765", "provider_id": "1098765", "name": "김실명", "full_name": "김실명",
             "picture": "https://lh3.googleusercontent.com/a/su1", "avatar_url": "https://lh3.googleusercontent.com/a/su1",
             "email": "su1-kid@gmail.example", "email_verified": true, "phone_verified": false}', now(), 'google'),
          ('d2000000-0000-0000-0000-000000000002', NULL,
           '{"provider": "kakao", "providers": ["kakao"]}',
           '{"iss": "https://kapi.kakao.com", "sub": "4012345678", "provider_id": "4012345678", "name": "파이썬꿈나무",
             "full_name": "파이썬꿈나무", "user_name": "파이썬꿈나무", "preferred_username": "파이썬꿈나무",
             "avatar_url": "http://k.kakaocdn.net/dn/su1/img_640x640.jpg", "email_verified": false, "phone_verified": false}', now(), 'kakao'),
          ('d2000000-0000-0000-0000-000000000003', NULL,
           '{"provider": "kakao", "providers": ["kakao"]}',
           '{"iss": "https://kapi.kakao.com", "sub": "4012345680", "provider_id": "4012345680", "email_verified": false, "phone_verified": false}',
           NULL, 'kakao'),
          ('d2000000-0000-0000-0000-000000000004', NULL,
           '{"provider": "custom:kakao", "providers": ["custom:kakao"]}',
           '{"iss": "https://kauth.kakao.com", "sub": "4012345681", "provider_id": "4012345681", "name": "카카오별명",
             "preferred_username": "카카오별명", "email_verified": false, "phone_verified": false}', now(), 'kakao'),
          ('d2000000-0000-0000-0000-000000000005', NULL,
           '{"provider": "custom:naver", "providers": ["custom:naver"]}',
           '{"iss": "https://nid.naver.com", "sub": "naver-pairwise-su1", "provider_id": "naver-pairwise-su1", "aud": ["naver-client"],
             "exp": 1893456000, "iat": 1893452400, "email_verified": false, "phone_verified": false}', now(), 'naver'),
          ('d2000000-0000-0000-0000-000000000006', NULL,
           '{"provider": "custom:kakao-mock", "providers": ["custom:kakao-mock"]}',
           '{"iss": "https://kauth.kakao.com", "sub": "4012345682", "name": "모의카카오"}', now(), 'kakao'),
          ('d2000000-0000-0000-0000-000000000007', NULL,
           '{"provider": "custom:other", "providers": ["custom:other"]}',
           '{"iss": "https://idp.example", "sub": "x1", "name": "다른곳실명", "picture": "https://idp.example/p.png"}', now(), NULL),
          ('d2000000-0000-0000-0000-000000000008', 'su1-email@example.com',
           '{"provider": "email", "providers": ["email"]}', '{"full_name": "이메일실명"}', NULL, NULL);
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, last_sign_in_at)
          SELECT id, email, app, meta, signed FROM su1;
        DO $$
        DECLARE v RECORD;
        BEGIN
          FOR v IN SELECT s.*, u.display_name, u.avatar_url, u.nickname, u.last_login_provider, u.last_login_at,
                          p.public_name, pv.display_name AS view_name, pv.avatar_url AS view_avatar
                     FROM su1 s
                     LEFT JOIN public.users u ON u.id = s.id
                     LEFT JOIN public.user_public_profiles p ON p.user_id = s.id
                     LEFT JOIN public.user_profiles_public pv ON pv.id = s.id LOOP
            IF v.display_name IS NULL OR v.public_name IS NULL THEN
              RAISE EXCEPTION '% (%): users·공개 프로필 행이 없음', v.id, v.app ->> 'provider';
            END IF;
            IF v.display_name !~ '^모험가[0-9]{4}$' OR v.display_name <> public.placeholder_display_name(v.id)
               OR v.public_name <> v.display_name OR v.view_name IS DISTINCT FROM v.display_name THEN
              RAISE EXCEPTION '% (%): 이름이 자리표시자가 아님 % / % / %', v.id, v.app ->> 'provider',
                v.display_name, v.public_name, v.view_name;
            END IF;
            IF coalesce(v.avatar_url, '') <> '' OR v.view_avatar IS NOT NULL OR v.nickname IS NOT NULL THEN
              RAISE EXCEPTION '% (%): 사진·닉네임이 채워짐 % % %', v.id, v.app ->> 'provider', v.avatar_url, v.view_avatar, v.nickname;
            END IF;
            IF v.last_login_provider IS DISTINCT FROM v.want THEN
              RAISE EXCEPTION '% (%): last_login_provider % (기대 %)', v.id, v.app ->> 'provider', v.last_login_provider, v.want;
            END IF;
            IF v.last_login_at IS NULL OR (v.signed IS NOT NULL AND v.last_login_at <> v.signed) THEN
              RAISE EXCEPTION '% (%): last_login_at % (last_sign_in_at %)', v.id, v.app ->> 'provider', v.last_login_at, v.signed;
            END IF;
            IF EXISTS (SELECT 1 FROM jsonb_each_text(v.meta) e
                        WHERE e.value <> '' AND e.value IN (v.display_name, v.public_name, coalesce(v.avatar_url, ''))) THEN
              RAISE EXCEPTION '% (%): provider 메타데이터 값이 공개 필드에 들어감', v.id, v.app ->> 'provider';
            END IF;
          END LOOP;
        END $$;`),
  });
  await check({
    group: 'auth',
    id: 'SU-2',
    role: 'postgres',
    op: 'social_login_provider(provider, iss) 표: google·kakao·custom:kakao·custom:naver(대소문자·공백 무시), provider 를 모르면 iss, 둘 다 모르면 NULL. 결과는 모두 users_last_login_provider_check 통과',
    ...OK,
    run: () =>
      sqlCheck(`DO $$
      DECLARE v RECORD;
      BEGIN
        FOR v IN SELECT * FROM (VALUES
            ('google', NULL, 'google'), (' Google ', NULL, 'google'),
            ('kakao', NULL, 'kakao'), ('custom:kakao', NULL, 'kakao'),
            ('naver', NULL, 'naver'), ('custom:naver', NULL, 'naver'), ('CUSTOM:NAVER', NULL, 'naver'),
            (NULL, 'https://accounts.google.com', 'google'),
            (NULL, 'https://kapi.kakao.com', 'kakao'), (NULL, 'https://kauth.kakao.com', 'kakao'),
            (NULL, 'https://nid.naver.com', 'naver'),
            ('custom:kakao-mock', 'https://kauth.kakao.com', 'kakao'),
            ('google', 'https://kapi.kakao.com', 'google'),
            ('email', NULL, NULL), ('phone', NULL, NULL), ('anonymous', NULL, NULL),
            ('github', 'https://github.com', NULL), ('custom:other', 'https://idp.example', NULL),
            ('', '', NULL), (NULL, NULL, NULL)
          ) AS t(p, iss, want) LOOP
          IF public.social_login_provider(v.p, v.iss) IS DISTINCT FROM v.want THEN
            RAISE EXCEPTION 'social_login_provider(%, %) = % (기대 %)', v.p, v.iss, public.social_login_provider(v.p, v.iss), v.want;
          END IF;
        END LOOP;
        IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
             WHERE conrelid = 'public.users'::regclass AND conname = 'users_last_login_provider_check')
           !~ 'google.*kakao.*naver' THEN
          RAISE EXCEPTION 'users_last_login_provider_check 가 google·kakao·naver 가 아님';
        END IF;
      END $$;`),
  });
  await check({
    group: 'auth',
    id: 'SU-3',
    role: 'postgres',
    op: 'handle_new_user·handle_user_signed_in 본문이 이메일·이름·사진 메타데이터(email, full_name, name, nickname, picture, avatar_url …)를 읽는가',
    ...NONE,
    run: () => {
      const v = one(`select coalesce(string_agg(p.proname || ':' || m[1], ', ' order by p.proname), '')
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral regexp_matches(p.prosrc,
          '(NEW\\.email|->>?\\s*''(?:email|full_name|name|nickname|user_name|preferred_username|picture|avatar_url)'')', 'g') m
       where n.nspname = 'public' and p.proname in ('handle_new_user', 'handle_user_signed_in')`);
      return v ? { actual: 'reads', detail: v } : { actual: 'none', detail: '(없음)' };
    },
  });
  await check({
    group: 'auth',
    id: 'SU-4',
    role: 'postgres',
    op: 'GoTrue 실제 가입·비밀번호 로그인(alice, provider email) → last_login_provider NULL (google·kakao·naver 가 아니면 비움, CHECK 위반 없이 가입·로그인)',
    ...OK,
    run: () => {
      const v = one(
        `select coalesce(u.last_login_provider, 'null') || ' ' || coalesce(a.raw_app_meta_data ->> 'provider', '?')
           from public.users u join auth.users a on a.id = u.id where u.id = '${u.alice.id}'`,
      );
      return v.startsWith('null ')
        ? { actual: 'ok', detail: v.slice(5) }
        : { actual: 'mismatch', detail: v };
    },
  });
  await check({
    group: 'auth',
    id: 'LG-1',
    role: 'postgres',
    op: '연결 계정(Google 가입 + Kakao·Naver 연결, app_metadata.provider 는 google 고정) 로그인마다 GoTrue 처럼 identity_data 병합 + last_sign_in_at → kakao → naver → google → custom:kakao(kauth) kakao. 이름·사진·닉네임·공개 이름은 그대로',
    ...OK,
    run: () =>
      sqlCheck(`
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, last_sign_in_at) VALUES
          ('d3000000-0000-0000-0000-000000000001', 'lg1-kid@gmail.example',
           '{"provider": "google", "providers": ["google", "kakao", "custom:naver"]}',
           '{"iss": "https://accounts.google.com", "sub": "g-lg1", "name": "김실명", "full_name": "김실명",
             "picture": "https://lh3.googleusercontent.com/a/lg1", "email": "lg1-kid@gmail.example"}', now() - interval '1 day');
        UPDATE public.users SET nickname = 'Lg1Kid' WHERE id = 'd3000000-0000-0000-0000-000000000001';
        DO $$
        DECLARE
          v_uid  UUID := 'd3000000-0000-0000-0000-000000000001';
          v_at   TIMESTAMPTZ := now();
          v_step RECORD;
          v      RECORD;
          i      INT := 0;
        BEGIN
          IF (SELECT last_login_provider FROM public.users WHERE id = v_uid) IS DISTINCT FROM 'google' THEN
            RAISE EXCEPTION 'Google 가입 직후가 google 이 아님';
          END IF;
          FOR v_step IN SELECT * FROM (VALUES
              (1, '{"iss": "https://kapi.kakao.com", "sub": "4012345690", "provider_id": "4012345690", "name": "카카오닉",
                    "full_name": "카카오닉", "avatar_url": "http://k.kakaocdn.net/dn/lg1.jpg"}'::jsonb, 'kakao'),
              (2, '{"iss": "https://nid.naver.com", "sub": "naver-lg1", "provider_id": "naver-lg1", "aud": ["naver-client"]}'::jsonb, 'naver'),
              (3, '{"iss": "https://accounts.google.com", "sub": "g-lg1", "name": "김실명", "picture": "https://lh3.googleusercontent.com/a/lg1"}'::jsonb, 'google'),
              (4, '{"iss": "https://kauth.kakao.com", "sub": "4012345690", "provider_id": "4012345690", "name": "카카오닉"}'::jsonb, 'kakao')
            ) AS t(n, identity_data, want) ORDER BY n LOOP
            i := i + 1;
            UPDATE auth.users
               SET raw_user_meta_data = raw_user_meta_data || v_step.identity_data,
                   last_sign_in_at    = v_at + make_interval(mins => i)
             WHERE id = v_uid;
            SELECT u.*, p.public_name INTO v
              FROM public.users u JOIN public.user_public_profiles p ON p.user_id = u.id WHERE u.id = v_uid;
            IF v.last_login_provider IS DISTINCT FROM v_step.want OR v.last_login_at <> v_at + make_interval(mins => i) THEN
              RAISE EXCEPTION '로그인 %: % % (기대 %)', v_step.n, v.last_login_provider, v.last_login_at, v_step.want;
            END IF;
            IF v.display_name <> public.placeholder_display_name(v_uid) OR coalesce(v.avatar_url, '') <> ''
               OR v.nickname IS DISTINCT FROM 'Lg1Kid' OR v.public_name IS DISTINCT FROM 'Lg1Kid' THEN
              RAISE EXCEPTION '로그인 %: 공개 필드가 바뀜 % % % %', v_step.n, v.display_name, v.avatar_url, v.nickname, v.public_name;
            END IF;
          END LOOP;
          IF (SELECT raw_app_meta_data ->> 'provider' FROM auth.users WHERE id = v_uid) <> 'google' THEN
            RAISE EXCEPTION '전제 깨짐: app_metadata.provider 가 google 이 아님';
          END IF;
        END $$;`),
  });
  await check({
    group: 'auth',
    id: 'RPC-9',
    role: 'postgres',
    op: '00013 함수(가입·로그인·상태 보호 트리거, provider·자리표시자 함수) 중 anon/authenticated 가 EXECUTE 할 수 있는 것',
    ...NONE,
    run: () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('handle_new_user', 'handle_user_signed_in', 'prevent_status_downgrade',
                           'social_login_provider', 'placeholder_display_name')
         and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
}

// ── board: 게시판 안전장치 (P1-18, B19, 00014·00015) ──────────
/** CHECK 위반(23514)이면 'rejected'. 그 밖은 classifyWrite 와 같음 */
async function classifyCheckWrite(reqPromise, verifySql) {
  const r = await reqPromise;
  const written = one(verifySql) === 't';
  const base = `${r.status} ${errCode(r) ?? ''} ${errMsg(r) ?? ''}`.trim();
  if (written) return { actual: 'written', detail: base };
  if (errCode(r) === '23514') return { actual: 'rejected', detail: base };
  if (r.status === 401 || r.status === 403 || errCode(r) === '42501')
    return { actual: 'denied', detail: base };
  if (r.status >= 200 && r.status < 300)
    return { actual: 'no-op', detail: `${base} (RLS 로 0행)` };
  return { actual: 'error', detail: base };
}
const CHECKW = { deny: ['rejected'], allow: ['written'] };
const CLIENTW = { deny: ['denied', 'no-op', 'rejected'], allow: ['written'] };

async function groupBoard(u) {
  // ① 00014 CHECK: service_role(= 새 API 경로)도 막힘 → DB 가 마지막 방어선 (B19)
  const longTitle = `b19-${RUN}-` + 'x'.repeat(100);
  const checks = [
    ['B19-1', 'POST /board_posts 제목 101자 이상', 'board_posts', { user_id: u.bob.id, title: longTitle, content: 'x' }, `title = ${sqlStr(longTitle)}`],
    ['B19-2', 'POST /board_posts 제목이 공백뿐', 'board_posts', { user_id: u.bob.id, title: '   ', content: `b19-2-${RUN}` }, `content = 'b19-2-${RUN}'`],
    ['B19-3', 'POST /board_posts 내용 2,001자', 'board_posts', { user_id: u.bob.id, title: `b19-3-${RUN}`, content: 'x'.repeat(2001) }, `title = 'b19-3-${RUN}'`],
    ['B19-4', 'POST /board_comments 댓글 501자', 'board_comments', { post_id: u.postId, user_id: u.bob.id, content: `b19-4-${RUN}` + 'x'.repeat(500) }, `content like 'b19-4-${RUN}%'`],
    ['B19-5', 'POST /board_comments 빈 댓글', 'board_comments', { post_id: u.postId, user_id: u.bob.id, content: '' }, `user_id = '${u.bob.id}' and content = ''`],
  ];
  for (const [id, op, table, body, where] of checks) {
    await check({
      group: 'board',
      id,
      role: 'service_role',
      op: `${op} (CHECK)`,
      ...CHECKW,
      run: () =>
        classifyCheckWrite(
          rest('POST', `/rest/v1/${table}`, { as: 'service', body, prefer: 'return=minimal' }),
          `select exists (select 1 from public.${table} where ${where})`,
        ),
    });
  }
  // 한도 경계: 이모지 100개(코드 포인트 100, UTF-16 200) 제목 + 2,000자 내용은 저장됨
  const emojiTitle = '🐍'.repeat(96) + RUN.slice(-4).padStart(4, 'a');
  await check({
    group: 'board',
    id: 'B19-6',
    role: 'service_role',
    op: 'POST /board_posts 제목 100자(이모지)·내용 2,000자 → 저장됨 (한도 = char_length)',
    ...CHECKW,
    deny: ['rejected', 'error', 'denied'],
    allow: ['written'],
    run: () =>
      classifyCheckWrite(
        rest('POST', '/rest/v1/board_posts', {
          as: 'service',
          body: { user_id: u.bob.id, title: emojiTitle, content: 'y'.repeat(2000) },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_posts where title = ${sqlStr(emojiTitle)})`,
      ),
  });
  await check({
    group: 'board',
    id: 'B19-7',
    role: 'authenticated',
    op: 'POST /board_posts 제목 101자 (원래 B19 우회: 브라우저에서 직접 INSERT)',
    ...CLIENTW,
    run: () =>
      classifyCheckWrite(
        rest('POST', '/rest/v1/board_posts', {
          as: u.alice,
          body: { user_id: u.alice.id, title: `b19-7-${RUN}` + 'x'.repeat(100), content: 'x' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_posts where title like 'b19-7-${RUN}%')`,
      ),
  });
  await check({
    group: 'board',
    id: 'B19-8',
    role: 'postgres',
    op: 'board CHECK 3개가 VALID (운영에 위반 행이 있으면 NOT VALID 로 추가됨 → 런북 "00014 확인")',
    deny: ['valid'],
    allow: (a) => a !== 'valid',
    run: () => {
      const v = one(`select coalesce(string_agg(conname || '=' || convalidated, ',' order by conname), '')
        from pg_constraint where conname in ('board_posts_title_check', 'board_posts_content_check', 'board_comments_content_check')`);
      return {
        actual: v === 'board_comments_content_check=true,board_posts_content_check=true,board_posts_title_check=true' ? 'valid' : 'invalid',
        detail: v,
      };
    },
  });

  // ③ 00015: 클라이언트 쓰기 거부 (금칙어 필터 우회 차단)
  const clientWrites = [
    ['BW-1', u.alice, 'POST /board_posts {user_id: 본인} (정상 길이)', () =>
      rest('POST', '/rest/v1/board_posts', { as: u.alice, body: { user_id: u.alice.id, title: `bw-1-${RUN}`, content: '필터 우회' }, prefer: 'return=minimal' }),
      `select exists (select 1 from public.board_posts where title = 'bw-1-${RUN}')`],
    ['BW-2', u.alice, 'PATCH /board_posts?id=eq.<본인 글>', () =>
      rest('PATCH', `/rest/v1/board_posts?id=eq.${u.alicePostId}`, { as: u.alice, body: { content: `bw-2-${RUN}` }, prefer: 'return=minimal' }),
      `select exists (select 1 from public.board_posts where id = '${u.alicePostId}' and content = 'bw-2-${RUN}')`],
    ['BW-3', u.alice, 'DELETE /board_posts?id=eq.<본인 글>', () =>
      rest('DELETE', `/rest/v1/board_posts?id=eq.${u.alicePostId}`, { as: u.alice, prefer: 'return=minimal' }),
      `select not exists (select 1 from public.board_posts where id = '${u.alicePostId}')`],
    ['BW-4', u.alice, 'POST /board_comments {user_id: 본인}', () =>
      rest('POST', '/rest/v1/board_comments', { as: u.alice, body: { post_id: u.postId, user_id: u.alice.id, content: `bw-4-${RUN}` }, prefer: 'return=minimal' }),
      `select exists (select 1 from public.board_comments where content = 'bw-4-${RUN}')`],
    ['BW-5', u.alice, 'DELETE /board_comments?id=eq.<본인 댓글>', () =>
      rest('DELETE', `/rest/v1/board_comments?id=eq.${u.aliceCommentId}`, { as: u.alice, prefer: 'return=minimal' }),
      `select not exists (select 1 from public.board_comments where id = '${u.aliceCommentId}')`],
    ['BW-6', 'anon', 'POST /board_posts (비로그인)', () =>
      rest('POST', '/rest/v1/board_posts', { body: { user_id: u.bob.id, title: `bw-6-${RUN}`, content: 'x' }, prefer: 'return=minimal' }),
      `select exists (select 1 from public.board_posts where title = 'bw-6-${RUN}')`],
  ];
  for (const [id, who, op, req, verify] of clientWrites) {
    await check({
      group: 'board',
      id,
      role: who === 'anon' ? 'anon' : 'authenticated',
      op,
      ...CLIENTW,
      run: () => classifyCheckWrite(req(), verify),
    });
  }

  // ① 00014 숨김: 숨긴 글은 작성자만, 숨긴 글의 댓글은 아무도 (작성자 포함, 글 RLS 를 따름 → 작성자는 볼 수 있음)
  await check({
    group: 'board',
    id: 'BH-1',
    role: 'authenticated',
    op: 'GET /board_posts?id=eq.<남의 숨긴 글>',
    ...READ,
    run: async () => classifyRead(await rest('GET', `/rest/v1/board_posts?select=id&id=eq.${u.hiddenBobPostId}`, { as: u.alice })),
  });
  await check({
    group: 'board',
    id: 'BH-2',
    role: 'authenticated',
    op: 'GET /board_comments?post_id=eq.<남의 숨긴 글> (내가 쓴 댓글이라도 글이 안 보이면 안 보임)',
    ...READ,
    run: async () => classifyRead(await rest('GET', `/rest/v1/board_comments?select=id&post_id=eq.${u.hiddenBobPostId}`, { as: u.alice })),
  });
  await check({
    group: 'board',
    id: 'BH-3',
    role: 'authenticated',
    op: 'GET /board_posts?id=eq.<내 숨긴 글> (작성자는 봄: "나만 볼 수 있어요")',
    ...READ,
    run: async () => classifyRead(await rest('GET', `/rest/v1/board_posts?select=id,is_hidden&id=eq.${u.hiddenAlicePostId}`, { as: u.alice })),
  });
  await check({
    group: 'board',
    id: 'BH-4',
    role: 'authenticated',
    op: '① 상태 재현(쓰기 권한·정책 임시 부여): 클라이언트가 is_hidden·hidden_at 을 바꾸면 보호 트리거가 버림',
    deny: ['ok'],
    allow: ['mismatch'],
    run: () =>
      sqlCheck(`
        GRANT INSERT, UPDATE ON public.board_posts TO authenticated;
        CREATE POLICY tmp_bh4_ins ON public.board_posts FOR INSERT TO authenticated WITH CHECK (true);
        CREATE POLICY tmp_bh4_upd ON public.board_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub": "${u.alice.id}", "role": "authenticated"}';
        DO $$
        DECLARE v_id UUID; v_hidden BOOLEAN; v_at TIMESTAMPTZ;
        BEGIN
          INSERT INTO public.board_posts (user_id, title, content, is_hidden, hidden_at)
          VALUES ('${u.alice.id}', 'bh4', 'x', true, now()) RETURNING id, is_hidden, hidden_at INTO v_id, v_hidden, v_at;
          IF v_hidden OR v_at IS NOT NULL THEN RAISE EXCEPTION 'INSERT 로 숨김 상태를 정함: % %', v_hidden, v_at; END IF;
          UPDATE public.board_posts SET is_hidden = false, hidden_at = NULL WHERE id = '${u.hiddenAlicePostId}'
            RETURNING is_hidden, hidden_at INTO v_hidden, v_at;
          IF NOT v_hidden OR v_at IS NULL THEN RAISE EXCEPTION 'UPDATE 로 숨김을 풂: % %', v_hidden, v_at; END IF;
        END $$;
        RESET ROLE;`),
  });

  // ① 00014 신고: board_reports·report_board_content 는 service_role 전용
  await check({
    group: 'board',
    id: 'BR-1',
    role: 'anon',
    op: 'GET /board_reports',
    ...READ,
    run: async () => classifyRead(await rest('GET', '/rest/v1/board_reports?select=*')),
  });
  await check({
    group: 'board',
    id: 'BR-2',
    role: 'authenticated',
    op: 'GET /board_reports (누가 누구를 신고했는지)',
    ...READ,
    run: async () => classifyRead(await rest('GET', '/rest/v1/board_reports?select=*', { as: u.alice })),
  });
  await check({
    group: 'board',
    id: 'BR-3',
    role: 'authenticated',
    op: 'POST /board_reports (API 를 건너뛴 신고 = 혼자 숨김 조작)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/board_reports', {
          as: u.alice,
          body: { reporter_id: u.alice.id, target_type: 'post', target_id: u.reportPostId, reason: 'other' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_reports where reporter_id = '${u.alice.id}' and target_id = '${u.reportPostId}')`,
      ),
  });
  await check({
    group: 'board',
    id: 'BR-4',
    role: 'authenticated',
    op: 'POST /rpc/report_board_content (다른 사람 id 로 신고 = 혼자 3번 신고)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/rpc/report_board_content', {
          as: u.alice,
          body: { p_reporter_id: u.carol.id, p_target_type: 'post', p_target_id: u.reportPostId, p_reason: 'abuse' },
        }),
        `select exists (select 1 from public.board_reports where reporter_id = '${u.carol.id}' and target_id = '${u.reportPostId}')`,
      ),
  });
  await check({
    group: 'board',
    id: 'BR-5',
    role: 'service_role',
    op: 'api/board/reports → POST /rpc/report_board_content (alice 가 bob 의 글 신고)',
    ...WRITE,
    run: async () => {
      const r = await rest('POST', '/rest/v1/rpc/report_board_content', {
        as: 'service',
        body: { p_reporter_id: u.alice.id, p_target_type: 'post', p_target_id: u.reportPostId, p_reason: 'abuse' },
      });
      const written = one(`select exists (select 1 from public.board_reports where reporter_id = '${u.alice.id}' and target_id = '${u.reportPostId}')`) === 't';
      return written && r.json?.result === 'reported'
        ? { actual: 'written', detail: JSON.stringify(r.json) }
        : { actual: 'error', detail: `${r.status} ${JSON.stringify(r.json)}` };
    },
  });
  await check({
    group: 'board',
    id: 'BR-6',
    role: 'service_role',
    op: 'report_board_content 규칙: 중복은 already, 본인 글은 own, 없는 대상은 not_found, 서로 다른 3명이면 숨김(글·댓글), 2명이면 그대로',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`
        SET LOCAL ROLE service_role;
        DO $$
        DECLARE
          v_post UUID := '${u.reportPostId}';
          v_comment UUID := '${u.reportCommentId}';
          r JSONB;
        BEGIN
          r := public.report_board_content('${u.alice.id}', 'post', v_post, 'abuse');
          IF r->>'result' <> 'already' THEN RAISE EXCEPTION '중복 신고: %', r; END IF;
          r := public.report_board_content('${u.bob.id}', 'post', v_post, 'abuse');
          IF r->>'result' <> 'own' THEN RAISE EXCEPTION '본인 글: %', r; END IF;
          r := public.report_board_content('${u.carol.id}', 'post', gen_random_uuid(), 'abuse');
          IF r->>'result' <> 'not_found' THEN RAISE EXCEPTION '없는 대상: %', r; END IF;
          r := public.report_board_content('${u.carol.id}', 'post', v_post, 'bullying');
          IF (r->>'hidden')::boolean OR (SELECT is_hidden FROM public.board_posts WHERE id = v_post) THEN
            RAISE EXCEPTION '2명인데 숨김: %', r;
          END IF;
          r := public.report_board_content('${u.dan.id}', 'post', v_post, 'personal_info');
          IF NOT (r->>'hidden')::boolean OR NOT (SELECT is_hidden AND hidden_at IS NOT NULL FROM public.board_posts WHERE id = v_post) THEN
            RAISE EXCEPTION '3명인데 숨기지 않음: %', r;
          END IF;
          IF (SELECT count(*) FROM public.board_reports WHERE target_id = v_post) <> 3 THEN
            RAISE EXCEPTION '신고 행 수가 3이 아님';
          END IF;
          PERFORM public.report_board_content('${u.alice.id}', 'comment', v_comment, 'abuse');
          PERFORM public.report_board_content('${u.carol.id}', 'comment', v_comment, 'abuse');
          r := public.report_board_content('${u.dan.id}', 'comment', v_comment, 'other');
          IF NOT (SELECT is_hidden FROM public.board_comments WHERE id = v_comment) THEN
            RAISE EXCEPTION '댓글 3명인데 숨기지 않음: %', r;
          END IF;
          BEGIN
            PERFORM public.report_board_content('${u.alice.id}', 'user', v_post, 'abuse');
            RAISE EXCEPTION '알 수 없는 target_type 을 받음';
          EXCEPTION WHEN invalid_parameter_value THEN NULL;
          END;
          BEGIN
            PERFORM public.report_board_content('${u.carol.id}', 'comment', v_post, 'spam');
          EXCEPTION WHEN check_violation THEN NULL;
          END;
        END $$;
        RESET ROLE;`),
  });
  await check({
    group: 'board',
    id: 'BR-7',
    role: 'postgres',
    op: '00014 함수(report_board_content·board_protect_moderation) 중 anon/authenticated 가 EXECUTE 할 수 있는 것',
    ...NONE,
    run: () => {
      const v = one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('report_board_content', 'board_protect_moderation')
         and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });

  // ① 00014 작성자 표시: 실명이 들어 있는 기존 사용자(운영 Google 사용자)도 뷰로는 닉네임·자리표시자만
  await check({
    group: 'board',
    id: 'VIEW-3',
    role: 'authenticated',
    op: 'user_profiles_public: 실명 display_name·사진이 있는 사용자도 이름 = coalesce(nickname, placeholder_display_name), avatar_url = NULL',
    deny: ['ok'],
    allow: ['mismatch'],
    run: () =>
      sqlCheck(`
        UPDATE public.users SET display_name = '박실명', avatar_url = 'https://lh3.googleusercontent.com/x' WHERE id = '${u.bob.id}';
        UPDATE public.users SET display_name = '최실명', nickname = '캐롤코딩' WHERE id = '${u.carol.id}';
        CREATE TEMP TABLE tmp_expected ON COMMIT DROP AS
          SELECT id, coalesce(nickname, public.placeholder_display_name(id)) AS name FROM public.users;
        GRANT SELECT ON tmp_expected TO authenticated;
        SET LOCAL ROLE authenticated;
        SET LOCAL request.jwt.claims = '{"sub": "${u.alice.id}", "role": "authenticated"}';
        DO $$
        DECLARE v_bad INTEGER;
        BEGIN
          SELECT count(*) INTO v_bad
            FROM public.user_profiles_public v JOIN tmp_expected e ON e.id = v.id
           WHERE v.display_name IS DISTINCT FROM e.name OR v.avatar_url IS NOT NULL;
          IF v_bad > 0 THEN RAISE EXCEPTION '뷰 이름이 닉네임·자리표시자와 다른 행 %', v_bad; END IF;
          IF EXISTS (SELECT 1 FROM public.user_profiles_public WHERE display_name IN ('박실명', '최실명')) THEN
            RAISE EXCEPTION '실명이 보임';
          END IF;
          IF (SELECT display_name FROM public.user_profiles_public WHERE id = '${u.carol.id}') <> '캐롤코딩' THEN
            RAISE EXCEPTION '닉네임이 있는데 닉네임이 아님';
          END IF;
        END $$;
        RESET ROLE;`),
  });
}

// ── onboarding: 첫 로그인 온보딩 (P3-11, ① 00023) ──────────────
async function groupOnboarding(u) {
  const AG = '/rest/v1/user_agreements';
  const T = '2026-11-06';
  // 동의 기록은 법적 기록: 클라이언트가 읽거나 지우거나 끼워 넣으면 안 됨 (service_role 전용)
  one(`insert into public.user_agreements (user_id, item, version, method) values ('${u.alice.id}', 'terms', '${T}', 'self')
       on conflict do nothing`);
  await check({
    group: 'onboarding',
    id: 'OB-1',
    role: 'anon',
    op: 'GET /user_agreements',
    ...READ,
    run: async () => classifyRead(await rest('GET', `${AG}?select=*`)),
  });
  await check({
    group: 'onboarding',
    id: 'OB-2',
    role: 'authenticated',
    op: 'GET /user_agreements?user_id=eq.<본인> · DELETE (동의 기록 읽기·지우기)',
    ...WRITE,
    run: async () => {
      const read = classifyRead(await rest('GET', `${AG}?select=*&user_id=eq.${u.alice.id}`, { as: u.alice }));
      if (read.actual === 'allowed') return { actual: 'written', detail: `읽힘: ${read.detail}` };
      return classifyWrite(
        rest('DELETE', `${AG}?user_id=eq.${u.alice.id}`, { as: u.alice, prefer: 'return=minimal' }),
        `select not exists (select 1 from public.user_agreements where user_id = '${u.alice.id}' and item = 'terms')`,
      );
    },
  });
  await check({
    group: 'onboarding',
    id: 'OB-3',
    role: 'authenticated',
    op: 'POST /user_agreements {user_id: 다른 사람} (남의 동의를 꾸며 넣기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', AG, {
          as: u.alice,
          body: { user_id: u.bob.id, item: 'privacy', version: T, method: 'guardian_in_person' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_agreements where user_id = '${u.bob.id}' and item = 'privacy')`,
      ),
  });
  await check({
    group: 'onboarding',
    id: 'OB-4',
    role: 'authenticated',
    op: 'POST /rpc/complete_onboarding · PATCH /users {nickname, onboarded_at} (금칙어 검사·동의 없이 온보딩 끝내기)',
    ...WRITE,
    run: async () => {
      const r = await classifyWrite(
        rest('POST', '/rest/v1/rpc/complete_onboarding', {
          as: u.alice,
          body: {
            p_user_id: u.alice.id,
            p_nickname: 'Hacker01',
            p_skin: 'sky',
            p_grade: null,
            p_agreements: [{ item: 'terms', version: T }],
            p_method: 'self',
            p_age_band: '14plus',
            p_guardian_agreements: null,
            p_guardian_relation: null,
          },
        }),
        `select exists (select 1 from public.users where id = '${u.alice.id}' and (nickname = 'Hacker01' or onboarded_at is not null))`,
      );
      if (r.actual === 'written') return r;
      return classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { nickname: 'Hacker02', onboarded_at: new Date().toISOString() },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.users where id = '${u.alice.id}' and (nickname = 'Hacker02' or onboarded_at is not null))`,
      );
    },
  });
  await check({
    group: 'onboarding',
    id: 'OB-5',
    role: 'anon·authenticated',
    op: 'POST /rpc/is_nickname_taken (다른 아이 닉네임 훑기)',
    deny: ['denied'],
    allow: (a) => a !== 'denied',
    run: async () => {
      for (const as of ['anon', u.alice]) {
        const r = await rest('POST', '/rest/v1/rpc/is_nickname_taken', {
          as,
          body: { p_nickname: '캐롤코딩', p_user_id: u.alice.id },
        });
        if (r.status < 300) return { actual: 'allowed', detail: `${as === 'anon' ? 'anon' : 'auth'} ${r.status} ${JSON.stringify(r.json)}` };
        if (!(r.status === 401 || r.status === 403 || r.status === 404 || errCode(r) === '42501'))
          return { actual: 'error', detail: `${r.status} ${errCode(r)} ${errMsg(r)}` };
      }
      return { actual: 'denied', detail: '둘 다 거부' };
    },
  });
  await check({
    group: 'onboarding',
    id: 'OB-6',
    role: 'service_role',
    op: 'complete_onboarding: 닉네임·학년·스킨(다른 키 유지)·완료 시각·동의 한 번에 / 다시 불러도 처음 시각 유지 / 닉네임 중복 23505 면 동의도 안 남음 / 공개 프로필 스킨 동기화 / is_nickname_taken 대소문자·본인 제외',
    ...OK,
    run: async () => {
      const x = await createUser('ob6', '온보딩점검');
      const y = await createUser('ob6b', '온보딩중복');
      one(`update public.users set avatar_config = '{"hat":"party"}' where id = '${x.id}'`);
      const args = (id, nickname) => ({
        p_user_id: id,
        p_nickname: nickname,
        p_skin: 'violet',
        p_grade: 3,
        p_agreements: [
          { item: 'terms', version: T },
          { item: 'privacy', version: T },
        ],
        p_method: 'self',
        p_age_band: '14plus',
        p_guardian_agreements: null,
        p_guardian_relation: null,
      });
      const r1 = await rpc('complete_onboarding', args(x.id, 'ObCheck01'));
      if (r1.status !== 200 || r1.json?.first !== true) return { actual: 'error', detail: `1차 ${r1.status} ${JSON.stringify(r1.json)}` };
      const row = one(`select nickname || '|' || grade || '|' || (avatar_config->>'skin') || '|' || (avatar_config->>'hat') || '|' ||
                         (onboarded_at is not null) || '|' || (select count(*) from public.user_agreements where user_id = '${x.id}') || '|' ||
                         coalesce((select avatar_skin from public.user_public_profiles where user_id = '${x.id}'), '-')
                         from public.users where id = '${x.id}'`);
      const firstAt = one(`select onboarded_at from public.users where id = '${x.id}'`);
      const firstAgreed = one(`select max(agreed_at) from public.user_agreements where user_id = '${x.id}'`);
      const r2 = await rpc('complete_onboarding', { ...args(x.id, 'ObCheck02'), p_grade: null });
      const again = one(`select (onboarded_at = '${firstAt}') || '|' || coalesce(grade::text, 'null') || '|' || nickname
                         || '|' || (select max(agreed_at) = '${firstAgreed}' from public.user_agreements where user_id = '${x.id}')
                         from public.users where id = '${x.id}'`);
      const dup = await rpc('complete_onboarding', args(y.id, 'obcheck02'));
      const yState = one(`select (onboarded_at is null) || '|' || (select count(*) from public.user_agreements where user_id = '${y.id}')
                          from public.users where id = '${y.id}'`);
      const bad = await rpc('complete_onboarding', { ...args(y.id, 'ObCheck03'), p_agreements: [] });
      const taken = await rpc('is_nickname_taken', { p_nickname: 'OBCHECK02', p_user_id: y.id });
      const self = await rpc('is_nickname_taken', { p_nickname: 'obcheck02', p_user_id: x.id });
      return (
        compare(
        'OB-6',
        {
          row: 'ObCheck01|3|violet|party|true|2|violet',
          second: '200 false',
          again: 'true|null|ObCheck02|true',
          dup: '409 23505',
          yState: 'true|0',
          bad: 'PT400',
          taken: true,
          self: false,
        },
        {
          row,
          second: `${r2.status} ${r2.json?.first}`,
          again,
          dup: `${dup.status} ${errCode(dup)}`,
          yState,
          bad: String(errCode(bad)),
          taken: taken.json,
          self: self.json,
        },
      ) ?? { actual: 'ok', detail: 'RPC 한 번에 저장·롤백·동기화 확인' }
      );
    },
  });
}

// ── consent: 만 14세 미만 법정대리인 동의 (P3-15, ① 00024) ──────────
async function groupConsent(u) {
  const T = '2026-11-06';
  const G = [
    { item: 'guardian_privacy', version: T },
    { item: 'guardian_attest', version: T },
  ];
  await check({
    group: 'consent',
    id: 'GC-1',
    role: 'authenticated',
    op: 'PATCH /users {age_band: 14plus, guardian_consented_at, consent_deadline: null} (제한 모드·파기 기한 스스로 풀기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { age_band: '14plus', guardian_consented_at: new Date().toISOString(), consent_deadline: null },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.users where id = '${u.alice.id}' and (age_band = '14plus' or guardian_consented_at is not null))`,
      ),
  });
  await check({
    group: 'consent',
    id: 'GC-2',
    role: 'anon·authenticated',
    op: 'POST /rpc/record_guardian_consent · list_expired_unconsented (보호자 동의 꾸미기·파기 대상 훑기)',
    deny: ['denied'],
    allow: (a) => a !== 'denied',
    run: async () => {
      for (const as of ['anon', u.alice]) {
        for (const [fn, body] of [
          ['record_guardian_consent', { p_user_id: u.alice.id, p_agreements: G, p_relation: null, p_method: 'guardian_in_person' }],
          ['list_expired_unconsented', { p_limit: 10 }],
        ]) {
          const r = await rest('POST', `/rest/v1/rpc/${fn}`, { as, body });
          if (r.status < 300) return { actual: 'allowed', detail: `${fn} ${r.status}` };
          if (!(r.status === 401 || r.status === 403 || r.status === 404 || errCode(r) === '42501'))
            return { actual: 'error', detail: `${fn} ${r.status} ${errCode(r)} ${errMsg(r)}` };
        }
      }
      const written = one(`select guardian_consented_at is not null from public.users where id = '${u.alice.id}'`);
      return written === 't' ? { actual: 'allowed', detail: '동의가 기록됨' } : { actual: 'denied', detail: '모두 거부' };
    },
  });
  await check({
    group: 'consent',
    id: 'GC-3',
    role: 'service_role',
    op: 'complete_onboarding 나이·보호자: 미동의 만 14세 미만 = 제한 + 기한 30일 / 결과는 한 번 정하면 그대로 / 보호자 동의 함께 = 기한 없음·관계 기록 / record_guardian_consent 로 나중에 해제 / 만 14세 이상은 409',
    ...OK,
    run: async () => {
      const kid = await createUser('gc3a', '동의전아이');
      const kid2 = await createUser('gc3b', '동의한아이');
      const teen = await createUser('gc3c', '열다섯');
      const base = (id, nick, band, guardian = null, relation = null) => ({
        p_user_id: id,
        p_nickname: nick,
        p_skin: 'sky',
        p_grade: null,
        p_agreements: [{ item: 'terms', version: T }, { item: 'privacy', version: T }],
        p_method: 'self',
        p_age_band: band,
        p_guardian_agreements: guardian,
        p_guardian_relation: relation,
      });
      const r1 = await rpc('complete_onboarding', base(kid.id, 'GcKid01', 'under14'));
      const kidState = one(`select age_band || '|' || (guardian_consented_at is null) || '|' ||
                            (consent_deadline between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour')
                            from public.users where id = '${kid.id}'`);
      const deadline1 = one(`select consent_deadline from public.users where id = '${kid.id}'`);
      // 다시 불러 만 14세 이상이라고 해도 결과·기한은 그대로
      await rpc('complete_onboarding', base(kid.id, 'GcKid01', '14plus'));
      const kidAgain = one(`select age_band || '|' || (consent_deadline = '${deadline1}') from public.users where id = '${kid.id}'`);
      const r2 = await rpc('complete_onboarding', base(kid2.id, 'GcKid02', 'under14', G, 'mother'));
      const kid2State = one(`select (guardian_consented_at is not null) || '|' || (consent_deadline is null) || '|' ||
                             (select count(*) from public.user_agreements where user_id = '${kid2.id}' and method = 'guardian_in_person' and relation = 'mother')
                             from public.users where id = '${kid2.id}'`);
      await rpc('complete_onboarding', base(teen.id, 'GcTeen01', '14plus', G, 'father'));
      const teenState = one(`select age_band || '|' || (consent_deadline is null) || '|' ||
                             (select count(*) from public.user_agreements where user_id = '${teen.id}' and method = 'guardian_in_person')
                             from public.users where id = '${teen.id}'`);
      const teenLater = await rpc('record_guardian_consent', { p_user_id: teen.id, p_agreements: G, p_relation: null, p_method: 'guardian_in_person' });
      const badRel = await rpc('record_guardian_consent', { p_user_id: kid.id, p_agreements: G, p_relation: 'uncle', p_method: 'guardian_in_person' });
      const later = await rpc('record_guardian_consent', { p_user_id: kid.id, p_agreements: G, p_relation: 'other', p_method: 'guardian_in_person' });
      const kidLater = one(`select (guardian_consented_at is not null) || '|' || (consent_deadline is null) from public.users where id = '${kid.id}'`);
      return (
        compare(
          'GC-3',
          {
            r1: true,
            kidState: 'under14|true|true',
            kidAgain: 'under14|true',
            r2: false,
            kid2State: 'true|true|2',
            teenState: '14plus|true|0',
            teenLater: 'PT409',
            badRel: 'PT400',
            later: 200,
            kidLater: 'true|true',
          },
          {
            r1: r1.json?.restricted,
            kidState,
            kidAgain,
            r2: r2.json?.restricted,
            kid2State,
            teenState,
            teenLater: String(errCode(teenLater)),
            badRel: String(errCode(badRel)),
            later: later.status,
            kidLater,
          },
        ) ?? { actual: 'ok', detail: '제한·기한·결과 고정·보호자 기록·나중 동의 확인' }
      );
    },
  });
  await check({
    group: 'consent',
    id: 'GC-4',
    role: 'service_role',
    op: 'list_expired_unconsented: 기한 지난 미동의 만 14세 미만만 (동의함·기한 남음·만 14세 이상·확인 전 제외)',
    ...OK,
    run: async () => {
      const ids = {};
      for (const [k, band, consented, days] of [
        ['expired', 'under14', false, -1],
        ['consented', 'under14', true, -1],
        ['future', 'under14', false, 5],
        ['teen', '14plus', false, -1],
        ['unknown', null, false, -1],
      ]) {
        const x = await createUser(`gc4${k}`, '파기점검');
        ids[k] = x.id;
        one(`update public.users set age_band = ${band ? `'${band}'` : 'null'},
               guardian_consented_at = ${consented ? 'now()' : 'null'},
               consent_deadline = now() + interval '${days} days'
             where id = '${x.id}'`);
      }
      const r = await rpc('list_expired_unconsented', { p_limit: 500 });
      const listed = Array.isArray(r.json) ? r.json : [];
      const got = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, listed.includes(id)]));
      return (
        compare('GC-4', { expired: true, consented: false, future: false, teen: false, unknown: false }, got) ?? {
          actual: 'ok',
          detail: `대상 ${listed.length}`,
        }
      );
    },
  });
}

// ── seen-unlocks: 잠금 해제 연출 본 기록 (P5-05, ① 00025) ──────────
async function groupSeenUnlocks(u) {
  const SU = '/rest/v1/user_seen_unlocks';
  await check({
    group: 'seen-unlocks',
    id: 'UL-1',
    role: 'anon',
    op: 'GET /user_seen_unlocks',
    ...READ,
    run: async () => classifyRead(await rest('GET', `${SU}?select=*`)),
  });
  await check({
    group: 'seen-unlocks',
    id: 'UL-2',
    role: 'authenticated',
    op: 'GET /user_seen_unlocks?user_id=eq.<다른 사람> (남의 기록 읽기)',
    ...READ,
    run: async () => classifyRead(await rest('GET', `${SU}?select=*&user_id=eq.${u.bob.id}`, { as: u.alice })),
  });
  await check({
    group: 'seen-unlocks',
    id: 'UL-3',
    role: 'authenticated',
    op: 'POST /user_seen_unlocks {잠긴 스테이지} · DELETE 본인 행 · POST /rpc/record_seen_unlocks (클라이언트 직접 쓰기)',
    ...WRITE,
    run: async () => {
      const ins = await classifyWrite(
        rest('POST', SU, { as: u.alice, body: { user_id: u.alice.id, stage_id: STAGE7 }, prefer: 'return=minimal' }),
        `select exists (select 1 from public.user_seen_unlocks where user_id = '${u.alice.id}' and stage_id = '${STAGE7}')`,
      );
      if (ins.actual === 'written') return ins;
      const del = await classifyWrite(
        rest('DELETE', `${SU}?user_id=eq.${u.alice.id}`, { as: u.alice, prefer: 'return=minimal' }),
        `select not exists (select 1 from public.user_seen_unlocks where user_id = '${u.alice.id}' and stage_id = '${STAGE1}')`,
      );
      if (del.actual === 'written') return del;
      return classifyWrite(
        rest('POST', '/rest/v1/rpc/record_seen_unlocks', {
          as: u.alice,
          body: { p_user_id: u.bob.id, p_stage_ids: [STAGE2] },
        }),
        `select exists (select 1 from public.user_seen_unlocks where user_id = '${u.bob.id}' and stage_id = '${STAGE2}')`,
      );
    },
  });
  await check({
    group: 'seen-unlocks',
    id: 'UL-4',
    role: 'service_role',
    op: 'record_seen_unlocks: 열린 스테이지만 기록 · 없는 id 무시 · 다시 불러도 처음 시각 유지 · 256개 넘으면 PT400 · 탈퇴하면 함께 지워짐',
    ...OK,
    run: async () => {
      const x = await createUser('su4', '해제기록');
      const ghost = 'a1000000-0000-0000-0000-0000000000ff';
      const r1 = await rpc('record_seen_unlocks', { p_user_id: x.id, p_stage_ids: [STAGE1, STAGE2, ghost] });
      const firstAt = one(`select seen_at from public.user_seen_unlocks where user_id = '${x.id}' and stage_id = '${STAGE1}'`);
      // 스테이지 1 을 모두 완료하면 스테이지 2 가 열려 기록됨
      for (const q of stageQuests(STAGE1)) await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
      const r2 = await rpc('record_seen_unlocks', { p_user_id: x.id, p_stage_ids: [STAGE1, STAGE2] });
      const rows = one(`select string_agg(stage_id::text, ',' order by stage_id) || '|' ||
                         bool_and(stage_id <> '${STAGE1}' or seen_at = '${firstAt}')
                         from public.user_seen_unlocks where user_id = '${x.id}'`);
      const big = await rpc('record_seen_unlocks', { p_user_id: x.id, p_stage_ids: Array.from({ length: 257 }, () => STAGE1) });
      one(`delete from public.users where id = '${x.id}'`);
      const left = one(`select count(*) from public.user_seen_unlocks where user_id = '${x.id}'`);
      return (
        compare(
          'UL-4',
          { r1: '200 1', r2: '200 1', rows: `${STAGE1},${STAGE2}|true`, big: 'PT400', left: '0' },
          { r1: `${r1.status} ${r1.json}`, r2: `${r2.status} ${r2.json}`, rows, big: String(errCode(big)), left },
        ) ?? { actual: 'ok', detail: '잠긴 스테이지 2 는 처음에 기록 안 됨 → 해제 뒤 기록, 처음 시각 유지, CASCADE' }
      );
    },
  });
}

// ── quiz: 퀴즈 채점 RPC (P7-02, ① 00026) ───────────────────────
// 시드 퀴즈(P7-12)와 별개로 정답을 아는 점검용 퀴즈를 postgres 로 만들고 끝에 지움 (다른 그룹 점검과 겹치지 않게 맨 뒤에서)
const QZ_MC = 'd7000000-0000-0000-0000-000000000001'; // 스테이지 1, 객관식
const QZ_PARSONS = 'd7000000-0000-0000-0000-000000000002'; // 스테이지 1, 순서 맞추기 (정답 2개)
const QZ_LOCKED = 'd7000000-0000-0000-0000-000000000003'; // 스테이지 2, 객관식
const QZ_RIGHT = 'opt-k7qz';
const QZ_WRONG = ['opt-b2mx', 'opt-c3nw', 'opt-d4py'];
const QZ_EXPLAIN = '정답 해설 qz';

function insertQuizFixtures() {
  const mcPrompt = (title) =>
    JSON.stringify({
      topic: title,
      learning_goals: ['g'],
      story_context: 's',
      fallback_text: 'f',
      quiz: {
        kind: 'multiple_choice',
        question: '?',
        options: [QZ_RIGHT, ...QZ_WRONG].sort().map((id) => ({ id, text: id })),
      },
    });
  const mcKey = JSON.stringify({
    kind: 'multiple_choice',
    accepted: [QZ_RIGHT],
    explanation: QZ_EXPLAIN,
    explanations: Object.fromEntries(QZ_WRONG.map((id) => [id, `${id} 를 고른 해설`])),
  });
  const parsonsPrompt = JSON.stringify({
    topic: 'p',
    learning_goals: ['g'],
    story_context: 's',
    fallback_text: 'f',
    quiz: {
      kind: 'parsons',
      question: '?',
      lines: ['ln-a1x9', 'ln-b2y8', 'ln-c3z7'].map((id) => ({ id, code: id })),
    },
  });
  const parsonsKey = JSON.stringify({
    kind: 'parsons',
    accepted: [
      ['ln-c3z7', 'ln-a1x9', 'ln-b2y8'],
      ['ln-c3z7', 'ln-b2y8', 'ln-a1x9'],
    ],
    explanation: QZ_EXPLAIN,
  });
  one(`insert into public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type,
         quest_type, quiz_kind, is_mobile_friendly, xp_reward) values
       ('${QZ_MC}', '${STAGE1}', 901, 'qz mc', 'qz', ${sqlStr(mcPrompt('qz mc'))}, 'all', 'quiz', 'multiple_choice', true, 0),
       ('${QZ_PARSONS}', '${STAGE1}', 902, 'qz parsons', 'qz', ${sqlStr(parsonsPrompt)}, 'all', 'quiz', 'parsons', true, 0),
       ('${QZ_LOCKED}', '${STAGE2}', 901, 'qz locked', 'qz', ${sqlStr(mcPrompt('qz locked'))}, 'all', 'quiz', 'multiple_choice', true, 0)`);
  one(`insert into public.quest_answer_keys (quest_id, quiz_answer) values
       ('${QZ_MC}', ${sqlStr(mcKey)}), ('${QZ_PARSONS}', ${sqlStr(parsonsKey)}), ('${QZ_LOCKED}', ${sqlStr(mcKey)})`);
}

const quiz = (uid, answer, quest = QZ_MC) =>
  rpc('submit_quiz_answer', { p_user_id: uid, p_quest_id: quest, p_answer: answer });
/** 응답에서 비교할 값만 */
const qv = (r) =>
  r.status === 200
    ? (({ correct, attempt_no, mode, stars, best_stars, xp_awarded, total_xp }) => ({
        correct, attempt_no, mode, stars, best_stars, xp_awarded, total_xp,
      }))(r.json)
    : { status: r.status, error: errMsg(r) };
const quizProgress = (uid, qid = QZ_MC) =>
  JSON.parse(
    one(`select coalesce((select json_build_object('status', status, 'stars', stars, 'best_stars', best_stars,
           'judged_today', stars_judged_on = public.kst_today(), 'earned_xp', earned_xp, 'attempts', attempts)
           from public.user_progress where user_id = '${uid}' and quest_id = '${qid}'), '{}')`),
  );
const quizAttempts = (uid, qid = QZ_MC) =>
  one(`select coalesce(string_agg(mode || attempt_no || (case when is_correct then 'o' else 'x' end), ',' order by created_at), '')
         from public.quiz_attempts where user_id = '${uid}' and quest_id = '${qid}'`);

async function groupQuiz(u) {
  const ready = requirementMet('public.submit_quiz_answer()');
  if (ready) insertQuizFixtures();
  try {
    for (const [id, as] of [['QZ-1', 'anon'], ['QZ-2', u.alice]]) {
      await check({
        group: 'quiz',
        id,
        role: as === 'anon' ? 'anon' : 'authenticated',
        op: 'POST /rpc/submit_quiz_answer {p_user_id: 본인} (클라이언트 직접 채점 = 정답 오라클)',
        deny: ['denied'],
        allow: ['allowed', 'empty'],
        run: async () =>
          classifyRead(
            await rest('POST', '/rest/v1/rpc/submit_quiz_answer', {
              as,
              body: { p_user_id: u.alice.id, p_quest_id: QZ_MC, p_answer: QZ_RIGHT },
            }),
          ),
      });
    }

    await check({
      group: 'quiz',
      id: 'QZ-3',
      role: 'service_role',
      op: '보기 4개를 동시에 제출 → 첫 시도(first 1번)는 하나, 시도 번호 겹침 없음, XP = best_stars × 10',
      ...OK,
      run: async () => {
        const x = await createUser('qz3', '동시퀴즈');
        const rs = await Promise.all([QZ_RIGHT, ...QZ_WRONG].map((a) => quiz(x.id, a)));
        const bad = rs.find((r) => r.status !== 200);
        if (bad) return { actual: 'error', detail: `${bad.status} ${errMsg(bad)}` };
        const rows = quizAttempts(x.id).split(',');
        const firstOnes = rows.filter((r) => r.startsWith('first1')).length;
        const keys = rows.map((r) => r.slice(0, -1));
        const p = quizProgress(x.id);
        return (
          compare(
            '동시',
            { rows: 4, firstOnes: 1, unique: true, attempts: 4, xp: p.best_stars * 10, user_xp: p.best_stars * 10 },
            {
              rows: rows.length,
              firstOnes,
              unique: new Set(keys).size === keys.length,
              attempts: p.attempts,
              xp: p.earned_xp,
              user_xp: userRow(x.id).total_xp,
            },
          ) || { actual: 'ok', detail: rows.join(' ') }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-4',
      role: 'service_role',
      op: '별: 1번째 정답 ⭐3·30 XP, 2번째 ⭐2·20 XP, 3번째 ⭐1·10 XP → completed, best_stars, 레벨 갱신',
      ...OK,
      run: async () => {
        const got = {};
        for (const wrongs of [0, 1, 2]) {
          const x = await createUser(`qz4${wrongs}`, '별계산');
          for (let i = 0; i < wrongs; i++) await quiz(x.id, QZ_WRONG[i]);
          got[wrongs] = { ...qv(await quiz(x.id, QZ_RIGHT)), progress: quizProgress(x.id), xp: userRow(x.id).total_xp };
        }
        const want = (n, stars) => ({
          correct: true, attempt_no: n, mode: 'first', stars, best_stars: stars, xp_awarded: stars * 10, total_xp: stars * 10,
        });
        return (
          compare('1번째', want(1, 3), got[0]) ||
          compare('2번째', want(2, 2), got[1]) ||
          compare('3번째', want(3, 1), got[2]) ||
          compare(
            'progress',
            { p0: { status: 'completed', stars: 3, best_stars: 3, judged_today: true, earned_xp: 30, attempts: 1 }, xp2: 10 },
            { p0: got[0].progress, xp2: got[2].xp },
          ) || { actual: 'ok', detail: '⭐3/30 · ⭐2/20 · ⭐1/10' }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-5',
      role: 'service_role',
      op: '오답 응답에 정답 없음(고른 보기 해설만) · 3번째 오답이면 정답 공개 + ⭐1 클리어',
      ...OK,
      run: async () => {
        const x = await createUser('qz5', '오답');
        const rs = [];
        for (const a of QZ_WRONG) rs.push(await quiz(x.id, a));
        if (rs.some((r) => r.status !== 200)) return { actual: 'error', detail: rs.map((r) => r.status).join(',') };
        const leak = rs
          .slice(0, 2)
          .map((r, i) => [i + 1, JSON.stringify(r.json)])
          .filter(([, s]) => s.includes(QZ_RIGHT) || s.includes(QZ_EXPLAIN));
        if (leak.length) return { actual: 'mismatch', detail: `정답이 오답 응답에: ${leak.map(([n, s]) => `${n}: ${s}`).join(' / ')}` };
        const third = rs[2].json;
        return (
          compare(
            '1·2번째',
            { r1: [false, 1, 0, null, `${QZ_WRONG[0]} 를 고른 해설`], r2: [false, 2, 0, null, `${QZ_WRONG[1]} 를 고른 해설`] },
            {
              r1: [rs[0].json.correct, rs[0].json.attempt_no, rs[0].json.stars, rs[0].json.revealed, rs[0].json.explanation],
              r2: [rs[1].json.correct, rs[1].json.attempt_no, rs[1].json.stars, rs[1].json.revealed, rs[1].json.explanation],
            },
          ) ||
          compare(
            '3번째',
            {
              correct: false, attempt_no: 3, stars: 1, xp_awarded: 10,
              revealed: { answer: QZ_RIGHT, explanation: QZ_EXPLAIN }, explanation: `${QZ_WRONG[2]} 를 고른 해설`,
            },
            third,
          ) ||
          compare('progress', { status: 'completed', best_stars: 1, earned_xp: 10 }, quizProgress(x.id)) || {
            actual: 'ok',
            detail: '오답 2번 정답·정답 해설 없음, 3번째 revealed + ⭐1',
          }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-6',
      role: 'service_role',
      op: '같은 날 다시 풀기 = practice: 별·XP·best_stars 그대로, 시도 번호는 새 회차 1부터, 3번 틀리면 공개만',
      ...OK,
      run: async () => {
        const x = await createUser('qz6', '연습');
        await quiz(x.id, QZ_WRONG[0]);
        await quiz(x.id, QZ_RIGHT); // ⭐2 · 20 XP
        const p1 = qv(await quiz(x.id, QZ_RIGHT));
        const w = [];
        for (const a of QZ_WRONG) w.push(await quiz(x.id, a));
        return (
          compare(
            '연습 정답',
            { correct: true, attempt_no: 1, mode: 'practice', stars: 0, best_stars: 2, xp_awarded: 0, total_xp: 20 },
            p1,
          ) ||
          compare(
            '연습 3번 오답',
            { modes: 'practice,practice,practice', nos: '1,2,3', revealed: [false, false, true], xp: 0, stars: 0 },
            {
              modes: w.map((r) => r.json.mode).join(','),
              nos: w.map((r) => r.json.attempt_no).join(','),
              revealed: w.map((r) => r.json.revealed !== null),
              xp: w.reduce((n, r) => n + r.json.xp_awarded, 0),
              stars: w[2].json.stars,
            },
          ) ||
          compare('progress', { stars: 2, best_stars: 2, earned_xp: 20, attempts: 6 }, quizProgress(x.id)) ||
          compare('시도', { rows: 'first1x,first2o,practice1o,practice1x,practice2x,practice3x' }, { rows: quizAttempts(x.id) }) || {
            actual: 'ok',
            detail: 'practice 별·XP 0, 회차 1부터',
          }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-7',
      role: 'service_role',
      op: '다음 날(KST, 판정일을 하루 앞당김) = review: 오른 별만큼만 XP, 낮게 맞히면 best 유지, 다시 그날은 practice',
      ...OK,
      run: async () => {
        const x = await createUser('qz7', '복습');
        const back = () =>
          one(`update public.user_progress set stars_judged_on = public.kst_today() - 1
                where user_id = '${x.id}' and quest_id = '${QZ_MC}'`);
        await quiz(x.id, QZ_WRONG[0]);
        await quiz(x.id, QZ_RIGHT); // first ⭐2 · 20
        back();
        const rv = await quiz(x.id, QZ_RIGHT); // review ⭐3 · +10
        const after = qv(await quiz(x.id, QZ_RIGHT)); // 같은 날 → practice
        back();
        const w = qv(await quiz(x.id, QZ_WRONG[1])); // review 1번 오답 (판정 없음)
        const low = qv(await quiz(x.id, QZ_RIGHT)); // review 2번째 정답 ⭐2 < best 3
        const tomorrow = one(`select to_char(public.kst_today() + 1, 'YYYY-MM-DD')`);
        return (
          compare(
            'review',
            { correct: true, attempt_no: 1, mode: 'review', stars: 3, best_stars: 3, xp_awarded: 10, total_xp: 30 },
            qv(rv),
          ) ||
          compare('next_review_on', { next_review_on: tomorrow }, rv.json) ||
          compare('같은 날', { mode: 'practice', stars: 0, xp_awarded: 0, total_xp: 30 }, after) ||
          compare('review 오답', { mode: 'review', attempt_no: 1, stars: 0 }, w) ||
          compare('review 낮은 별', { mode: 'review', attempt_no: 2, stars: 2, best_stars: 3, xp_awarded: 0, total_xp: 30 }, low) ||
          compare(
            'progress',
            { stars: 2, best_stars: 3, judged_today: true, earned_xp: 30 },
            quizProgress(x.id),
          ) ||
          compare('users', { total_xp: 30 }, userRow(x.id)) || { actual: 'ok', detail: '⭐2(20) → 복습 ⭐3(+10) → 복습 ⭐2(+0)' }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-8',
      role: 'service_role',
      op: '채점은 accepted 중 하나와 jsonb = (순서 다름·부분집합·상위집합 오답, 두 번째 정답 인정) · 모양 틀림/코드 퀘스트는 400·기록 없음',
      ...OK,
      run: async () => {
        const x = await createUser('qz8', '채점');
        const r = async (a) => (await quiz(x.id, a, QZ_PARSONS)).json?.correct;
        const got = {
          reordered: await r(['ln-a1x9', 'ln-b2y8', 'ln-c3z7']),
          subset: await r(['ln-c3z7', 'ln-a1x9']),
          superset: await r(['ln-c3z7', 'ln-a1x9', 'ln-b2y8', 'ln-c3z7']),
          second: await r(['ln-c3z7', 'ln-b2y8', 'ln-a1x9']),
        };
        const shape = await quiz(x.id, 'ln-a1x9', QZ_PARSONS);
        const code = await quiz(x.id, QZ_RIGHT, Q1);
        return (
          compare('채점', { reordered: false, subset: false, superset: false, second: true }, got) ||
          compare(
            '거부',
            { shape: '400 invalid_arguments', code: '400 not_quiz', rows: 4, q1_rows: '0' },
            {
              shape: `${shape.status} ${errMsg(shape)}`,
              code: `${code.status} ${errMsg(code)}`,
              rows: quizAttempts(x.id, QZ_PARSONS).split(',').length,
              q1_rows: one(`select count(*) from public.quiz_attempts where user_id = '${x.id}' and quest_id = '${Q1}'`),
            },
          ) || { actual: 'ok', detail: '순서·집합이 다르면 오답, 정답 2개 모두 인정' }
        );
      },
    });

    await check({
      group: 'quiz',
      id: 'QZ-9',
      role: 'service_role',
      op: '잠긴 스테이지 퀴즈 403·기록 없음 · 퀴즈는 보너스: 스테이지 1 코드 퀘스트만 끝내면 클리어·스테이지 2 열림',
      ...OK,
      run: async () => {
        const x = await createUser('qz9', '보너스');
        const locked = await quiz(x.id, QZ_RIGHT, QZ_LOCKED);
        const lockedRows = one(`select count(*) from public.quiz_attempts where user_id = '${x.id}'`);
        const codeQuests = stageQuests(STAGE1);
        let last;
        for (const q of codeQuests) {
          last = await rpc('complete_quest', { p_user_id: x.id, p_quest_id: q, p_submission: submission() });
          if (last.status !== 200) return { actual: 'error', detail: `${q}: ${last.status} ${errMsg(last)}` };
        }
        const unlocked = one(`select public.is_stage_unlocked('${x.id}', '${STAGE2}')`);
        const open = await quiz(x.id, QZ_RIGHT, QZ_LOCKED);
        return (
          compare(
            '보너스',
            {
              locked: '403 stage_locked',
              lockedRows: '0',
              stage_cleared: true,
              badges: ['first_code', 'hint_master', 'stage_clear'],
              unlocked: 't',
              open: 200,
            },
            {
              locked: `${locked.status} ${errMsg(locked)}`,
              lockedRows,
              stage_cleared: last.json.stage_cleared !== null,
              badges: userRow(x.id).badges,
              unlocked,
              open: open.status,
            },
          ) || { actual: 'ok', detail: '퀴즈 2개를 안 풀어도 스테이지 1 클리어' }
        );
      },
    });
    await check({
      group: 'quiz',
      id: 'QZ-10',
      role: 'service_role',
      op: 'B50 reset_progress 가 퀴즈 시도 기록도 지움: 뒤 스테이지 리셋은 그대로 · 전체 리셋 → 0 · 다시 first · 그 스테이지 리셋 → 0',
      ...OK,
      run: async () => {
        const x = await createUser('qz10', '퀴즈리셋');
        const reset = (scope, stage = null) =>
          rpc('reset_progress', { p_user_id: x.id, p_scope: scope, p_stage_id: stage });
        const count = () => one(`select count(*) from public.quiz_attempts where user_id = '${x.id}'`);
        const a = await quiz(x.id, QZ_WRONG[0]);
        const r2 = await reset('stage', STAGE2);
        const afterStage2 = count();
        const rAll = await reset('all');
        const afterAll = count();
        const again = await quiz(x.id, QZ_WRONG[0]);
        const r1 = await reset('stage', STAGE1);
        for (const r of [r2, rAll, r1])
          if (r.status !== 200) return { actual: 'error', detail: `${r.status} ${errMsg(r)}` };
        return (
          compare(
            '퀴즈 리셋',
            { first: 'first 1', afterStage2: '1', afterAll: '0', again: 'first 1', afterStage1: '0' },
            {
              first: `${a.json?.mode} ${a.json?.attempt_no}`,
              afterStage2,
              afterAll,
              again: `${again.json?.mode} ${again.json?.attempt_no}`,
              afterStage1: count(),
            },
          ) || { actual: 'ok', detail: '오답 1번 → 스테이지 2 리셋 1행 · 전체 리셋 0행 → 다시 first 1번째 → 스테이지 1 리셋 0행' }
        );
      },
    });
    await check({
      group: 'quiz',
      id: 'CN-9',
      role: 'service_role',
      op: 'submit_quiz_answer 코인 (P8-04): 새로 얻은 별에만 5씩(⭐2 → 10, 복습 ⭐3 → +5) · 연습 0 · 동시 제출 1회 · 리셋 뒤 다시 모아도 0',
      ...OK,
      run: async () => {
        const x = await createUser('cn9', '별코인');
        const c = (r) => `${r.json?.coins_earned}:${r.json?.coins_balance}`;
        const w = await quiz(x.id, QZ_WRONG[0]);
        const first = await quiz(x.id, QZ_RIGHT); // first ⭐2
        const practice = await quiz(x.id, QZ_RIGHT);
        one(`update public.user_progress set stars_judged_on = public.kst_today() - 1
              where user_id = '${x.id}' and quest_id = '${QZ_MC}'`);
        const review = await Promise.all([quiz(x.id, QZ_RIGHT), quiz(x.id, QZ_RIGHT), quiz(x.id, QZ_RIGHT)]);
        await rpc('reset_progress', { p_user_id: x.id, p_scope: 'all' });
        const redo = await quiz(x.id, QZ_RIGHT); // 리셋 뒤 다시 ⭐3: 별 번호 1~3 모두 받은 적 있음
        return (
          compare(
            'CN-9',
            {
              w: '0:0',
              first: '10:10',
              practice: 'practice 0:10',
              review: '5',
              redo: '3 0:15',
              levelUps: '[]',
              ledger: 'star:3',
              mismatches: '0',
            },
            {
              w: c(w),
              first: c(first),
              practice: `${practice.json?.mode} ${c(practice)}`,
              review: String(review.reduce((n, r) => n + (r.json?.coins_earned ?? 99), 0)),
              redo: `${redo.json?.stars} ${c(redo)}`,
              levelUps: JSON.stringify(redo.json?.level_ups),
              ledger: one(`select string_agg(source || ':' || n, ',') from (select source, count(*) n from public.coin_ledger
                            where user_id = '${x.id}' group by source) t`),
              mismatches: mismatches(x.id),
            },
          ) || { actual: 'ok', detail: '⭐2 = 10 → 연습 0 → 복습 ⭐3 동시 3번 중 +5 한 번 → 리셋 뒤 ⭐3 = 0' }
        );
      },
    });
  } finally {
    if (ready) one(`delete from public.quests where id in ('${QZ_MC}', '${QZ_PARSONS}', '${QZ_LOCKED}')`);
  }
}

// ── ratelimit: 사용자별 요청 한도 (P1-19, 00016) ───────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function groupRateLimit(u) {
  // 클라이언트가 카운터를 지우거나 0 으로 만들면 한도가 풀리고, RPC 를 직접 부르면 다른 아이의 한도를 다 써 버릴 수 있음
  one(`insert into public.api_rate_limits (user_id, bucket, minute_start, minute_count, day, day_count)
       values ('${u.alice.id}', 'tutor:hint_generator', date_trunc('minute', now()), 6, public.kst_today(), 60)
       on conflict (user_id, bucket) do update set minute_count = 6, day_count = 60`);
  await check({
    group: 'ratelimit',
    id: 'RL-1',
    role: 'anon',
    op: 'GET /api_rate_limits',
    ...READ,
    run: async () => classifyRead(await rest('GET', '/rest/v1/api_rate_limits?select=*')),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-2',
    role: 'authenticated',
    op: 'GET /api_rate_limits?user_id=eq.<본인> (언제 튜터를 썼는지)',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', `/rest/v1/api_rate_limits?select=*&user_id=eq.${u.alice.id}`, { as: u.alice })),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-3',
    role: 'authenticated',
    op: 'PATCH /api_rate_limits {day_count: 0} (본인 한도 되돌리기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/api_rate_limits?user_id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { minute_count: 0, day_count: 0 },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.api_rate_limits where user_id = '${u.alice.id}' and bucket = 'tutor:hint_generator' and day_count = 0)`,
      ),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-4',
    role: 'authenticated',
    op: 'DELETE /api_rate_limits?user_id=eq.<본인> (카운터 지우기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/api_rate_limits?user_id=eq.${u.alice.id}`, { as: u.alice, prefer: 'return=minimal' }),
        `select not exists (select 1 from public.api_rate_limits where user_id = '${u.alice.id}' and bucket = 'tutor:hint_generator')`,
      ),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-5',
    role: 'authenticated',
    op: 'POST /rpc/consume_rate_limit {p_user_id: 다른 사람} (남의 한도 소진·우회)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/rpc/consume_rate_limit', {
          as: u.alice,
          body: { p_user_id: u.bob.id, p_bucket: 'tutor:quest_intro', p_per_minute: 1000, p_per_day: 1000 },
        }),
        `select exists (select 1 from public.api_rate_limits where user_id = '${u.bob.id}' and bucket = 'tutor:quest_intro')`,
      ),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-5b',
    role: 'anon',
    op: 'POST /rpc/consume_rate_limit (비로그인)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/rpc/consume_rate_limit', {
          body: { p_user_id: u.bob.id, p_bucket: 'tutor:stage_summary', p_per_minute: 1000, p_per_day: 1000 },
        }),
        `select exists (select 1 from public.api_rate_limits where user_id = '${u.bob.id}' and bucket = 'tutor:stage_summary')`,
      ),
  });

  // 경합: 서로 다른 PostgREST 요청(트랜잭션) 20개가 동시에 와도 한도만큼만 허용 (행 잠금)
  await check({
    group: 'ratelimit',
    id: 'RL-6',
    role: 'service_role',
    op: '한도 분당 5 에 동시 20회 → 정확히 5회 허용 · 15회 거부(retry_after 1~60) · 카운트 5, 하루 한도 3 에 동시 10회 → 3회',
    ...OK,
    run: async () => {
      const x = await createUser('rl6', '동시한도');
      // 분 창 경계에 걸리면 두 창으로 나뉘므로 경계 직전이면 다음 분까지 기다림
      const sec = new Date().getUTCSeconds();
      if (sec >= 55) await sleep((61 - sec) * 1000);
      const burst = (bucket, n, perMinute, perDay) =>
        Promise.all(
          Array.from({ length: n }, () =>
            rpc('consume_rate_limit', { p_user_id: x.id, p_bucket: bucket, p_per_minute: perMinute, p_per_day: perDay }),
          ),
        );
      const rs = await burst('test:minute', 20, 5, 1000);
      const bad = rs.find((r) => r.status !== 200);
      if (bad) return { actual: 'error', detail: `${bad.status} ${errMsg(bad)}` };
      const allowed = rs.filter((r) => r.json.allowed === true);
      const denied = rs.filter((r) => r.json.allowed === false);
      const retries = denied.map((r) => r.json.retry_after);
      const row = one(
        `select minute_count || ',' || minute_denied || ',' || day_count from public.api_rate_limits where user_id = '${x.id}' and bucket = 'test:minute'`,
      );
      const ds = await burst('test:day', 10, 1000, 3);
      const dayAllowed = ds.filter((r) => r.json.allowed === true).length;
      const dayScope = [...new Set(ds.filter((r) => !r.json.allowed).map((r) => r.json.scope))].join(',');
      return (
        compare(
          '분 한도',
          { allowed: 5, denied: 15, scope: 'minute', row: '5,15,5', retry_ok: true },
          {
            allowed: allowed.length,
            denied: denied.length,
            scope: [...new Set(denied.map((r) => r.json.scope))].join(','),
            row,
            retry_ok: retries.every((n) => n >= 1 && n <= 60),
          },
        ) ||
        compare('하루 한도', { allowed: 3, scope: 'day' }, { allowed: dayAllowed, scope: dayScope }) || {
          actual: 'ok',
          detail: `분: 20회 중 5 허용(남은 수 ${allowed.map((r) => r.json.remaining).sort().join('·')}), 하루: 10회 중 3 허용`,
        }
      );
    },
  });

  // 규칙: 창 경과 후 재허용, 하루 창(KST 자정), 버킷 독립, 인자 검증, 기회적 정리, 탈퇴 cascade
  const stale = await createUser('rl7', '오래된행');
  await check({
    group: 'ratelimit',
    id: 'RL-7',
    role: 'service_role',
    op: 'consume_rate_limit 규칙: 분 창이 지나면 다시 허용·하루 한도는 KST 자정까지(scope day)·어제 창은 초기화·버킷 독립·창을 되돌리지 않음·잘못된 인자 PT400·그날 첫 요청이 2일 넘은 행 정리·탈퇴 cascade',
    ...OK,
    run: () =>
      sqlCheck(`
        SET LOCAL ROLE service_role;
        DO $$
        DECLARE
          v_user UUID := '${u.carol.id}';
          v_other UUID := '${stale.id}';
          r JSONB;
          v_midnight INTEGER;
        BEGIN
          DELETE FROM public.api_rate_limits WHERE user_id IN (v_user, v_other);
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          IF NOT (r->>'allowed')::boolean OR (r->>'remaining')::int <> 1 THEN RAISE EXCEPTION '첫 요청: %', r; END IF;
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          IF NOT (r->>'allowed')::boolean OR (r->>'remaining')::int <> 0 THEN RAISE EXCEPTION '두 번째: %', r; END IF;
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          IF (r->>'allowed')::boolean OR r->>'scope' <> 'minute' OR (r->>'retry_after')::int NOT BETWEEN 1 AND 60
             OR (r->>'denied_minute')::int <> 1 THEN
            RAISE EXCEPTION '분 한도: %', r;
          END IF;
          -- 다른 버킷은 따로 셈
          r := public.consume_rate_limit(v_user, 'tutor:quest_intro', 2, 3);
          IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION '버킷 독립: %', r; END IF;

          -- 분 창이 지남 (시간을 되돌려 흉내) → 다시 허용, 분 거부 수 초기화
          UPDATE public.api_rate_limits SET minute_start = minute_start - interval '1 minute'
           WHERE user_id = v_user AND bucket = 'tutor:hint_generator';
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          IF NOT (r->>'allowed')::boolean OR (r->>'denied_minute')::int <> 0 OR (r->>'denied_today')::int <> 1 THEN
            RAISE EXCEPTION '분 창 경과: %', r;
          END IF;

          -- 하루 3번 다 씀 → 분 창이 지나도 거부, 다음 KST 자정까지
          UPDATE public.api_rate_limits SET minute_start = minute_start - interval '1 minute'
           WHERE user_id = v_user AND bucket = 'tutor:hint_generator';
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          v_midnight := ceil(extract(epoch FROM ((public.kst_today() + 1)::timestamp AT TIME ZONE 'Asia/Seoul') - clock_timestamp()));
          IF (r->>'allowed')::boolean OR r->>'scope' <> 'day' OR abs((r->>'retry_after')::int - v_midnight) > 2 THEN
            RAISE EXCEPTION '하루 한도: % (자정까지 %초)', r, v_midnight;
          END IF;

          -- 어제 창 → 오늘은 처음부터
          UPDATE public.api_rate_limits SET day = day - 1 WHERE user_id = v_user AND bucket = 'tutor:hint_generator';
          r := public.consume_rate_limit(v_user, 'tutor:hint_generator', 2, 3);
          IF NOT (r->>'allowed')::boolean OR (r->>'denied_today')::int <> 0 THEN RAISE EXCEPTION '하루 창 경과: %', r; END IF;

          -- 늦게 온 요청이 창을 되돌리지 않음 (미래 창이 저장돼 있으면 그대로 셈)
          UPDATE public.api_rate_limits SET minute_start = date_trunc('minute', clock_timestamp()) + interval '5 minutes', minute_count = 2
           WHERE user_id = v_user AND bucket = 'tutor:quest_intro';
          r := public.consume_rate_limit(v_user, 'tutor:quest_intro', 2, 100);
          IF (r->>'allowed')::boolean THEN RAISE EXCEPTION '창을 되돌림: %', r; END IF;

          -- 인자 검증
          BEGIN
            PERFORM public.consume_rate_limit(v_user, 'Bad Bucket!', 1, 1);
            RAISE EXCEPTION '잘못된 버킷을 받음';
          EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL;
          END;
          BEGIN
            PERFORM public.consume_rate_limit(v_user, 'tutor:hint_generator', 0, 1);
            RAISE EXCEPTION '한도 0 을 받음';
          EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL;
          END;

          -- 정리: 3일 전에 마지막으로 쓴 행(다른 사용자)은 누군가의 그날 첫 요청 때 지워짐. 1일 전 행은 남음
          INSERT INTO public.api_rate_limits (user_id, bucket, minute_start, day, updated_at) VALUES
            (v_other, 'tutor:old', now() - interval '3 days', public.kst_today() - 3, now() - interval '3 days'),
            (v_other, 'tutor:recent', now() - interval '1 day', public.kst_today() - 1, now() - interval '1 day');
          r := public.consume_rate_limit(v_user, 'tutor:encouragement', 5, 5);   -- 이 버킷의 첫 요청 = 새 하루
          IF EXISTS (SELECT 1 FROM public.api_rate_limits WHERE user_id = v_other AND bucket = 'tutor:old') THEN
            RAISE EXCEPTION '오래된 행을 정리하지 않음';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM public.api_rate_limits WHERE user_id = v_other AND bucket = 'tutor:recent') THEN
            RAISE EXCEPTION '최근 행을 지움';
          END IF;
        END $$;
        RESET ROLE;
        -- 탈퇴하면 카운터도 지워짐 (auth.users → users → api_rate_limits ON DELETE CASCADE)
        DO $$
        BEGIN
          DELETE FROM auth.users WHERE id = '${stale.id}';
          IF EXISTS (SELECT 1 FROM public.api_rate_limits WHERE user_id = '${stale.id}') THEN
            RAISE EXCEPTION '탈퇴한 사용자의 카운터가 남음';
          END IF;
        END $$;`),
  });
  await check({
    group: 'ratelimit',
    id: 'RL-8',
    role: 'postgres',
    op: '00016 객체 중 anon/authenticated 가 접근할 수 있는 것 (테이블 권한·함수 EXECUTE·정책)',
    ...NONE,
    run: () => {
      const v = one(`select concat_ws(',',
          case when has_table_privilege('anon', 'public.api_rate_limits', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then 'anon:table' end,
          case when has_table_privilege('authenticated', 'public.api_rate_limits', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then 'authenticated:table' end,
          case when has_function_privilege('anon', 'public.consume_rate_limit(uuid, text, integer, integer)', 'EXECUTE') then 'anon:execute' end,
          case when has_function_privilege('authenticated', 'public.consume_rate_limit(uuid, text, integer, integer)', 'EXECUTE') then 'authenticated:execute' end,
          (select string_agg('policy:' || policyname, ',') from pg_policies where schemaname = 'public' and tablename = 'api_rate_limits'))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
}

// ── analytics: 익명 분석 이벤트 (P1-17, 00017) ─────────────────
// 클라이언트가 직접 쓰면 퍼널·완료 지표를 부풀리거나 지울 수 있고, 읽으면 다른 아이의 이용 기록을 볼 수 있음
const AN_SID = 'AnSidAnSidAnSidAnSid00';
async function groupAnalytics(u) {
  const ready = requirementMet('public.analytics_events');
  if (ready)
    one(`insert into public.analytics_events (name, actor, anon_id, source, props, device, path)
         values ('landing_view', 'visitor', '${AN_SID}', 'client', '{}', 'mobile', '/')`);
  const exists = (where) =>
    `select exists (select 1 from public.analytics_events where ${where})`;
  const gone = (where) =>
    `select not exists (select 1 from public.analytics_events where ${where})`;
  await check({
    group: 'analytics',
    id: 'AN-1',
    role: 'anon',
    op: 'GET /analytics_events',
    ...READ,
    run: async () => classifyRead(await rest('GET', '/rest/v1/analytics_events?select=*')),
  });
  await check({
    group: 'analytics',
    id: 'AN-2',
    role: 'authenticated',
    op: 'GET /analytics_events (다른 아이의 이용 기록)',
    ...READ,
    run: async () =>
      classifyRead(await rest('GET', '/rest/v1/analytics_events?select=*', { as: u.alice })),
  });
  await check({
    group: 'analytics',
    id: 'AN-3',
    role: 'anon',
    op: 'POST /analytics_events (지표 부풀리기: 가짜 로그인 성공)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/analytics_events', {
          body: { name: 'login_success', actor: 'user', anon_id: 'FakeFakeFakeFakeFake01', source: 'server', props: {} },
          prefer: 'return=minimal',
        }),
        exists(`anon_id = 'FakeFakeFakeFakeFake01'`),
      ),
  });
  await check({
    group: 'analytics',
    id: 'AN-4',
    role: 'authenticated',
    op: 'POST /analytics_events (가짜 퀘스트 완료)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/analytics_events', {
          as: u.alice,
          body: { name: 'quest_complete', actor: 'user', anon_id: 'FakeFakeFakeFakeFake02', source: 'server', props: {} },
          prefer: 'return=minimal',
        }),
        exists(`anon_id = 'FakeFakeFakeFakeFake02'`),
      ),
  });
  await check({
    group: 'analytics',
    id: 'AN-5',
    role: 'authenticated',
    op: 'DELETE /analytics_events (기록 지우기)',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/analytics_events?anon_id=eq.${AN_SID}`, { as: u.alice, prefer: 'return=minimal' }),
        gone(`anon_id = '${AN_SID}'`),
      ),
  });
  await check({
    group: 'analytics',
    id: 'AN-6',
    role: 'authenticated',
    op: 'POST /rpc/prune_analytics_events · /rpc/consume_global_rate_limit (기록 지우기·비로그인 한도 소진)',
    ...WRITE,
    run: async () => {
      one(`update public.analytics_events set occurred_at = now() - interval '2 days' where anon_id = '${AN_SID}'`);
      const tries = {
        prune: await classifyWrite(
          rest('POST', '/rest/v1/rpc/prune_analytics_events', {
            as: u.alice,
            body: { p_retention: '1 day', p_limit: 100 },
          }),
          gone(`anon_id = '${AN_SID}'`),
        ),
        'anon prune': await classifyWrite(
          rest('POST', '/rest/v1/rpc/prune_analytics_events', { body: { p_retention: '1 day', p_limit: 100 } }),
          gone(`anon_id = '${AN_SID}'`),
        ),
        consume: await classifyWrite(
          rest('POST', '/rest/v1/rpc/consume_global_rate_limit', {
            as: u.alice,
            body: { p_bucket: 'analytics:visitor', p_per_minute: 1000, p_per_day: 1000 },
          }),
          `select exists (select 1 from public.api_global_rate_limits where bucket = 'analytics:visitor')`,
        ),
      };
      const outs = Object.values(tries).map((t) => t.actual);
      const detail = Object.entries(tries).map(([k, t]) => `${k}: ${t.detail}`).join(' · ');
      if (outs.includes('written')) return { actual: 'written', detail };
      return { actual: outs.every((a) => WRITE.deny.includes(a)) ? 'denied' : 'error', detail };
    },
  });

  // 서버 경로 (service_role): /api/analytics·서버 이벤트가 쓰는 upsert(ON CONFLICT DO NOTHING), CHECK, UPDATE 불가, 보존 정리, 전역 한도
  await check({
    group: 'analytics',
    id: 'AN-7',
    role: 'service_role',
    op: 'upsert 로 "처음 한 번" dedupe · CHECK(이름·익명 ID·경로 쿼리·props 512B·기기) 거부 · service_role 도 UPDATE 불가 · 180일 지난 행만 정리 · 인자 검증 · 전역 한도 정확',
    ...OK,
    run: async () => {
      const row = { name: 'quest_start', actor: 'user', anon_id: 'An7An7An7An7An7An7An7A', source: 'server', props: { quest_id: Q1 }, device: 'desktop', path: '/quest/[id]', dedupe_key: `quest_start:${Q1}` };
      const up = () =>
        rest('POST', '/rest/v1/analytics_events?on_conflict=anon_id,dedupe_key', {
          as: 'service',
          body: [row],
          prefer: 'resolution=ignore-duplicates,return=minimal',
        });
      const r1 = await up();
      const r2 = await up();
      const n = one(`select count(*) from public.analytics_events where anon_id = '${row.anon_id}'`);
      one(`delete from public.analytics_events where anon_id = '${row.anon_id}'`);
      const dedupe = compare('dedupe', { s1: 201, s2: 201, rows: '1' }, { s1: r1.status, s2: r2.status, rows: n });
      if (dedupe) return dedupe;
      return sqlCheck(`
        SET LOCAL ROLE service_role;
        DO $$
        DECLARE
          v_n INTEGER;
          r JSONB;
        BEGIN
          -- CHECK
          BEGIN
            INSERT INTO public.analytics_events (name, actor, anon_id, source) VALUES ('Login Success!', 'user', 'An7An7An7An7An7An7An7B', 'server');
            RAISE EXCEPTION '이름 형식을 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          BEGIN
            INSERT INTO public.analytics_events (name, actor, anon_id, source) VALUES ('quest_start', 'user', '11111111-1111-1111-1111-111111111111', 'server');
            RAISE EXCEPTION 'user id 모양 익명 ID 를 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          BEGIN
            INSERT INTO public.analytics_events (name, actor, anon_id, source, path) VALUES ('landing_view', 'visitor', 'An7An7An7An7An7An7An7B', 'client', '/?utm_source=x');
            RAISE EXCEPTION '쿼리가 있는 경로를 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          BEGIN
            INSERT INTO public.analytics_events (name, actor, anon_id, source, props) VALUES ('landing_view', 'visitor', 'An7An7An7An7An7An7An7B', 'client', jsonb_build_object('x', repeat('a', 600)));
            RAISE EXCEPTION '큰 props 를 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          BEGIN
            INSERT INTO public.analytics_events (name, actor, anon_id, source, device) VALUES ('landing_view', 'visitor', 'An7An7An7An7An7An7An7B', 'client', 'Mozilla/5.0 (iPhone)');
            RAISE EXCEPTION 'UA 원문을 받음';
          EXCEPTION WHEN check_violation THEN NULL;
          END;
          -- 기록은 고칠 수 없음
          BEGIN
            UPDATE public.analytics_events SET name = 'quest_complete' WHERE anon_id = '${AN_SID}';
            RAISE EXCEPTION 'service_role 이 UPDATE 함';
          EXCEPTION WHEN insufficient_privilege THEN NULL;
          END;
          -- 보존 정리: 181일 전 2행은 지우고 179일 전 1행은 남김. 한 번에 p_limit 행까지
          INSERT INTO public.analytics_events (occurred_at, name, actor, anon_id, source) VALUES
            (now() - interval '181 days', 'landing_view', 'visitor', 'An7OldAn7OldAn7OldAn7A', 'client'),
            (now() - interval '182 days', 'landing_view', 'visitor', 'An7OldAn7OldAn7OldAn7B', 'client'),
            (now() - interval '179 days', 'landing_view', 'visitor', 'An7NewAn7NewAn7NewAn7A', 'client');
          v_n := public.prune_analytics_events(interval '180 days', 1);
          IF v_n <> 1 OR NOT EXISTS (SELECT 1 FROM public.analytics_events WHERE anon_id = 'An7OldAn7OldAn7OldAn7A') THEN
            RAISE EXCEPTION '가장 오래된 것부터 1행: %', v_n;
          END IF;
          v_n := public.prune_analytics_events();
          IF v_n < 1 OR EXISTS (SELECT 1 FROM public.analytics_events WHERE anon_id LIKE 'An7Old%')
             OR NOT EXISTS (SELECT 1 FROM public.analytics_events WHERE anon_id = 'An7NewAn7NewAn7NewAn7A') THEN
            RAISE EXCEPTION '180일 정리: %', v_n;
          END IF;
          BEGIN
            PERFORM public.prune_analytics_events(interval '1 hour', 10);
            RAISE EXCEPTION '1일 미만 보존을 받음';
          EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL;
          END;
          -- 전역 한도: 분당 2·하루 3
          DELETE FROM public.api_global_rate_limits WHERE bucket = 'test:an7';
          r := public.consume_global_rate_limit('test:an7', 2, 3);
          IF NOT (r->>'allowed')::boolean OR (r->>'remaining')::int <> 1 THEN RAISE EXCEPTION '첫 요청: %', r; END IF;
          r := public.consume_global_rate_limit('test:an7', 2, 3);
          r := public.consume_global_rate_limit('test:an7', 2, 3);
          IF (r->>'allowed')::boolean OR r->>'scope' <> 'minute' OR (r->>'retry_after')::int NOT BETWEEN 1 AND 60 THEN
            RAISE EXCEPTION '분 한도: %', r;
          END IF;
          UPDATE public.api_global_rate_limits SET minute_start = minute_start - interval '1 minute' WHERE bucket = 'test:an7';
          r := public.consume_global_rate_limit('test:an7', 2, 3);
          IF NOT (r->>'allowed')::boolean THEN RAISE EXCEPTION '분 창 경과: %', r; END IF;
          UPDATE public.api_global_rate_limits SET minute_start = minute_start - interval '1 minute' WHERE bucket = 'test:an7';
          r := public.consume_global_rate_limit('test:an7', 2, 3);
          IF (r->>'allowed')::boolean OR r->>'scope' <> 'day' THEN RAISE EXCEPTION '하루 한도: %', r; END IF;
          BEGIN
            PERFORM public.consume_global_rate_limit('Bad Bucket', 1, 1);
            RAISE EXCEPTION '잘못된 버킷을 받음';
          EXCEPTION WHEN SQLSTATE 'PT400' THEN NULL;
          END;
        END $$;
        RESET ROLE;`);
    },
  });
  await check({
    group: 'analytics',
    id: 'AN-8',
    role: 'postgres',
    op: '00017 객체 중 anon/authenticated 가 접근할 수 있는 것 (테이블 권한·함수 EXECUTE·정책)',
    ...NONE,
    run: () => {
      const v = one(`select concat_ws(',',
          (select string_agg(r || ':' || t, ',') from unnest(array['anon', 'authenticated']) r,
              unnest(array['public.analytics_events', 'public.api_global_rate_limits']) t
            where has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')),
          (select string_agg(r || ':' || f, ',') from unnest(array['anon', 'authenticated']) r,
              unnest(array['public.prune_analytics_events(interval, integer)', 'public.consume_global_rate_limit(text, integer, integer)']) f
            where has_function_privilege(r, f, 'EXECUTE')),
          (select string_agg('policy:' || policyname, ',') from pg_policies
            where schemaname = 'public' and tablename in ('analytics_events', 'api_global_rate_limits')))`);
      return { actual: v || 'none', detail: v || '(없음)' };
    },
  });
  if (ready) {
    one(`delete from public.analytics_events where anon_id = '${AN_SID}'`);
    one(`delete from public.api_global_rate_limits where bucket = 'analytics:visitor'`);
  }
}

// ── 실행 ──────────────────────────────────────────────────
async function main() {
  console.log(`[${scenario}] ${S.label}`);
  const u = {};
  u.alice = await createUser('alice', '김앨리스', { signIn: true });
  u.bob = await createUser('bob', '박밥');
  u.carol = await createUser('carol', '최캐롤');
  u.dan = await createUser('dan', '정단');
  // 픽스처 (postgres 로 직접 생성 → 권한과 무관하게 같은 출발점)
  u.postId = one(
    `insert into public.board_posts (user_id, title, content) values ('${u.bob.id}', 'rls post', 'x') returning id`,
  );
  u.aliceCommentId = one(
    `insert into public.board_comments (post_id, user_id, content) values ('${u.postId}', '${u.alice.id}', 'rls comment') returning id`,
  );
  // 게시판 안전장치 픽스처 (P1-18): alice 글, 숨긴 글(bob·alice), 신고 대상 글·댓글(bob)
  u.alicePostId = one(
    `insert into public.board_posts (user_id, title, content) values ('${u.alice.id}', 'alice post', 'x') returning id`,
  );
  u.hiddenBobPostId = one(
    `insert into public.board_posts (user_id, title, content, is_hidden, hidden_at) values ('${u.bob.id}', 'hidden bob', 'x', true, now()) returning id`,
  );
  one(
    `insert into public.board_comments (post_id, user_id, content) values ('${u.hiddenBobPostId}', '${u.alice.id}', 'on hidden post')`,
  );
  u.hiddenAlicePostId = one(
    `insert into public.board_posts (user_id, title, content, is_hidden, hidden_at) values ('${u.alice.id}', 'hidden alice', 'x', true, now()) returning id`,
  );
  u.reportPostId = one(
    `insert into public.board_posts (user_id, title, content) values ('${u.bob.id}', 'report me', 'x') returning id`,
  );
  u.reportCommentId = one(
    `insert into public.board_comments (post_id, user_id, content) values ('${u.reportPostId}', '${u.bob.id}', 'report me too') returning id`,
  );
  one(`insert into public.user_progress (user_id, quest_id, status, hints_used, used_golden_key, code_submitted) values
        ('${u.alice.id}', '${Q1}', 'in_progress', 2, true, ''),
        ('${u.alice.id}', '${Q2}', 'in_progress', 0, false, ''),
        ('${u.bob.id}', '${Q1}', 'in_progress', 0, false, '')`);
  one(
    `insert into public.user_badges (user_id, badge_type) values ('${u.alice.id}', 'first_code')`,
  );
  if (requirementMet('public.user_api_keys'))
    one(`insert into public.user_api_keys (user_id, provider, key_version, iv, auth_tag, ciphertext) values
          ('${u.alice.id}', 'openai', 1, 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 'YWxpY2U='),
          ('${u.bob.id}', 'openai', 1, 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 'Ym9i')`);

  // 해제 연출 본 기록 (P5-05, ① 00025): 앨리스·밥 모두 첫 스테이지를 봄 → 본인 행만 보여야 함 (UL-2, APP-16)
  if (requirementMet('public.user_seen_unlocks'))
    one(`insert into public.user_seen_unlocks (user_id, stage_id) values
          ('${u.alice.id}', '${STAGE1}'), ('${u.bob.id}', '${STAGE1}') on conflict do nothing`);

  await groupEnv();
  await groupView(u);
  await groupNotice(u);
  await groupWrite(u);
  await groupAnswer(u);
  await groupApiKeys(u);
  await groupRpc(u);
  await groupReward();
  await groupCoins(u);
  await groupMissions(u);
  await groupAttendance(u);
  await groupAchievements(u);
  await groupSchema(u);
  await groupAuthTriggers(u);
  await groupBoard(u);
  await groupRateLimit(u);
  await groupOnboarding(u);
  await groupConsent(u);
  await groupSeenUnlocks(u);
  await groupQuiz(u);
  await groupAnalytics(u);
  await groupAccount(u);
  await groupApp(u);
  await groupStatic();

  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(
    `\n[${scenario}] PASS ${count('PASS')} · GAP ${count('GAP')} · PENDING ${count('PENDING')} · INFO ${count('INFO')} · FAIL ${count('FAIL')} (총 ${results.length})`,
  );
  if (RESULTS)
    appendFileSync(
      RESULTS,
      results.map((r) => JSON.stringify(r)).join('\n') + '\n',
    );
  process.exit(count('FAIL') ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(3);
});
