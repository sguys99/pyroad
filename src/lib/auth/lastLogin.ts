import { toSocialProvider, type SocialProvider } from './loginProvider';

/**
 * "최근에 ○○로 로그인했어요" 배지의 브라우저 저장값 (P3-08).
 *
 * 로그인 **전** 화면(랜딩 로그인 시트)에서 보여야 하므로 서버가 아니라 이 기기에 둔다.
 * - 저장소: `localStorage`(쿠키 아님). 개인정보처리방침 10절 "웹 저장소: … 최근에 사용한 로그인 수단"과 맞다.
 *   쿠키는 인증 쿠키만 쓴다는 문장을 지키려고 쿠키를 쓰지 않는다
 * - 값: `{ provider: 'kakao'|'naver'|'google', at: ISO 시각 }`. 계정 식별자·이름은 넣지 않는다(§2.6)
 * - 1년이 지나면 무시한다. 로그아웃해도 지우지 않는다(다음 로그인 때 같은 수단을 고르게 돕는 것이 목적)
 * - UI 힌트일 뿐이다: 사용자가 바꿀 수 있는 값(`user_metadata.iss`, 이 저장값)이라 인가 판단에 쓰지 않는다
 *
 * 전달 경로: `/auth/callback`(서버)이 세션 사용자에서 provider를 정하고(`loginProviderFromUser`) 리다이렉트 주소에
 * `#lp=<provider>` 조각을 붙인다(`withLastLoginFragment`) → 도착한 화면의 `LastLoginRecorder`가 저장하고 조각을 지운다.
 * 쿼리가 아니라 **조각(#)**인 이유: 조각은 서버·로그·분석으로 가지 않고, 미들웨어가 한 번 더 리다이렉트해도
 * (예: /world → /onboarding) 브라우저가 조각을 이어 붙인다(RFC 9110 §10.2.2).
 */

export const LAST_LOGIN_STORAGE_KEY = 'pyroad.lastLogin.v1';
/** 리다이렉트 주소 조각의 키: `#lp=kakao` */
export const LAST_LOGIN_FRAGMENT_KEY = 'lp';
/** 이보다 오래된 기록은 배지를 띄우지 않는다 */
export const LAST_LOGIN_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface LastLogin {
  provider: SocialProvider;
  /** 저장한 시각 (ISO 8601) */
  at: string;
}

/** 저장 문자열 → 값. 모양이 틀리거나 1년이 지났거나 미래 시각이면 null */
export function parseLastLogin(
  raw: string | null | undefined,
  now: number = Date.now(),
): LastLogin | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { provider, at } = value as { provider?: unknown; at?: unknown };
  const p = toSocialProvider(provider);
  if (!p || p !== provider || typeof at !== 'string') return null;
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return null;
  // 기기 시계가 조금 틀려도 되게 하루까지는 미래를 허용
  if (t > now + 24 * 60 * 60 * 1000 || now - t > LAST_LOGIN_MAX_AGE_MS)
    return null;
  return { provider: p, at };
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // 사파리 개인 정보 보호 모드·차단된 사이트 데이터: 접근만으로 예외
    return null;
  }
}

/** 저장값 읽기. 저장소를 못 쓰면 null (배지 없이 그대로 동작) */
export function readLastLogin(
  storage: Storage | null = defaultStorage(),
  now: number = Date.now(),
): LastLogin | null {
  if (!storage) return null;
  try {
    return parseLastLogin(storage.getItem(LAST_LOGIN_STORAGE_KEY), now);
  } catch {
    return null;
  }
}

/** 저장. 성공하면 true (저장소가 막혀 있으면 false, 예외를 던지지 않음) */
export function writeLastLogin(
  provider: SocialProvider,
  storage: Storage | null = defaultStorage(),
  now: number = Date.now(),
): boolean {
  if (!storage) return false;
  try {
    const value: LastLogin = { provider, at: new Date(now).toISOString() };
    storage.setItem(LAST_LOGIN_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * 서버(`/auth/callback`): `safeNext`를 통과한 같은 출처 경로에 `#lp=<provider>`를 붙인다.
 * 이미 조각이 있는 경로(`/notice#top`)는 건드리지 않는다(배지를 저장하지 않을 뿐, 이동은 그대로).
 */
export function withLastLoginFragment(
  path: string,
  provider: SocialProvider | null,
): string {
  if (!provider || path.includes('#')) return path;
  return `${path}#${LAST_LOGIN_FRAGMENT_KEY}=${provider}`;
}

/**
 * 클라이언트: 주소의 `#lp=<provider>`를 읽는다. 있으면 provider와 조각을 지운 주소(경로+쿼리)를 돌려준다.
 * 모르는 값(`#lp=github`)도 조각은 지운다(provider는 null).
 */
export function takeLastLoginFragment(
  href: string,
): { provider: SocialProvider | null; cleaned: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params = new URLSearchParams(url.hash.slice(1));
  if (!params.has(LAST_LOGIN_FRAGMENT_KEY)) return null;
  const raw = params.get(LAST_LOGIN_FRAGMENT_KEY);
  const provider = toSocialProvider(raw);
  return {
    provider: provider && provider === raw ? provider : null,
    cleaned: `${url.pathname}${url.search}`,
  };
}

/**
 * 이 수단의 기록이면 지운다 (P3-07: 그 수단의 연결을 끊었으면 그걸로 들어오면 새 계정이 되므로 배지가 잘못 안내함).
 * 다른 수단의 기록이면 그대로. 저장소가 막혀 있으면 아무것도 하지 않음
 */
export function forgetLastLoginIf(
  provider: SocialProvider,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    if (readLastLogin(storage)?.provider === provider)
      storage.removeItem(LAST_LOGIN_STORAGE_KEY);
  } catch {
    // 무시
  }
}
