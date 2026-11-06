import { DEFAULT_NEXT } from './safeNext';
import type { SocialProvider } from './socialLogin';

/**
 * 로그인 실패·취소·동의 거부를 아이에게 보여 줄 **사유 enum** (P3-10). 서버(`/auth/callback`)와 랜딩이 같은 표를 쓴다.
 *
 * provider·GoTrue가 준 원문(`error_description` 등)은 화면·주소·분석에 넘기지 않는다: 영어이고, 내부 사정이 섞일 수 있다.
 * 주소에는 이 enum과 시도한 provider(`via`)만 싣는다.
 *
 * | 사유 | 들어오는 값 |
 * |---|---|
 * | `cancelled` | `error=access_denied` (취소·동의 거부. Kakao "User denied access", Naver "Canceled By User", Google) |
 * | `identity_taken` | `identity_already_exists` (계정 연결 P3-07: 이미 다른 계정에 묶인 identity) |
 * | `expired` | `bad_oauth_state`(state 만료·변조, Site URL `/`로 옴) · `bad_oauth_callback` · `flow_state_expired` |
 * | `reused` | `flow_state_already_used` · `flow_state_not_found` (같은 콜백을 다시 열었거나 두 번 교환) |
 * | `other_browser` | PKCE verifier 없음(`pkce_code_verifier_not_found`, 다른 브라우저·앱에서 콜백) · `bad_code_verifier` |
 * | `unavailable` | 설정 오류: `server_error`(예: "Error getting user email" = `email_optional` 꺼짐) · `provider_disabled` · `oauth_provider_not_supported` · `unexpected_failure` · `manual_linking_disabled` |
 * | `unknown` | 그 밖 전부 (`code`도 `error`도 없는 콜백 포함) |
 */
export const LOGIN_ERROR_REASONS = [
  'cancelled',
  'identity_taken',
  'expired',
  'reused',
  'other_browser',
  'unavailable',
  'unknown',
] as const;
export type LoginErrorReason = (typeof LOGIN_ERROR_REASONS)[number];

/** 주소 쿼리 키: `/?login_error=cancelled&via=kakao` */
export const LOGIN_ERROR_PARAM = 'login_error';
/** 시도한 provider (로그인 버튼이 redirectTo에 붙임, `getOAuthCredentials`) */
export const LOGIN_VIA_PARAM = 'via';

export function isLoginErrorReason(value: unknown): value is LoginErrorReason {
  return (
    typeof value === 'string' &&
    (LOGIN_ERROR_REASONS as readonly string[]).includes(value)
  );
}

/** `via` 값 검증: 짧은 이름 3종만 */
export function parseVia(value: unknown): SocialProvider | null {
  return value === 'kakao' || value === 'naver' || value === 'google'
    ? value
    : null;
}

const CODE_REASON: Record<string, LoginErrorReason> = {
  access_denied: 'cancelled',
  identity_already_exists: 'identity_taken',
  bad_oauth_state: 'expired',
  bad_oauth_callback: 'expired',
  flow_state_expired: 'expired',
  flow_state_already_used: 'reused',
  flow_state_not_found: 'reused',
  pkce_code_verifier_not_found: 'other_browser',
  bad_code_verifier: 'other_browser',
  server_error: 'unavailable',
  provider_disabled: 'unavailable',
  oauth_provider_not_supported: 'unavailable',
  unexpected_failure: 'unavailable',
  manual_linking_disabled: 'unavailable',
};

/** 코드 모양만 (로그·Sentry 태그에 원문 대신) */
export function safeCode(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z0-9_]{1,64}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

/**
 * GoTrue가 리다이렉트에 붙인 오류(`error`·`error_code`·`error_description`) → 사유. 오류가 없으면 null.
 * `error_code`가 있으면 그것이 먼저(더 구체적), 없으면 `error`(OAuth 표준 값). `error_description`은 설정 오류
 * "Error getting user email"을 알아보는 데만 쓰고 밖으로 내보내지 않는다. 옛 주소 `?error=auth`도 받는다(unknown).
 */
