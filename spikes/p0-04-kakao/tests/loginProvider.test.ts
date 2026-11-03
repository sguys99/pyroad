import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  providerFromIssuer,
  resolveLoginProvider,
  pickIdentityData,
  lastLoginBadgeText,
} from '../src/loginProvider.ts';
import { normalizeProviderMetadata } from '../src/normalizeProviderMetadata.ts';
import * as fx from '../fixtures/metadata.ts';

describe('providerFromIssuer', () => {
  it('GoTrue 가 넣는 iss 값으로 provider 를 판별한다', () => {
    assert.equal(providerFromIssuer('https://accounts.google.com'), 'google');
    assert.equal(providerFromIssuer('https://kapi.kakao.com'), 'kakao'); // 내장 OAuth
    assert.equal(providerFromIssuer('https://kauth.kakao.com'), 'kakao'); // OIDC
    assert.equal(providerFromIssuer('https://nid.naver.com'), 'naver');
    assert.equal(providerFromIssuer('https://evil.example'), null);
    assert.equal(providerFromIssuer('kapi.kakao.com'), null); // 스킴 없는 값은 거부
    assert.equal(providerFromIssuer(undefined), null);
  });
});

describe('resolveLoginProvider (/auth/callback 의 ?lp= 검증)', () => {
  const identities = [
    { provider: 'google', created_at: '2026-01-01T00:00:00Z' },
    { provider: 'custom:kakao', created_at: '2026-11-03T00:00:00Z' },
  ];

  it('연결된 identity 와 일치하면 그 provider', () => {
    assert.equal(resolveLoginProvider('kakao', identities), 'kakao');
    assert.equal(resolveLoginProvider('google', identities), 'google');
  });

  it('연결되지 않은 provider·이상한 값은 null (저장하지 않음)', () => {
    assert.equal(resolveLoginProvider('naver', identities), null);
    assert.equal(resolveLoginProvider('<script>', identities), null);
    assert.equal(resolveLoginProvider(null, identities), null);
    assert.equal(resolveLoginProvider('kakao', undefined), null);
  });
});

describe('pickIdentityData (연결 계정의 메타데이터 섞임 방지)', () => {
  it('user_metadata 를 그대로 정규화하면 Google 이메일이 Kakao 것으로 잘못 잡힌다', () => {
    const wrong = normalizeProviderMetadata('kakao', fx.mergedGoogleThenKakao);
    assert.equal(wrong.email, 'minjun.parent@gmail.com');
  });

  it('identity_data 를 provider 별로 고르면 정확하다', () => {
    const identities = [
      { provider: 'google', identity_data: fx.google, created_at: '2026-01-01T00:00:00Z' },
      { provider: 'kakao', identity_data: fx.kakaoOAuthNoEmail, created_at: '2026-11-03T00:00:00Z' },
    ];
    const kakao = pickIdentityData(identities, 'kakao');
    assert.equal(normalizeProviderMetadata('kakao', kakao).email, null);
    assert.equal(pickIdentityData(identities, 'naver'), null);
  });
});

describe('lastLoginBadgeText', () => {
  it('localStorage 값으로 배지 문구', () => {
    assert.equal(lastLoginBadgeText('kakao'), '최근에 카카오로 로그인했어요');
    assert.equal(lastLoginBadgeText('custom:naver'), '최근에 네이버로 로그인했어요');
    assert.equal(lastLoginBadgeText('garbage'), null);
  });
});
