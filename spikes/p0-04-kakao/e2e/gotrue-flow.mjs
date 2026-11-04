// 로컬 GoTrue v2.197.0 + Kakao 목업으로 Supabase 내장 kakao provider 동작을 실측한다.
// 실행 위치: e2e/run.sh 가 띄우는 node 컨테이너 (docker network p004net)
//   /deps/node_modules : 저장소 루트 node_modules (읽기 전용, @supabase/auth-js 2.101.0 사용)
//   /out               : 결과 JSON 저장 (spikes/p0-04-kakao/e2e/observed)
import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { GoTrueClient } = require('/deps/node_modules/@supabase/auth-js');

const A = process.env.GOTRUE_A ?? 'http://p004auth:9999'; // email_optional=true, manual linking on
const B = process.env.GOTRUE_B ?? 'http://p004auth-strict:9999'; // email_optional=false
const MOCK = process.env.MOCK ?? 'https://kapi.kakao.com'; // docker 네트워크 별칭 (목업)
const JWT_SECRET = process.env.JWT_SECRET;
const REDIRECT_TO = 'http://localhost:3000/auth/callback';

const results = [];
const observed = {};

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function client(url) {
  return new GoTrueClient({
    url,
    storage: memoryStorage(),
    storageKey: 'p004',
    flowType: 'pkce',
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  });
}

function serviceRoleJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'service_role', iss: 'p004', iat: now, exp: now + 3600 })}`;
  return `${body}.${createHmac('sha256', JWT_SECRET).update(body).digest('base64url')}`;
}

async function hop(url) {
  const res = await fetch(url, { redirect: 'manual' });
  const location = res.headers.get('location');
  const body = location ? '' : await res.text();
  return { status: res.status, location, body };
}

async function mockReset(biz = false) {
  await fetch(`${MOCK}/__reset?biz=${biz}`);
}
async function mockLog() {
  return (await fetch(`${MOCK}/__log`)).json();
}

/** 브라우저 리다이렉트를 손으로 따라간다: GoTrue /authorize → Kakao(목업) → GoTrue /callback → 앱 redirect_to */
// linkIdentity() 는 GoTrue 가 JSON 으로 돌려준 Kakao 인가 URL 을 바로 주므로 첫 hop 을 건너뛴다
async function runOAuth(startUrl) {
  const trace = {};
  let kakaoLocation = startUrl;
  if (!startUrl.startsWith(MOCK)) {
    const s1 = await hop(startUrl);
    trace.gotrueAuthorize = s1.status;
    if (!s1.location) return { ...trace, stage: 'gotrue-authorize', error: s1.body };
    kakaoLocation = s1.location;
  }
  const kakaoUrl = new URL(kakaoLocation);
  trace.kakaoAuthorizeUrl = kakaoUrl.toString();
  trace.kakaoScope = kakaoUrl.searchParams.get('scope');
  trace.kakaoParams = [...kakaoUrl.searchParams.keys()].sort();
  if (!kakaoUrl.toString().startsWith(MOCK)) return { ...trace, stage: 'external' };

  const s2 = await hop(kakaoUrl);
  trace.kakaoStatus = s2.status;
  if (!s2.location) return { ...trace, stage: 'kakao-authorize', error: s2.body.replace(/<[^>]+>/g, ' ').trim() };

  const s3 = await hop(s2.location);
  trace.callbackStatus = s3.status;
  if (!s3.location) return { ...trace, stage: 'gotrue-callback', error: s3.body };
  const app = new URL(s3.location);
  trace.appRedirect = s3.location;
  const error = app.searchParams.get('error') ?? new URLSearchParams(app.hash.slice(1)).get('error');
  if (error) {
    const q = new URLSearchParams(app.search + '&' + app.hash.slice(1));
    return { ...trace, stage: 'app-redirect', error, error_code: q.get('error_code'), error_description: q.get('error_description') };
  }
  return { ...trace, stage: 'done', code: app.searchParams.get('code') };
}

async function signInKakao(base, options) {
  const c = client(base);
  const { data, error } = await c.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true, ...options },
  });
  assert.equal(error, null);
  const flow = await runOAuth(data.url);
  if (flow.stage === 'done') {
    const ex = await c.exchangeCodeForSession(flow.code);
    assert.equal(ex.error, null, `exchange failed: ${ex.error?.message}`);
    flow.user = ex.data.user;
  }
  return { client: c, flow };
}

function pickUser(u) {
  return {
    id: u.id,
    email: u.email ?? null,
    email_confirmed_at: u.email_confirmed_at ?? null,
    app_metadata: u.app_metadata,
    user_metadata: u.user_metadata,
    identities: (u.identities ?? []).map((i) => ({
      provider: i.provider,
      id: i.id,
      email: i.email ?? null,
      identity_data: i.identity_data,
    })),
  };
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`FAIL  ${name}\n      ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
await mockReset(false);

