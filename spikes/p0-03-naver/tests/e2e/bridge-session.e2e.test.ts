/**
 * 대안 C bridge end-to-end against real GoTrue + mock Naver (legacy endpoints):
 * start -> Naver authorize -> callback -> token -> /v1/nid/me -> admin.createUser (synthetic email)
 * -> generateLink + verifyOtp -> real, refreshable Supabase session.
 */
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { completeNaverLogin, startNaverLogin } from '../../bridge/naverBridge.ts';
import { supabaseSessionIssuer, supabaseUserDirectory, syntheticEmail } from '../../bridge/supabaseAdapters.ts';
import { adminClient, browserClient, MOCK_BASE, ANON_KEY, SUPABASE_URL, memoryStorage } from '../helpers/e2e.ts';

const admin = adminClient();
const PEPPER = 'p003-test-pepper';
const SECRET = 'p003-state-secret';
const CFG = {
  clientId: 'p003-naver-client',
  clientSecret: 'p003-naver-secret',
  redirectUri: 'http://127.0.0.1:3000/auth/naver/callback',
  endpoints: {
    authorize: `${MOCK_BASE}/oauth2.0/authorize`,
    token: `${MOCK_BASE}/oauth2.0/token`,
    me: `${MOCK_BASE}/v1/nid/me`,
    revoke: `${MOCK_BASE}/oauth2.0/revoke`,
  },
};
const BOB = 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq';

async function bridgeLogin(mockUser: string) {
  const start = startNaverLogin(CFG, { next: '/world', stateSecret: SECRET, secureCookie: false });
  const az = new URL(start.url);
  az.searchParams.set('mock_user', mockUser);
  const res = await fetch(az, { redirect: 'manual' });
  const cb = new URL(res.headers.get('location')!);
  return completeNaverLogin(
    CFG,
    { url: cb, stateCookie: start.cookie.value, stateSecret: SECRET },
    {
      users: supabaseUserDirectory(admin, PEPPER),
      sessions: supabaseSessionIssuer(admin, () => browserClient(), PEPPER),
    },
  );
}

before(async () => {
  const email = syntheticEmail(BOB, PEPPER);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data?.users ?? []) if (u.email === email) await admin.auth.admin.deleteUser(u.id);
});

describe('대안 C: server bridge + generateLink/verifyOtp (이메일 없는 Naver 사용자)', () => {
  test('C-1 첫 로그인 → 실제 GoTrue 세션 (refresh·getUser·RLS 동작), 합성 이메일 사용자', async () => {
    const r = await bridgeLogin('bob'); // bob declined email
    assert.equal(r.ok, true, JSON.stringify(r));
    if (!r.ok) return;
    assert.equal(r.created, true);

    const c = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { storage: memoryStorage(), autoRefreshToken: false, detectSessionInUrl: false },
    });
    await c.auth.setSession(r.session);
    const g = await c.auth.getUser();
    assert.equal(g.data.user?.id, r.userId);
    assert.equal(g.data.user?.email, syntheticEmail(BOB, PEPPER));
    assert.equal(g.data.user?.app_metadata.naver_id, BOB);
    assert.deepEqual(g.data.user?.identities?.map((i) => i.provider), ['email']);

    const { data: rows, error } = await c.from('users').select('id');
    assert.equal(error, null);
    assert.deepEqual(rows, [{ id: r.userId }]);

    const refreshed = await c.auth.refreshSession();
    assert.equal(refreshed.error, null);
  });

  test('C-2 재로그인 → 같은 사용자', async () => {
    const a = await bridgeLogin('bob');
    const b = await bridgeLogin('bob');
    assert.ok(a.ok && b.ok);
    if (a.ok && b.ok) {
      assert.equal(a.userId, b.userId);
      assert.equal(b.created, false);
    }
  });
});
