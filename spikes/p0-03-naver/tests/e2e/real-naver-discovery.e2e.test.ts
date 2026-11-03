/**
 * Talks to the REAL Naver OIDC metadata through a real GoTrue (no Naver app needed):
 * - admin.customProviders.createProvider with issuer https://nid.naver.com
 *   (GoTrue fetches and validates https://nid.naver.com/.well-known/openid-configuration)
 * - GoTrue /authorize builds the real Naver authorize URL
 * Uses a dummy client_id, so no login can complete. Set RUN_REAL_NAVER_DISCOVERY=0 to skip.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { adminClient, browserClient, APP_CALLBACK, PUBLIC_API_ORIGIN, SUPABASE_URL } from '../helpers/e2e.ts';

const run = process.env.RUN_REAL_NAVER_DISCOVERY !== '0';
const admin = adminClient();
const created: string[] = [];

after(async () => {
  for (const id of created) await admin.auth.admin.customProviders.deleteProvider(id);
});

describe('real Naver metadata via GoTrue admin API', { skip: !run }, () => {
  test('R-1 custom:naver (OIDC, issuer https://nid.naver.com) 생성 성공 → GoTrue가 실제 discovery 검증', async (ctx) => {
    await admin.auth.admin.customProviders.deleteProvider('custom:naver');
    const { data, error } = await admin.auth.admin.customProviders.createProvider({
      provider_type: 'oidc',
      identifier: 'custom:naver',
      name: 'Naver',
      client_id: 'p003-dummy-client-id',
      client_secret: 'p003-dummy-secret',
      issuer: 'https://nid.naver.com',
      scopes: ['openid'],
      email_optional: true,
    } as never);
    assert.equal(error, null, error?.message);
    created.push('custom:naver');
    const doc = (data as unknown as { discovery_document?: Record<string, unknown> }).discovery_document;
    ctx.diagnostic(`provider: ${JSON.stringify({ ...data, client_secret: undefined }).slice(0, 600)}`);
    if (doc) assert.equal(doc.issuer, 'https://nid.naver.com');
  });

  test('R-2 signInWithOAuth(custom:naver) → 실제 Naver OIDC authorize URL', async (ctx) => {
    const client = browserClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'custom:naver',
      options: { redirectTo: APP_CALLBACK, skipBrowserRedirect: true },
    });
    assert.equal(error, null);
    const res = await fetch(data.url!.replace(PUBLIC_API_ORIGIN, SUPABASE_URL), { redirect: 'manual' });
    const loc = new URL(res.headers.get('location')!);
    ctx.diagnostic(`authorize: ${loc.origin}${loc.pathname}?${[...loc.searchParams.keys()].join('&')}`);
    assert.equal(loc.origin + loc.pathname, 'https://nid.naver.com/oauth2/authorize');
    assert.equal(loc.searchParams.get('client_id'), 'p003-dummy-client-id');
    assert.equal(loc.searchParams.get('scope'), 'openid');
    assert.equal(loc.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(loc.searchParams.get('redirect_uri'), `${PUBLIC_API_ORIGIN}/auth/v1/callback`);

    // one request to Naver with the dummy client, just to see the endpoint answers (no login possible)
    const naver = await fetch(loc, { redirect: 'manual' });
    ctx.diagnostic(`naver /oauth2/authorize with dummy client -> HTTP ${naver.status} ${naver.headers.get('location') ?? ''}`.slice(0, 300));
    assert.ok(naver.status < 500);
  });

  test('R-3 SSRF 가드: http:// issuer는 생성 거부', async () => {
    const { error } = await admin.auth.admin.customProviders.createProvider({
      provider_type: 'oidc',
      identifier: 'custom:naver-http',
      name: 'x',
      client_id: 'x',
      client_secret: 'x',
      issuer: 'http://nid.naver.com',
      scopes: ['openid'],
    } as never);
    assert.ok(error);
    assert.match(error.message, /HTTPS/i);
  });

  test('R-4 원안 설정(OAuth2 + https://openapi.naver.com/v1/nid/me)은 생성 자체는 성공 → 실패는 로그인 때 드러남', async () => {
    await admin.auth.admin.customProviders.deleteProvider('custom:naver-legacy');
    const { error } = await admin.auth.admin.customProviders.createProvider({
      provider_type: 'oauth2',
      identifier: 'custom:naver-legacy',
      name: 'Naver legacy',
      client_id: 'p003-dummy-client-id',
      client_secret: 'p003-dummy-secret',
      authorization_url: 'https://nid.naver.com/oauth2.0/authorize',
      token_url: 'https://nid.naver.com/oauth2.0/token',
      userinfo_url: 'https://openapi.naver.com/v1/nid/me',
      scopes: [],
      email_optional: true,
      attribute_mapping: { sub: 'response.id' },
    } as never);
    assert.equal(error, null, error?.message);
    created.push('custom:naver-legacy');
  });
});