await test('S1 기본 signInWithOAuth(kakao): GoTrue 가 account_email 을 항상 요청 → 일반 앱은 KOE205', async () => {
  const { flow } = await signInKakao(A, {});
  observed.S1 = flow;
  assert.equal(flow.kakaoScope, 'account_email profile_image profile_nickname');
  assert.equal(flow.stage, 'kakao-authorize');
  assert.match(flow.error, /KOE205/);
  assert.match(flow.error, /account_email/);
});

await test('S2 options.scopes 로는 account_email 을 뺄 수 없음 (뒤에 덧붙기만 함) → KOE205', async () => {
  const { flow } = await signInKakao(A, { scopes: 'profile_nickname' });
  observed.S2 = flow;
  assert.equal(flow.kakaoScope, 'account_email profile_image profile_nickname profile_nickname');
  assert.match(flow.error ?? '', /KOE205/);
});

let kidUserId;
await test('S3 queryParams.scope 로 scope 를 통째로 덮어쓰면 통과 + email_optional 로 이메일 없이 가입', async () => {
  const { flow } = await signInKakao(A, {
    queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid' },
  });
  observed.S3 = { ...flow, user: flow.user && pickUser(flow.user) };
  assert.equal(flow.kakaoScope, 'profile_nickname profile_image');
  assert.equal(flow.stage, 'done', JSON.stringify(flow));
  assert.ok(!flow.user.email, 'email 이 비어 있어야 함');
  assert.equal(flow.user.app_metadata.provider, 'kakao');
  assert.equal(flow.user.identities.length, 1);
  assert.equal(flow.user.identities[0].provider, 'kakao');
  assert.equal(flow.user.identities[0].id, '4012345678');
  kidUserId = flow.user.id;
});

await test('S3b user_metadata 키 집합 (소스 분석과 일치 확인)', async () => {
  const keys = Object.keys(observed.S3.user.user_metadata).sort();
  observed.S3b = keys;
  assert.deepEqual(keys, [
    'avatar_url', 'email_verified', 'full_name', 'iss', 'name', 'phone_verified',
    'preferred_username', 'provider_id', 'sub', 'user_name',
  ]);
  const md = observed.S3.user.user_metadata;
  assert.equal(md.iss, 'https://kapi.kakao.com'); // kakao.go: Issuer = APIHost
  assert.equal(md.name, '파이썬꿈나무');
  assert.equal(md.sub, '4012345678');
});

await test('S3c 토큰 요청은 client_secret_post (본문에 client_id·client_secret, Basic 헤더 없음)', async () => {
  const log = await mockLog();
  const token = log.filter((l) => l.type === 'token').at(-1);
  observed.S3c = token;
  assert.equal(token.hasBasicAuthHeader, false);
  assert.ok(token.bodyKeys.includes('client_id') && token.bodyKeys.includes('client_secret'));
  const authz = log.filter((l) => l.type === 'authorize').at(-1);
  observed.S3c_authorizeParams = Object.keys(authz.query).sort();
});

await test('S4 email_optional=false 서버: 같은 흐름이 "Error getting user email" 로 실패', async () => {
  const { flow } = await signInKakao(B, {
    queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid-default' },
  });
  observed.S4 = flow;
  assert.equal(flow.stage, 'app-redirect');
  assert.match(flow.error_description ?? '', /Error getting user email from external provider/);
});

await test('S5 기본 이미지·실명 같은 닉네임 사용자 가입 (email_optional=true)', async () => {
  const { flow } = await signInKakao(A, {
    queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid-default' },
  });
  observed.S5 = { ...flow, user: flow.user && pickUser(flow.user) };
  assert.equal(flow.stage, 'done');
  assert.match(flow.user.user_metadata.avatar_url, /default_profile/);
});

