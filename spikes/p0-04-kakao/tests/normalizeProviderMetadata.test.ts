import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProviderMetadata,
  toSocialProvider,
  KAKAO_DEFAULT_NICKNAME,
} from '../src/normalizeProviderMetadata.ts';
import * as fx from '../fixtures/metadata.ts';

describe('toSocialProvider', () => {
  it('내장·커스텀 provider 이름을 3종으로 정규화한다', () => {
    assert.equal(toSocialProvider('google'), 'google');
    assert.equal(toSocialProvider('kakao'), 'kakao');
    assert.equal(toSocialProvider('custom:kakao'), 'kakao');
    assert.equal(toSocialProvider('custom:naver'), 'naver');
    assert.equal(toSocialProvider(' NAVER '), 'naver');
    assert.equal(toSocialProvider('email'), null);
    assert.equal(toSocialProvider(undefined), null);
  });

  it('지원하지 않는 provider는 예외', () => {
    assert.throws(() => normalizeProviderMetadata('github', {}), /지원하지 않는 provider/);
  });
});

describe('google', () => {
  it('실명(name)은 제안값으로 쓰지 않고 privateName 에만 둔다', () => {
    const r = normalizeProviderMetadata('google', fx.google);
    assert.equal(r.displayNameCandidate, null);
    assert.equal(r.displayNameSource, 'google_name');
    assert.equal(r.nameMayBeRealName, true);
    assert.equal(r.privateName, '김민준');
    assert.equal(r.email, 'minjun.parent@gmail.com');
    assert.equal(r.emailVerified, true);
    assert.equal(r.providerUserId, '109876543210987654321');
    assert.equal(r.avatarUrl, 'https://lh3.googleusercontent.com/a/ACg8ocJ-sample=s96-c');
  });
});

describe('kakao (내장 OAuth 경로)', () => {
  it('이메일 없는 계정도 정상 정규화 (비즈앱 미전환)', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    assert.equal(r.provider, 'kakao');
    assert.equal(r.email, null);
    assert.equal(r.emailVerified, false);
    assert.equal(r.providerUserId, '4012345678');
    assert.equal(r.displayNameCandidate, '파이썬꿈나무');
    assert.equal(r.displayNameSource, 'kakao_nickname');
    assert.equal(r.nameMayBeRealName, false);
  });

  it('kakaocdn http 이미지는 https 로 올린다', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    assert.equal(
      r.avatarUrl,
      'https://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_640x640.jpg',
    );
    assert.equal(r.avatarIsDefault, false);
  });

  it('Kakao 기본 프로필 이미지는 null + avatarIsDefault', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthDefaultImage);
    assert.equal(r.avatarUrl, null);
    assert.equal(r.avatarIsDefault, true);
  });

  it('한글 2~4글자 닉네임은 실명 가능성 → 제안하지 않음', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthDefaultImage);
    assert.equal(r.displayNameCandidate, null);
    assert.equal(r.nameMayBeRealName, true);
    assert.equal(r.privateName, '이서연');
  });

  it('닉네임 동의 거부(회원번호만) → 이름·사진 모두 null', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthIdOnly);
    assert.deepEqual(
      {
        displayNameCandidate: r.displayNameCandidate,
        displayNameSource: r.displayNameSource,
        privateName: r.privateName,
        avatarUrl: r.avatarUrl,
        email: r.email,
        providerUserId: r.providerUserId,
      },
      {
        displayNameCandidate: null,
        displayNameSource: null,
        privateName: null,
        avatarUrl: null,
        email: null,
        providerUserId: '4012345680',
      },
    );
  });

  it(`Kakao 기본 닉네임("${KAKAO_DEFAULT_NICKNAME}")은 없는 것으로 처리`, () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthPolicyNickname);
    assert.equal(r.displayNameCandidate, null);
    assert.equal(r.privateName, null);
  });

  it('비즈앱 이메일이 오면 소문자로 정규화', () => {
    const r = normalizeProviderMetadata('kakao', fx.kakaoOAuthWithEmail);
    assert.equal(r.email, 'kid.parent@kakao.com');
    assert.equal(r.emailVerified, true);
  });

  it('회원번호가 숫자로 와도 문자열로', () => {
    const r = normalizeProviderMetadata('kakao', { sub: 4012345678 });
    assert.equal(r.providerUserId, '4012345678');
  });

  it('긴 닉네임은 12자로 자르고, 제어·제로폭 문자를 지운다', () => {
    const r = normalizeProviderMetadata('kakao', {
      sub: '1',
      name: '\u200b  파이썬\n마스터가될거야abcdefg  ',
    });
    assert.equal(r.displayNameCandidate, '파이썬 마스터가될거야a');
    assert.equal(Array.from(r.displayNameCandidate ?? '').length, 12);
  });
});

