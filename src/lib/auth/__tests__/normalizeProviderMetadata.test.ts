import { describe, it, expect } from 'vitest';
import {
  normalizeProviderMetadata,
  nicknameSuggestionFromUser,
  mayBeRealName,
  KAKAO_DEFAULT_NICKNAME,
} from '../normalizeProviderMetadata';
import * as fx from './fixtures/providerMetadata';

// P0-04 스파이크 tests/normalizeProviderMetadata.test.ts 이관 (P3-18)

describe('normalizeProviderMetadata: 공통', () => {
  it('지원하지 않는 provider는 예외', () => {
    expect(() => normalizeProviderMetadata('github', {})).toThrow(
      /지원하지 않는 provider/,
    );
  });

  it('null/undefined 메타데이터도 예외 없이 빈 결과', () => {
    for (const raw of [null, undefined, {}]) {
      const r = normalizeProviderMetadata('kakao', raw);
      expect(r.providerUserId).toBeNull();
      expect(r.displayNameCandidate).toBeNull();
      expect(r.avatarUrl).toBeNull();
      expect(r.email).toBeNull();
    }
  });

  it('https 가 아닌(또는 깨진) 이미지 URL 은 버린다', () => {
    expect(
      normalizeProviderMetadata('google', {
        picture: 'http://evil.example/x.png',
      }).avatarUrl,
    ).toBeNull();
    expect(
      normalizeProviderMetadata('google', { picture: 'javascript:alert(1)' })
        .avatarUrl,
    ).toBeNull();
    expect(
      normalizeProviderMetadata('kakao', { avatar_url: 'not a url' }).avatarUrl,
    ).toBeNull();
  });

  it('@ 없는 이메일 값은 null, email_verified 는 이메일이 있을 때만 true', () => {
    expect(normalizeProviderMetadata('kakao', { email: 'nope' }).email).toBe(
      null,
    );
    expect(
      normalizeProviderMetadata('kakao', { email_verified: true })
        .emailVerified,
    ).toBe(false);
  });
});

describe('google', () => {
  it('실명(name)은 제안값으로 쓰지 않고 privateName 에만 둔다', () => {
    const r = normalizeProviderMetadata('google', fx.google);
    expect(r).toMatchObject({
      provider: 'google',
      displayNameCandidate: null,
      displayNameSource: 'google_name',
      nameMayBeRealName: true,
      privateName: '김민준',
      email: 'minjun.parent@gmail.com',
      emailVerified: true,
      providerUserId: '109876543210987654321',
      avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocJ-sample=s96-c',
    });
  });
});

describe('kakao (내장 OAuth 경로)', () => {
  it('이메일 없는 계정도 정상 정규화 (비즈앱 미전환)', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    expect(r).toMatchObject({
      provider: 'kakao',
      email: null,
      emailVerified: false,
      providerUserId: '4012345678',
      displayNameCandidate: '파이썬꿈나무',
      displayNameSource: 'kakao_nickname',
      nameMayBeRealName: false,
    });
  });

  it('kakaocdn http 이미지는 https 로 올린다', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    expect(r.avatarUrl).toBe(
      'https://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_640x640.jpg',
    );
    expect(r.avatarIsDefault).toBe(false);
  });

  it('Kakao 기본 프로필 이미지는 null + avatarIsDefault', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthDefaultImage);
    expect(r.avatarUrl).toBeNull();
    expect(r.avatarIsDefault).toBe(true);
  });

  it('한글 2~4글자 닉네임은 실명 가능성 → 제안하지 않음', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthDefaultImage);
    expect(r.displayNameCandidate).toBeNull();
    expect(r.nameMayBeRealName).toBe(true);
    expect(r.privateName).toBe('이서연');
  });

  it('닉네임 동의 거부(회원번호만) → 이름·사진 모두 null', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthIdOnly);
    expect(r).toMatchObject({
      displayNameCandidate: null,
      displayNameSource: null,
      privateName: null,
      avatarUrl: null,
      email: null,
      providerUserId: '4012345680',
    });
  });

  it(`Kakao 기본 닉네임("${KAKAO_DEFAULT_NICKNAME}")은 없는 것으로 처리`, () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthPolicyNickname);
    expect(r.displayNameCandidate).toBeNull();
    expect(r.privateName).toBeNull();
  });

  it('비즈앱 이메일이 오면 소문자로 정규화', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthWithEmail);
    expect(r.email).toBe('kid.parent@kakao.com');
    expect(r.emailVerified).toBe(true);
  });

  it('회원번호가 숫자로 와도 문자열로', () => {
    const r = normalizeProviderMetadata('kakao', { sub: 4012345678 });
    expect(r.providerUserId).toBe('4012345678');
  });

  it('긴 닉네임은 12자로 자르고, 제어·제로폭 문자를 지운다', () => {
    const r = normalizeProviderMetadata('kakao', {
      sub: '1',
      name: '\u200b  파이썬\n마스터가될거야abcdefg  ',
    });
    expect(r.displayNameCandidate).toBe('파이썬 마스터가될거야a');
    expect(Array.from(r.displayNameCandidate ?? '')).toHaveLength(12);
  });
});

