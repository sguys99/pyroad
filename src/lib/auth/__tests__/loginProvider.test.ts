import { describe, it, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  lastLoginBadgeText,
  linkedProviders,
  loginProviderFromUser,
  pickIdentityData,
  providerFromIssuer,
  resolveLoginProvider,
  toSocialProvider,
} from '../loginProvider';
import { normalizeProviderMetadata } from '../normalizeProviderMetadata';
import * as fx from './fixtures/providerMetadata';

// P0-04 스파이크 tests/loginProvider.test.ts 이관 + loginProviderFromUser (P3-18)

describe('toSocialProvider', () => {
  it('내장·커스텀 provider 이름을 3종으로 정규화한다', () => {
    expect(toSocialProvider('google')).toBe('google');
    expect(toSocialProvider('kakao')).toBe('kakao');
    expect(toSocialProvider('custom:kakao')).toBe('kakao');
    expect(toSocialProvider('custom:naver')).toBe('naver');
    expect(toSocialProvider(' NAVER ')).toBe('naver');
    expect(toSocialProvider('email')).toBeNull();
    expect(toSocialProvider(undefined)).toBeNull();
  });
});

describe('providerFromIssuer', () => {
  it('GoTrue 가 넣는 iss 값으로 provider 를 판별한다 (DB social_login_provider 와 같음)', () => {
    expect(providerFromIssuer('https://accounts.google.com')).toBe('google');
    expect(providerFromIssuer('https://kapi.kakao.com')).toBe('kakao'); // 내장 OAuth
    expect(providerFromIssuer('https://kauth.kakao.com')).toBe('kakao'); // OIDC
    expect(providerFromIssuer('https://nid.naver.com')).toBe('naver');
  });

  it('모르는 값·비슷한 값은 null', () => {
    expect(providerFromIssuer('https://evil.example')).toBeNull();
    expect(providerFromIssuer('kapi.kakao.com')).toBeNull(); // 스킴 없음
    expect(providerFromIssuer('https://nid.naver.com.evil.example')).toBeNull();
    expect(providerFromIssuer('toString')).toBeNull(); // 프로토타입 키
    expect(providerFromIssuer('__proto__')).toBeNull();
    expect(providerFromIssuer(undefined)).toBeNull();
    expect(providerFromIssuer(42)).toBeNull();
  });
});

describe('loginProviderFromUser (P3-08 최근 로그인, user_metadata.iss 우선)', () => {
  it('iss 가 있으면 iss 로 판별한다 (app_metadata.provider 는 첫 identity 라 무시)', () => {
    // Google 가입 → Kakao 연결 → Kakao 로그인
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'google', providers: ['google', 'kakao'] },
        user_metadata: fx.mergedGoogleThenKakao,
        identities: [{ provider: 'google' }, { provider: 'kakao' }],
      }),
    ).toBe('kakao');
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'custom:naver' },
        user_metadata: fx.naverOidcIdOnly,
      }),
    ).toBe('naver');
  });

  it('iss 를 모르면 연결된 소셜 provider 가 하나일 때만 그것', () => {
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'custom:naver', providers: ['custom:naver'] },
        user_metadata: {},
      }),
    ).toBe('naver');
    expect(
      loginProviderFromUser({
        user_metadata: {},
        identities: [{ provider: 'kakao' }, { provider: 'custom:kakao' }],
      }),
    ).toBe('kakao');
  });

  it('여러 provider 가 연결돼 있고 iss 가 없으면 추측하지 않는다', () => {
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'google', providers: ['google', 'kakao'] },
        user_metadata: { iss: 'https://evil.example' },
      }),
    ).toBeNull();
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'google' },
        user_metadata: {},
        identities: [{ provider: 'google' }, { provider: 'kakao' }],
      }),
    ).toBeNull();
  });

  it('사용자가 없거나 소셜이 아닌 provider 면 null', () => {
    expect(loginProviderFromUser(null)).toBeNull();
    expect(loginProviderFromUser(undefined)).toBeNull();
    expect(
      loginProviderFromUser({
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
      }),
    ).toBeNull();
  });

  it('Supabase User 타입을 그대로 받는다', () => {
    const user = {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      created_at: '2026-11-03T00:00:00Z',
      app_metadata: { provider: 'kakao', providers: ['kakao'] },
      user_metadata: fx.kakaoOAuthNoEmail,
      identities: [
        {
          id: '4012345678',
          identity_id: '00000000-0000-0000-0000-000000000002',
          user_id: '00000000-0000-0000-0000-000000000001',
          provider: 'kakao',
          identity_data: fx.kakaoOAuthNoEmail,
          created_at: '2026-11-03T00:00:00Z',
          last_sign_in_at: '2026-11-03T00:00:00Z',
        },
      ],
    } satisfies User;
    expect(loginProviderFromUser(user)).toBe('kakao');
    expect(linkedProviders(user)).toEqual(['kakao']);
  });
});