await test('S6 선택 동의를 모두 거부한 사용자도 회원번호만으로 가입', async () => {
  const { flow } = await signInKakao(A, {
    queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid-noconsent' },
  });
  observed.S6 = { ...flow, user: flow.user && pickUser(flow.user) };
  assert.equal(flow.stage, 'done');
  assert.deepEqual(Object.keys(flow.user.user_metadata).sort(), [
    'email_verified', 'iss', 'phone_verified', 'provider_id', 'sub',
  ]);
});

await test('S7 같은 Kakao 계정으로 다시 로그인하면 같은 사용자 (AccountExists)', async () => {
  const { flow } = await signInKakao(A, {
    queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid' },
  });
  observed.S7 = { id: flow.user?.id, last_sign_in_at: flow.user?.last_sign_in_at };
  assert.equal(flow.user.id, kidUserId);
  assert.equal(flow.user.identities.length, 1);
});

await test('S8 사용자가 카카오 동의 화면에서 취소 → 앱 redirect_to 로 error=access_denied', async () => {
  const { flow } = await signInKakao(A, { queryParams: { scope: 'profile_nickname', mock_user: 'cancel' } });
  observed.S8 = flow;
  assert.equal(flow.stage, 'app-redirect');
  assert.equal(flow.error, 'access_denied');
});

const admin = { Authorization: `Bearer ${serviceRoleJwt()}`, 'Content-Type': 'application/json' };
async function adminCreateUser(email, userMetadata) {
  const res = await fetch(`${A}/admin/users`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ email, password: 'p004-Password!1', email_confirm: true, user_metadata: userMetadata }),
  });
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  return json;
}

await test('S9 (비교) 비즈앱 + 검증된 이메일이면 같은 이메일의 기존 사용자에 자동 연결', async () => {
  const existing = await adminCreateUser('kid.parent@kakao.com'); // 기존 Google 사용자 대용 (같은 이메일)
  await mockReset(true);
  const { flow } = await signInKakao(A, {
    queryParams: { scope: 'profile_nickname account_email', mock_user: 'parent-email' },
  });
  await mockReset(false);
  observed.S9 = { existingId: existing.id, kakaoLoginUserId: flow.user?.id, identities: flow.user && pickUser(flow.user).identities };
  assert.equal(flow.user.id, existing.id);
  assert.deepEqual(flow.user.identities.map((i) => i.provider).sort(), ['email', 'kakao']);
});

let linkedUserId;
await test('S10 수동 연결 linkIdentity(kakao): 기존 계정에 이메일 없는 Kakao 를 붙이고, 이후 Kakao 로그인 = 같은 사용자', async () => {
  // 기존 Google 사용자 대용: Google 로그인 때 GoTrue 가 넣는 user_metadata 를 흉내
  const existing = await adminCreateUser('google.kid@example.com', {
    iss: 'https://accounts.google.com', sub: '1098', provider_id: '1098', email: 'google.kid@example.com',
    email_verified: true, name: '김구글', full_name: '김구글', picture: 'https://lh3.googleusercontent.com/a/x',
  });
  linkedUserId = existing.id;
  const c = client(A);
  const si = await c.signInWithPassword({ email: 'google.kid@example.com', password: 'p004-Password!1' });
  assert.equal(si.error, null);
  const { data, error } = await c.linkIdentity({
    provider: 'kakao',
    options: { redirectTo: REDIRECT_TO, queryParams: { scope: 'profile_nickname', mock_user: 'kid-link' } },
  });
  assert.equal(error, null, error?.message);
  const flow = await runOAuth(data.url);
  observed.S10_link = flow;
  assert.equal(flow.stage, 'done', JSON.stringify(flow));
  const ex = await c.exchangeCodeForSession(flow.code);
  assert.equal(ex.error, null, ex.error?.message);
  assert.equal(ex.data.user.id, existing.id);
  assert.deepEqual(ex.data.user.identities.map((i) => i.provider).sort(), ['email', 'kakao']);

  const again = await signInKakao(A, { queryParams: { scope: 'profile_nickname', mock_user: 'kid-link' } });
  const u = pickUser(again.flow.user);
  observed.S10_loginAfterLink = u;
  assert.equal(u.id, existing.id);
  // app_metadata.provider 는 첫 identity(email) 그대로 → "최근 로그인 provider" 로 쓸 수 없음
  assert.equal(u.app_metadata.provider, 'email');
  // user_metadata 는 방금 로그인한 Kakao identity_data 로 덮어써짐 (iss 포함)
  assert.equal(u.user_metadata.iss, MOCK);
  assert.equal(u.user_metadata.name, 'link_bear');
  // Kakao 가 주지 않은 Google 키(email, picture)는 남고, 겹치는 키(name, full_name, sub, iss)는 Kakao 값으로 바뀜 → 섞임
  assert.equal(u.user_metadata.email, 'google.kid@example.com');
  assert.equal(u.user_metadata.picture, 'https://lh3.googleusercontent.com/a/x');
  assert.equal(u.user_metadata.full_name, 'link_bear');
  assert.equal(u.user_metadata.sub, '4012345690');
});

