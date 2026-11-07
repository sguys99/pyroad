/**
 * 탈퇴 직전 네이버 재인증 (P3-16). 네이버 토큰은 저장하지 않으므로, 탈퇴하려는 사용자에게 네이버로 한 번 더 로그인하게 해
 * 그 순간 받은 토큰으로 연동을 해제한다(`revokeNaver`). 흐름:
 *
 * 1. 계정 관리(`AccountManagementSection`)가 이 탭의 sessionStorage에 `{ uid, at }`를 적고(`rememberWithdrawStart`),
 *    `useSocialLogin('naver', { next: NAVER_WITHDRAW_NEXT })`로 로그인한다
 * 2. `/auth/callback`이 교환 직후 `next`가 이 주소이면(`isNaverWithdrawNext`) 세션의 provider 토큰으로 폐기하고
 *    `/profile?withdraw=naver&naver=<결과>`로 보낸다(`naverWithdrawResultPath`). 토큰은 저장·기록하지 않는다
 * 3. 계정 관리가 결과를 읽고(`takeNaverWithdrawResult`), 시작한 사용자와 지금 사용자가 같을 때만 탈퇴 확인 창을 연다
 *
 * **삭제는 여기서 일어나지 않는다.** 탈퇴는 언제나 확인 창 → `DELETE /api/account/delete`(세션 사용자)뿐이다.
 * 누군가 이 주소로 로그인을 유도해도 일어나는 일은 "그 사람 자신의 네이버 연동 해제"뿐이고, 다음 로그인 때 다시 동의하면 된다.
 */

export const NAVER_WITHDRAW_NEXT = '/profile?withdraw=naver';
export const WITHDRAW_STORAGE_KEY = 'pyroad.withdraw.v1';
/** 재인증을 시작한 뒤 이 시간 안에 돌아와야 이어서 탈퇴 창을 연다 */
export const WITHDRAW_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * 콜백이 돌려주는 결과.
 * ok = 연동 해제 · failed = 요청 실패 · skipped = 서버에 네이버 키가 없음 · mismatch = 네이버가 아니거나 새로 만들어진 계정(다른 네이버 계정)
 */
export type NaverWithdrawOutcome = 'ok' | 'failed' | 'skipped' | 'mismatch';
const OUTCOMES: readonly NaverWithdrawOutcome[] = [
  'ok',
  'failed',
  'skipped',
  'mismatch',
];

/** `safeNext`를 통과한 경로가 네이버 탈퇴 재인증인가 (경로 /profile + withdraw=naver) */
export function isNaverWithdrawNext(next: string): boolean {
  try {
    const url = new URL(next, 'https://pyroad.invalid');
    return (
      url.pathname === '/profile' &&
      url.searchParams.get('withdraw') === 'naver'
    );
  } catch {
    return false;
  }
}

export function naverWithdrawResultPath(outcome: NaverWithdrawOutcome): string {
  return `/profile?withdraw=naver&naver=${outcome}`;
}

/** 주소에서 결과를 읽고 그 키를 지운 경로를 돌려준다 */
export function takeNaverWithdrawResult(
  href: string,
): { outcome: NaverWithdrawOutcome; cleaned: string } | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.searchParams.get('withdraw') !== 'naver') return null;
  const raw = url.searchParams.get('naver');
  // 결과가 없으면 재인증을 건너뛰었거나 취소하고 돌아온 것(P3-10 안내의 "돌아가기") → 해제하지 않음
  const outcome: NaverWithdrawOutcome =
    raw === null
      ? 'skipped'
      : (OUTCOMES as readonly string[]).includes(raw)
        ? (raw as NaverWithdrawOutcome)
        : 'failed';
  url.searchParams.delete('withdraw');
  url.searchParams.delete('naver');
  const search = url.searchParams.toString();
  return {
    outcome,
    cleaned: `${url.pathname}${search ? `?${search}` : ''}${url.hash}`,
  };
}

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** 재인증을 시작한 사용자 (이 탭에만, 15분) */
export function rememberWithdrawStart(
  uid: string,
  storage: Storage | null = session(),
  now: number = Date.now(),
): void {
  try {
    storage?.setItem(WITHDRAW_STORAGE_KEY, JSON.stringify({ uid, at: now }));
  } catch {
    // 저장소가 막혀 있으면 돌아와서 이어 가지 못할 뿐 (다시 탈퇴하기를 누르면 됨)
  }
}

/** 시작한 사용자 id를 꺼내고 지운다. 없거나 오래됐으면 null */
export function takeWithdrawStart(
  storage: Storage | null = session(),
  now: number = Date.now(),
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WITHDRAW_STORAGE_KEY);
    storage.removeItem(WITHDRAW_STORAGE_KEY);
    if (!raw) return null;
    const { uid, at } = JSON.parse(raw) as { uid?: unknown; at?: unknown };
    if (typeof uid !== 'string' || typeof at !== 'number') return null;
    if (now - at > WITHDRAW_MAX_AGE_MS || at > now + 60_000) return null;
    return uid;
  } catch {
    return null;
  }
}
