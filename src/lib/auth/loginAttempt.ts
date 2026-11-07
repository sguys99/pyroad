import type { SocialProvider } from './socialLogin';

/**
 * 방금 시도한 로그인 수단 (B43). 실패 안내(P3-10)가 "카카오 로그인을 그만뒀구나"처럼 provider 이름을 쓰려면 어떤 버튼을
 * 눌렀는지 알아야 한다. 예전에는 `redirectTo`에 `?via=<provider>`를 붙였는데, 그러면 콜백 주소가 Supabase Redirect URLs의
 * 정확한 주소와 달라져(쿼리까지 비교) GoTrue가 Site URL로 보내는 사고가 났다(운영 Site URL이 localhost였음).
 * 그래서 `redirectTo`는 쿼리 없는 `/auth/callback`으로 고정하고, 시도한 수단은 이 탭의 sessionStorage에 둔다.
 *
 * - 값: `{ provider, at }`. 계정 정보 없음. 10분이 지나면 무시(오래된 시도가 다른 오류 안내에 섞이지 않게)
 * - 쓰는 곳: 로그인·계정 연결 직전(`useSocialLogin`·`useLinkIdentity`). 읽는 곳: 랜딩 실패 시트(`LandingLoginError`)·`/auth/error`
 * - 로그인이 끝나면(최근 로그인 기록 `LastLoginRecorder`) 또는 안내에 한 번 쓰면 지운다
 * - 저장소가 막혀 있으면 provider 이름 없는 안내로 그대로 동작한다(예외를 던지지 않음)
 */
export const LOGIN_ATTEMPT_STORAGE_KEY = 'pyroad.loginAttempt.v1';
export const LOGIN_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberLoginAttempt(
  provider: SocialProvider,
  storage: Storage | null = session(),
  now: number = Date.now(),
): void {
  try {
    storage?.setItem(
      LOGIN_ATTEMPT_STORAGE_KEY,
      JSON.stringify({ provider, at: now }),
    );
  } catch {
    // 안내에 이름이 빠질 뿐
  }
}

/** 시도한 수단을 꺼내고 지운다. 없거나 10분이 지났거나 모양이 틀리면 null */
export function takeLoginAttempt(
  storage: Storage | null = session(),
  now: number = Date.now(),
): SocialProvider | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(LOGIN_ATTEMPT_STORAGE_KEY);
    storage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const { provider, at } = JSON.parse(raw) as {
      provider?: unknown;
      at?: unknown;
    };
    if (provider !== 'kakao' && provider !== 'naver' && provider !== 'google')
      return null;
    if (typeof at !== 'number' || now - at > LOGIN_ATTEMPT_MAX_AGE_MS)
      return null;
    if (at > now + 60_000) return null;
    return provider;
  } catch {
    return null;
  }
}

/** 로그인이 끝났으면 지운다 */
export function clearLoginAttempt(storage: Storage | null = session()): void {
  try {
    storage?.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
  } catch {
    // 무시
  }
}
