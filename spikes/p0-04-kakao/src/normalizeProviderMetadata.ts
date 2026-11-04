/**
 * P0-04 스파이크: provider별 Supabase `user_metadata`(= auth.users.raw_user_meta_data
 * 또는 auth.identities.identity_data)를 하나의 모양으로 정규화한다.
 *
 * 설계 원칙 (docs/4.upgrade-plan.md §2.6, P3-11, P3-13)
 * - 여기서 나온 이름은 "온보딩 닉네임 입력칸의 기본 제안값"일 뿐이다. 공개 필드에 저장하지 않는다.
 * - 실명일 가능성이 큰 값(Google `name`, 한글 2~4글자 닉네임, Naver `name`)은 제안값으로 쓰지 않는다.
 *   본인 화면 인사말 같은 비공개 용도로만 `privateName`에 남기고, DB에는 저장하지 않는다.
 * - provider 기본 프로필 이미지는 `avatarUrl = null`로 돌려준다 (캐릭터 아바타로 대체).
 * - 이메일이 없어도 정상 결과를 돌려준다 (Kakao 비즈앱 미전환, Q12).
 *
 * GoTrue가 저장하는 키 (supabase/auth@004f767 기준, 보고서 §4 참고)
 * - google (OIDC id_token): iss, sub, name, picture, full_name, avatar_url, provider_id, email, email_verified, phone_verified
 * - kakao 내장 OAuth (/v2/user/me): iss=https://kapi.kakao.com, sub, name, preferred_username, user_name, full_name,
 *   avatar_url, provider_id, email(동의 시), email_verified, phone_verified
 * - kakao OIDC (custom:kakao, signInWithIdToken): iss=https://kauth.kakao.com, sub, name, preferred_username,
 *   provider_id, picture, email(동의 시), email_verified, phone_verified
 * - naver: P0-03 결과에 따름. custom:naver(OIDC)는 id_token에 프로필 claim이 없어 iss/sub/provider_id만 남는다.
 *   서버 브릿지는 userinfo의 nickname/profile_image를 그대로 넣는다고 가정 (샘플).
 */

export type SocialProvider = 'google' | 'kakao' | 'naver';

export type DisplayNameSource =
  | 'kakao_nickname'
  | 'naver_nickname'
  | 'google_name'
  | null;

export interface NormalizedProfile {
  provider: SocialProvider;
  /** provider 쪽 사용자 ID (sub / provider_id). Kakao는 회원번호 문자열 */
  providerUserId: string | null;
  /**
   * 온보딩 닉네임 입력칸의 기본 제안값. 실명 가능성이 있으면 null.
   * 공개 필드(users.nickname, display_name 등)에 자동 저장 금지. 사용자가 확인·수정한 값만 저장한다.
   */
  displayNameCandidate: string | null;
  displayNameSource: DisplayNameSource;
  /** provider가 준 이름이 실명일 가능성이 있어 제안값에서 뺐는지 */
  nameMayBeRealName: boolean;
  /** 본인 화면에서만 쓰는 이름 (예: "○○님, 반가워요"). DB에 저장하지 않는다 */
  privateName: string | null;
  /** https 프로필 사진 URL. provider 기본 이미지·잘못된 URL이면 null */
  avatarUrl: string | null;
  /** provider 기본 프로필 이미지였는지 (Kakao default_profile, Naver img_profile) */
  avatarIsDefault: boolean;
  email: string | null;
  emailVerified: boolean;
}

type Raw = Record<string, unknown> | null | undefined;

/** Kakao가 정책 위반 닉네임 대신 넣는 기본 닉네임 (developers.kakao.com REST API 문서, is_default_nickname) */
export const KAKAO_DEFAULT_NICKNAME = '닉네임을 등록해주세요';
const KAKAO_DEFAULT_IMAGE = /\/account_images\/default_profile\./i;
const NAVER_DEFAULT_IMAGE = /\/static\/pwe\/address\/img_profile\.png$/i;
/** 한글 2~4글자 = 한국식 실명일 가능성이 높음. 거짓 양성(예: "코딩왕")은 "제안 안 함"이라 안전한 쪽 */
const LOOKS_LIKE_KOREAN_FULL_NAME = /^[가-힣]{2,4}$/;
/** Naver는 별명이 없으면 아이디 일부를 가린 값(예: "bob***")을 준다 */
const MASKED_NICKNAME = /\*{2,}/;
const MAX_CANDIDATE_LENGTH = 12;

const HTTPS_UPGRADE_HOSTS = [/\.kakaocdn\.net$/i, /\.pstatic\.net$/i];

export function toSocialProvider(value: unknown): SocialProvider | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toLowerCase()) {
    case 'google':
      return 'google';
    case 'kakao':
    case 'custom:kakao':
      return 'kakao';
    case 'naver':
    case 'custom:naver':
      return 'naver';
    default:
      return null;
  }
}