export function reasonFromRedirectParams(params: {
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}): LoginErrorReason | null {
  const { error, errorCode, errorDescription } = params;
  if (!error && !errorCode) return null;
  const code = safeCode(errorCode);
  if (code && code in CODE_REASON) return CODE_REASON[code];
  if (
    typeof errorDescription === 'string' &&
    /error getting user email/i.test(errorDescription)
  ) {
    return 'unavailable';
  }
  const err = safeCode(error);
  if (err && err in CODE_REASON) return CODE_REASON[err];
  return 'unknown';
}

/** `exchangeCodeForSession` 오류 → 사유. supabase-js `AuthError`의 `code`(`pkce_code_verifier_not_found` 등)·`name`을 본다 */
export function reasonFromExchangeError(error: unknown): LoginErrorReason {
  if (!error || typeof error !== 'object') return 'unknown';
  const { code, name } = error as { code?: unknown; name?: unknown };
  const c = safeCode(code);
  if (c && c in CODE_REASON) return CODE_REASON[c];
  if (name === 'AuthPKCECodeVerifierMissingError') return 'other_browser';
  return 'unknown';
}

/** 운영자가 알아야 하는 사유만 Sentry로 (취소·만료·재전송·다른 브라우저는 아이 쪽 사정이라 보내지 않음) */
export function shouldReportLoginError(reason: LoginErrorReason): boolean {
  return reason === 'unavailable' || reason === 'unknown';
}

/**
 * 실패한 뒤 보낼 같은 출처 경로.
 * - 랜딩에서 시작한 로그인(`next` 없음 = 기본 `/world`): 랜딩 `/?login_error=…&via=…` → 로그인 시트가 저절로 열려 안내 + 버튼
 * - 다른 화면에서 시작한 흐름(설정의 계정 연결 P3-07 등 `next`가 있음): `/auth/error?reason=…&via=…&next=…` 안내 화면
 *   (돌아가기 = 그 `next`). `next`는 이미 `safeNext`를 통과한 값
 */
export function loginErrorPath(
  reason: LoginErrorReason,
  {
    next = DEFAULT_NEXT,
    via = null,
  }: { next?: string; via?: SocialProvider | null } = {},
): string {
  const q = new URLSearchParams();
  if (next === DEFAULT_NEXT) {
    q.set(LOGIN_ERROR_PARAM, reason);
    if (via) q.set(LOGIN_VIA_PARAM, via);
    return `/?${q}`;
  }
  q.set('reason', reason);
  if (via) q.set(LOGIN_VIA_PARAM, via);
  q.set('next', next);
  return `/auth/error?${q}`;
}

/**
 * 랜딩(클라이언트): 주소에서 로그인 오류를 읽는다. 우리 콜백이 보낸 `login_error`·`via`와,
 * GoTrue가 Site URL로 바로 보낸 원래 값(`error`·`error_code`·`error_description`, PKCE는 쿼리·implicit은 조각)을 모두 본다.
 * 오류가 있으면 사유와 그 키들을 지운 주소(경로+남은 쿼리)를 돌려준다.
 */
export function takeLoginErrorFromUrl(href: string): {
  reason: LoginErrorReason;
  via: SocialProvider | null;
  cleaned: string;
} | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.slice(1));
  const pick = (k: string) => query.get(k) ?? hash.get(k);

  const ours = pick(LOGIN_ERROR_PARAM);
  const reason = isLoginErrorReason(ours)
    ? ours
    : ours !== null
      ? 'unknown'
      : reasonFromRedirectParams({
          error: pick('error'),
          errorCode: pick('error_code'),
          errorDescription: pick('error_description'),
        });
  if (!reason) return null;
  const via = parseVia(pick(LOGIN_VIA_PARAM));

  for (const k of [
    LOGIN_ERROR_PARAM,
    LOGIN_VIA_PARAM,
    'error',
    'error_code',
    'error_description',
  ]) {
    query.delete(k);
    hash.delete(k);
  }
  const search = query.toString();
  const rest = hash.toString();
  return {
    reason,
    via,
    cleaned: `${url.pathname}${search ? `?${search}` : ''}${rest ? `#${rest}` : ''}`,
  };
}
