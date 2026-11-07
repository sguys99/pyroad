/**
 * auth.users.raw_user_meta_data 샘플 (값은 가짜). P0-04 스파이크 `spikes/p0-04-kakao/fixtures/metadata.ts`에서 이관 (P3-18).
 * - google / kakaoOAuth*: supabase/auth@004f767 소스의 Claims → structs.Map 결과 키를 그대로 따름.
 *   kakaoOAuth* 의 키 집합은 로컬 GoTrue v2.197.0 + Kakao 목업 e2e 에서 실측해 일치를 확인함 (spikes/p0-04-kakao/e2e/gotrue-flow.mjs).
 * - kakaoOidc*: oidc.go parseKakaoIDToken 기준 (custom:kakao, signInWithIdToken 경로). 실측 아님.
 * - naver*: P0-03 결과에 따른 **가정 샘플**. custom:naver(OIDC)는 프로필 claim이 없고,
 *   서버 브릿지는 userinfo의 nickname/profile_image를 user_metadata에 넣는다고 가정.
 *
 * GoTrue는 email_verified / phone_verified 를 값이 false여도 항상 넣는다 (structs 태그에 omitempty 없음).
 */

export const google = {
  iss: 'https://accounts.google.com',
  sub: '109876543210987654321',
  name: '김민준',
  full_name: '김민준',
  picture: 'https://lh3.googleusercontent.com/a/ACg8ocJ-sample=s96-c',
  avatar_url: 'https://lh3.googleusercontent.com/a/ACg8ocJ-sample=s96-c',
  provider_id: '109876543210987654321',
  email: 'minjun.parent@gmail.com',
  email_verified: true,
  phone_verified: false,
};

/** Kakao 내장 provider(OAuth, /v2/user/me) - 이메일 없음(비즈앱 미전환), 닉네임·사진 동의 */
export const kakaoOAuthNoEmail = {
  iss: 'https://kapi.kakao.com',
  sub: '4012345678',
  name: '파이썬꿈나무',
  preferred_username: '파이썬꿈나무',
  user_name: '파이썬꿈나무',
  full_name: '파이썬꿈나무',
  avatar_url:
    'http://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_640x640.jpg',
  provider_id: '4012345678',
  email_verified: false,
  phone_verified: false,
};

/** Kakao 내장 provider - 기본 프로필 이미지 + 닉네임이 실명처럼 보임 */
export const kakaoOAuthDefaultImage = {
  iss: 'https://kapi.kakao.com',
  sub: '4012345679',
  name: '이서연',
  preferred_username: '이서연',
  user_name: '이서연',
  full_name: '이서연',
  avatar_url:
    'http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=http://t1.kakaocdn.net/account_images/default_profile.jpeg',
  provider_id: '4012345679',
  email_verified: false,
  phone_verified: false,
};

/** Kakao - 닉네임·사진 동의를 거부(선택 동의)했거나 scope 에서 뺀 경우: 회원번호만 남음 */
export const kakaoOAuthIdOnly = {
  iss: 'https://kapi.kakao.com',
  sub: '4012345680',
  provider_id: '4012345680',
  email_verified: false,
  phone_verified: false,
};

/** Kakao - 정책 위반 닉네임이라 Kakao 기본 닉네임이 들어온 경우 */
export const kakaoOAuthPolicyNickname = {
  iss: 'https://kapi.kakao.com',
  sub: '4012345681',
  name: '닉네임을 등록해주세요',
  preferred_username: '닉네임을 등록해주세요',
  user_name: '닉네임을 등록해주세요',
  full_name: '닉네임을 등록해주세요',
  provider_id: '4012345681',
  email_verified: false,
  phone_verified: false,
};

/** Kakao 비즈앱 + 이메일 동의 (비교용, 채택안에서는 발생하지 않음) */
export const kakaoOAuthWithEmail = {
  ...kakaoOAuthNoEmail,
  sub: '4012345682',
  provider_id: '4012345682',
  email: 'Kid.Parent@Kakao.com',
  email_verified: true,
};

/** custom:kakao (OIDC) 또는 signInWithIdToken({ provider: 'kakao' }) - parseKakaoIDToken 결과 */
export const kakaoOidcNoEmail = {
  iss: 'https://kauth.kakao.com',
  sub: '4012345678',
  name: '파이썬꿈나무',
  preferred_username: '파이썬꿈나무',
  provider_id: '4012345678',
  picture:
    'https://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_110x110.jpg',
  email_verified: false,
  phone_verified: false,
};

/** custom:kakao 권장 scope(openid profile_nickname)만 요청 → picture 없음 */
export const kakaoOidcNicknameOnly = {
  iss: 'https://kauth.kakao.com',
  sub: '4012345683',
  name: 'coding_bear',
  preferred_username: 'coding_bear',
  provider_id: '4012345683',
  email_verified: false,
  phone_verified: false,
};

/** [가정 샘플] Naver 서버 브릿지 - userinfo response 를 평탄화해 넣은 경우 */
export const naverBridge = {
  iss: 'https://nid.naver.com',
  sub: 'Zq3mT8xWc1v0nVb7kLp2Rs9dHf4gJy6uEaQo5iNt1Ck',
  provider_id: 'Zq3mT8xWc1v0nVb7kLp2Rs9dHf4gJy6uEaQo5iNt1Ck',
  nickname: '코딩앨리스',
  name: '김앨리스',
  profile_image:
    'https://phinf.pstatic.net/contact/20260101_1/sample_alice.png',
  email: 'alice.parent@naver.com',
  email_verified: true,
};

/** [가정 샘플] Naver userinfo 원본(response 중첩)이 그대로 들어온 경우, 별명 없음(마스킹) + 기본 이미지 */
export const naverRawMasked = {
  resultcode: '00',
  message: 'success',
  response: {
    id: 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq',
    nickname: 'bob***',
    profile_image: 'https://ssl.pstatic.net/static/pwe/address/img_profile.png',
  },
};

/** [P0-03 실측 모양] custom:naver(OIDC) - id_token 에 프로필 claim 이 없어 식별자만 남음 */
export const naverOidcIdOnly = {
  iss: 'https://nid.naver.com',
  sub: 'Hc4rN7tYq0wPz3Lm6Vb9Xs2Kd5Fg8Ju1Ia4Oe7Ty0Rw',
  provider_id: 'Hc4rN7tYq0wPz3Lm6Vb9Xs2Kd5Fg8Ju1Ia4Oe7Ty0Rw',
  email_verified: false,
  phone_verified: false,
};

/**
 * Google 로 가입 → Kakao 를 수동 연결(linkIdentity) → Kakao 로 로그인한 사용자의 user_metadata.
 * AccountExists 경로에서 Kakao identity_data 가 덮어써져 Google 키(email, picture)와 Kakao 키가 섞인다.
 */
export const mergedGoogleThenKakao = {
  ...google,
  ...kakaoOAuthNoEmail,
};