describe('kakao (OIDC 경로: custom:kakao)', () => {
  it('picture 키를 쓰고 provider 이름 custom:kakao 도 받는다', () => {
    const r = normalizeProviderMetadata('custom:kakao', fx.kakaoOidcNoEmail);
    expect(r.provider).toBe('kakao');
    expect(r.avatarUrl).toBe(
      'https://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_110x110.jpg',
    );
    expect(r.displayNameCandidate).toBe('파이썬꿈나무');
    expect(r.email).toBeNull();
  });

  it('닉네임만 요청하면 사진 없음', () => {
    const r = normalizeProviderMetadata(
      'custom:kakao',
      fx.kakaoOidcNicknameOnly,
    );
    expect(r.avatarUrl).toBeNull();
    expect(r.avatarIsDefault).toBe(false);
    expect(r.displayNameCandidate).toBe('coding_bear');
  });

  it('내장 OAuth 경로와 OIDC 경로의 providerUserId(회원번호)가 같다', () => {
    const a = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    const b = normalizeProviderMetadata('custom:kakao', fx.kakaoOidcNoEmail);
    expect(a.providerUserId).toBe(b.providerUserId);
  });
});

describe('naver', () => {
  it('custom:naver(OIDC) 식별자만 있는 경우 (P0-03 실측 모양)', () => {
    const r = normalizeProviderMetadata('custom:naver', fx.naverOidcIdOnly);
    expect(r).toMatchObject({
      provider: 'naver',
      providerUserId: 'Hc4rN7tYq0wPz3Lm6Vb9Xs2Kd5Fg8Ju1Ia4Oe7Ty0Rw',
      displayNameCandidate: null,
      email: null,
    });
  });

  it('[대안 B·C 대비] 평탄화한 userinfo: nickname 을 쓰고 실명 name(김앨리스)은 절대 쓰지 않는다', () => {
    const r = normalizeProviderMetadata('naver', fx.naverBridge);
    expect(r.displayNameCandidate).toBe('코딩앨리스');
    expect(r.displayNameSource).toBe('naver_nickname');
    expect(r.privateName).not.toBe('김앨리스');
    expect(r.avatarUrl).toBe(
      'https://phinf.pstatic.net/contact/20260101_1/sample_alice.png',
    );
  });

  it('[대안 B·C 대비] userinfo 원본(response 중첩): 마스킹 별명·기본 이미지는 null', () => {
    const r = normalizeProviderMetadata('naver', fx.naverRawMasked);
    expect(r).toMatchObject({
      providerUserId: 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq',
      displayNameCandidate: null,
      avatarUrl: null,
      avatarIsDefault: true,
      email: null,
    });
  });
});

