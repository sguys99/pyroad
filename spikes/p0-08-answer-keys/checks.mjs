#!/usr/bin/env node
// P0-08 접근 점검 러너 (P1-20 RLS 회귀 테스트의 씨앗)
// 사용: node checks.mjs <scenario>   (verify.sh 가 환경 변수를 채워서 호출)
//
// 환경 변수
//   P008_API_URL           로컬 API (예: http://127.0.0.1:54621)
//   P008_ANON_KEY          로컬 anon 키 (supabase status)
//   P008_SERVICE_ROLE_KEY  로컬 service_role 키 (supabase status)
//   P008_DB_CONTAINER      DB 컨테이너 이름 (예: supabase_db_p008answers)
//   P008_REPO              저장소 루트 (seed.sql, 00001 Section 6 재실행용)
//   P008_RESULTS           결과 JSON 을 덧붙일 파일 (JSON Lines)
//
// 각 점검은 { 시나리오, 그룹, ID, 역할, 동작, 기대, 실제, 통과 } 를 남깁니다.
// kind: security = 지켜야 할 보안 속성 / known-gap = 현재 취약 상태 기록(수정되면 기대값을 뒤집음) / info = 참고
import { spawnSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const API = must('P008_API_URL');
const ANON = must('P008_ANON_KEY');
const SERVICE = must('P008_SERVICE_ROLE_KEY');
const DB = must('P008_DB_CONTAINER');
const REPO = must('P008_REPO');
const RESULTS = process.env.P008_RESULTS;
const scenario = process.argv[2];

function must(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env ${name}`);
    process.exit(2);
  }
  return v;
}

// ── 시나리오 ──────────────────────────────────────────────
// hotfix: 00002(또는 같은 내용이 들어간 현재 00001) 적용 / keys: 00003 적용 / colPrivs: 컬럼 권한 대안
// rpc: 채점 RPC + 노출형 대안 적용 / prodData: 운영처럼 solution_code 가 채워진 데이터 / newDefault: 자동 노출 꺼짐
const SCENARIOS = {
  prod_baseline: {
    hotfix: false,
    keys: false,
    prodData: true,
    groups: ['env', 'b03', 'b02', 'b04', 'b07', 'app', 'b08'],
  },
  prod_plus_00002: {
    hotfix: true,
    keys: false,
    prodData: true,
    groups: ['b03', 'b02', 'b04', 'b07', 'app'],
  },
  prod_plus_00003: {
    hotfix: true,
    keys: true,
    prodData: true,
    groups: ['keys', 'b07', 'app', 'legacy', 'reseed', 'static'],
  },
  fresh_repo: {
    hotfix: true,
    keys: false,
    fresh: true,
    groups: ['b08', 'b03', 'b02', 'b07', 'app'],
  },
  alt_column_privs: {
    hotfix: true,
    keys: false,
    colPrivs: true,
    fresh: true,
    groups: ['b07', 'app', 'colpriv'],
  },
  fresh_with_00003: {
    hotfix: true,
    keys: true,
    fresh: true,
    groups: ['keys', 'b07', 'app', 'b08', 'reseed', 'static'],
  },
  quiz_rpc: {
    hotfix: true,
    keys: true,
    rpc: true,
    fresh: true,
    groups: ['rpc', 'static', 'latency'],
  },
  new_default_privs: {
    hotfix: true,
    keys: true,
    fresh: true,
    newDefault: true,
    groups: ['env', 'keys', 'app', 'b03'],
  },
};
const S = SCENARIOS[scenario];
if (!S) {
  console.error(
    `unknown scenario ${scenario}. one of: ${Object.keys(SCENARIOS).join(', ')}`,
  );
  process.exit(2);
}

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
const one = (sql) => psql(sql).out;

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
  const t0 = performance.now();
  const res = await fetch(API + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const ms = performance.now() - t0;
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, ms, headers: res.headers };
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

/** 쓰기 요청 후 DB 에서 실제로 반영됐는지 확인 */
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

const results = [];
async function check(group, id, role, op, expected, fn, kind = 'security') {
  let out;
  try {
    out = await fn();
  } catch (e) {
    out = { actual: 'exception', detail: String(e?.stack || e).split('\n')[0] };
  }
  const exp = Array.isArray(expected) ? expected : [expected];
  const pass = exp.includes(out.actual);
  const row = {
    scenario,
    group,
    id,
    role,
    op,
    expected: exp.join('|'),
    actual: out.actual,
    pass,
    kind,
    detail: out.detail ?? '',
  };
  results.push(row);
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(
    `${mark}  [${group}] ${id} ${role} :: ${op} → expected ${row.expected}, got ${out.actual}  (${row.detail})`,
  );
}

// ── 테스트 사용자 ─────────────────────────────────────────
const RUN = Date.now().toString(36);
async function createUser(name, fullName) {
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
  const t = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const tj = await t.json();
  if (!tj.access_token)
    throw new Error(`sign in ${name}: ${JSON.stringify(tj)}`);
  return { name, id: c.json.id, token: tj.access_token };
}

const Q1 = 'b1000000-0000-0000-0000-000000000001'; // 1-1 첫 번째 인사
const Q_PROJECT = 'b1000000-0000-0000-0000-000000000022'; // 7-1 프로젝트
const STAGE1 = 'a1000000-0000-0000-0000-000000000001';
const QUIZ_MC = 'c1000000-0000-0000-0000-000000000001';
const QUIZ_PARSONS = 'c1000000-0000-0000-0000-000000000002';

function section6Sql() {
  const src = readFileSync(
    join(REPO, 'supabase/migrations/00001_v0.1.0_initial_schema.sql'),
    'utf8',
  );
  const start = src.indexOf('-- Section 6');
  const end = src.indexOf('-- Section 7');
  return src.slice(
    src.lastIndexOf('\n', start),
    src.lastIndexOf('-- ====', end),
  );
}
const seedSql = () => readFileSync(join(REPO, 'supabase/seed.sql'), 'utf8');

// ── 그룹 ──────────────────────────────────────────────────
async function groupEnv() {
  await check(
    'env',
    'ENV-1',
    'postgres',
    'public 스키마 새 테이블의 anon 기본 권한 (legacy 자동 노출 여부)',
    S.newDefault ? 'off' : 'on',
    () => {
      const acl = one(
        `select coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'r'`,
      );
      const m = acl.match(/anon=([^/]*)\//);
      return {
        actual: m && m[1].includes('r') ? 'on' : 'off',
        detail: `postgres 기본 ACL(테이블) anon=${m ? m[1] : '(없음)'}`,
      };
    },
    'info',
  );
  await check(
    'env',
    'ENV-3',
    'postgres',
    'public 스키마 새 함수의 anon EXECUTE 기본 권한',
    S.newDefault ? 'off' : 'on',
    () => {
      const acl = one(
        `select coalesce(array_to_string(defaclacl, ','), '') from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'`,
      );
      return {
        actual: /anon=X/.test(acl) ? 'on' : 'off',
        detail: `postgres 기본 ACL(함수) ${acl || '(없음: PUBLIC EXECUTE 기본값)'}`,
      };
    },
    'info',
  );
  await check(
    'env',
    'ENV-2',
    'postgres',
    'anon 의 quests SELECT 권한 (00001 에 GRANT 가 없음)',
    S.newDefault ? 'false' : 'true',
    () => {
      const v = one(
        `select has_table_privilege('anon', 'public.quests', 'SELECT')`,
      );
      return {
        actual: v === 't' ? 'true' : 'false',
        detail: `has_table_privilege=${v}`,
      };
    },
    'info',
  );
}