await test('S11 이미 다른 사용자에 묶인 Kakao 계정은 연결 불가 (identity_already_exists)', async () => {
  const c = client(A);
  await c.signInWithPassword({ email: 'google.kid@example.com', password: 'p004-Password!1' });
  const { data } = await c.linkIdentity({
    provider: 'kakao',
    options: { redirectTo: REDIRECT_TO, queryParams: { scope: 'profile_nickname profile_image', mock_user: 'kid' } },
  });
  const flow = await runOAuth(data.url);
  observed.S11 = flow;
  assert.equal(flow.stage, 'app-redirect');
  assert.match(`${flow.error_code} ${flow.error_description}`, /identity_already_exists|already linked to another user/i);
});

await test('S12 custom:kakao (실제 Kakao issuer 로 OIDC discovery) 생성 → authorize URL 확인 (Kakao 로는 보내지 않음)', async () => {
  const res = await fetch(`${A}/admin/custom-providers`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({
      provider_type: 'oidc',
      identifier: 'custom:kakao',
      name: 'Kakao',
      client_id: 'mock-rest-api-key',
      client_secret: 'mock-client-secret',
      issuer: 'https://kauth.kakao.com',
      scopes: ['openid', 'profile_nickname'],
      email_optional: true,
    }),
  });
  const created = await res.json();
  observed.S12_create = { status: res.status, body: created };
  assert.ok([200, 201].includes(res.status), JSON.stringify(created));
  const c = client(A);
  const { data } = await c.signInWithOAuth({
    provider: 'custom:kakao',
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true },
  });
  const s1 = await hop(data.url);
  const u = new URL(s1.location);
  observed.S12_authorize = {
    host: u.host,
    path: u.pathname,
    scope: u.searchParams.get('scope'),
    redirect_uri: u.searchParams.get('redirect_uri'),
    code_challenge_method: u.searchParams.get('code_challenge_method'),
    has_code_challenge: u.searchParams.has('code_challenge'),
    params: [...u.searchParams.keys()].sort(),
  };
  assert.equal(u.host, 'kauth.kakao.com');
  assert.equal(u.pathname, '/oauth/authorize');
  assert.equal(u.searchParams.get('scope'), 'openid profile_nickname');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
});

await test('S13 custom:kakao 는 options.scopes 가 저장된 scope 를 대체 (내장 kakao 는 덧붙임)', async () => {
  const c = client(A);
  const { data } = await c.signInWithOAuth({
    provider: 'custom:kakao',
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true, scopes: 'openid profile_nickname profile_image' },
  });
  const s1 = await hop(data.url);
  const u = new URL(s1.location);
  observed.S13 = u.searchParams.get('scope');
  assert.equal(u.searchParams.get('scope'), 'openid profile_nickname profile_image');
});

// --- custom:kakao 콜백 경로 (목업 discovery, issuer 는 실제 값 https://kauth.kakao.com) ---------------
// GoTrue 의 OIDC provider 캐시는 issuer 만 키로 쓴다 (provider/oidc_cache.go GetProviderFromURL).
// A 는 S12 에서 실제 kauth.kakao.com discovery 를 캐시했으므로, 목업 흐름은 캐시가 빈 B 로 보낸다.
// custom provider 는 DB(auth.custom_oauth_providers)에 있어 두 GoTrue 가 공유하고, email_optional 도 provider 별 설정이다.
async function createMockCustomKakao() {
  const res = await fetch(`${B}/admin/custom-providers`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({
      provider_type: 'oidc',
      identifier: 'custom:kakao-mock',
      name: 'Kakao (mock)',
      client_id: 'mock-rest-api-key',
      client_secret: 'mock-client-secret',
      issuer: 'https://kauth.kakao.com',
      discovery_url: 'https://mock-kauth.p004.test/.well-known/openid-configuration',
      scopes: ['openid', 'profile_nickname'],
      email_optional: true,
    }),
  });
  return { status: res.status, body: await res.json() };
}

