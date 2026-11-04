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
      classifyWrite(
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
      classifyWrite(
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
  // P1-03 complete_quest(p_user_id, p_quest_id, p_submission): service_role 전용
  const RPC = '/rest/v1/rpc/complete_quest';
  const body = {
    p_user_id: u.alice.id,
    p_quest_id: Q1,
    p_submission: 'print(1)',
  };
  await check({
    group: 'rpc',
    id: 'RPC-1',
    role: 'anon',
    op: `POST ${RPC}`,
    deny: ['denied'],
    allow: ['allowed', 'empty'],
    run: async () => classifyRead(await rest('POST', RPC, { body })),
  });
  await check({
    group: 'rpc',
    id: 'RPC-2',
    role: 'authenticated',
    op: `POST ${RPC} {p_user_id: 본인}`,
    deny: ['denied'],
    allow: ['allowed', 'empty'],
    run: async () =>
      classifyRead(await rest('POST', RPC, { as: u.alice, body })),
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
      'world/page.tsx stages',
      '/rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quests(id,order)&order=order.asc',
    ],
    [
      'APP-3',
      'world·profile user_progress',
      `/rest/v1/user_progress?select=quest_id,status&user_id=eq.${u.alice.id}`,
    ],
    [
      'APP-4',
      'world/page.tsx users',
      `/rest/v1/users?select=id,display_name,avatar_url,total_xp,current_level,custom_api_keys&id=eq.${u.alice.id}`,
    ],
    [
      'APP-5',
      'world·profile user_badges',
      `/rest/v1/user_badges?select=badge_type,earned_at&user_id=eq.${u.alice.id}`,
    ],
    [
      'APP-6',
      'profile/page.tsx stages',
      '/rest/v1/stages?select=id,order,title,quests(id)&order=order.asc',
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
    op: 'board/page.tsx → GET /board_posts?select=*,user_profiles_public!…(display_name,avatar_url),board_comments(count) + count=exact',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        '/rest/v1/board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count)&order=created_at.desc&offset=0&limit=10',
        { as: u.alice, prefer: 'count=exact' },
      );
      const c = classifyRead(r);
      if (
        c.actual === 'allowed' &&
        !r.json[0]?.user_profiles_public?.display_name
      )
        return {
          actual: 'author-missing',
          detail: JSON.stringify(r.json[0]).slice(0, 120),
        };
      return c;
    },
  });
  await check({
    group: 'app',
    id: 'APP-14',
    role: 'authenticated',
    op: 'board/[postId]/page.tsx → GET /board_comments?select=*,user_profiles_public!…(display_name,avatar_url)',
    ...READ,
    run: async () => {
      const r = await rest(
        'GET',
        `/rest/v1/board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url)&post_id=eq.${u.postId}&order=created_at.asc`,
        { as: u.alice },
      );
      const c = classifyRead(r);
      if (
        c.actual === 'allowed' &&
        !r.json[0]?.user_profiles_public?.display_name
      )
        return {
          actual: 'author-missing',
          detail: JSON.stringify(r.json[0]).slice(0, 120),
        };
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
    op: 'QuestShell.tsx auto-save → upsert user_progress {code_submitted, hints_used, status: in_progress} (기존 행)',
    ...WRITE,
    run: () =>
      classifyWrite(
        upsert(Q1, {
          code_submitted: 'print("w1")',
          hints_used: 1,
          status: 'in_progress',
        }),
        `select code_submitted = 'print("w1")' from public.user_progress where user_id = '${u.alice.id}' and quest_id = '${Q1}'`,
      ),
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
  const title = `app-post-${RUN}`;
  await check({
    group: 'app',
    id: 'APP-W4',
    role: 'authenticated',
    op: 'api/board/posts POST → POST /board_posts {user_id: 본인}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/board_posts', {
          as: u.alice,
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
    role: 'authenticated',
    op: 'api/board/posts/[postId] PATCH → PATCH /board_posts?id=eq.<본인 글>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/board_posts?id=eq.${myPost}`, {
          as: u.alice,
          body: { content: '고쳤어요' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.board_posts where id::text = ${sqlStr(myPost)} and content = '고쳤어요')`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W6',
    role: 'authenticated',
    op: 'api/board/comments POST → POST /board_comments {user_id: 본인}',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('POST', '/rest/v1/board_comments', {
          as: u.alice,
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
    role: 'authenticated',
    op: 'api/board/comments/[commentId] DELETE → DELETE /board_comments?id=eq.<본인 댓글>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest(
          'DELETE',
          `/rest/v1/board_comments?content=eq.app-comment-${RUN}&user_id=eq.${u.alice.id}`,
          { as: u.alice, prefer: 'return=minimal' },
        ),
        `select not exists (select 1 from public.board_comments where content = 'app-comment-${RUN}')`,
      ),
  });
  await check({
    group: 'app',
    id: 'APP-W8',
    role: 'authenticated',
    op: 'api/board/posts/[postId] DELETE → DELETE /board_posts?id=eq.<본인 글>',
    ...WRITE,
    run: () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/board_posts?id=eq.${myPost}`, {
          as: u.alice,
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
    op: 'api/account/reset → DELETE /user_progress?user_id=eq.<본인>&quest_id=in.(…)',
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
    run: () => {
      const v = one(`select count(*) from pg_policies
       where schemaname = 'public'
         and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''), 'SELECT auth\\.(uid|role)\\(\\)', '', 'g') ~ 'auth\\.(uid|role)\\(\\)'`);
      return { actual: v, detail: `${v}개` };
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
  one(
    `insert into public.board_comments (post_id, user_id, content) values ('${u.postId}', '${u.alice.id}', 'rls comment')`,
  );
  one(`insert into public.user_progress (user_id, quest_id, status, hints_used, used_golden_key, code_submitted) values
        ('${u.alice.id}', '${Q1}', 'in_progress', 2, true, ''),
        ('${u.alice.id}', '${Q2}', 'in_progress', 0, false, ''),
        ('${u.bob.id}', '${Q1}', 'in_progress', 0, false, '')`);
  one(
    `insert into public.user_badges (user_id, badge_type) values ('${u.alice.id}', 'first_code')`,
  );

  await groupEnv();
  await groupView(u);
  await groupNotice(u);
  await groupWrite(u);
  await groupAnswer(u);
  await groupRpc(u);
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