async function groupB03(u) {
  const H = S.hotfix;
  const gap = H ? 'security' : 'known-gap'; // 핫픽스 전에는 취약 상태를 기록
  await check(
    'b03',
    'B03-1',
    'anon',
    'GET /user_profiles_public?select=*',
    H ? 'denied' : 'allowed',
    async () =>
      classifyRead(await rest('GET', '/rest/v1/user_profiles_public?select=*')),
    gap,
  );
  await check(
    'b03',
    'B03-2',
    'anon(psql)',
    'SET ROLE anon; SELECT count(*) FROM user_profiles_public',
    H ? 'denied' : 'allowed',
    async () =>
      classifySql(
        psqlAs(
          'anon',
          null,
          'SELECT count(*) FROM public.user_profiles_public;',
        ),
      ),
    gap,
  );
  await check(
    'b03',
    'B03-3',
    'authenticated',
    'GET /user_profiles_public?select=* → 컬럼은 id·display_name·avatar_url 뿐',
    S.newDefault ? 'allowed' : 'allowed',
    async () => {
      const r = await rest('GET', '/rest/v1/user_profiles_public?select=*', {
        as: u.alice,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      const keys = Object.keys(r.json[0]).sort().join(',');
      return keys === 'avatar_url,display_name,id'
        ? {
            actual: 'allowed',
            detail: `rows=${r.json.length} (전체 사용자), cols=${keys}`,
          }
        : { actual: 'extra-columns', detail: keys };
    },
  );
  await check(
    'b03',
    'B03-4',
    'authenticated',
    'GET /user_profiles_public?select=total_xp (뷰에 없는 컬럼)',
    'no-column',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/user_profiles_public?select=total_xp', {
          as: u.alice,
        }),
      ),
  );
  if (S.newDefault) return;
  await check(
    'b03',
    'B03-5',
    'authenticated',
    'PATCH /user_profiles_public?id=eq.<다른 사용자> display_name',
    H ? 'denied' : 'written',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/user_profiles_public?id=eq.${u.bob.id}`, {
          as: u.alice,
          body: { display_name: '해킹됨' },
          prefer: 'return=minimal',
        }),
        `select display_name = '해킹됨' from public.users where id = '${u.bob.id}'`,
      ),
    gap,
  );
  await check(
    'b03',
    'B03-6',
    'anon',
    'PATCH /user_profiles_public?id=eq.<사용자> display_name',
    H ? 'denied' : 'written',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/user_profiles_public?id=eq.${u.bob.id}`, {
          body: { display_name: '익명해킹' },
          prefer: 'return=minimal',
        }),
        `select display_name = '익명해킹' from public.users where id = '${u.bob.id}'`,
      ),
    gap,
  );
  await check(
    'b03',
    'B03-7',
    'authenticated',
    'DELETE /user_profiles_public?id=eq.<다른 사용자> (public.users 행 삭제 → 진행·뱃지 연쇄 삭제)',
    H ? 'denied' : 'written',
    () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/user_profiles_public?id=eq.${u.carol.id}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.users where id = '${u.carol.id}')`,
      ),
    gap,
  );
  await check(
    'b03',
    'B03-7b',
    'anon',
    'DELETE /user_profiles_public?id=eq.<사용자> (비로그인 삭제)',
    H ? 'denied' : 'written',
    () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/user_profiles_public?id=eq.${u.dan.id}`, {
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.users where id = '${u.dan.id}')`,
      ),
    gap,
  );
  await check(
    'b03',
    'B03-8',
    'postgres',
    'user_profiles_public 에 대한 anon/authenticated 권한 목록',
    H ? 'authenticated:SELECT' : 'anon+authenticated:ALL',
    () => {
      const v =
        one(`select coalesce(string_agg(grantee || ':' || privs, ' ' order by grantee), '') from (
      select grantee, string_agg(privilege_type, ',' order by privilege_type) privs
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'user_profiles_public' and grantee in ('anon', 'authenticated', 'PUBLIC')
       group by grantee) t`);
      const all = 'DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE';
      const norm =
        v === `anon:${all} authenticated:${all}` ? 'anon+authenticated:ALL' : v;
      return { actual: norm, detail: v };
    },
    gap,
  );
  // 앱이 쓰는 임베딩 (게시판): 핫픽스 후에도 동작해야 함
  await check(
    'b03',
    'B03-9',
    'authenticated',
    'GET /board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count) (게시판 목록)',
    'allowed',
    async () => {
      const r = await rest(
        'GET',
        '/rest/v1/board_posts?select=*,user_profiles_public!board_posts_user_id_fkey(display_name,avatar_url),board_comments(count)&order=created_at.desc',
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
  );
  await check(
    'b03',
    'B03-10',
    'authenticated',
    'GET /board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url) (게시글 상세)',
    'allowed',
    async () =>
      classifyRead(
        await rest(
          'GET',
          `/rest/v1/board_comments?select=*,user_profiles_public!board_comments_user_id_fkey(display_name,avatar_url)&post_id=eq.${u.postId}`,
          { as: u.alice },
        ),
      ),
  );
  await check(
    'b03',
    'B03-11',
    'service_role',
    'GET /user_profiles_public?select=*',
    'allowed',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/user_profiles_public?select=*', {
          as: 'service',
        }),
      ),
  );
}

async function groupB02(u) {
  const H = S.hotfix;
  const gap = H ? 'security' : 'known-gap';
  // alice 소유 공지 1개 (예전 정책이면 alice 가 수정·삭제 가능했던 형태)
  const own = one(
    `insert into public.notices (user_id, title, content) values ('${u.alice.id}', 'alice-own', 'x') returning id`,
  );
  const admin = one(
    `insert into public.notices (user_id, title, content) values ('${u.bob.id}', '관리자 공지', 'x') returning id`,
  );
  await check(
    'b02',
    'B02-1',
    'anon',
    'GET /notices?select=* (공지는 공개)',
    'allowed',
    async () => classifyRead(await rest('GET', '/rest/v1/notices?select=*')),
    'info',
  );
  await check(
    'b02',
    'B02-2',
    'authenticated',
    'POST /notices {user_id: 본인}',
    H ? 'denied' : 'written',
    () =>
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
    gap,
  );
  await check(
    'b02',
    'B02-3',
    'authenticated(psql)',
    'SET ROLE authenticated; INSERT INTO notices (user_id=auth.uid())',
    H ? 'denied' : 'allowed',
    async () =>
      classifySql(
        psqlAs(
          'authenticated',
          u.alice.id,
          `INSERT INTO public.notices (user_id, title, content) VALUES (auth.uid(), 'psql-notice', 'x');`,
        ),
      ),
    gap,
  );
  await check(
    'b02',
    'B02-4',
    'authenticated',
    'PATCH /notices?id=eq.<본인 소유 공지>',
    H ? 'no-op' : 'written',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/notices?id=eq.${own}`, {
          as: u.alice,
          body: { title: '변조됨' },
          prefer: 'return=minimal',
        }),
        `select title = '변조됨' from public.notices where id = '${own}'`,
      ),
    gap,
  );
  await check(
    'b02',
    'B02-5',
    'authenticated',
    'DELETE /notices?id=eq.<본인 소유 공지>',
    H ? 'no-op' : 'written',
    () =>
      classifyWrite(
        rest('DELETE', `/rest/v1/notices?id=eq.${own}`, {
          as: u.alice,
          prefer: 'return=minimal',
        }),
        `select not exists (select 1 from public.notices where id = '${own}')`,
      ),
    gap,
  );
  await check(
    'b02',
    'B02-6',
    'authenticated',
    'PATCH /notices?id=eq.<다른 사람 공지>',
    'no-op',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/notices?id=eq.${admin}`, {
          as: u.alice,
          body: { title: '변조됨2' },
          prefer: 'return=minimal',
        }),
        `select title = '변조됨2' from public.notices where id = '${admin}'`,
      ),
  );
  await check('b02', 'B02-7', 'anon', 'POST /notices', 'denied', () =>
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
  );
  await check(
    'b02',
    'B02-8',
    'service_role',
    'POST /notices (관리자 API 경로)',
    'written',
    () =>
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
  );
  await check(
    'b02',
    'B02-9',
    'postgres',
    'notices 정책 목록',
    H
      ? 'notices_select_public'
      : 'notices_delete_own,notices_insert_authenticated,notices_select_public,notices_update_own',
    () => {
      const v = one(
        `select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'notices'`,
      );
      return { actual: v, detail: v };
    },
    gap,
  );
}

async function groupB04(u) {
  await check(
    'b04',
    'B04-1',
    'authenticated',
    'PATCH /users?id=eq.<본인> {total_xp: 999999, current_level: 5}',
    'written',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { total_xp: 999999, current_level: 5 },
          prefer: 'return=minimal',
        }),
        `select total_xp = 999999 from public.users where id = '${u.alice.id}'`,
      ),
    'known-gap',
  );
  await check(
    'b04',
    'B04-2',
    'authenticated',
    'PATCH /users?id=eq.<본인> {golden_keys: 99}',
    'written',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.alice.id}`, {
          as: u.alice,
          body: { golden_keys: 99 },
          prefer: 'return=minimal',
        }),
        `select golden_keys = 99 from public.users where id = '${u.alice.id}'`,
      ),
    'known-gap',
  );
  await check(
    'b04',
    'B04-3',
    'authenticated',
    'PATCH /users?id=eq.<다른 사용자> {total_xp: 1}',
    'no-op',
    () =>
      classifyWrite(
        rest('PATCH', `/rest/v1/users?id=eq.${u.bob.id}`, {
          as: u.alice,
          body: { total_xp: 1 },
          prefer: 'return=minimal',
        }),
        `select total_xp = 1 from public.users where id = '${u.bob.id}'`,
      ),
  );
  await check(
    'b04',
    'B04-4',
    'authenticated',
    'POST /user_progress (upsert) {quest: 7-1 최종 프로젝트, status: completed}',
    'written',
    () =>
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
    'known-gap',
  );
  await check(
    'b04',
    'B04-5',
    'authenticated',
    'POST /user_badges {badge_type: project_builder}',
    'written',
    () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_badges', {
          as: u.alice,
          body: { user_id: u.alice.id, badge_type: 'project_builder' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_badges where user_id = '${u.alice.id}' and badge_type = 'project_builder')`,
      ),
    'known-gap',
  );
  await check(
    'b04',
    'B04-6',
    'authenticated',
    'POST /user_badges {user_id: 다른 사용자}',
    'denied',
    () =>
      classifyWrite(
        rest('POST', '/rest/v1/user_badges', {
          as: u.alice,
          body: { user_id: u.bob.id, badge_type: 'streak_3' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.user_badges where user_id = '${u.bob.id}' and badge_type = 'streak_3')`,
      ),
  );
  await check(
    'b04',
    'B04-7',
    'authenticated(psql)',
    `SET ROLE authenticated; UPDATE users SET total_xp = 123456 WHERE id = auth.uid()`,
    'allowed',
    async () => {
      const r = psqlAs(
        'authenticated',
        u.alice.id,
        `UPDATE public.users SET total_xp = 123456 WHERE id = auth.uid() RETURNING total_xp;`,
      );
      return classifySql(r);
    },
    'known-gap',
  );
  await check(
    'b04',
    'B04-8',
    'authenticated',
    'GET /users?select=custom_api_keys (본인 API 키 평문 조회, B13)',
    'allowed',
    async () =>
      classifyRead(
        await rest(
          'GET',
          `/rest/v1/users?select=custom_api_keys&id=eq.${u.alice.id}`,
          { as: u.alice },
        ),
      ),
    'known-gap',
  );
  await check(
    'b04',
    'B04-9',
    'authenticated',
    'GET /users?select=* → 본인 행만',
    'own-only',
    async () => {
      const r = await rest('GET', '/rest/v1/users?select=id', { as: u.alice });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      return r.json.length === 1 && r.json[0].id === u.alice.id
        ? { actual: 'own-only', detail: 'rows=1' }
        : { actual: 'others-visible', detail: `rows=${r.json.length}` };
    },
  );
}