async function signInCustom(options) {
  const c = client(B);
  const { data } = await c.signInWithOAuth({
    provider: 'custom:kakao-mock',
    options: { redirectTo: REDIRECT_TO, skipBrowserRedirect: true, ...options },
  });
  const flow = await runOAuthAt(data.url, 'https://mock-kauth.p004.test');
  if (flow.stage === 'done') {
    const ex = await c.exchangeCodeForSession(flow.code);
    assert.equal(ex.error, null, `exchange failed: ${ex.error?.message}`);
    flow.user = ex.data.user;
  }
  return flow;
}

// runOAuth 와 같지만 목업 호스트가 다름
async function runOAuthAt(startUrl, host) {
  const s1 = await hop(startUrl);
  if (!s1.location?.startsWith(host)) return { stage: 'gotrue-authorize', status: s1.status, location: s1.location, error: s1.body };
  const kakaoUrl = new URL(s1.location);
  const trace = { kakaoScope: kakaoUrl.searchParams.get('scope'), kakaoParams: [...kakaoUrl.searchParams.keys()].sort() };
  const s2 = await hop(kakaoUrl);
  if (!s2.location) return { ...trace, stage: 'kakao-authorize', error: s2.body };
  const s3 = await hop(s2.location);
  if (!s3.location) return { ...trace, stage: 'gotrue-callback', status: s3.status, error: s3.body };
  const app = new URL(s3.location);
  const q = new URLSearchParams(app.search + '&' + app.hash.slice(1));
  if (q.get('error')) return { ...trace, stage: 'app-redirect', error: q.get('error'), error_code: q.get('error_code'), error_description: q.get('error_description') };
  return { ...trace, stage: 'done', code: app.searchParams.get('code') };
}

await test('S14 custom:kakao(OIDC) 콜백: 이메일 없이 가입, parseKakaoIDToken 매핑, 토큰 요청은 Basic 시도 후 client_secret_post 재시도', async () => {
  await mockReset(false);
  const created = await createMockCustomKakao();
  observed.S14_create = { status: created.status, pkce_enabled: created.body.pkce_enabled, scopes: created.body.scopes };
  assert.ok([200, 201].includes(created.status), JSON.stringify(created.body));
  const flow = await signInCustom({ queryParams: { mock_user: 'kid' } });
  const log = await mockLog();
  const tokenCalls = log.filter((l) => l.type === 'token');
  observed.S14 = { ...flow, user: flow.user && pickUser(flow.user), tokenCalls };
  assert.equal(flow.stage, 'done', JSON.stringify(flow));
  assert.equal(flow.kakaoScope, 'openid profile_nickname');
  assert.ok(flow.kakaoParams.includes('code_challenge'), 'PKCE(S256) 를 Kakao 에도 보냄');
  assert.deepEqual(tokenCalls.map((t) => `${t.hasBasicAuthHeader ? 'basic' : 'post'}:${t.result}`), ['basic:KOE101', 'post:ok']);
  assert.equal(tokenCalls[1].pkce, 'ok');
  const u = flow.user;
  assert.ok(!u.email);
  assert.equal(u.app_metadata.provider, 'custom:kakao-mock');
  assert.equal(u.identities[0].id, '4012345678');
  assert.deepEqual(Object.keys(u.user_metadata).sort(), [
    'email_verified', 'iss', 'name', 'phone_verified', 'preferred_username', 'provider_id', 'sub',
  ]);
  assert.equal(u.user_metadata.iss, 'https://kauth.kakao.com');
  assert.equal(u.user_metadata.name, '파이썬꿈나무');
});

await test('S14b 같은 Kakao 회원번호라도 내장 kakao 와 custom:kakao 는 다른 사용자 (provider 를 바꾸면 계정이 갈라짐)', async () => {
  assert.notEqual(observed.S14.user.id, kidUserId);
});

await test('S15 (가정) Kakao 가 실패한 Basic 요청에서도 코드를 소모한다면 custom:kakao 로그인은 매번 실패 → P3 실측 필수', async () => {
  await mockReset(false);
  await fetch(`${MOCK}/__reset?burn=true`);
  const flow = await signInCustom({ queryParams: { mock_user: 'kid-default' } });
  await mockReset(false);
  observed.S15 = flow;
  assert.equal(flow.stage, 'app-redirect');
  observed.S15_error = `${flow.error} / ${flow.error_code} / ${flow.error_description}`;
});

writeFileSync('/out/observed.json', JSON.stringify({ results, observed }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
