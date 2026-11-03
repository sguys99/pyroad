import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { completeNaverLogin, revokeNaverToken, startNaverLogin, STATE_COOKIE } from '../../bridge/naverBridge.ts';
import { syntheticEmail } from '../../bridge/supabaseAdapters.ts';
import { CFG, fakeNaverFetch, fakeSessions, memoryUsers, samples } from '../helpers/fakeNaver.ts';

const SECRET = 'state-secret-for-tests';
const NOW = 1_793_700_000;

function begin(next?: string) {
  const s = startNaverLogin(CFG, { next, stateSecret: SECRET, nowSec: NOW });
  const state = new URL(s.url).searchParams.get('state')!;
  return { ...s, state };
}
function callback(params: Record<string, string>) {
  return new URL(`${CFG.redirectUri}?${new URLSearchParams(params)}`);
}

describe('대안 C bridge: start', () => {
  test('authorize URL + signed, httpOnly, Lax state cookie scoped to /auth/naver', () => {
    const s = begin('/quest/abc');
    const u = new URL(s.url);
    assert.equal(u.origin + u.pathname, 'https://nid.naver.com/oauth2.0/authorize');
    assert.equal(u.searchParams.get('response_type'), 'code');
    assert.equal(u.searchParams.get('client_id'), CFG.clientId);
    assert.equal(u.searchParams.get('redirect_uri'), CFG.redirectUri);
    assert.ok(s.state.length >= 43);
    assert.equal(s.cookie.name, STATE_COOKIE);
    assert.deepEqual(s.cookie.options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/naver', maxAge: 600 });
    assert.ok(!s.cookie.value.includes(CFG.clientSecret));
  });
});

describe('대안 C bridge: callback', () => {
  test('happy path (full consent) → user + session, next preserved', async () => {
    const s = begin('/quest/abc');
    const naver = fakeNaverFetch({ account: 'fullConsent' });
    const users = memoryUsers();
    const r = await completeNaverLogin(
      CFG,
      { url: callback({ code: 'c1', state: s.state }), stateCookie: s.cookie.value, stateSecret: SECRET, nowSec: NOW + 5 },
      { fetchImpl: naver.impl, users, sessions: fakeSessions },
    );
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.created, true);
    assert.equal(r.next, '/quest/abc');
    assert.equal(users.byNaverId.get(samples.userinfo.fullConsent.response.id), r.userId);
    assert.deepEqual(naver.calls, ['/oauth2.0/token', '/v1/nid/me']);
    assert.ok(r.naverTokens.refresh_token, 'keep for revoke on account deletion (P3-16)');
  });

  test('이메일 없는 사용자(noEmail, identifierOnly)도 가입된다', async () => {
    for (const account of ['noEmail', 'identifierOnly'] as const) {
      const s = begin();
      const r = await completeNaverLogin(
        CFG,
        { url: callback({ code: 'c', state: s.state }), stateCookie: s.cookie.value, stateSecret: SECRET, nowSec: NOW },
        { fetchImpl: fakeNaverFetch({ account }).impl, users: memoryUsers(), sessions: fakeSessions },
      );
      assert.equal(r.ok, true, account);
    }
  });

  test('재로그인하면 같은 사용자(키 = Naver id)', async () => {
    const users = memoryUsers();
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const s = begin();
      const r = await completeNaverLogin(
        CFG,
        { url: callback({ code: `c${i}`, state: s.state }), stateCookie: s.cookie.value, stateSecret: SECRET, nowSec: NOW },
        { fetchImpl: fakeNaverFetch({ account: 'noEmail' }).impl, users, sessions: fakeSessions },
      );
      assert.ok(r.ok);
      if (r.ok) ids.push(r.userId);
    }
    assert.equal(ids[0], ids[1]);
    assert.equal(users.byNaverId.size, 1);
  });

  test('동의 취소(error=access_denied) → cancelled, 토큰 요청 없음', async () => {
    const s = begin();
    const naver = fakeNaverFetch();
    const r = await completeNaverLogin(
      CFG,
      {
        url: callback({ state: s.state, error: 'access_denied', error_description: 'Canceled By User' }),
        stateCookie: s.cookie.value,
        stateSecret: SECRET,
        nowSec: NOW,
      },
      { fetchImpl: naver.impl, users: memoryUsers(), sessions: fakeSessions },
    );
    assert.deepEqual(r, { ok: false, reason: 'cancelled', next: '/', clearCookie: true });
    assert.deepEqual(naver.calls, []);
  });

  test('state 불일치 / 쿠키 없음 / 서명 위조 / 만료 → 거부, 토큰 요청 없음', async () => {
    const s = begin();
    const other = begin();
    const forged = s.cookie.value.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
    const cases: Array<[string, string | undefined, number, string]> = [
      ['state_mismatch', s.cookie.value, NOW, other.state],
      ['state_missing', undefined, NOW, s.state],
      ['state_invalid', forged, NOW, s.state],
      ['state_expired', s.cookie.value, NOW + 601, s.state],
    ];
    for (const [reason, cookie, now, state] of cases) {
      const naver = fakeNaverFetch();
      const r = await completeNaverLogin(
        CFG,
        { url: callback({ code: 'c', state }), stateCookie: cookie, stateSecret: SECRET, nowSec: now },
        { fetchImpl: naver.impl, users: memoryUsers(), sessions: fakeSessions },
      );
      assert.equal(r.ok ? 'ok' : r.reason, reason);
      assert.deepEqual(naver.calls, [], `${reason}: no token request`);
    }
  });

  test('토큰 오류(HTTP 200 + error), 프로필 오류(resultcode 024) → 실패 처리', async () => {
    const s1 = begin();
    const t = await completeNaverLogin(
      CFG,
      { url: callback({ code: 'used', state: s1.state }), stateCookie: s1.cookie.value, stateSecret: SECRET, nowSec: NOW },
      { fetchImpl: fakeNaverFetch({ tokenError: true }).impl, users: memoryUsers(), sessions: fakeSessions },
    );
    assert.equal(t.ok ? 'ok' : t.reason, 'token_error');
    const s2 = begin();
    const p = await completeNaverLogin(
      CFG,
      { url: callback({ code: 'c', state: s2.state }), stateCookie: s2.cookie.value, stateSecret: SECRET, nowSec: NOW },
      { fetchImpl: fakeNaverFetch({ account: 'invalidToken' }).impl, users: memoryUsers(), sessions: fakeSessions },
    );
    assert.equal(p.ok ? 'ok' : p.reason, 'profile_error');
  });

  test('revoke(연동 해제)는 HTTP 200만 성공으로 본다', async () => {
    assert.equal(await revokeNaverToken(CFG, 'rt', 'refresh_token', fakeNaverFetch().impl), true);
  });

  test('합성 이메일: Naver id + pepper로 결정적, id 노출 없음', () => {
    const id = samples.userinfo.noEmail.response.id;
    const a = syntheticEmail(id, 'pepper-1');
    assert.equal(a, syntheticEmail(id, 'pepper-1'));
    assert.notEqual(a, syntheticEmail(id, 'pepper-2'));
    assert.ok(!a.includes(id));
    assert.match(a, /^n_[0-9a-f]{40}@/);
  });
});