async function groupB07(u) {
  const leakExpected = S.keys ? 'no-answers' : S.colPrivs ? 'denied' : 'leaks';
  await check(
    'b07',
    'B07-1',
    'anon',
    'GET /quests?select=id (quests 는 로그인 사용자만)',
    'empty',
    async () => classifyRead(await rest('GET', '/rest/v1/quests?select=id')),
  );
  await check(
    'b07',
    'B07-2',
    'authenticated',
    'GET /quests?select=id,expected_output',
    leakExpected,
    async () =>
      classifyLeak(
        await rest('GET', '/rest/v1/quests?select=id,expected_output', {
          as: u.alice,
        }),
      ),
    S.keys || S.colPrivs ? 'security' : 'known-gap',
  );
  await check(
    'b07',
    'B07-3',
    'authenticated',
    'GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps',
    S.keys ? 'no-answers' : 'leaks',
    async () =>
      classifyLeak(
        await rest(
          'GET',
          '/rest/v1/quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps',
          { as: u.alice },
        ),
      ),
    S.keys ? 'security' : 'known-gap',
  );
  await check(
    'b07',
    'B07-4',
    'authenticated',
    'GET /quests?select=*',
    S.colPrivs ? 'denied' : 'allowed',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/quests?select=*', { as: u.alice }),
      ),
  );
  if (S.prodData && !S.keys) {
    await check(
      'b07',
      'B07-5',
      'authenticated',
      'GET /quests?select=sol:prompt_skeleton->solution_code (운영과 같은 데이터: 황금키 정답 코드)',
      'leaks',
      async () =>
        classifyLeak(
          await rest(
            'GET',
            '/rest/v1/quests?select=id,sol:prompt_skeleton->solution_code',
            { as: u.alice },
          ),
        ),
      'known-gap',
    );
  }
}

