import { toSocialProvider, type IdentityLike } from './loginProvider';
import type { SocialProvider } from './socialLogin';

/**
 * 로그인 계정 연결 규칙 (P3-07, 계획서 §2.8). 설정 화면(`LinkedAccountsSection`)과 해제 API(`/api/account/unlink`)가 같은 표를 쓴다.
 *
 * - **자동 연결 없음**: Kakao·Naver는 이메일이 없어 같은 아이가 Google과 함께 쓰면 계정이 둘 생긴다. 그래서 설정에서 직접 붙인다
 *   (`linkIdentity`, Supabase Manual linking ON)
 * - **확인된 방향만 권한다**: 이메일 있는 계정(Google identity가 있음)에 Kakao·Naver를 붙이는 것은 된다. 이메일 없는 계정끼리
 *   (Kakao만 있는 계정에 Naver, 또는 그 반대)는 실패한다 → 그 버튼은 막고 "Google을 먼저 연결하면 돼"라고 알려 준다.
 *   Kakao·Naver만 있는 계정에 Google을 붙이는 방향은 아직 실 앱으로 확인하지 않았지만 허용한다(스모크 L-3)
 * - **마지막 수단은 끊지 않는다**: identity가 2개 이상일 때만 해제. 남는 수단이 0이 되는 해제는 화면·서버 모두 막는다
 * - 화면에는 provider 이름·연결한 날짜만. 이메일·이름·provider 식별자는 보여 주지 않는다(§2.6)
 */

export interface LinkedIdentity {
  provider: SocialProvider;
  /** Supabase identity 행 id (해제할 때 씀, 화면에 보이지 않음) */
  identityId: string | null;
  /** 연결한 날짜 (ISO) */
  linkedAt: string | null;
}

type IdentityRow = IdentityLike & { identity_id?: string | null };

/** 소셜 identity만 (email 등 제외), provider마다 하나 (같은 provider가 둘이면 먼저 연결된 것) */
export function linkedIdentities(
  identities: readonly IdentityRow[] | null | undefined,
): LinkedIdentity[] {
  const out: LinkedIdentity[] = [];
  for (const i of identities ?? []) {
    const provider = toSocialProvider(i.provider);
    if (!provider || out.some((o) => o.provider === provider)) continue;
    out.push({
      provider,
      identityId: i.identity_id ?? null,
      linkedAt: i.created_at ?? null,
    });
  }
  return out;
}

export type AccountLinkRow =
  | {
      provider: SocialProvider;
      state: 'linked';
      linkedAt: string | null;
      /** false면 마지막 로그인 수단이라 끊을 수 없음 */
      canUnlink: boolean;
    }
  | { provider: SocialProvider; state: 'available' }
  | {
      provider: SocialProvider;
      state: 'blocked';
      /** needs_google: 이메일 없는 계정끼리라 지금은 안 됨 → Google을 먼저 연결 */
      reason: 'needs_google';
    };

const ORDER: readonly SocialProvider[] = ['google', 'kakao', 'naver'];

/**
 * 설정 화면의 줄들. 연결된 수단은 언제나 보이고(숨긴 provider여도 해제할 수 있게), 연결 안 된 수단은 `enabled`
 * (`NEXT_PUBLIC_LOGIN_PROVIDERS`)에 있는 것만. 순서: Google → 카카오 → 네이버 (붙이는 방향의 시작점이 Google이라 맨 위)
 */
export function accountLinkRows(
  identities: readonly IdentityRow[] | null | undefined,
  enabled: readonly SocialProvider[],
): AccountLinkRow[] {
  const linked = linkedIdentities(identities);
  const total = (identities ?? []).length;
  const hasGoogle = linked.some((l) => l.provider === 'google');
  const rows: AccountLinkRow[] = [];
  for (const provider of ORDER) {
    const mine = linked.find((l) => l.provider === provider);
    if (mine) {
      const sameProvider = (identities ?? []).filter(
        (i) => toSocialProvider(i.provider) === provider,
      ).length;
      rows.push({
        provider,
        state: 'linked',
        linkedAt: mine.linkedAt,
        canUnlink: total - sameProvider >= 1,
      });
    } else if (enabled.includes(provider)) {
      rows.push(
        provider === 'google' || hasGoogle
          ? { provider, state: 'available' }
          : { provider, state: 'blocked', reason: 'needs_google' },
      );
    }
  }
  return rows;
}

/** 연결 뒤 돌아올 곳: `/settings?linked=kakao` (safeNext 통과, 콜백은 이 흐름에서 최근 로그인 배지를 남기지 않음) */
export function linkNext(provider: SocialProvider): string {
  return `/settings?linked=${provider}`;
}

/** `safeNext`를 통과한 경로가 계정 연결 흐름인가 */
export function isLinkNext(next: string): boolean {
  try {
    const url = new URL(next, 'https://pyroad.invalid');
    return (
      url.pathname === '/settings' &&
      toSocialProvider(url.searchParams.get('linked')) !== null
    );
  } catch {
    return false;
  }
}

/** 설정 화면: `?linked=<provider>`를 읽고 그 키를 지운 경로 */
export function takeLinkedResult(
  href: string,
): { provider: SocialProvider; cleaned: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const raw = url.searchParams.get('linked');
  const provider =
    raw === 'kakao' || raw === 'naver' || raw === 'google' ? raw : null;
  if (!provider) return null;
  url.searchParams.delete('linked');
  const search = url.searchParams.toString();
  return {
    provider,
    cleaned: `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
  };
}
