/**
 * P0-04 스파이크: "최근 로그인 provider"(P3-08)와 계정 연결(P3-07)용 보조 함수.
 *
 * 왜 필요한가 (supabase/auth@004f767 소스 확인)
 * - app_metadata.provider 는 "가장 먼저 연결된 identity"의 provider다
 *   (models/user.go UpdateAppMetaDataProviders → providers[0], identities.created_at ASC).
 *   Google로 가입한 뒤 Kakao를 연결해 Kakao로 로그인해도 'google'로 남는다 → 최근 로그인 판별에 쓸 수 없다.
 * - 로그인할 때마다 GoTrue가 해당 identity의 identity_data를 raw_user_meta_data에 덮어쓴다
 *   (api/external.go AccountExists → user.UpdateUserMetaData). 그래서 user_metadata.iss 는
 *   "방금 로그인한 provider"의 issuer가 된다. 단, 사용자가 updateUser({ data })로 바꿀 수 있는 값이라 UI 힌트로만 쓴다.
 * - 같은 이유로 연결된 계정의 user_metadata 는 여러 provider 키가 섞여 있다.
 *   정규화할 때는 user_metadata 대신 identities[].identity_data 를 provider별로 골라 쓴다.
 */
import { toSocialProvider, type SocialProvider } from './normalizeProviderMetadata.ts';

export interface IdentityLike {
  provider: string;
  identity_data?: Record<string, unknown> | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

/**
 * issuer → provider. GoTrue 소스 기준 값
 * - Google: https://accounts.google.com (google.go / oidc.go)
 * - Kakao 내장 OAuth: https://kapi.kakao.com (kakao.go: Issuer = APIHost)
 * - Kakao OIDC (custom:kakao, signInWithIdToken): https://kauth.kakao.com
 * - Naver OIDC (custom:naver): https://nid.naver.com (P0-03)
 */
export function providerFromIssuer(iss: unknown): SocialProvider | null {
  if (typeof iss !== 'string') return null;
  let host: string;
  try {
    host = new URL(iss).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === 'accounts.google.com') return 'google';
  if (host === 'kauth.kakao.com' || host === 'kapi.kakao.com') return 'kakao';
  if (host === 'nid.naver.com') return 'naver';
  return null;
}

/**
 * /auth/callback 에서 쓰는 검증: 로그인 버튼이 redirectTo 에 붙여 보낸 `lp`(요청 provider)가
 * 실제로 이 사용자에게 연결된 identity 인지 확인한다. 연결되지 않은 값이면 null (저장하지 않음).
 */
export function resolveLoginProvider(
  requested: unknown,
  identities: readonly IdentityLike[] | null | undefined,
): SocialProvider | null {
  const want = toSocialProvider(requested);
  if (!want || !identities) return null;
  return identities.some((i) => toSocialProvider(i.provider) === want) ? want : null;
}

/** 연결된 계정에서 provider별 identity_data 고르기 (user_metadata 는 provider 키가 섞여 있음) */
export function pickIdentityData(
  identities: readonly IdentityLike[] | null | undefined,
  provider: SocialProvider,
): Record<string, unknown> | null {
  if (!identities) return null;
  const match = identities.filter((i) => toSocialProvider(i.provider) === provider);
  if (match.length === 0) return null;
  // 같은 provider identity 가 여러 개면 가장 최근 것
  match.sort((a, b) => String(b.last_sign_in_at ?? b.created_at ?? '').localeCompare(String(a.last_sign_in_at ?? a.created_at ?? '')));
  return match[0].identity_data ?? null;
}

/** 랜딩 "최근에 ○○로 로그인했어요" 배지 문구 (localStorage 값 기준, P3-08) */
export function lastLoginBadgeText(provider: unknown): string | null {
  switch (toSocialProvider(provider)) {
    case 'kakao':
      return '최근에 카카오로 로그인했어요';
    case 'naver':
      return '최근에 네이버로 로그인했어요';
    case 'google':
      return '최근에 Google로 로그인했어요';
    default:
      return null;
  }
}
