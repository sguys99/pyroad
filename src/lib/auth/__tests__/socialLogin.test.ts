import { describe, it, expect } from 'vitest';
import {
  getOAuthCredentials,
  needsExternalBrowser,
  KAKAO_SCOPE,
  NAVER_PROVIDER_ID,
  NAVER_APPSCHEME_ON_ANDROID,
  SHARED_DEVICE_PARAMS,
  type SocialProvider,
} from '../socialLogin';
import { parseLoginProviders } from '../enabledProviders';

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

  it('Naver: Android면 "네이버 앱으로 자동로그인" appscheme=true, iOS·PC는 붙이지 않음 (P3-09)', () => {
    expect(NAVER_APPSCHEME_ON_ANDROID).toBe(true);
    expect(
      getOAuthCredentials('naver', { origin, device: { isAndroid: true } })
        .options?.queryParams,
    ).toEqual({ appscheme: 'true' });
    expect(
      getOAuthCredentials('naver', { origin, device: { isAndroid: false } })
        .options?.queryParams,
    ).toBeUndefined();
    // 다른 provider에는 영향 없음 (Kakao scope 덮어쓰기는 그대로, Google은 옵션 없음)
    expect(
      getOAuthCredentials('kakao', { origin, device: { isAndroid: true } })
        .options?.queryParams,
    ).toEqual({ scope: KAKAO_SCOPE });
    expect(
      getOAuthCredentials('google', { origin, device: { isAndroid: true } })
        .options?.queryParams,
    ).toBeUndefined();
  });

  it.each(['google', 'kakao', 'naver'] as const)(
    '%s: next가 없으면 redirectTo는 쿼리 없는 콜백 주소 그대로 (B43: Redirect URLs 정확 일치)',
    (provider) => {
      for (const isAndroid of [false, true]) {
        expect(
          getOAuthCredentials(provider, { origin, device: { isAndroid } })
            .options?.redirectTo,
        ).toBe(`${origin}/auth/callback`);
      }
    },
  );

  it('next를 주면 콜백 쿼리에 인코딩해서 붙임 (계정 연결 후 /settings 복귀 등)', () => {
    const creds = getOAuthCredentials('kakao', {
      origin,
      next: '/settings?tab=account',
    });
    const redirect = new URL(creds.options!.redirectTo!);
    expect(redirect.origin).toBe(origin);
    expect(redirect.pathname).toBe('/auth/callback');
    expect(redirect.searchParams.get('next')).toBe('/settings?tab=account');
    // 시도한 수단은 주소에 싣지 않는다 (B43: Redirect URLs 쿼리 비교)
    expect(redirect.searchParams.has('via')).toBe(false);
  });
});

describe('getOAuthCredentials 공용 기기 모드 (P4-09, §12-Q44)', () => {
  const query = (
    provider: SocialProvider,
    extra: Partial<Parameters<typeof getOAuthCredentials>[1]> = {},
  ) =>
    getOAuthCredentials(provider, { origin, sharedDevice: true, ...extra })
      .options?.queryParams;

  it('provider별 근거 있는 값: 카카오·네이버 prompt=login, Google prompt=select_account(login은 문서에 없음)', () => {
    expect(SHARED_DEVICE_PARAMS).toEqual({
      kakao: { prompt: 'login' },
      naver: { prompt: 'login' },
      google: { prompt: 'select_account' },
    });
  });

  it('카카오: scope 덮어쓰기와 합친다 (scope 키가 빠지면 KOE205)', () => {
    expect(query('kakao')).toEqual({ scope: KAKAO_SCOPE, prompt: 'login' });
    const q = new URLSearchParams(query('kakao')).toString();
    expect(q).toBe(`scope=${encodeURIComponent(KAKAO_SCOPE)}&prompt=login`);
  });

  it('카카오톡 인앱의 카카오는 prompt=login을 빼고 scope만 (카카오톡 인앱 브라우저에서는 제공하지 않음)', () => {
    expect(
      query('kakao', { device: { isAndroid: true, type: 'kakaotalk' } }),
    ).toEqual({ scope: KAKAO_SCOPE });
    // 다른 인앱(인스타그램 등)에서는 붙인다
    expect(
      query('kakao', { device: { isAndroid: true, type: 'instagram' } }),
    ).toEqual({ scope: KAKAO_SCOPE, prompt: 'login' });
  });

  it('네이버: prompt=login, Android여도 앱 자동로그인(appscheme)은 붙이지 않음', () => {
    expect(query('naver')).toEqual({ prompt: 'login' });
    expect(query('naver', { device: { isAndroid: true } })).toEqual({
      prompt: 'login',
    });
  });

  it('Google: prompt=select_account', () => {
    expect(query('google')).toEqual({ prompt: 'select_account' });
  });

  it('꺼져 있으면(기본) 예전과 같다', () => {
    expect(
      getOAuthCredentials('google', { origin, sharedDevice: false }).options,
    ).toEqual({ redirectTo: `${origin}/auth/callback` });
    expect(
      getOAuthCredentials('naver', { origin, device: { isAndroid: true } })
        .options?.queryParams,
    ).toEqual({ appscheme: 'true' });
  });

  it('redirectTo는 그대로 (B43)', () => {
    for (const p of ['google', 'kakao', 'naver'] as const) {
      expect(
        getOAuthCredentials(p, { origin, sharedDevice: true }).options
          ?.redirectTo,
      ).toBe(`${origin}/auth/callback`);
    }
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

describe('parseLoginProviders (P3-09, NEXT_PUBLIC_LOGIN_PROVIDERS)', () => {
  it('비우거나 알아볼 값이 없으면 세 개 모두 (오타로 버튼이 사라지지 않게)', () => {
    expect(parseLoginProviders(undefined)).toEqual([
      'kakao',
      'naver',
      'google',
    ]);
    expect(parseLoginProviders('')).toEqual(['kakao', 'naver', 'google']);
    expect(parseLoginProviders('github, ,')).toEqual([
      'kakao',
      'naver',
      'google',
    ]);
  });

  it('고른 것만, 순서는 기본 순서(카카오 → 네이버 → Google), 대소문자·공백·원래 이름 허용', () => {
    expect(parseLoginProviders('google,kakao')).toEqual(['kakao', 'google']);
    expect(parseLoginProviders(' Kakao , GOOGLE ')).toEqual([
      'kakao',
      'google',
    ]);
    expect(parseLoginProviders('custom:naver')).toEqual(['naver']);
    expect(parseLoginProviders('kakao,kakao,typo')).toEqual(['kakao']);
  });
});