async function groupApp(u) {
  // 현재 앱이 실제로 보내는 PostgREST 쿼리 (src/ 기준). 모든 시나리오에서 동작해야 함
  const exp = S.newDefault ? 'denied' : 'allowed';
  const kind = S.newDefault ? 'info' : 'security';
  const q = [
    [
      'APP-1',
      'quest/[questId]/page.tsx:24',
      `/rest/v1/quests?select=id,stage_id,order,title,concept,prompt_skeleton,validation_type,xp_reward,created_at,stage:stages(id,title,order,theme_name)&id=eq.${Q1}`,
    ],
    [
      'APP-2',
      'world/page.tsx:22',
      '/rest/v1/stages?select=id,order,title,theme_name,description,is_final,created_at,quests(id,order)&order=order.asc',
    ],
    [
      'APP-3',
      'profile/page.tsx:22',
      '/rest/v1/stages?select=id,order,title,quests(id)&order=order.asc',
    ],
    [
      'APP-4',
      'checkBadges.ts:46',
      `/rest/v1/quests?select=stage_id&id=eq.${Q1}`,
    ],
    [
      'APP-5',
      'checkBadges.ts:53',
      `/rest/v1/quests?select=id&stage_id=eq.${STAGE1}`,
    ],
    [
      'APP-6',
      'checkBadges.ts:77',
      `/rest/v1/quests?select=stage_id,stages!inner(is_final)&id=eq.${Q1}`,
    ],
  ];
  for (const [id, where, path] of q) {
    await check(
      'app',
      id,
      'authenticated',
      `${where} → GET ${path.split('?')[0]}?${decodeURIComponent(path.split('?')[1]).slice(0, 70)}`,
      exp,
      async () => {
        const r = await rest('GET', path, { as: u.alice });
        const c = classifyRead(r);
        if (id === 'APP-1' && c.actual === 'allowed') {
          const sk = r.json[0].prompt_skeleton;
          if (!sk.starter_code && sk.starter_code !== '')
            return {
              actual: 'skeleton-broken',
              detail: Object.keys(sk).join(','),
            };
          c.detail += ` skeleton keys=${Object.keys(sk).sort().join(',')}`;
        }
        return c;
      },
      kind,
    );
  }
  const svc = [
    [
      'APP-7',
      'tutor/helpers.ts:139 (admin)',
      `/rest/v1/quests?select=*,stage:stages(id,title,order,theme_name)&id=eq.${Q1}`,
    ],
    [
      'APP-8',
      'quest/validate/route.ts:41 (admin)',
      `/rest/v1/quests?select=validation_type,expected_output,prompt_skeleton&id=eq.${Q1}`,
    ],
    [
      'APP-9',
      'quest/golden-key/route.ts:45 (admin)',
      `/rest/v1/quests?select=id,prompt_skeleton,stage_id&id=eq.${Q1}`,
    ],
  ];
  for (const [id, where, path] of svc) {
    await check(
      'app',
      id,
      'service_role',
      `${where} → GET ${path.split('?')[0]}`,
      exp,
      async () => classifyRead(await rest('GET', path, { as: 'service' })),
      kind,
    );
  }
}

async function groupLegacy() {
  // 00003 이후 기존 앱 코드(서버)가 quests 에서 정답을 읽으면 빈 값 → P1-02 에서 앱 코드 변경 필요
  await check(
    'legacy',
    'LEG-1',
    'service_role',
    'validate/route.ts 가 읽는 quests.expected_output (00003 이후)',
    'empty-string',
    async () => {
      const r = await rest(
        'GET',
        `/rest/v1/quests?select=expected_output&id=eq.${Q1}`,
        { as: 'service' },
      );
      return {
        actual:
          r.json?.[0]?.expected_output === '' ? 'empty-string' : 'has-value',
        detail: JSON.stringify(r.json?.[0]),
      };
    },
    'info',
  );
  await check(
    'legacy',
    'LEG-2',
    'service_role',
    'golden-key·tutor 가 읽는 prompt_skeleton.solution_code / hints (00003 이후)',
    'absent',
    async () => {
      const r = await rest(
        'GET',
        `/rest/v1/quests?select=prompt_skeleton&id=eq.${Q1}`,
        { as: 'service' },
      );
      const sk = r.json?.[0]?.prompt_skeleton ?? {};
      return {
        actual:
          !('hints' in sk) && !('solution_code' in sk) ? 'absent' : 'present',
        detail: Object.keys(sk).sort().join(','),
      };
    },
    'info',
  );
  await check(
    'legacy',
    'LEG-3',
    'service_role',
    '대체 경로: GET /quest_answer_keys?select=expected_output,hints,solution_code,steps&quest_id=eq.<1-1>',
    'allowed',
    async () =>
      classifyRead(
        await rest(
          'GET',
          `/rest/v1/quest_answer_keys?select=expected_output,hints,solution_code,steps&quest_id=eq.${Q1}`,
          { as: 'service' },
        ),
      ),
  );
}

