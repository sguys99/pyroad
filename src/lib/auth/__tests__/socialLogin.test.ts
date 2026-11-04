import { describe, it, expect } from 'vitest';
import {
  getOAuthCredentials,
  needsExternalBrowser,
  KAKAO_SCOPE,
  NAVER_PROVIDER_ID,
  type SocialProvider,
} from '../socialLogin';

const origin = 'https://pyroad.vercel.app';

describe('getOAuthCredentials (P1-14)', () => {
  it('Google: 내장 provider, 기존 /auth/callback 그대로 (추가 옵션 없음)', () => {
    expect(getOAuthCredentials('google', { origin })).toEqual({
      provider: 'google',
      options: { redirectTo: `${origin}/auth/callback` },
    });
  });

  it('Kakao: 내장 kakao + queryParams.scope로 덮어쓰기, options.scopes는 쓰지 않음', () => {
    const creds = getOAuthCredentials('kakao', { origin });
    expect(creds.provider).toBe('kakao');
    expect(creds.options?.redirectTo).toBe(`${origin}/auth/callback`);
    expect(creds.options?.queryParams).toEqual({ scope: KAKAO_SCOPE });
    expect(creds.options).not.toHaveProperty('scopes');
  });

  it('Kakao: scope 값이 빈 문자열이어도 키는 항상 보냄 (빠지면 GoTrue 기본 account_email → KOE205)', () => {
    const creds = getOAuthCredentials('kakao', { origin });
    expect(Object.keys(creds.options?.queryParams ?? {})).toContain('scope');
    // supabase-js가 인가 URL에 붙이는 형태
    const query = new URLSearchParams(creds.options?.queryParams).toString();
    expect(query).toBe(`scope=${encodeURIComponent(KAKAO_SCOPE)}`);
  });

  it('Kakao: 기본 scope는 식별자만 (이메일·사진 요청 없음, §12-Q16)', () => {
    expect(KAKAO_SCOPE).toBe('');
    expect(KAKAO_SCOPE).not.toMatch(/account_email|profile_image/);
  });

  it('Naver: 커스텀 OIDC provider custom:naver, 추가 옵션 없음', () => {
    expect(NAVER_PROVIDER_ID).toBe('custom:naver');
    expect(getOAuthCredentials('naver', { origin })).toEqual({
      provider: 'custom:naver',
      options: { redirectTo: `${origin}/auth/callback` },
    });
  });

  it('next를 주면 콜백 쿼리에 인코딩해서 붙임 (계정 연결 후 /settings 복귀 등)', () => {
    const creds = getOAuthCredentials('kakao', {
      origin,
      next: '/settings?tab=account',
    });
    const redirect = new URL(creds.options!.redirectTo!);
    expect(redirect.origin).toBe(origin);
    expect(redirect.pathname).toBe('/auth/callback');
    expect(redirect.searchParams.get('next')).toBe('/settings?tab=account');
  });
});

describe('needsExternalBrowser (B16)', () => {
  const providers: SocialProvider[] = ['google', 'kakao', 'naver'];

  it('인앱 브라우저에서는 Google만 외부 브라우저로 보냄', () => {
    expect(
      providers.filter((p) => needsExternalBrowser(p, { isInApp: true })),
    ).toEqual(['google']);
  });

  it('일반 브라우저에서는 어떤 provider도 외부로 보내지 않음', () => {
    expect(
      providers.filter((p) => needsExternalBrowser(p, { isInApp: false })),
    ).toEqual([]);
  });
});
