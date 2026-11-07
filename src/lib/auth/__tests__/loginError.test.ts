import { describe, expect, it } from 'vitest';
import {
  LOGIN_ERROR_REASONS,
  isLoginErrorReason,
  loginErrorPath,
  reasonFromExchangeError,
  reasonFromRedirectParams,
  shouldReportLoginError,
  takeLoginErrorFromUrl,
} from '../loginError';
import {
  loginErrorCopy,
  loginErrorHint,
} from '@/components/auth/loginErrorCopy';

// 로그인 실패 사유 표 (P3-10)

describe('reasonFromRedirectParams', () => {
  it('오류가 없으면 null', () => {
    expect(reasonFromRedirectParams({})).toBeNull();
    expect(reasonFromRedirectParams({ errorDescription: 'x' })).toBeNull();
  });

  it.each([
    [{ error: 'access_denied' }, 'cancelled'],
    [{ error: 'ACCESS_DENIED' }, 'cancelled'],
    [
      { error: 'invalid_request', errorCode: 'identity_already_exists' },
      'identity_taken',
    ],
    [{ error: 'invalid_request', errorCode: 'bad_oauth_state' }, 'expired'],
    [
      { error: 'invalid_request', errorCode: 'flow_state_already_used' },
      'reused',
    ],
    [
      {
        error: 'server_error',
        errorDescription: 'Error getting user email from external provider',
      },
      'unavailable',
    ],
    [{ error: 'server_error' }, 'unavailable'],
    // 옛 주소 /?error=auth, 모양이 이상한 값
    [{ error: 'auth' }, 'unknown'],
    [{ error: '<script>' }, 'unknown'],
  ] as const)('%o → %s', (params, reason) => {
    expect(reasonFromRedirectParams(params)).toBe(reason);
  });

  it('error_code가 error보다 먼저', () => {
    expect(
      reasonFromRedirectParams({
        error: 'access_denied',
        errorCode: 'identity_already_exists',
      }),
    ).toBe('identity_taken');
  });
});

describe('reasonFromExchangeError', () => {
  it.each([
    [{ code: 'pkce_code_verifier_not_found' }, 'other_browser'],
    [{ name: 'AuthPKCECodeVerifierMissingError' }, 'other_browser'],
    [{ code: 'bad_code_verifier' }, 'other_browser'],
    [{ code: 'flow_state_expired' }, 'expired'],
    [{ code: 'flow_state_not_found' }, 'reused'],
    [{ code: 'unexpected_failure' }, 'unavailable'],
    [{ code: 'new_thing' }, 'unknown'],
    [new Error('network'), 'unknown'],
    [null, 'unknown'],
  ] as const)('%o → %s', (error, reason) => {
    expect(reasonFromExchangeError(error)).toBe(reason);
  });
});

describe('loginErrorPath', () => {
  it('랜딩에서 시작한 로그인(기본 next)은 랜딩 시트로', () => {
    expect(loginErrorPath('cancelled')).toBe('/?login_error=cancelled');
    expect(loginErrorPath('expired', { next: '/world', via: 'naver' })).toBe(
      '/?login_error=expired&via=naver',
    );
  });

  it('다른 화면에서 시작한 흐름은 /auth/error, next를 싣는다', () => {
    expect(
      loginErrorPath('identity_taken', { next: '/settings', via: 'kakao' }),
    ).toBe('/auth/error?reason=identity_taken&via=kakao&next=%2Fsettings');
  });

  it('보고는 설정 오류·모르는 오류만', () => {
    expect(LOGIN_ERROR_REASONS.filter(shouldReportLoginError)).toEqual([
      'unavailable',
      'unknown',
    ]);
  });
});

