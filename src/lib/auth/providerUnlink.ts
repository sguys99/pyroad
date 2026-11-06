import 'server-only';

import { reportServerError } from '@/lib/api/serverError';
import { toSocialProvider, type IdentityLike } from './loginProvider';

/**
 * 소셜 provider 쪽 연결 끊기 (P3-16, 계획서 §2.8 "탈퇴").
 *
 * Supabase `admin.deleteUser`·`unlinkIdentity`는 provider에 알리지 않는다. 그래서 탈퇴(`/api/account/delete`)와
 * 수동 연결 해제(P3-07 설정 화면, `unlinkIdentity` 전에)도 같은 함수(`unlinkKakao`·`unlinkAllKakao`·`revokeNaver`)를 쓴다. 규칙:
 * - **실패해도 던지지 않는다.** 결과만 돌려주고, 부르는 쪽은 우리 데이터 삭제를 계속한다
 * - 기록은 provider + HTTP 상태(또는 timeout·network)만. 토큰·회원번호·이메일은 로그·Sentry에 남기지 않는다
 * - 키가 없으면(Preview·로컬) 부르지 않고 `skipped` (로그 한 줄, Sentry 없음)
 * - 요청 하나에 5초 제한, 재시도 없음(탈퇴 버튼을 다시 누르면 다시 시도됨)
 *
 * Kakao: 어드민 키로 회원번호를 지정해 앱 연결 끊기
 *   `POST https://kapi.kakao.com/v1/user/unlink` · `Authorization: KakaoAK ${KAKAO_ADMIN_KEY}` ·
 *   `target_id_type=user_id&target_id=<회원번호>`. 이미 끊긴 사용자(-101)는 성공으로 본다.
 * Naver: 로그인 토큰을 폐기하면 "내정보 > 연결된 서비스 관리"의 연동 항목이 지워진다(네이버 로그인 API 명세 3.3, 2026-11-06 확인)
 *   `POST https://nid.naver.com/oauth2.0/revoke` · `client_id`·`client_secret`·`token`·`token_type_hint`.
 *   이미 폐기·없는 토큰도 200. 토큰은 DB에 저장하지 않으므로 탈퇴 직전 재인증으로 받은 토큰만 쓴다(`/auth/callback`).
 *   (OIDC로 받은 토큰이 이 주소에서 폐기되는지는 실 앱 스모크 N-11로 확인. 거절되면 discovery의 `/oauth2/revoke`로 바꾼다.
 *   카카오는 K-10, docs/release/v0.4-phase3-providers.md §9)
 */

export type UnlinkOutcome = 'ok' | 'failed' | 'skipped';

export const KAKAO_UNLINK_URL = 'https://kapi.kakao.com/v1/user/unlink';
export const NAVER_REVOKE_URL = 'https://nid.naver.com/oauth2.0/revoke';
export const UNLINK_TIMEOUT_MS = 5000;

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

interface Deps {
  env?: Env;
  fetch?: Fetch;
  timeoutMs?: number;
}

/** 실패 기록: provider + 상태만 (토큰·식별자 없음) */
function recordFailure(provider: 'kakao' | 'naver', status: string): void {
  reportServerError(new Error(`${provider} unlink ${status}`), {
    area: 'auth',
    op: `${provider}_unlink`,
  });
}

async function postForm(
  url: string,
  body: URLSearchParams,
  headers: Record<string, string>,
  { fetch: f = fetch, timeoutMs = UNLINK_TIMEOUT_MS }: Deps,
): Promise<{ status: number; json: unknown } | 'timeout' | 'network'> {
  try {
    const res = await f(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        ...headers,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } catch (error) {
    return error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
      ? 'timeout'
      : 'network';
  }
}

/** 카카오 회원번호 하나의 앱 연결 끊기 (어드민 키) */
export async function unlinkKakao(
  kakaoUserId: string,
  deps: Deps = {},
): Promise<UnlinkOutcome> {
  const key = (deps.env ?? process.env).KAKAO_ADMIN_KEY?.trim();
  if (!key) {
    console.info('[auth] kakao_unlink skipped: KAKAO_ADMIN_KEY 없음');
    return 'skipped';
  }
  if (!/^\d{1,20}$/.test(kakaoUserId)) {
    recordFailure('kakao', 'bad_id');
    return 'failed';
  }
  const res = await postForm(
    KAKAO_UNLINK_URL,
    new URLSearchParams({ target_id_type: 'user_id', target_id: kakaoUserId }),
    { Authorization: `KakaoAK ${key}` },
    deps,
  );
  if (typeof res === 'string') {
    recordFailure('kakao', res);
    return 'failed';
  }
  if (res.status === 200) return 'ok';
  // -101: 이 앱에 연결되지 않은 사용자 = 이미 끊김
  const code = (res.json as { code?: unknown } | null)?.code;
  if (code === -101) return 'ok';
  recordFailure(
    'kakao',
    `http_${res.status}${typeof code === 'number' ? `_${code}` : ''}`,
  );
  return 'failed';
}

/** 네이버 로그인 토큰 폐기 = 앱 연동 해제. refresh 토큰이 있으면 그것(쌍으로 폐기), 없으면 access 토큰 */
export async function revokeNaver(
  token: { refreshToken?: string | null; accessToken?: string | null },
  deps: Deps = {},
): Promise<UnlinkOutcome> {
  const env = deps.env ?? process.env;
  const clientId = env.NAVER_CLIENT_ID?.trim();
  const clientSecret = env.NAVER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.info(
      '[auth] naver_unlink skipped: NAVER_CLIENT_ID·NAVER_CLIENT_SECRET 없음',
    );
    return 'skipped';
  }
  const value = token.refreshToken || token.accessToken;
  if (!value) {
    recordFailure('naver', 'no_token');
    return 'failed';
  }
  const res = await postForm(
    NAVER_REVOKE_URL,
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: value,
      token_type_hint: token.refreshToken ? 'refresh_token' : 'access_token',
    }),
    {},
    deps,
  );
  if (typeof res === 'string') {
    recordFailure('naver', res);
    return 'failed';
  }
  if (res.status === 200) return 'ok';
  recordFailure('naver', `http_${res.status}`);
  return 'failed';
}

/** 사용자의 Kakao identity 회원번호들 (내장 `kakao`·대체안 `custom:kakao`) */
export function kakaoUserIds(
  identities:
    | readonly (IdentityLike & { id?: string | null })[]
    | null
    | undefined,
): string[] {
  const out: string[] = [];
  for (const i of identities ?? []) {
    if (toSocialProvider(i.provider) !== 'kakao') continue;
    const data = i.identity_data ?? {};
    const raw = i.id ?? data.provider_id ?? data.sub;
    const id =
      typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** 사용자의 Kakao 연결을 모두 끊는다. identity가 없으면 `skipped` */
export async function unlinkAllKakao(
  identities: Parameters<typeof kakaoUserIds>[0],
  deps: Deps = {},
): Promise<UnlinkOutcome> {
  const ids = kakaoUserIds(identities);
  if (ids.length === 0) return 'skipped';
  const results = await Promise.all(ids.map((id) => unlinkKakao(id, deps)));
  if (results.includes('failed')) return 'failed';
  return results.includes('ok') ? 'ok' : 'skipped';
}
