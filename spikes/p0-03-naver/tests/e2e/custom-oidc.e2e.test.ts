/**
 * E2E against a real GoTrue v2.197.0 (local Supabase CLI stack) + mock Naver (HTTPS).
 * Run with scripts/e2e.sh (see docs/spikes/P0-03-naver-login.md §8).
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminClient,
  browserClient,
  callbackError,
  countUsersWithIdentity,
  finishAtAppCallback,
  mockLog,
  oauthLogin,
  MOCK_BASE,
  PUBLIC_API_ORIGIN,
} from '../helpers/e2e.ts';
import { ensureMockProviders } from '../helpers/providers.ts';

const SUB = {
  alice: 'Zq3mT8xWc1v0nVb7kLp2Rs9dHf4gJy6uEaQo5iNt1Ck',
  bob: 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq',
  collide: 'Qw1eR2tY3uI4oP5aS6dF7gH8jK9lZ0xC1vB2nM3qW4e',
};
const admin = adminClient();

async function allUserIds() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return new Set(data.users.map((u) => u.id));
}

before(async () => {
  // clean slate: remove users from previous runs, register providers via the admin API
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) await admin.auth.admin.deleteUser(u.id);
  await ensureMockProviders(admin);
  await mockLog(); // drain
});

describe('A. custom:naver as OIDC provider (채택안)', () => {
  test('A-1 정상 로그인: identity = id_token sub, 이메일 없음, PKCE·state, RLS, refresh', async () => {
    const t = await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'alice' });
    const az = t.providerAuthorizeUrl!;
    assert.equal(az.origin + az.pathname, `${MOCK_BASE}/oauth2/authorize`);
    assert.equal(az.searchParams.get('response_type'), 'code');
    assert.equal(az.searchParams.get('scope'), 'openid');
    assert.equal(az.searchParams.get('code_challenge_method'), 'S256'); // GoTrue <-> Naver PKCE
    assert.ok(az.searchParams.get('code_challenge'));
    assert.match(az.searchParams.get('state')!, /^[0-9a-f-]{36}$/); // GoTrue flow_state id
    assert.equal(az.searchParams.get('redirect_uri'), `${PUBLIC_API_ORIGIN}/auth/v1/callback`);
    assert.equal(az.searchParams.get('client_secret'), null);
    assert.equal(az.searchParams.get('nonce'), null, 'GoTrue does not send a nonce in the redirect flow');

    const { session, user } = await finishAtAppCallback(t);
    assert.ok(session.access_token && session.refresh_token);
    assert.ok(!user.email, 'Naver id_token carries no email');
    assert.equal(user.app_metadata.provider, 'custom:naver-mock');
    assert.equal(user.identities?.length, 1);
    assert.equal(user.identities![0].provider, 'custom:naver-mock');
    assert.equal(user.identities![0].id, SUB.alice); // auth.identities.provider_id
    for (const k of ['name', 'full_name', 'nickname', 'picture', 'avatar_url', 'email']) {
      assert.equal(user.user_metadata[k], undefined, `no ${k} in user_metadata`);
    }
    assert.equal(user.user_metadata.sub, SUB.alice);

    // GoTrue first tries client_secret_basic, Naver(mock) rejects, then client_secret_post works
    const log = (await mockLog()).filter((l) => l.at === 'token');
    assert.deepEqual(
      log.map((l) => [l.usedBasic, l.hasPostSecret]),
      [
        [true, false],
        [false, true],
      ],
    );

    // handle_new_user trigger ran; RLS (auth.uid()) works with this session
    const { data: rows, error } = await t.client.from('users').select('id, display_name, avatar_url');
    assert.equal(error, null);
    assert.deepEqual(rows, [{ id: user.id, display_name: '', avatar_url: '' }]);

    // refreshable session
    const r = await t.client.auth.refreshSession();
    assert.equal(r.error, null);
    assert.notEqual(r.data.session!.refresh_token, session.refresh_token);
    const g = await t.client.auth.getUser();
    assert.equal(g.data.user!.id, user.id);

    // provider tokens come back once (exchangeCodeForSession) -> usable for Naver revoke (P3-16)
    assert.ok(session.provider_token && session.provider_refresh_token);
    const revoke = await fetch(`${MOCK_BASE}/oauth2/revoke`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: 'p003-naver-client',
        client_secret: 'p003-naver-secret',
        token: session.provider_refresh_token!,
        token_type_hint: 'refresh_token',
      }),
    });
    assert.equal(revoke.status, 200);
  });

  test('A-2 같은 Naver 계정으로 다시 로그인하면 같은 Supabase 사용자', async () => {
    const first = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'alice' }));
    const second = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'alice' }));
    assert.equal(second.user.id, first.user.id);
    assert.equal((await countUsersWithIdentity(admin, 'custom:naver-mock', SUB.alice)).length, 1);
  });

  test('A-3 다른 Naver 계정은 다른 사용자', async () => {
    const a = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'alice' }));
    const b = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'bob' }));
    assert.notEqual(a.user.id, b.user.id);
    assert.equal(b.user.identities![0].id, SUB.bob);
  });

  test('A-4 동의 화면에서 취소(access_denied) → 앱 콜백에 error 전달, 사용자 생성 없음', async (ctx) => {
    const before = await allUserIds();
    const t = await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'idonly', deny: true });
    assert.equal(t.appCallbackUrl?.origin + t.appCallbackUrl!.pathname, 'http://127.0.0.1:3000/auth/callback');
    assert.equal(t.appCallbackUrl!.searchParams.get('code'), null);
    const err = callbackError(t.appCallbackUrl);
    ctx.diagnostic(`app callback: ${t.appCallbackUrl}`);
    assert.equal(err?.error, 'access_denied');
    assert.equal(err?.description, 'Canceled By User');
    assert.deepEqual(await allUserIds(), before);
  });

  test('A-5 state 변조 → GoTrue가 거부(bad_oauth_state), code 없음', async (ctx) => {
    const before = await allUserIds();
    const t = await oauthLogin({
      provider: 'custom:naver-mock',
      mockUser: 'idonly',
      tamperState: () => crypto.randomUUID(),
    });
    assert.equal(t.appCallbackUrl?.searchParams.get('code') ?? null, null);
    const err = callbackError(t.appCallbackUrl);
    ctx.diagnostic(`redirect: ${t.appCallbackUrl}`);
    assert.equal(err?.code, 'bad_oauth_state');
    // with an unknown state there is no flow_state -> GoTrue falls back to SITE_URL
    assert.equal(t.appCallbackUrl!.origin, 'http://127.0.0.1:3000');
    assert.deepEqual(await allUserIds(), before);
  });

  test('A-6 콜백 재전송(replay)과 다른 브라우저의 code 교환은 실패', async (ctx) => {
    const t = await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'alice' });
    // replay the same Naver -> GoTrue callback URL
    const internal = t.providerCallbackUrl!.toString().replace(PUBLIC_API_ORIGIN, process.env.SUPABASE_URL!);
    const replay = await fetch(internal, { redirect: 'manual' });
    const loc = new URL(replay.headers.get('location')!);
    assert.equal(loc.searchParams.get('code'), null);
    ctx.diagnostic(`replay -> ${JSON.stringify(callbackError(loc))}`);
    assert.ok(callbackError(loc), `replay must fail: ${loc}`);
    // the GoTrue auth code is bound to this browser's PKCE verifier
    const code = t.appCallbackUrl!.searchParams.get('code')!;
    const other = browserClient();
    const { error } = await other.auth.exchangeCodeForSession(code);
    ctx.diagnostic(`foreign exchange -> ${error?.message}`);
    assert.ok(error, 'code without the matching code_verifier must be rejected');
  });

  test('A-7 email_optional=false(기본값)면 로그인 실패 → 반드시 true로 생성', async (ctx) => {
    const t = await oauthLogin({ provider: 'custom:naver-mock-strict', mockUser: 'alice' });
    assert.equal(t.appCallbackUrl?.searchParams.get('code') ?? null, null);
    const err = callbackError(t.appCallbackUrl);
    ctx.diagnostic(JSON.stringify(err));
    assert.equal(err?.error, 'server_error');
    assert.match(err?.description ?? '', /email/i);
  });

  test('A-8 기존 계정과 같은 이메일의 Naver 사용자 → 자동 연결되지 않음(계정 탈취 없음)', async () => {
    const { data: victim, error } = await admin.auth.admin.createUser({
      email: 'victim@example.com',
      email_confirm: true,
      password: crypto.randomUUID(),
    });
    assert.equal(error, null);
    const s = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'collide' }));
    assert.notEqual(s.user.id, victim.user!.id);
    const v = await admin.auth.admin.getUserById(victim.user!.id);
    assert.deepEqual(
      v.data.user!.identities!.map((i) => i.provider),
      ['email'],
    );
  });

  test('A-9 계정 삭제(admin.deleteUser) → public.users cascade, 다시 로그인하면 새 사용자', async () => {
    const s1 = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'bob' }));
    const { error } = await admin.auth.admin.deleteUser(s1.user.id);
    assert.equal(error, null);
    const { data: rows } = await admin.from('users').select('id').eq('id', s1.user.id);
    assert.deepEqual(rows, []);
    const s2 = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'bob' }));
    assert.notEqual(s2.user.id, s1.user.id);
    assert.equal(s2.user.identities![0].id, SUB.bob);
  });

  test('A-10 queryParams는 Naver authorize URL로 전달됨 (예: appscheme=true, 인앱 브라우저용)', async () => {
    const t = await oauthLogin({
      provider: 'custom:naver-mock',
      mockUser: 'alice',
      queryParams: { appscheme: 'true' },
    });
    assert.equal(t.providerAuthorizeUrl!.searchParams.get('appscheme'), 'true');
    // note: GoTrue also forwards redirect_to as an extra param to the provider
    assert.equal(t.providerAuthorizeUrl!.searchParams.get('redirect_to'), 'http://127.0.0.1:3000/auth/callback');
  });

  test('A-11 수동 연결: 이메일 있는 계정(예: Google)에 Naver identity 추가 → 성공', async () => {
    const email = `linker-${Date.now()}@example.com`;
    const password = crypto.randomUUID();
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const client = browserClient();
    assert.equal((await client.auth.signInWithPassword({ email, password })).error, null);
    const t = await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'linker', client, link: true });
    const linked = await finishAtAppCallback(t);
    assert.equal(linked.user.id, u.user!.id);
    assert.deepEqual(linked.user.identities!.map((i) => i.provider).sort(), ['custom:naver-mock', 'email']);
    // afterwards the Naver login lands on the same (Google/email) user
    const again = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'linker' }));
    assert.equal(again.user.id, u.user!.id);
  });

  test('A-12 수동 연결: 이메일 없는 계정끼리(Naver→이메일 없는 다른 provider)는 GoTrue가 거부', async (ctx) => {
    const t0 = await oauthLogin({ provider: 'custom:naver-mock', mockUser: 'idonly' });
    await finishAtAppCallback(t0); // t0.client now holds the session of an email-less user
    const t = await oauthLogin({ provider: 'custom:naver-adapter', mockUser: 'idonly', client: t0.client, link: true });
    const err = callbackError(t.appCallbackUrl);
    ctx.diagnostic(JSON.stringify(err));
    assert.equal(t.appCallbackUrl?.searchParams.get('code') ?? null, null);
    assert.equal(err?.error, 'server_error');
    assert.match(err?.description ?? '', /confirmation email/i);
  });
});

describe('원안: OAuth2 provider를 중첩 userinfo(/v1/nid/me)에 직접 연결', () => {
  for (const provider of ['custom:naver-nested', 'custom:naver-mapped'] as const) {
    test(`${provider} → 로그인 실패 (sub 비어 있음), 사용자 생성 없음`, async (ctx) => {
      const before = await allUserIds();
      const t = await oauthLogin({ provider, mockUser: 'alice' });
      assert.equal(t.appCallbackUrl?.searchParams.get('code') ?? null, null);
      const err = callbackError(t.appCallbackUrl);
      ctx.diagnostic(JSON.stringify(err));
      assert.equal(err?.error, 'server_error');
      assert.match(err?.description ?? '', /identity|provider id/i);
      assert.deepEqual(await allUserIds(), before);
    });
  }
});

describe('대안 B: OAuth2 provider + userinfo 어댑터(평탄화)', () => {
  test('B-1 어댑터 경유 로그인 성공, identity = Naver response.id, 프로필 최소 전달', async () => {
    const first = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-adapter', mockUser: 'alice' }));
    assert.equal(first.user.identities![0].provider, 'custom:naver-adapter');
    assert.equal(first.user.identities![0].id, SUB.alice);
    assert.ok(!first.user.email);
    assert.equal(first.user.user_metadata.nickname, undefined);
    const again = await finishAtAppCallback(await oauthLogin({ provider: 'custom:naver-adapter', mockUser: 'alice' }));
    assert.equal(again.user.id, first.user.id);
    // separate provider identifier -> separate identity/user from custom:naver-mock (expected)
  });
});