async function groupKeys(u) {
  const T = '/rest/v1/quest_answer_keys';
  await check('keys', 'AK-1', 'anon', `GET ${T}?select=*`, 'denied', async () =>
    classifyRead(await rest('GET', `${T}?select=*`)),
  );
  await check(
    'keys',
    'AK-2',
    'authenticated',
    `GET ${T}?select=*`,
    'denied',
    async () =>
      classifyRead(await rest('GET', `${T}?select=*`, { as: u.alice })),
  );
  await check(
    'keys',
    'AK-3',
    'authenticated',
    `GET ${T}?select=quest_id&quest_id=eq.<1-1>`,
    'denied',
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=quest_id&quest_id=eq.${Q1}`, {
          as: u.alice,
        }),
      ),
  );
  await check(
    'keys',
    'AK-4',
    'authenticated',
    'GET /quests?select=id,quest_answer_keys(*) (임베딩 우회)',
    ['denied', 'error'],
    async () =>
      classifyRead(
        await rest(
          'GET',
          `/rest/v1/quests?select=id,quest_answer_keys(*)&id=eq.${Q1}`,
          { as: u.alice },
        ),
      ),
  );
  await check(
    'keys',
    'AK-5',
    'authenticated',
    `GET ${T}?select=quest_id,quests(id) (역방향 임베딩)`,
    ['denied', 'error'],
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=quest_id,quests(id)`, { as: u.alice }),
      ),
  );
  if (S.newDefault) {
    // 신규 기본값에서는 마이그레이션이 GRANT 를 명시해야만 service_role 도 접근 가능
  }
  if (!S.newDefault) {
    await check(
      'keys',
      'AK-6',
      'authenticated',
      `POST ${T} {quest_id: 1-1, expected_output: 'x'}`,
      'denied',
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
    await check(
      'keys',
      'AK-7',
      'authenticated',
      `PATCH ${T}?quest_id=eq.<1-1>`,
      'denied',
      () =>
        classifyWrite(
          rest('PATCH', `${T}?quest_id=eq.${Q1}`, {
            as: u.alice,
            body: { expected_output: 'HACKED2' },
            prefer: 'return=minimal',
          }),
          `select exists (select 1 from public.quest_answer_keys where expected_output = 'HACKED2')`,
        ),
    );
    await check(
      'keys',
      'AK-8',
      'authenticated',
      `DELETE ${T}?quest_id=eq.<1-1>`,
      'denied',
      () =>
        classifyWrite(
          rest('DELETE', `${T}?quest_id=eq.${Q1}`, {
            as: u.alice,
            prefer: 'return=minimal',
          }),
          `select not exists (select 1 from public.quest_answer_keys where quest_id = '${Q1}')`,
        ),
    );
    await check('keys', 'AK-9', 'anon', `POST ${T}`, 'denied', () =>
      classifyWrite(
        rest('POST', T, {
          body: { quest_id: Q1, expected_output: 'HACKED3' },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.quest_answer_keys where expected_output = 'HACKED3')`,
      ),
    );
  }
  await check(
    'keys',
    'AK-10',
    'service_role',
    `GET ${T}?select=*&quest_id=eq.<1-1>`,
    'allowed',
    async () =>
      classifyRead(
        await rest('GET', `${T}?select=*&quest_id=eq.${Q1}`, { as: 'service' }),
      ),
  );
  await check(
    'keys',
    'AK-11',
    'service_role',
    `PATCH ${T}?quest_id=eq.<1-1> (콘텐츠 도구 경로)`,
    'written',
    async () => {
      const before = one(
        `select hints::text from public.quest_answer_keys where quest_id = '${Q1}'`,
      );
      const out = await classifyWrite(
        rest('PATCH', `${T}?quest_id=eq.${Q1}`, {
          as: 'service',
          body: { hints: { level_1: 'svc-edit' } },
          prefer: 'return=minimal',
        }),
        `select hints->>'level_1' = 'svc-edit' from public.quest_answer_keys where quest_id = '${Q1}'`,
      );
      psql(
        `update public.quest_answer_keys set hints = '${before.replace(/'/g, "''")}'::jsonb where quest_id = '${Q1}'`,
      );
      return out;
    },
  );
  await check(
    'keys',
    'AK-12',
    'anon(psql)',
    'SET ROLE anon; SELECT count(*) FROM quest_answer_keys',
    'denied',
    async () =>
      classifySql(
        psqlAs('anon', null, 'SELECT count(*) FROM public.quest_answer_keys;'),
      ),
  );
  await check(
    'keys',
    'AK-13',
    'authenticated(psql)',
    'SET ROLE authenticated (+jwt claims); SELECT * FROM quest_answer_keys',
    'denied',
    async () =>
      classifySql(
        psqlAs(
          'authenticated',
          u.alice.id,
          'SELECT * FROM public.quest_answer_keys LIMIT 1;',
        ),
      ),
  );
  await check(
    'keys',
    'AK-14',
    'service_role(psql)',
    'SET ROLE service_role; SELECT count(*) FROM quest_answer_keys',
    'allowed',
    async () =>
      classifySql(
        psqlAs(
          'service_role',
          null,
          'SELECT count(*) FROM public.quest_answer_keys;',
        ),
      ),
  );
  await check(
    'keys',
    'AK-15',
    'anon',
    'GET /rest/v1/ (OpenAPI 스키마에 quest_answer_keys 노출 여부)',
    ['hidden', 'denied'],
    async () => {
      const r = await rest('GET', '/rest/v1/', {
        headers: { Accept: 'application/openapi+json' },
      });
      if (r.status === 401 || r.status === 403)
        return { actual: 'denied', detail: `${r.status}` };
      const paths = Object.keys(r.json?.paths ?? {});
      return {
        actual: paths.includes('/quest_answer_keys') ? 'listed' : 'hidden',
        detail: `${r.status} paths=${paths.length}`,
      };
    },
  );
  await check(
    'keys',
    'AK-16',
    'authenticated',
    'GET /rest/v1/ (OpenAPI, 로그인 사용자)',
    ['hidden', 'denied'],
    async () => {
      const r = await rest('GET', '/rest/v1/', {
        as: u.alice,
        headers: { Accept: 'application/openapi+json' },
      });
      if (r.status === 401 || r.status === 403)
        return { actual: 'denied', detail: `${r.status}` };
      const paths = Object.keys(r.json?.paths ?? {});
      return {
        actual: paths.includes('/quest_answer_keys') ? 'listed' : 'hidden',
        detail: `${r.status} paths=${paths.length}`,
      };
    },
  );
  await check(
    'keys',
    'AK-17',
    'postgres',
    'quests 에 남은 정답 행 수 / quest_answer_keys 행 수',
    '0/44',
    () => {
      const left = one(
        `select count(*) from public.quests where expected_output <> '' or prompt_skeleton ?| array['hints','solution_code'] or jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints) || exists(@.solution_code))')`,
      );
      const keys = one(
        `select count(*) from public.quest_answer_keys where quiz_answer is null`,
      );
      return {
        actual: `${left}/${keys}`,
        detail: one(
          `select format('expected_output %s, hints %s, solution_code %s, steps %s', count(*) filter (where expected_output <> ''), count(*) filter (where hints <> '{}'), count(*) filter (where solution_code is not null), count(*) filter (where jsonb_array_length(steps) > 0)) from public.quest_answer_keys`,
        ),
      };
    },
  );
  if (S.newDefault) return;
  await check(
    'keys',
    'AK-18',
    'postgres',
    '백스톱: 트리거를 끄고 quests.expected_output 에 정답을 쓰면',
    'blocked',
    () => {
      const r = psql(
        `BEGIN; ALTER TABLE public.quests DISABLE TRIGGER trg_quests_split_answer_fields; UPDATE public.quests SET expected_output = 'leak' WHERE id = '${Q1}'; ROLLBACK;`,
      );
      return r.ok
        ? { actual: 'stored', detail: r.out }
        : {
            actual: /quests_no_answer_fields/.test(r.err) ? 'blocked' : 'error',
            detail: firstLine(r.err),
          };
    },
  );
  await check(
    'keys',
    'AK-19',
    'postgres',
    '백스톱: 퀴즈 보기에 is_correct 를 넣으면',
    'blocked',
    () => {
      const r = psql(
        `BEGIN; UPDATE public.quests SET prompt_skeleton = prompt_skeleton || '{"quiz":{"options":[{"id":"a","is_correct":true}]}}' WHERE id = '${Q1}'; ROLLBACK;`,
      );
      return r.ok
        ? { actual: 'stored', detail: r.out }
        : {
            actual: /quests_no_answer_fields/.test(r.err) ? 'blocked' : 'error',
            detail: firstLine(r.err),
          };
    },
  );
}

async function groupReseed() {
  await check(
    'reseed',
    'RS-1',
    'postgres',
    'seed.sql 재실행 → quests 에 정답이 다시 생기는지 / solution_code 유지되는지',
    'no-leak+kept',
    () => {
      const solBefore = one(
        `select count(*) from public.quest_answer_keys where solution_code is not null`,
      );
      const r = psql(seedSql());
      if (!r.ok) return { actual: 'seed-failed', detail: firstLine(r.err) };
      const left = one(
        `select count(*) from public.quests where expected_output <> '' or prompt_skeleton ?| array['hints','solution_code'] or jsonb_path_exists(prompt_skeleton, '$.steps[*] ? (exists(@.expected_output) || exists(@.hints))')`,
      );
      const solAfter = one(
        `select count(*) from public.quest_answer_keys where solution_code is not null`,
      );
      const hints = one(
        `select count(*) from public.quest_answer_keys where hints <> '{}'`,
      );
      return {
        actual:
          left === '0' && solAfter === solBefore
            ? 'no-leak+kept'
            : `left=${left} sol ${solBefore}->${solAfter}`,
        detail: `quests 잔여 정답 ${left}, solution_code ${solBefore}→${solAfter}, hints ${hints}`,
      };
    },
  );
}