describe('kakao (OIDC 경로: custom:kakao / signInWithIdToken)', () => {
  it('picture 키를 쓰고 provider 이름 custom:kakao 도 받는다', () => {
    const r = normalizeProviderMetadata('custom:kakao', fx.kakaoOidcNoEmail);
    assert.equal(r.provider, 'kakao');
    assert.equal(r.avatarUrl, 'https://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_110x110.jpg');
    assert.equal(r.displayNameCandidate, '파이썬꿈나무');
    assert.equal(r.email, null);
  });

  it('권장 scope(openid profile_nickname)만 요청하면 사진 없음', () => {
    const r = normalizeProviderMetadata('custom:kakao', fx.kakaoOidcNicknameOnly);
    assert.equal(r.avatarUrl, null);
    assert.equal(r.avatarIsDefault, false);
    assert.equal(r.displayNameCandidate, 'coding_bear');
  });

  it('내장 OAuth 경로와 OIDC 경로의 providerUserId(회원번호)가 같다', () => {
    const a = normalizeProviderMetadata('kakao', fx.kakaoOAuthNoEmail);
    const b = normalizeProviderMetadata('custom:kakao', fx.kakaoOidcNoEmail);
    assert.equal(a.providerUserId, b.providerUserId);
  });
});

describe('naver ([가정 샘플], P0-03 결과로 확정)', () => {
  it('브릿지: nickname 을 쓰고 실명 name(김앨리스)은 절대 쓰지 않는다', () => {
    const r = normalizeProviderMetadata('naver', fx.naverBridge);
    assert.equal(r.displayNameCandidate, '코딩앨리스');
    assert.equal(r.displayNameSource, 'naver_nickname');
    assert.notEqual(r.privateName, '김앨리스');
    assert.equal(r.avatarUrl, 'https://phinf.pstatic.net/contact/20260101_1/sample_alice.png');
    assert.equal(r.email, 'alice.parent@naver.com');
  });

  it('userinfo 원본(response 중첩): 마스킹 별명·기본 이미지는 null', () => {
    const r = normalizeProviderMetadata('naver', fx.naverRawMasked);
    assert.equal(r.providerUserId, 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq');
    assert.equal(r.displayNameCandidate, null);
    assert.equal(r.avatarUrl, null);
    assert.equal(r.avatarIsDefault, true);
    assert.equal(r.email, null);
  });

  it('custom:naver(OIDC) 식별자만 있는 경우', () => {
    const r = normalizeProviderMetadata('custom:naver', fx.naverOidcIdOnly);
    assert.equal(r.provider, 'naver');
    assert.equal(r.providerUserId, 'Hc4rN7tYq0wPz3Lm6Vb9Xs2Kd5Fg8Ju1Ia4Oe7Ty0Rw');
    assert.equal(r.displayNameCandidate, null);
    assert.equal(r.email, null);
  });
});

describe('공통 방어', () => {
  it('null/undefined 메타데이터도 예외 없이 빈 결과', () => {
    for (const raw of [null, undefined, {}]) {
      const r = normalizeProviderMetadata('kakao', raw);
      assert.equal(r.providerUserId, null);
      assert.equal(r.displayNameCandidate, null);
      assert.equal(r.avatarUrl, null);
      assert.equal(r.email, null);
    }
  });

  it('https 가 아닌(또는 깨진) 이미지 URL 은 버린다', () => {
    assert.equal(normalizeProviderMetadata('google', { picture: 'http://evil.example/x.png' }).avatarUrl, null);
    assert.equal(normalizeProviderMetadata('google', { picture: 'javascript:alert(1)' }).avatarUrl, null);
    assert.equal(normalizeProviderMetadata('kakao', { avatar_url: 'not a url' }).avatarUrl, null);
  });

  it('@ 없는 이메일 값은 null', () => {
    assert.equal(normalizeProviderMetadata('kakao', { email: 'nope' }).email, null);
  });

  it('email_verified 는 이메일이 있을 때만 true', () => {
    assert.equal(normalizeProviderMetadata('kakao', { email_verified: true }).emailVerified, false);
  });
});
