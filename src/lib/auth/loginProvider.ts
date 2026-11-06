import { NAVER_PROVIDER_ID, type SocialProvider } from './socialLogin';

/**
 * 로그인 provider 판별 (P0-04 스파이크 `spikes/p0-04-kakao/src/loginProvider.ts`에서 이관, P3-18).
 * "최근에 ○○로 로그인했어요" 배지(P3-08), 계정 연결(P3-07), 온보딩 닉네임 제안(P3-11)이 씁니다.
 *
 * 왜 `user_metadata.iss`를 먼저 보나 (supabase/auth@004f767 소스 확인, §2.2 `last_login_provider`)
 * - `app_metadata.provider`는 "가장 먼저 연결된 identity"의 provider입니다(UpdateAppMetaDataProviders → providers[0]).
 *   Google로 가입한 뒤 Kakao를 연결해 Kakao로 로그인해도 'google'로 남으므로 최근 로그인 판별에 쓸 수 없습니다.
 * - 로그인할 때마다 GoTrue가 그 identity의 identity_data를 raw_user_meta_data에 덮어씁니다(AccountExists → UpdateUserMetaData).
 *   그래서 `user_metadata.iss`는 "방금 로그인한 provider"의 issuer입니다. 다만 사용자가 `updateUser({ data })`로 바꿀 수 있는
 *   값이라 **UI 힌트로만** 씁니다(인가 판단 금지).
 * - 같은 이유로 연결된 계정의 user_metadata에는 여러 provider의 키가 섞여 있습니다. provider별 값은 `pickIdentityData`로 고릅니다.
 * DB 쪽 같은 규칙: `public.social_login_provider(provider, iss)` (00013).
 */

export type { SocialProvider } from './socialLogin';

/** auth.identities 한 행 (Supabase `UserIdentity`와 호환되는 최소 모양) */
export interface IdentityLike {
  provider: string;
  identity_data?: Record<string, unknown> | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
}

/** Supabase `User`와 호환되는 최소 모양 (테스트에서 평범한 객체를 넘길 수 있게) */
export interface AuthUserLike {
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: readonly IdentityLike[] | null;
}

/**
 * provider 이름 → 짧은 이름 3종. 내장 `google`·`kakao`, 커스텀 `custom:naver`(P0-03), 대체안 `custom:kakao`(OIDC).
 * 그 밖(email, github …)은 null.
 */
export function toSocialProvider(value: unknown): SocialProvider | null {
  if (typeof value !== 'string') return null;
  switch (value.trim().toLowerCase()) {
    case 'google':
      return 'google';
    case 'kakao':
    case 'custom:kakao':
      return 'kakao';
    case 'naver':
    case NAVER_PROVIDER_ID:
      return 'naver';
    default:
      return null;
  }
}

/**
 * issuer → provider. GoTrue가 넣는 값과 **정확히 같을 때만** 인정합니다(DB `social_login_provider`(00013)와 같은 규칙).
 * - Google: https://accounts.google.com
 * - Kakao 내장 OAuth: https://kapi.kakao.com · Kakao OIDC(custom:kakao): https://kauth.kakao.com
 * - Naver OIDC(custom:naver): https://nid.naver.com
 */
const ISSUERS: Record<string, SocialProvider> = {
  'https://accounts.google.com': 'google',
  'https://kapi.kakao.com': 'kakao',
  'https://kauth.kakao.com': 'kakao',
  'https://nid.naver.com': 'naver',
};

export function providerFromIssuer(iss: unknown): SocialProvider | null {
  if (typeof iss !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(ISSUERS, iss)
    ? ISSUERS[iss]
    : null;
}

/** 이 사용자에게 연결된 소셜 provider 목록 (중복 없음). identities가 있으면 그것, 없으면 app_metadata */
export function linkedProviders(user: AuthUserLike): SocialProvider[] {
  const appProviders: unknown = user.app_metadata?.providers;
  const names: unknown[] = user.identities
    ? user.identities.map((i) => i.provider)
    : Array.isArray(appProviders)
      ? appProviders
      : [user.app_metadata?.provider];
  const out: SocialProvider[] = [];
  for (const name of names) {
    const p = toSocialProvider(name);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/**
 * 방금(마지막으로) 로그인한 provider. `/auth/callback`의 최근 로그인 배지(P3-08)와 온보딩 제안(P3-11)이 씁니다.
 * 1. `user_metadata.iss` (로그인할 때마다 그 identity 값으로 덮어써짐)
 * 2. iss를 모르면, 연결된 소셜 provider가 하나뿐일 때만 그 provider (첫 identity = 마지막 identity)
 * 3. 그 밖에는 null (추측하지 않음. 배지를 저장하지 않으면 됨)
 * `app_metadata.provider` 하나만으로는 판단하지 않습니다(첫 identity라서).
 */
export function loginProviderFromUser(
  user: AuthUserLike | null | undefined,
): SocialProvider | null {
  if (!user) return null;
  const fromIss = providerFromIssuer(user.user_metadata?.iss);
  if (fromIss) return fromIss;
  const linked = linkedProviders(user);
  return linked.length === 1 ? linked[0] : null;
}

/**
 * `/auth/callback`에서 쓰는 검증: 로그인 버튼이 redirectTo에 붙여 보낸 요청 provider(예: `lp`)가
 * 실제로 이 사용자에게 연결된 identity인지 확인합니다. 연결되지 않은 값이면 null (저장하지 않음).
 */
export function resolveLoginProvider(
  requested: unknown,
  identities: readonly IdentityLike[] | null | undefined,
): SocialProvider | null {
  const want = toSocialProvider(requested);
  if (!want || !identities) return null;
  return identities.some((i) => toSocialProvider(i.provider) === want)
    ? want
    : null;
}

/** 연결된 계정에서 provider별 identity_data 고르기 (user_metadata는 provider 키가 섞여 있음) */
export function pickIdentityData(
  identities: readonly IdentityLike[] | null | undefined,
  provider: SocialProvider,
): Record<string, unknown> | null {
  if (!identities) return null;
  const match = identities.filter(
    (i) => toSocialProvider(i.provider) === provider,
  );
  if (match.length === 0) return null;
  // 같은 provider identity가 여러 개면 가장 최근 것 (ISO 시각 문자열 비교)
  const at = (i: IdentityLike) =>
    String(i.last_sign_in_at ?? i.created_at ?? '');
  match.sort((a, b) => at(b).localeCompare(at(a)));
  return match[0].identity_data ?? null;
}

const PROVIDER_LABELS: Record<SocialProvider, string> = {
  kakao: '카카오',
  naver: '네이버',
  google: 'Google',
};

/** 랜딩 "최근에 ○○로 로그인했어요" 배지 문구 (브라우저 저장값 기준, P3-08). 모르는 값이면 null */
export function lastLoginBadgeText(provider: unknown): string | null {
  const p = toSocialProvider(provider);
  return p ? `최근에 ${PROVIDER_LABELS[p]}로 로그인했어요` : null;
}