async function groupB08() {
  if (S.prodData) {
    await check(
      'b08',
      'B08-0',
      'postgres',
      '운영 재현 데이터: 00001 Section 6 를 seed 뒤에 재실행한 상태의 solution_code 수',
      '44',
      () => {
        const v = one(
          `select count(*) from public.quests where prompt_skeleton ? 'solution_code' or jsonb_path_exists(prompt_skeleton, '$.steps[*].solution_code')`,
        );
        return { actual: v, detail: `quests with solution_code = ${v}` };
      },
      'info',
    );
    return;
  }
  if (!S.keys) {
    await check(
      'b08',
      'B08-1',
      'postgres',
      '새 DB (마이그레이션 → seed 순서) 의 solution_code 가 있는 퀘스트 수',
      '0',
      () => {
        const v = one(
          `select count(*) from public.quests where prompt_skeleton ? 'solution_code' or jsonb_path_exists(prompt_skeleton, '$.steps[*].solution_code')`,
        );
        return { actual: v, detail: `44개 중 ${v}개` };
      },
      'known-gap',
    );
    await check(
      'b08',
      'B08-2',
      'postgres',
      'Section 6 수동 실행 후 seed 재실행 → solution_code 가 지워지는지',
      'overwritten',
      () => {
        const r = psql(
          `BEGIN;\n${section6Sql()}\n${seedSql()}\nSELECT count(*) FROM public.quests WHERE prompt_skeleton ? 'solution_code';\nROLLBACK;`,
        );
        if (!r.ok) return { actual: 'error', detail: firstLine(r.err) };
        const n = r.out.split('\n').pop();
        return {
          actual: n === '0' ? 'overwritten' : `kept(${n})`,
          detail: `seed 재실행 후 solution_code ${n}개`,
        };
      },
      'known-gap',
    );
  } else {
    await check(
      'b08',
      'B08-3',
      'postgres',
      '00003 적용된 새 DB 의 solution_code 수 (seed 에 정답 코드가 없음)',
      '0',
      () => {
        const v = one(
          `select count(*) from public.quest_answer_keys where solution_code is not null or jsonb_path_exists(steps, '$[*].solution_code')`,
        );
        return { actual: v, detail: `quest_answer_keys 중 ${v}개` };
      },
      'known-gap',
    );
    await check(
      'b08',
      'B08-4',
      'postgres',
      'B08 해결안: 00001 Section 6 UPDATE 를 seed 뒤에 실행 → 분리 트리거가 정답 테이블로 옮김',
      '43+1',
      () => {
        const r = psql(
          `BEGIN;\n${section6Sql()}\nSELECT count(*) FILTER (WHERE solution_code IS NOT NULL) || '+' || count(*) FILTER (WHERE jsonb_path_exists(steps, '$[*].solution_code')) FROM public.quest_answer_keys;\nSELECT count(*) FROM public.quests WHERE prompt_skeleton ? 'solution_code' OR jsonb_path_exists(prompt_skeleton, '$.steps[*].solution_code');\nROLLBACK;`,
        );
        if (!r.ok) return { actual: 'error', detail: firstLine(r.err) };
        const [keys, left] = r.out.split('\n').slice(-2);
        return {
          actual: keys,
          detail: `정답 테이블 top-level+프로젝트 = ${keys}, quests 잔여 ${left}`,
        };
      },
    );
  }
}

async function groupColPriv(u) {
  await check(
    'colpriv',
    'CP-1',
    'authenticated',
    'GET /quests?select=expected_output (회수한 컬럼)',
    'denied',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/quests?select=expected_output', {
          as: u.alice,
        }),
      ),
  );
  await check(
    'colpriv',
    'CP-2',
    'authenticated',
    'GET /quests?select=* (PostgREST 는 * 를 모든 컬럼으로 펼침 → 42501)',
    'denied',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/quests?select=*', { as: u.alice }),
      ),
  );
  await check(
    'colpriv',
    'CP-3',
    'authenticated',
    'HEAD /quests?select=* + Prefer: count=exact (supabase-js .select("*", {count, head:true}))',
    ['denied', 'allowed', 'empty'],
    async () => {
      const r = await rest('HEAD', '/rest/v1/quests?select=*', {
        as: u.alice,
        prefer: 'count=exact',
      });
      return r.status >= 400
        ? { actual: 'denied', detail: `${r.status}` }
        : {
            actual: 'allowed',
            detail: `${r.status} content-range=${r.headers.get('content-range')}`,
          };
    },
    'info',
  );
  await check(
    'colpriv',
    'CP-4',
    'authenticated',
    'GET /stages?select=*,quests(*) (임베딩 * 도 실패)',
    'denied',
    async () =>
      classifyRead(
        await rest('GET', '/rest/v1/stages?select=*,quests(*)', {
          as: u.alice,
        }),
      ),
  );
  await check(
    'colpriv',
    'CP-5',
    'authenticated',
    'GET /quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code (jsonb 안의 정답)',
    'leaks',
    async () =>
      classifyLeak(
        await rest(
          'GET',
          '/rest/v1/quests?select=id,hints:prompt_skeleton->hints,sol:prompt_skeleton->solution_code,steps:prompt_skeleton->steps',
          { as: u.alice },
        ),
      ),
    'known-gap',
  );
  await check(
    'colpriv',
    'CP-6',
    'authenticated',
    'POST /quests?select=* 같은 representation 응답 (insert().select()) — quests 쓰기 정책이 없어 해당 없음',
    'n/a',
    async () => ({ actual: 'n/a', detail: '클라이언트가 quests 를 쓰지 않음' }),
    'info',
  );
  await check(
    'colpriv',
    'CP-7',
    'postgres',
    '컬럼을 새로 추가하면 클라이언트에 자동으로 보이는지 (ALTER TABLE quests ADD COLUMN x)',
    'hidden',
    () => {
      const r = psql(
        `BEGIN; ALTER TABLE public.quests ADD COLUMN p008_new_col text; SELECT has_column_privilege('authenticated', 'public.quests', 'p008_new_col', 'SELECT'); ROLLBACK;`,
      );
      return {
        actual: r.out.split('\n').pop() === 't' ? 'visible' : 'hidden',
        detail: `has_column_privilege=${r.out.split('\n').pop()} (새 컬럼마다 GRANT 필요)`,
      };
    },
    'info',
  );
}