describe('linkedProviders', () => {
  it('identities 가 있으면 그것을, 없으면 app_metadata 를 본다 (중복·비소셜 제외)', () => {
    expect(
      linkedProviders({
        identities: [
          { provider: 'google' },
          { provider: 'email' },
          { provider: 'custom:naver' },
          { provider: 'google' },
        ],
      }),
    ).toEqual(['google', 'naver']);
    expect(
      linkedProviders({
        app_metadata: { providers: ['kakao', 'custom:naver'] },
      }),
    ).toEqual(['kakao', 'naver']);
    expect(linkedProviders({ app_metadata: { provider: 'google' } })).toEqual([
      'google',
    ]);
    expect(linkedProviders({})).toEqual([]);
  });
});

describe('resolveLoginProvider (/auth/callback 의 요청 provider 검증)', () => {
  const identities = [
    { provider: 'google', created_at: '2026-01-01T00:00:00Z' },
    { provider: 'custom:kakao', created_at: '2026-11-03T00:00:00Z' },
  ];

  it('연결된 identity 와 일치하면 그 provider', () => {
    expect(resolveLoginProvider('kakao', identities)).toBe('kakao');
    expect(resolveLoginProvider('google', identities)).toBe('google');
  });

  it('연결되지 않은 provider·이상한 값은 null (저장하지 않음)', () => {
    expect(resolveLoginProvider('naver', identities)).toBeNull();
    expect(resolveLoginProvider('<script>', identities)).toBeNull();
    expect(resolveLoginProvider(null, identities)).toBeNull();
    expect(resolveLoginProvider('kakao', undefined)).toBeNull();
  });
});

describe('pickIdentityData (연결 계정의 메타데이터 섞임 방지)', () => {
  it('user_metadata 를 그대로 정규화하면 Google 이메일이 Kakao 것으로 잘못 잡힌다', () => {
    const wrong = normalizeProviderMetadata('kakao', fx.mergedGoogleThenKakao);
    expect(wrong.email).toBe('minjun.parent@gmail.com');
  });

  it('identity_data 를 provider 별로 고르면 정확하다', () => {
    const identities = [
      {
        provider: 'google',
        identity_data: fx.google,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        provider: 'kakao',
        identity_data: fx.kakaoOAuthNoEmail,
        created_at: '2026-11-03T00:00:00Z',
      },
    ];
    const kakao = pickIdentityData(identities, 'kakao');
    expect(normalizeProviderMetadata('kakao', kakao).email).toBeNull();
    expect(pickIdentityData(identities, 'naver')).toBeNull();
    expect(pickIdentityData(undefined, 'kakao')).toBeNull();
  });

  it('같은 provider identity 가 여럿이면 가장 최근 것', () => {
    const identities = [
      {
        provider: 'kakao',
        identity_data: { sub: 'old' },
        last_sign_in_at: '2026-01-01T00:00:00Z',
      },
      {
        provider: 'custom:kakao',
        identity_data: { sub: 'new' },
        last_sign_in_at: '2026-11-03T00:00:00Z',
      },
    ];
    expect(pickIdentityData(identities, 'kakao')).toEqual({ sub: 'new' });
  });
});

describe('lastLoginBadgeText', () => {
  it('브라우저 저장값으로 배지 문구', () => {
    expect(lastLoginBadgeText('kakao')).toBe('최근에 카카오로 로그인했어요');
    expect(lastLoginBadgeText('custom:naver')).toBe(
      '최근에 네이버로 로그인했어요',
    );
    expect(lastLoginBadgeText('google')).toBe('최근에 Google로 로그인했어요');
    expect(lastLoginBadgeText('garbage')).toBeNull();
    expect(lastLoginBadgeText(null)).toBeNull();
  });
});