describe('takeLoginErrorFromUrl (랜딩)', () => {
  it('우리 콜백 값: 사유·via를 읽고 그 키만 지운다', () => {
    expect(
      takeLoginErrorFromUrl(
        'https://pyroad.vercel.app/?login_error=cancelled&via=google&utm=x',
      ),
    ).toEqual({ reason: 'cancelled', via: 'google', cleaned: '/?utm=x' });
  });

  it('GoTrue가 Site URL로 바로 보낸 bad_oauth_state (쿼리)', () => {
    expect(
      takeLoginErrorFromUrl(
        'https://pyroad.vercel.app/?error=invalid_request&error_code=bad_oauth_state&error_description=OAuth+state+parameter+missing',
      ),
    ).toEqual({ reason: 'expired', via: null, cleaned: '/' });
  });

  it('implicit 흐름처럼 조각으로 온 오류도', () => {
    expect(
      takeLoginErrorFromUrl(
        'https://pyroad.vercel.app/#error=access_denied&error_description=x&lp=kakao',
      ),
    ).toEqual({ reason: 'cancelled', via: null, cleaned: '/#lp=kakao' });
  });

  it('모르는 login_error 값은 unknown, 옛 ?error=auth도 unknown', () => {
    expect(
      takeLoginErrorFromUrl('https://a.test/?login_error=hack')?.reason,
    ).toBe('unknown');
    expect(takeLoginErrorFromUrl('https://a.test/?error=auth')?.reason).toBe(
      'unknown',
    );
  });

  it('오류가 없으면 null', () => {
    expect(takeLoginErrorFromUrl('https://a.test/?utm=x')).toBeNull();
    expect(takeLoginErrorFromUrl('not a url')).toBeNull();
  });
});

describe('안내 문구 (loginErrorCopy·loginErrorHint)', () => {
  it.each(LOGIN_ERROR_REASONS)(
    '%s: 제목·설명이 있고, 영어 원문·오류 코드가 없다',
    (reason) => {
      expect(isLoginErrorReason(reason)).toBe(true);
      for (const via of [null, 'kakao', 'naver', 'google'] as const) {
        const c = loginErrorCopy(reason, via);
        expect(c.title.length).toBeGreaterThan(3);
        expect(c.body.length).toBeGreaterThan(10);
        expect(`${c.title} ${c.body}`).not.toMatch(/error|denied|_/i);
        expect(['encourage', 'think', 'confused', 'sad']).toContain(c.rig);
      }
    },
  );

  it('provider 이름이 자연스럽게 들어간다', () => {
    expect(loginErrorCopy('cancelled', 'kakao').title).toBe(
      '카카오 로그인을 그만뒀구나',
    );
    expect(loginErrorCopy('cancelled').title).toBe('로그인을 그만뒀구나');
    expect(loginErrorCopy('identity_taken', 'google').body).toContain(
      '이 Google 계정은',
    );
  });

  it('다른 방법 한마디: 카카오톡 인앱 + Google 실패 → 카카오', () => {
    expect(
      loginErrorHint('expired', {
        via: 'google',
        inApp: 'kakaotalk',
        available: ['kakao', 'naver', 'google'],
      }),
    ).toContain('카카오 버튼');
    // 카카오를 숨긴 빌드면 권하지 않음
    expect(
      loginErrorHint('expired', {
        via: 'google',
        inApp: 'kakaotalk',
        available: ['naver', 'google'],
      }),
    ).toBeNull();
  });

  it('다른 방법 한마디: 네이버 다른 브라우저 → 아이디 로그인, 설정 오류 → 다른 계정, 취소·재전송은 없음', () => {
    expect(loginErrorHint('other_browser', { via: 'naver' })).toContain(
      '아이디로 로그인',
    );
    expect(
      loginErrorHint('unavailable', {
        via: 'naver',
        available: ['kakao', 'naver', 'google'],
      }),
    ).toBe('카카오·Google 계정이 있으면 그걸로 들어가 봐.');
    expect(
      loginErrorHint('cancelled', {
        via: 'google',
        inApp: 'kakaotalk',
        available: ['kakao'],
      }),
    ).toBeNull();
    expect(loginErrorHint('reused', { via: 'naver' })).toBeNull();
  });
});
