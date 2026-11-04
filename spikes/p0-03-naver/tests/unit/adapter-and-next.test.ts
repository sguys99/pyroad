import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenNaverProfile, handleNaverUserinfoAdapter } from '../../adapter/naverUserinfoAdapter.ts';
import { safeNext } from '../../bridge/safeNext.ts';
import { samples } from '../helpers/fakeNaver.ts';

describe('대안 B userinfo adapter', () => {
  test('flatten: sub only by default (no email/name/mobile), profile opt-in', () => {
    assert.deepEqual(flattenNaverProfile(samples.userinfo.fullConsent), { sub: samples.userinfo.fullConsent.response.id });
    assert.deepEqual(flattenNaverProfile(samples.userinfo.fullConsent, true), {
      sub: samples.userinfo.fullConsent.response.id,
      nickname: '코딩앨리스',
      picture: samples.userinfo.fullConsent.response.profile_image,
    });
    assert.deepEqual(flattenNaverProfile(samples.userinfo.identifierOnly, true), {
      sub: samples.userinfo.identifierOnly.response.id,
    });
    assert.equal(flattenNaverProfile(samples.userinfo.invalidToken), null);
    assert.equal(flattenNaverProfile({ resultcode: '00', message: 'success', response: { id: '' } }), null);
  });

  test('handler: bearer 필수, Naver 401 → 401, resultcode≠00 → 502', async () => {
    const ok = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;
    const req = (auth?: string) => new Request('https://pyroad.example/api/auth/naver/userinfo', { headers: auth ? { authorization: auth } : {} });
    assert.equal((await handleNaverUserinfoAdapter(req(), { fetchImpl: ok({}) })).status, 401);
    const good = await handleNaverUserinfoAdapter(req('Bearer AAAAQosjWDJieBiQZc3to9YQp6HD'), { fetchImpl: ok(samples.userinfo.noEmail) });
    assert.equal(good.status, 200);
    assert.deepEqual(await good.json(), { sub: samples.userinfo.noEmail.response.id });
    assert.equal(good.headers.get('cache-control'), 'no-store');
    const expired = await handleNaverUserinfoAdapter(req('Bearer AAAAQosjWDJieBiQZc3to9YQp6HD'), {
      fetchImpl: ok(samples.userinfo.invalidToken, 401),
    });
    assert.equal(expired.status, 401);
    const weird = await handleNaverUserinfoAdapter(req('Bearer AAAAQosjWDJieBiQZc3to9YQp6HD'), {
      fetchImpl: ok({ resultcode: '00', message: 'success', response: {} }),
    });
    assert.equal(weird.status, 502);
  });
});

describe('safeNext (B23 open redirect)', () => {
  test('허용 경로만 통과, 나머지는 /world', () => {
    assert.equal(safeNext('/world'), '/world');
    assert.equal(safeNext('/quest/1?step=2'), '/quest/1?step=2');
    assert.equal(safeNext(null), '/world');
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example/world',
      '%2F%2Fevil.example',
      '/%5Cevil.example',
      'javascript:alert(1)',
      '/world\n//evil',
      '/admin',
      'world',
      '/%E0%A4%A',
    ]) {
      assert.equal(safeNext(bad), '/world', bad);
    }
  });
});