export function normalizeProviderMetadata(
  provider: SocialProvider | string,
  rawUserMetaData: Raw,
): NormalizedProfile {
  const p = toSocialProvider(provider);
  if (!p) {
    throw new Error(`지원하지 않는 provider: ${String(provider)}`);
  }
  const raw: Record<string, unknown> =
    rawUserMetaData && typeof rawUserMetaData === 'object' ? rawUserMetaData : {};
  // Naver userinfo 원본(response.{...})이 그대로 들어온 경우도 처리
  const nested =
    p === 'naver' && raw.response && typeof raw.response === 'object'
      ? (raw.response as Record<string, unknown>)
      : {};

  const providerUserId =
    str(raw.sub) ?? str(raw.provider_id) ?? str(nested.id) ?? str(raw.id);

  const email = normalizeEmail(str(raw.email) ?? str(nested.email));
  const emailVerified = email !== null && raw.email_verified === true;

  const name = pickName(p, raw, nested);
  const avatar = pickAvatar(p, raw, nested);

  return {
    provider: p,
    providerUserId,
    ...name,
    ...avatar,
    email,
    emailVerified,
  };
}

function pickName(
  p: SocialProvider,
  raw: Record<string, unknown>,
  nested: Record<string, unknown>,
): Pick<
  NormalizedProfile,
  'displayNameCandidate' | 'displayNameSource' | 'nameMayBeRealName' | 'privateName'
> {
  if (p === 'google') {
    // Google name은 계정 실명이므로 제안값으로 쓰지 않는다
    const privateName = cleanName(str(raw.name) ?? str(raw.full_name));
    return {
      displayNameCandidate: null,
      displayNameSource: privateName ? 'google_name' : null,
      nameMayBeRealName: privateName !== null,
      privateName,
    };
  }

  const source: DisplayNameSource = p === 'kakao' ? 'kakao_nickname' : 'naver_nickname';
  // kakao: GoTrue가 nickname을 name/preferred_username/user_name/full_name에 복사함
  // naver: nickname(브릿지) 또는 response.nickname. Naver `name`은 실명 동의항목이라 쓰지 않음
  const rawNickname =
    p === 'kakao'
      ? str(raw.nickname) ??
        str(raw.preferred_username) ??
        str(raw.name) ??
        str(raw.user_name) ??
        str(raw.full_name)
      : str(raw.nickname) ?? str(nested.nickname);

  let nickname = cleanName(rawNickname);
  if (nickname === KAKAO_DEFAULT_NICKNAME) nickname = null;
  if (nickname && p === 'naver' && MASKED_NICKNAME.test(nickname)) nickname = null;

  if (!nickname) {
    return {
      displayNameCandidate: null,
      displayNameSource: null,
      nameMayBeRealName: false,
      privateName: null,
    };
  }

  const mayBeRealName = LOOKS_LIKE_KOREAN_FULL_NAME.test(nickname);
  return {
    displayNameCandidate: mayBeRealName ? null : truncate(nickname, MAX_CANDIDATE_LENGTH),
    displayNameSource: source,
    nameMayBeRealName: mayBeRealName,
    privateName: nickname,
  };
}

function pickAvatar(
  p: SocialProvider,
  raw: Record<string, unknown>,
  nested: Record<string, unknown>,
): Pick<NormalizedProfile, 'avatarUrl' | 'avatarIsDefault'> {
  const candidate =
    p === 'google'
      ? str(raw.picture) ?? str(raw.avatar_url)
      : p === 'kakao'
        ? str(raw.avatar_url) ?? str(raw.picture)
        : str(raw.profile_image) ?? str(nested.profile_image) ?? str(raw.picture) ?? str(raw.avatar_url);

  if (!candidate) return { avatarUrl: null, avatarIsDefault: false };

  const isDefault =
    (p === 'kakao' && KAKAO_DEFAULT_IMAGE.test(candidate)) ||
    (p === 'naver' && NAVER_DEFAULT_IMAGE.test(candidate));
  if (isDefault) return { avatarUrl: null, avatarIsDefault: true };

  return { avatarUrl: toHttpsUrl(candidate), avatarIsDefault: false };
}

function toHttpsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol === 'http:' && HTTPS_UPGRADE_HOSTS.some((re) => re.test(url.hostname))) {
    url.protocol = 'https:';
  }
  return url.protocol === 'https:' ? url.toString() : null;
}

function str(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize('NFC')
    // 줄바꿈·탭 등 공백은 한 칸으로, 남은 제어 문자·제로폭 문자는 제거
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff]/g, '')
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join('') : value;
}

function normalizeEmail(value: string | null): string | null {
  if (!value || !value.includes('@')) return null;
  return value.toLowerCase();
}
