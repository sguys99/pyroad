import { validateNickname } from '@/lib/profile/nickname';
import {
  loginProviderFromUser,
  pickIdentityData,
  toSocialProvider,
  type AuthUserLike,
  type SocialProvider,
} from './loginProvider';

/**
 * provider별 Supabase `user_metadata`(= auth.users.raw_user_meta_data 또는 auth.identities.identity_data)를 한 모양으로
 * 정규화합니다 (P0-04 스파이크 `spikes/p0-04-kakao/src/normalizeProviderMetadata.ts`에서 이관, P3-06·P3-18).
 *
 * 원칙 (§2.6, §2.8, P3-06·P3-11·P3-13)
 * - 여기서 나온 이름은 "온보딩 닉네임 입력칸의 제안값"일 뿐입니다. 공개 필드(nickname·display_name)·DB에 자동 저장하지 않습니다.
 * - **실명일 가능성이 있으면 제안하지 않습니다**(Google `name`, Naver `name`, 한글 2~4글자 이름 모양 등. `mayBeRealName`).
 *   거짓 양성(예: "코딩왕"을 실명으로 봄)은 "제안 안 함"이라 안전한 쪽입니다.
 * - `privateName`은 본인 화면에서만 쓸 수 있는 값입니다. DB·로그·분석·Sentry로 보내지 않습니다.
 * - provider 프로필 사진은 공개 아바타로 쓰지 않습니다(캐릭터 아바타, §12-Q34). `avatarUrl`은 참고용입니다.
 * - 이메일이 없어도 정상 결과를 돌려줍니다(Kakao 비즈앱 미전환 §12-Q12, Naver 식별자만 §2.8).
 *
 * GoTrue가 저장하는 키 (supabase/auth@004f767, P0-04 보고서 §4)
 * - google (OIDC id_token): iss, sub, name, picture, full_name, avatar_url, provider_id, email, email_verified, phone_verified
 * - kakao 내장 OAuth (/v2/user/me): iss=https://kapi.kakao.com, sub, name, preferred_username, user_name, full_name,
 *   avatar_url, provider_id, email(동의 시), email_verified, phone_verified
 * - kakao OIDC (custom:kakao): iss=https://kauth.kakao.com, sub, name, preferred_username, provider_id, picture, email(동의 시) …
 * - naver (custom:naver, OIDC): id_token에 프로필 claim이 없어 iss/sub/provider_id만 남습니다(P0-03).
 *   userinfo를 평탄화한 값(nickname·profile_image, 또는 response 중첩)도 대안 B·C 대비로 처리합니다.
 */

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
   * 닉네임 제안 후보. 실명 가능성이 있으면 null. 닉네임 규칙 검사 전 값이므로
   * 온보딩에서는 `nicknameSuggestionFromUser`(규칙·금칙어까지 통과한 값)를 씁니다.
   */
  displayNameCandidate: string | null;
  displayNameSource: DisplayNameSource;
  /** provider가 준 이름이 실명일 가능성이 있어 제안값에서 뺐는지 */
  nameMayBeRealName: boolean;
  /** 본인 화면에서만 쓰는 이름. DB·로그·분석에 보내지 않음 */
  privateName: string | null;
  /** https 프로필 사진 URL. provider 기본 이미지·잘못된 URL이면 null. 공개 아바타로 쓰지 않음 */
  avatarUrl: string | null;
  /** provider 기본 프로필 이미지였는지 (Kakao default_profile, Naver img_profile) */
  avatarIsDefault: boolean;
  email: string | null;
  emailVerified: boolean;
}

type Raw = Record<string, unknown> | null | undefined;

/** Kakao가 정책 위반 닉네임 대신 넣는 기본 닉네임 (Kakao REST API 문서, is_default_nickname) */
export const KAKAO_DEFAULT_NICKNAME = '닉네임을 등록해주세요';
const KAKAO_DEFAULT_IMAGE = /\/account_images\/default_profile\./i;
const NAVER_DEFAULT_IMAGE = /\/static\/pwe\/address\/img_profile\.png$/i;
/** 한글 2~4글자 = 한국식 이름 모양 */
const KOREAN_NAME_SHAPE = /^[가-힣]{2,4}$/;
/** "Minjun Kim", "Kim Min Jun"처럼 대문자로 시작하는 영문 단어 2~3개 = 로마자 이름 모양 */
const ROMAN_NAME_SHAPE = /^[A-Z][a-z]+( [A-Z][a-z]+){1,2}$/;
/** Naver는 별명이 없으면 아이디 일부를 가린 값(예: "bob***")을 줍니다 */
const MASKED_NICKNAME = /\*{2,}/;
const MAX_CANDIDATE_LENGTH = 12;

const HTTPS_UPGRADE_HOSTS = [/\.kakaocdn\.net$/i, /\.pstatic\.net$/i];

/**
 * 실명일 가능성이 있는 이름인가 (있으면 제안하지 않음, P3-06).
 * - 한글 2~4글자 ("이서연"), 숫자·공백·기호를 뺀 나머지가 한글 2~4글자 ("김민준2015", "이 서연")
 * - 로마자 이름 모양 ("Minjun Kim")
 */