async function groupStatic() {
  await check(
    'static',
    'ST-1',
    'postgres',
    'quest_answer_keys: RLS 켜짐 + 정책 0개',
    'rls=on,policies=0',
    () => {
      const v = one(
        `select 'rls=' || case when relrowsecurity then 'on' else 'off' end || ',policies=' || (select count(*) from pg_policies where schemaname='public' and tablename='quest_answer_keys') from pg_class where oid = 'public.quest_answer_keys'::regclass`,
      );
      return { actual: v, detail: v };
    },
  );
  await check(
    'static',
    'ST-2',
    'postgres',
    'quest_answer_keys 테이블 권한 (anon/authenticated/PUBLIC)',
    'none',
    () => {
      const v = one(
        `select coalesce(string_agg(grantee || ':' || privilege_type, ',' order by grantee, privilege_type), '') from information_schema.role_table_grants where table_schema='public' and table_name='quest_answer_keys' and grantee in ('anon','authenticated','PUBLIC')`,
      );
      return { actual: v === '' ? 'none' : 'granted', detail: v || '(없음)' };
    },
  );
  await check(
    'static',
    'ST-3',
    'postgres',
    'quest_answer_keys 를 참조하는 뷰',
    'none',
    () => {
      const v = one(
        `select coalesce(string_agg(distinct v.relname, ','), '') from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class v on v.oid = r.ev_class where d.refobjid = 'public.quest_answer_keys'::regclass and v.oid <> 'public.quest_answer_keys'::regclass`,
      );
      return { actual: v === '' ? 'none' : 'found', detail: v || '(없음)' };
    },
  );
  await check(
    'static',
    'ST-4',
    'postgres',
    'Realtime publication 에 quest_answer_keys 포함 여부',
    'none',
    () => {
      const v = one(
        `select coalesce(string_agg(pubname, ','), '') from pg_publication_tables where schemaname='public' and tablename='quest_answer_keys'`,
      );
      return { actual: v === '' ? 'none' : 'found', detail: v || '(없음)' };
    },
  );
  const allow = S.rpc ? 'grade_quiz,submit_quiz_answer_self' : 'none';
  await check(
    'static',
    'ST-5',
    'postgres',
    'anon/authenticated 가 실행할 수 있는 public SECURITY DEFINER 함수 (트리거 함수 제외)',
    allow,
    () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
        and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v === '' ? 'none' : v, detail: v || '(없음)' };
    },
    S.rpc ? 'info' : 'security',
  );
  await check(
    'static',
    'ST-6',
    'postgres',
    'anon/authenticated 가 EXECUTE 가능한 SECURITY DEFINER 트리거 함수 (RPC 로는 호출 불가, 참고)',
    ['handle_new_user', 'none'],
    () => {
      const v =
        one(`select coalesce(string_agg(p.proname, ',' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
        and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
      return { actual: v === '' ? 'none' : v, detail: v || '(없음)' };
    },
    'info',
  );
}

async function groupRpc(u) {
  const RPC = '/rest/v1/rpc/submit_quiz_answer';
  const body = (uid, ans, qid = QUIZ_MC) => ({
    p_user_id: uid,
    p_quest_id: qid,
    p_answer: ans,
  });
  await check('rpc', 'RPC-1', 'anon', `POST ${RPC}`, 'denied', async () =>
    classifyRead(await rest('POST', RPC, { body: body(u.alice.id, 'opt_k2') })),
  );
  await check(
    'rpc',
    'RPC-2',
    'authenticated',
    `POST ${RPC} {p_user_id: 본인}`,
    'denied',
    async () =>
      classifyRead(
        await rest('POST', RPC, {
          as: u.alice,
          body: body(u.alice.id, 'opt_k2'),
        }),
      ),
  );
  await check(
    'rpc',
    'RPC-3',
    'authenticated',
    `POST ${RPC} {p_user_id: 다른 사용자} (사칭)`,
    'denied',
    async () =>
      classifyRead(
        await rest('POST', RPC, {
          as: u.alice,
          body: body(u.bob.id, 'opt_k2'),
        }),
      ),
  );
  await check(
    'rpc',
    'RPC-4',
    'service_role',
    `POST ${RPC} 오답 → 응답에 정답이 없는지`,
    'no-leak',
    async () => {
      const r = await rest('POST', RPC, {
        as: 'service',
        body: body(u.bob.id, 'opt_q7'),
      });
      const s = JSON.stringify(r.json);
      if (r.status !== 200)
        return { actual: 'error', detail: `${r.status} ${s}` };
      return {
        actual:
          r.json.correct === false && !s.includes('opt_k2')
            ? 'no-leak'
            : 'leak',
        detail: s,
      };
    },
  );
  await check(
    'rpc',
    'RPC-5',
    'service_role',
    `POST ${RPC} 두 번째 시도에 정답 → 별 2개, XP 1회`,
    'stars=2,xp=30',
    async () => {
      const r = await rest('POST', RPC, {
        as: 'service',
        body: body(u.bob.id, 'opt_k2'),
      });
      return {
        actual: `stars=${r.json?.stars},xp=${r.json?.xp_awarded}`,
        detail: JSON.stringify(r.json),
      };
    },
  );
  await check(
    'rpc',
    'RPC-6',
    'service_role',
    `POST ${RPC} 완료 후 다시 정답 → 보상 없음 (멱등)`,
    'already,xp=0',
    async () => {
      const r = await rest('POST', RPC, {
        as: 'service',
        body: body(u.bob.id, 'opt_k2'),
      });
      return {
        actual: `${r.json?.already_completed ? 'already' : 'new'},xp=${r.json?.xp_awarded}`,
        detail: JSON.stringify(r.json),
      };
    },
  );
  // 동시성: 4개 보기를 동시에 제출
  await check(
    'rpc',
    'RPC-7',
    'service_role',
    '보기 4개 동시 제출 → 시도 번호 1~4 직렬화, 정답 1회, XP 1회',
    'serialized',
    async () => {
      const opts = ['opt_q7', 'opt_k2', 'opt_x9', 'opt_m4'];
      const rs = await Promise.all(
        opts.map((o) =>
          rest('POST', RPC, { as: 'service', body: body(u.dave.id, o) }),
        ),
      );
      const nos = rs
        .map((r) => r.json?.attempt_no)
        .sort()
        .join(',');
      const correct = rs.filter((r) => r.json?.correct);
      const xp = one(
        `select total_xp from public.users where id = '${u.dave.id}'`,
      );
      const ok = nos === '1,2,3,4' && correct.length === 1 && xp === '30';
      return {
        actual: ok ? 'serialized' : 'race',
        detail: `attempt_no=${nos}, 정답 응답 ${correct.length}개(stars=${correct[0]?.json?.stars}), total_xp=${xp}`,
      };
    },
  );
  await check(
    'rpc',
    'RPC-8',
    'service_role',
    '같은 정답 5개 동시 제출 → XP 1회만',
    'once',
    async () => {
      const rs = await Promise.all(
        [1, 2, 3, 4, 5].map(() =>
          rest('POST', RPC, { as: 'service', body: body(u.erin.id, 'opt_k2') }),
        ),
      );
      const awarded = rs.filter((r) => r.json?.xp_awarded > 0).length;
      const xp = one(
        `select total_xp from public.users where id = '${u.erin.id}'`,
      );
      return {
        actual: awarded === 1 && xp === '30' ? 'once' : 'multiple',
        detail: `xp 지급 응답 ${awarded}개, total_xp=${xp}, status=${rs.map((r) => r.status).join(',')}`,
      };
    },
  );
  await check(
    'rpc',
    'RPC-9',
    'service_role',
    '10초 안에 7번 연속 오답 제출 → 6번째부터 429',
    'limited@6',
    async () => {
      const codes = [];
      for (let i = 0; i < 7; i++) {
        const r = await rest('POST', RPC, {
          as: 'service',
          body: body(u.frank.id, 'opt_q7'),
        });
        codes.push(r.status);
      }
      const first = codes.indexOf(429);
      return {
        actual: first === -1 ? 'not-limited' : `limited@${first + 1}`,
        detail: codes.join(','),
      };
    },
  );
  await check(
    'rpc',
    'RPC-10',
    'service_role',
    'parsons: 순서를 뒤집으면 오답, 맞는 순서면 정답 (jsonb = 비교)',
    'order-sensitive',
    async () => {
      const wrong = await rest('POST', RPC, {
        as: 'service',
        body: body(u.gina.id, ['ln_m', 'ln_x'], QUIZ_PARSONS),
      });
      const right = await rest('POST', RPC, {
        as: 'service',
        body: body(u.gina.id, ['ln_x', 'ln_m'], QUIZ_PARSONS),
      });
      return {
        actual:
          wrong.json?.correct === false && right.json?.correct === true
            ? 'order-sensitive'
            : 'broken',
        detail: `${JSON.stringify(wrong.json)} / ${JSON.stringify(right.json)}`,
      };
    },
  );
  await check(
    'rpc',
    'RPC-11',
    'postgres',
    `함정 확인: '[["ln_m","ln_x"]]' @> '[["ln_x","ln_m"]]' (포함 연산자는 순서를 무시)`,
    'true',
    () => {
      const v = one(
        `select '[["ln_m","ln_x"]]'::jsonb @> '[["ln_x","ln_m"]]'::jsonb`,
      );
      return {
        actual: v === 't' ? 'true' : 'false',
        detail: `@> 결과 ${v} → 채점에 @> 쓰면 안 됨`,
      };
    },
    'info',
  );
  await check(
    'rpc',
    'RPC-12',
    'authenticated',
    '노출형 (ii-a) grade_quiz 로 보기 4개 대입 → 흔적 없이 정답 확인',
    'oracle',
    async () => {
      const before = one(
        `select count(*) from public.quiz_attempts where user_id = '${u.alice.id}'`,
      );
      let found = null;
      let calls = 0;
      for (const o of ['opt_q7', 'opt_x9', 'opt_m4', 'opt_k2']) {
        calls++;
        const r = await rest('POST', '/rest/v1/rpc/grade_quiz', {
          as: u.alice,
          body: { p_quest_id: QUIZ_MC, p_answer: o },
        });
        if (r.json === true) {
          found = o;
          break;
        }
      }
      const after = one(
        `select count(*) from public.quiz_attempts where user_id = '${u.alice.id}'`,
      );
      return {
        actual: found && before === after ? 'oracle' : 'safe',
        detail: `${calls}번 호출로 ${found} 확인, 기록된 시도 ${before}→${after}`,
      };
    },
    'known-gap',
  );
  await check(
    'rpc',
    'RPC-13',
    'authenticated',
    '노출형 (ii-b) submit_quiz_answer_self 로 대입 → 시도는 기록되고 별이 깎임',
    'recorded',
    async () => {
      const res = [];
      for (const o of ['opt_q7', 'opt_x9', 'opt_k2']) {
        const r = await rest('POST', '/rest/v1/rpc/submit_quiz_answer_self', {
          as: u.hana,
          body: { p_quest_id: QUIZ_MC, p_answer: o },
        });
        res.push(r.json);
        if (r.json?.correct) break;
      }
      const n = one(
        `select count(*) from public.quiz_attempts where user_id = '${u.hana.id}'`,
      );
      const last = res[res.length - 1];
      return {
        actual: n === '3' && last?.stars === 1 ? 'recorded' : 'not-recorded',
        detail: `시도 ${n}개 기록, 별 ${last?.stars}`,
      };
    },
    'info',
  );
  await check(
    'rpc',
    'RPC-14',
    'authenticated',
    'GET /quiz_attempts → 본인 기록만',
    'own-only',
    async () => {
      const r = await rest('GET', '/rest/v1/quiz_attempts?select=user_id', {
        as: u.hana,
      });
      const c = classifyRead(r);
      if (c.actual !== 'allowed') return c;
      return r.json.every((x) => x.user_id === u.hana.id)
        ? { actual: 'own-only', detail: `rows=${r.json.length}` }
        : { actual: 'others-visible', detail: '' };
    },
  );
  await check(
    'rpc',
    'RPC-15',
    'authenticated',
    'POST /quiz_attempts (시도 기록 위조)',
    'denied',
    () =>
      classifyWrite(
        rest('POST', '/rest/v1/quiz_attempts', {
          as: u.alice,
          body: {
            user_id: u.alice.id,
            quest_id: QUIZ_MC,
            attempt_no: 99,
            answer: 'x',
            is_correct: true,
          },
          prefer: 'return=minimal',
        }),
        `select exists (select 1 from public.quiz_attempts where attempt_no = 99)`,
      ),
  );
  await check(
    'rpc',
    'RPC-16',
    'authenticated',
    'PATCH /user_progress?quest_id=eq.<퀴즈> {stars: 3} (P1-04 전 별 조작)',
    'written',
    () =>
      classifyWrite(
        rest(
          'PATCH',
          `/rest/v1/user_progress?user_id=eq.${u.hana.id}&quest_id=eq.${QUIZ_MC}`,
          { as: u.hana, body: { stars: 3 }, prefer: 'return=minimal' },
        ),
        `select stars = 3 from public.user_progress where user_id = '${u.hana.id}' and quest_id = '${QUIZ_MC}'`,
      ),
    'known-gap',
  );
}

async function groupLatency(u) {
  const pct = (a, p) =>
    a.slice().sort((x, y) => x - y)[
      Math.min(a.length - 1, Math.floor((p / 100) * a.length))
    ];
  const fmt = (a) =>
    `p50=${pct(a, 50).toFixed(1)}ms p95=${pct(a, 95).toFixed(1)}ms n=${a.length}`;
  // 워밍업
  for (let i = 0; i < 5; i++)
    await rest('GET', `/rest/v1/quests?select=id&id=eq.${Q1}`, { as: u.alice });
  const a = [];
  for (let i = 0; i < 40; i++)
    a.push(
      (
        await rest('GET', `/rest/v1/quests?select=id,title&id=eq.${QUIZ_MC}`, {
          as: u.alice,
        })
      ).ms,
    );
  const b = [];
  for (let i = 0; i < 40; i++)
    b.push(
      (
        await rest(
          'GET',
          `/rest/v1/quest_answer_keys?select=quiz_answer&quest_id=eq.${QUIZ_MC}`,
          { as: 'service' },
        )
      ).ms,
    );
  const c = [];
  for (const pu of u.pool)
    c.push(
      (
        await rest('POST', '/rest/v1/rpc/submit_quiz_answer', {
          as: 'service',
          body: { p_user_id: pu.id, p_quest_id: QUIZ_MC, p_answer: 'opt_k2' },
        })
      ).ms,
    );
  const d = [];
  for (let i = 0; i < 40; i++)
    d.push(
      (
        await rest('POST', '/rest/v1/rpc/grade_quiz', {
          as: u.alice,
          body: { p_quest_id: QUIZ_MC, p_answer: 'opt_x9' },
        })
      ).ms,
    );
  await check(
    'latency',
    'LAT-1',
    'authenticated',
    'GET quests 1행 (기준)',
    'measured',
    async () => ({ actual: 'measured', detail: fmt(a) }),
    'info',
  );
  await check(
    'latency',
    'LAT-2',
    'service_role',
    'GET quest_answer_keys 1행 (TS 채점안의 키 조회 1회)',
    'measured',
    async () => ({ actual: 'measured', detail: fmt(b) }),
    'info',
  );
  await check(
    'latency',
    'LAT-3',
    'service_role',
    'RPC submit_quiz_answer (잠금+채점+기록+보상, 1왕복)',
    'measured',
    async () => ({ actual: 'measured', detail: fmt(c) }),
    'info',
  );
  await check(
    'latency',
    'LAT-4',
    'authenticated',
    'RPC grade_quiz (순수 채점, 노출형)',
    'measured',
    async () => ({ actual: 'measured', detail: fmt(d) }),
    'info',
  );
}

// ── 실행 ──────────────────────────────────────────────────
async function main() {
  const need = new Set(S.groups);
  const u = {};
  u.alice = await createUser('alice', '김앨리스');
  u.bob = await createUser('bob', '박밥');
  u.carol = await createUser('carol', '최캐롤');
  u.dan = await createUser('dan', '정단');
  if (need.has('b03')) {
    // 게시판 임베딩 확인용 글·댓글 (service_role 로 직접 생성 → newDefault 에서도 동작)
    u.postId = one(
      `insert into public.board_posts (user_id, title, content) values ('${u.bob.id}', 'p008 post', 'x') returning id`,
    );
    one(
      `insert into public.board_comments (post_id, user_id, content) values ('${u.postId}', '${u.alice.id}', 'p008 comment')`,
    );
  }
  if (need.has('rpc')) {
    for (const n of ['dave', 'erin', 'frank', 'gina', 'hana'])
      u[n] = await createUser(n, n);
  }
  if (need.has('latency')) {
    u.pool = [];
    for (let i = 0; i < 30; i++)
      u.pool.push(await createUser(`pool${i}`, `pool${i}`));
  }
  const map = {
    env: groupEnv,
    b03: groupB03,
    b02: groupB02,
    b04: groupB04,
    b07: groupB07,
    app: groupApp,
    legacy: groupLegacy,
    keys: groupKeys,
    reseed: groupReseed,
    b08: groupB08,
    colpriv: groupColPriv,
    static: groupStatic,
    rpc: groupRpc,
    latency: groupLatency,
  };
  for (const g of S.groups) await map[g](u);
  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n[${scenario}] ${results.length - failed.length}/${results.length} passed`,
  );
  if (RESULTS)
    appendFileSync(
      RESULTS,
      results.map((r) => JSON.stringify(r)).join('\n') + '\n',
    );
  process.exit(failed.length ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(3);
});
