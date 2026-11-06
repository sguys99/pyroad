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
    op: 'GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐',
    ...READ,
    run: async () => {
      const r = await rest('GET', '/rest/v1/user_profiles_public?select=*', {
        as: u.alice,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const keys = Object.keys(r.json[0]).sort().join(',');
      return keys === 'avatar_url,display_name,id'
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
      op: '새 DB (마이그레이션 → seed) 에서 solution_code 가 있는 퀘스트 수',
      deny: ['present'],
      allow: ['missing'],
      run: () => {
        const n = solutionCount();
        const total = one('select count(*) from public.quests');
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
  //   코드·프로젝트 퀘스트 기준. 퀴즈(P7-01)가 생기면 quiz_answer 기준을 더할 것
  await check({
    group: 'answer',
    id: 'AK-17',
    role: 'postgres',
    op: 'quest_answer_keys 데이터: 퀘스트마다 expected_output·hints·정답 코드(또는 모든 단계 정답 코드), quests 에 남은 정답 0',
    deny: ['separated'],
    allow: ['left-in-quests', 'missing'],
    run: () => {
      const [total, eo, hints, sol, stepSol, left] = one(
        `select (select count(*) from public.quests),
                count(*) filter (where k.expected_output <> ''),
                count(*) filter (where k.hints <> '{}'::jsonb),
                count(*) filter (where k.solution_code is not null
                  or (jsonb_typeof(q.prompt_skeleton->'steps') = 'array'
                      and jsonb_array_length(q.prompt_skeleton->'steps') > 0
                      and (select count(*) from jsonb_array_elements(k.steps) s where s ? 'solution_code')
                          = jsonb_array_length(q.prompt_skeleton->'steps'))),
                (select count(*) from public.quest_answer_keys k2, jsonb_array_elements(k2.steps) s where s ? 'solution_code'),
                (select count(*) from public.quests
                  where expected_output <> '' or prompt_skeleton ?| array['hints', 'solution_code']
                     or jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))'))
           from public.quests q join public.quest_answer_keys k on k.quest_id = q.id`,
      )
        .split('|')
        .map(Number);
      const detail = `퀘스트 ${total} · expected_output ${eo} · hints ${hints} · 정답 코드 ${sol} (단계 정답 ${stepSol}) · quests 에 남은 정답 ${left}`;
      if (left > 0) return { actual: 'left-in-quests', detail };
      const complete = total > 0 && eo === total && hints === total && sol === total;
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
                           'user_progress_protect_earned_xp', 'record_hint', 'user_progress_lock_keys')
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
const rpc = (fn, body) =>
  rest('POST', `/rest/v1/rpc/${fn}`, { as: 'service', body });
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
         'badges', coalesce((select json_agg(badge_type order by badge_type) from public.user_badges where user_id = u.id), '[]'),
         'badge_rows', (select count(*) from public.user_badges where user_id = u.id))
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
const stageQuests = (stageId) =>
  one(
    `select string_agg(id::text, ',' order by "order") from public.quests where stage_id = '${stageId}'`,
  ).split(',');

async function groupReward() {
  const rules = JSON.parse(
    readFileSync(join(HERE, 'fixtures', 'reward-rules.json'), 'utf8'),
  );
  const tsArr = (xs) =>
    `array[${xs.map((x) => (x === null ? 'null' : sqlStr(x))).join(',')}]::timestamptz[]`;
  const txtArr = (xs) =>
    `array[${xs.map(sqlStr).join(',')}]::text[]`;

  await check({
    group: 'reward',
    id: 'RW-1',
    role: 'postgres',
    op: 'reward-rules.json 대조표 = SQL 규칙 함수 (quest_xp·level_for_xp·has_three_day_streak·decide_new_badges)',
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
        ...rules.streak.map((c) => [
          `streak ${c.name}`,
          `public.has_three_day_streak(${tsArr(c.completed_at)})::text`,
          String(c.streak),
        ]),
        ...rules.badges.map((c) => {
          const f = c.facts;
          return [
            `badges ${c.name}`,
            `array_to_json(public.decide_new_badges(${txtArr(f.earned)}, ${f.completedCount}, ${f.stageCleared}, ${f.isFinalStage}, ${f.hintsUsed}, ${f.usedGoldenKey}, ${f.streak3}))::text`,
            JSON.stringify(c.badges),
          ];
        }),
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
          { stage_id: STAGE1, order: 1, concepts: qs.length },
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
    op: 'B12 스테이지 리셋: earned_xp 합으로 재계산(황금키 0 XP 과다 차감 없음), stage_clear 는 조건부 삭제',
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
        compare('스테이지 1 리셋', { total_xp: 0, level: 1, badges: ['first_code', 'hint_master'] }, after1) ||
        compare('스테이지 1 리셋 응답', { removed_badges: ['stage_clear'] }, r1.json) || {
          actual: 'ok',
          detail: `스테이지 2 리셋 → total_xp ${before.total_xp} → ${stage1Xp}, stage_clear 유지 / 스테이지 1 리셋 → 0, stage_clear 삭제`,
        }
      );
    },
  });

  await check({
    group: 'reward',
    id: 'RW-8',
    role: 'service_role',
    op: 'B12 전체 리셋: 진행·뱃지 삭제, XP 0, 황금키 3 복구',
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
        compare('users', { total_xp: 0, level: 1, golden_keys: 3, badge_rows: 0 }, userRow(x.id)) ||
        compare(
          'progress',
          { rows: '0' },
          { rows: one(`select count(*) from public.user_progress where user_id = '${x.id}'`) },
        ) || { actual: 'ok', detail: '황금키 2 → 3, XP·뱃지·진행 0' }
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
      'world/page.tsx users',
      `/rest/v1/users?select=id,display_name,avatar_url,total_xp,current_level&id=eq.${u.alice.id}`,
    ],
    [
      'APP-5',
      'world·profile user_badges',
      `/rest/v1/user_badges?select=badge_type,earned_at&user_id=eq.${u.alice.id}`,
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
      'checkBadges.ts quests',
      `/rest/v1/quests?select=stage_id&id=eq.${Q1}`,
    ],
    [
      'APP-10',
      'checkBadges.ts quests',
      `/rest/v1/quests?select=id&stage_id=eq.${STAGE1}`,
    ],
    [
      'APP-11',
      'checkBadges.ts quests',
      `/rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.${Q1}`,
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
    op: 'board/page.tsx → GET /board_posts?select=*,user_profiles_public!…(display_name),board_comments(count) + count=exact (작성자 = 모험가NNNN, P1-18)',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        '/rest/v1/board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name),board_comments(count)&order=created_at.desc&offset=0&limit=10',
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
      return c;
    },
  });
  await check({
    group: 'app',
    id: 'APP-14',
    role: 'authenticated',
    op: 'board/[postId]/page.tsx → GET /board_comments?select=*,user_profiles_public!…(display_name)',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        `/rest/v1/board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name)&post_id=eq.${u.postId}&order=created_at.asc`,
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
    op: '스테이지 world_id·quest_type 백필 (7개 → 1월드, 7-1 project · 나머지 code, quiz_kind 없음)',
    deny: ['mismatch', 'error'],
    allow: ['ok'],
    run: () =>
      sqlCheck(`DO $$ BEGIN
        IF (SELECT count(*) FROM public.stages WHERE world_id <> '${PYTHON_ISLAND}') > 0
           OR (SELECT count(*) FROM public.stages) <> 7 THEN
          RAISE EXCEPTION 'stages: 1월드가 아닌 스테이지 또는 7개가 아님';
        END IF;
        IF (SELECT string_agg(id::text, ',') FROM public.quests WHERE quest_type = 'project') <> '${Q_PROJECT}'
           OR (SELECT count(*) FROM public.quests WHERE quest_type = 'code') <> 43
           OR EXISTS (SELECT 1 FROM public.quests WHERE quiz_kind IS NOT NULL OR is_mobile_friendly) THEN
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

  await groupEnv();
  await groupView(u);
  await groupNotice(u);
  await groupWrite(u);
  await groupAnswer(u);
  await groupApiKeys(u);
  await groupRpc(u);
  await groupReward();
  await groupSchema(u);
  await groupAuthTriggers(u);
  await groupBoard(u);
  await groupRateLimit(u);
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