export function mayBeRealName(name: string): boolean {
  const n = name.normalize('NFC').trim();
  if (KOREAN_NAME_SHAPE.test(n)) return true;
  const core = n.replace(/[\s\d_.\-·]/g, '');
  if (KOREAN_NAME_SHAPE.test(core)) return true;
  return ROMAN_NAME_SHAPE.test(n);
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
    rawUserMetaData && typeof rawUserMetaData === 'object'
      ? rawUserMetaData
      : {};
  // Naver userinfo 원본(response.{...})이 그대로 들어온 경우도 처리
  const nested =
    p === 'naver' && raw.response && typeof raw.response === 'object'
      ? (raw.response as Record<string, unknown>)
      : {};

  const providerUserId =
    str(raw.sub) ?? str(raw.provider_id) ?? str(nested.id) ?? str(raw.id);

  const email = normalizeEmail(str(raw.email) ?? str(nested.email));
  const emailVerified = email !== null && raw.email_verified === true;

  return {
    provider: p,
    providerUserId,
    ...pickName(p, raw, nested),
    ...pickAvatar(p, raw, nested),
    email,
    emailVerified,
  };
}

/**
 * 온보딩(P3-11) 닉네임 입력칸의 제안값. 없으면 null → 랜덤 추천 닉네임(`suggestNickname`)을 씁니다.
 * - 방금 로그인한 provider(`loginProviderFromUser`)의 identity_data만 봅니다(연결 계정의 섞인 user_metadata를 쓰지 않음).
 *   identities 정보가 없을 때만 user_metadata를 씁니다.
 * - 실명 가능성이 있거나, 닉네임 규칙(2~10자·글자·예약어)·금칙어를 통과하지 못하면 제안하지 않습니다.
 * - 제안값은 DB에 저장하지 않습니다. 아이가 확인하고 고른 값만 저장합니다.
 */
export function nicknameSuggestionFromUser(
  user: AuthUserLike | null | undefined,
): string | null {
  if (!user) return null;
  const provider = loginProviderFromUser(user);
  if (!provider) return null;
  const data = user.identities
    ? pickIdentityData(user.identities, provider)
    : (user.user_metadata ?? null);
  if (!data) return null;
  const candidate = normalizeProviderMetadata(
    provider,
    data,
  ).displayNameCandidate;
  if (!candidate) return null;
  const checked = validateNickname(candidate);
  return checked.ok ? checked.nickname : null;
}

function pickName(
  p: SocialProvider,
  raw: Record<string, unknown>,
  nested: Record<string, unknown>,
): Pick<
  NormalizedProfile,
  | 'displayNameCandidate'
  | 'displayNameSource'
  | 'nameMayBeRealName'
  | 'privateName'
> {
  if (p === 'google') {
    // Google name은 계정 실명이므로 제안값으로 쓰지 않음
    const privateName = cleanName(str(raw.name) ?? str(raw.full_name));
    return {
      displayNameCandidate: null,
      displayNameSource: privateName ? 'google_name' : null,
      nameMayBeRealName: privateName !== null,
      privateName,
    };
  }

  const source: DisplayNameSource =
    p === 'kakao' ? 'kakao_nickname' : 'naver_nickname';
  // kakao: GoTrue가 nickname을 name/preferred_username/user_name/full_name에 복사함
  // naver: nickname 또는 response.nickname. Naver `name`은 실명 동의항목이라 쓰지 않음
  const rawNickname =
    p === 'kakao'
      ? (str(raw.nickname) ??
        str(raw.preferred_username) ??
        str(raw.name) ??
        str(raw.user_name) ??
        str(raw.full_name))
      : (str(raw.nickname) ?? str(nested.nickname));

  let nickname = cleanName(rawNickname);
  if (nickname === KAKAO_DEFAULT_NICKNAME) nickname = null;
  if (nickname && p === 'naver' && MASKED_NICKNAME.test(nickname)) {
    nickname = null;
  }

  if (!nickname) {
    return {
      displayNameCandidate: null,
      displayNameSource: null,
      nameMayBeRealName: false,
      privateName: null,
    };
  }

  const realName = mayBeRealName(nickname);
  return {
    displayNameCandidate: realName
      ? null
      : truncate(nickname, MAX_CANDIDATE_LENGTH),
    displayNameSource: source,
    nameMayBeRealName: realName,
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
      ? (str(raw.picture) ?? str(raw.avatar_url))
      : p === 'kakao'
        ? (str(raw.avatar_url) ?? str(raw.picture))
        : (str(raw.profile_image) ??
          str(nested.profile_image) ??
          str(raw.picture) ??
          str(raw.avatar_url));

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
  if (
    url.protocol === 'http:' &&
    HTTPS_UPGRADE_HOSTS.some((re) => re.test(url.hostname))
  ) {
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

// 제어 문자·폭 없는 문자·방향 표시 (줄바꿈·탭은 먼저 공백 한 칸으로 바꿈)
const INVISIBLE_CHARS =
  /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060\ufeff]/g;

function cleanName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(INVISIBLE_CHARS, '')
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