describe('mayBeRealName (실명 가능성이 있으면 제안하지 않음, P3-06)', () => {
  it.each([
    '이서연',
    '김민준',
    '남궁민수',
    '김민준2015',
    '이 서연',
    'Minjun Kim',
    'Kim Min Jun',
  ])('%s → 실명일 수 있음', (name) => {
    expect(mayBeRealName(name)).toBe(true);
  });

  it.each(['파이썬꿈나무', 'coding_bear', 'Pyroad01', '코딩왕자짱짱'])(
    '%s → 실명 모양 아님',
    (name) => {
      expect(mayBeRealName(name)).toBe(false);
    },
  );

  it('실명 모양 Kakao 닉네임(숫자 붙임)도 제안하지 않는다', () => {
    const r = normalizeProviderMetadata('kakao', {
      sub: '1',
      name: '김민준2015',
    });
    expect(r.displayNameCandidate).toBeNull();
    expect(r.nameMayBeRealName).toBe(true);
  });
});

describe('nicknameSuggestionFromUser (온보딩 제안값, P3-11)', () => {
  const kakaoIdentity = (data: Record<string, unknown>) => ({
    provider: 'kakao',
    identity_data: data,
    created_at: '2026-11-03T00:00:00Z',
  });

  it('Kakao 닉네임이 규칙을 통과하면 제안', () => {
    expect(
      nicknameSuggestionFromUser({
        user_metadata: fx.kakaoOAuthNoEmail,
        identities: [kakaoIdentity(fx.kakaoOAuthNoEmail)],
      }),
    ).toBe('파이썬꿈나무');
  });

  it('실명 모양·Google·Naver OIDC·식별자만이면 제안 없음', () => {
    expect(
      nicknameSuggestionFromUser({
        user_metadata: fx.kakaoOAuthDefaultImage,
        identities: [kakaoIdentity(fx.kakaoOAuthDefaultImage)],
      }),
    ).toBeNull();
    expect(
      nicknameSuggestionFromUser({
        user_metadata: fx.google,
        identities: [{ provider: 'google', identity_data: fx.google }],
      }),
    ).toBeNull();
    expect(
      nicknameSuggestionFromUser({
        user_metadata: fx.naverOidcIdOnly,
        identities: [
          { provider: 'custom:naver', identity_data: fx.naverOidcIdOnly },
        ],
      }),
    ).toBeNull();
    expect(
      nicknameSuggestionFromUser({
        user_metadata: fx.kakaoOAuthIdOnly,
        identities: [kakaoIdentity(fx.kakaoOAuthIdOnly)],
      }),
    ).toBeNull();
  });

  it('닉네임 규칙(띄어쓰기·밑줄·길이)·금칙어를 통과하지 못하면 제안 없음', () => {
    for (const name of [
      'coding_bear',
      '파이썬 마스터',
      '아주아주아주긴닉네임이에요',
      '시발점아님시발',
    ]) {
      const data = { iss: 'https://kapi.kakao.com', sub: '1', name };
      expect(
        nicknameSuggestionFromUser({
          user_metadata: data,
          identities: [kakaoIdentity(data)],
        }),
      ).toBeNull();
    }
  });

  it('연결 계정: 방금 로그인한 provider(iss)의 identity_data만 본다', () => {
    // Google 가입 → Kakao 연결 → Kakao 로그인: user_metadata에 Google 실명이 섞여 있어도 Kakao 닉네임만
    expect(
      nicknameSuggestionFromUser({
        app_metadata: { provider: 'google', providers: ['google', 'kakao'] },
        user_metadata: fx.mergedGoogleThenKakao,
        identities: [
          { provider: 'google', identity_data: fx.google },
          kakaoIdentity(fx.kakaoOAuthNoEmail),
        ],
      }),
    ).toBe('파이썬꿈나무');
  });

  it('사용자가 없거나 provider를 모르면 null', () => {
    expect(nicknameSuggestionFromUser(null)).toBeNull();
    expect(
      nicknameSuggestionFromUser({
        app_metadata: { provider: 'email' },
        user_metadata: { name: '코딩친구' },
        identities: [{ provider: 'email' }],
      }),
    ).toBeNull();
  });
});
