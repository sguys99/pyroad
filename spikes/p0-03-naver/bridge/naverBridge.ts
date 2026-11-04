/**
 * 대안 C: server bridge (only if custom:naver via GoTrue is unusable).
 *
 *   GET /auth/naver/start     -> startNaverLogin()   : signed state cookie + 302 to Naver
 *   GET /auth/naver/callback  -> completeNaverLogin(): state check -> code->token -> /v1/nid/me
 *                                -> find-or-create Supabase user (service role) -> real Supabase
 *                                   session (generateLink + verifyOtp, see supabaseAdapters.ts)
 *
 * Framework-light: plain functions + injected deps, so the same code runs in a Next.js
 * Route Handler (cookies()/NextResponse) and in node:test with fakes.
 * Uses Naver's legacy OAuth2 endpoints (no PKCE documented there; state is mandatory).
 */
import crypto from 'node:crypto';
import { safeNext } from './safeNext.ts';

export const NAVER = {
  authorize: 'https://nid.naver.com/oauth2.0/authorize',
  token: 'https://nid.naver.com/oauth2.0/token',
  me: 'https://openapi.naver.com/v1/nid/me',
  revoke: 'https://nid.naver.com/oauth2.0/revoke',
};

export type NaverConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string; // https://<app>/auth/naver/callback (registered in Naver Developers)
  endpoints?: Partial<typeof NAVER>;
};

export const STATE_COOKIE = 'pyroad_naver_state';
const STATE_TTL_SEC = 600;

type StatePayload = { s: string; next: string; iat: number };

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const hmac = (secret: string, data: string) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

function sign(payload: StatePayload, secret: string) {
  const body = b64u(JSON.stringify(payload));
  return `${body}.${hmac(secret, body)}`;
}

function verify(value: string | undefined, secret: string, nowSec: number): StatePayload | 'invalid' | 'expired' {
  if (!value || !value.includes('.')) return 'invalid';
  const [body, sig] = value.split('.', 2);
  const expected = hmac(secret, body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return 'invalid';
  let p: StatePayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return 'invalid';
  }
  if (typeof p.s !== 'string' || typeof p.iat !== 'number') return 'invalid';
  if (nowSec - p.iat > STATE_TTL_SEC || p.iat > nowSec + 30) return 'expired';
  return p;
}

export type CookieSpec = {
  name: string;
  value: string;
  options: { httpOnly: true; secure: boolean; sameSite: 'lax'; path: string; maxAge: number };
};

export function startNaverLogin(
  cfg: NaverConfig,
  opts: { next?: string | null; stateSecret: string; nowSec?: number; secureCookie?: boolean },
): { url: string; cookie: CookieSpec } {
  const state = b64u(crypto.randomBytes(32));
  const next = safeNext(opts.next);
  const url = new URL(cfg.endpoints?.authorize ?? NAVER.authorize);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('state', state);
  return {
    url: url.toString(),
    cookie: {
      name: STATE_COOKIE,
      value: sign({ s: state, next, iat: opts.nowSec ?? Math.floor(Date.now() / 1000) }, opts.stateSecret),
      // Lax: the cookie must come back on Naver's top-level GET redirect to our callback
      options: { httpOnly: true, secure: opts.secureCookie ?? true, sameSite: 'lax', path: '/auth/naver', maxAge: STATE_TTL_SEC },
    },
  };
}

export type NaverProfile = { id: string; nickname?: string; profile_image?: string; email?: string };
export type NaverTokens = { access_token: string; refresh_token?: string };

export interface UserDirectory {
  /** stable key = Naver per-app id. Must never match by email. */
  findOrCreateByNaverId(naverId: string): Promise<{ userId: string; created: boolean }>;
}
export interface SessionIssuer {
  issue(userId: string, naverId: string): Promise<{ access_token: string; refresh_token: string }>;
}

export type BridgeFailure =
  | 'cancelled'
  | 'provider_error'
  | 'state_missing'
  | 'state_invalid'
  | 'state_expired'
  | 'state_mismatch'
  | 'code_missing'
  | 'token_error'
  | 'profile_error'
  | 'user_error'
  | 'session_error';

export type BridgeResult =
  | {
      ok: true;
      userId: string;
      created: boolean;
      next: string;
      session: { access_token: string; refresh_token: string };
      naverTokens: NaverTokens;
    }
  | { ok: false; reason: BridgeFailure; next: '/'; clearCookie: true };

const fail = (reason: BridgeFailure): BridgeResult => ({ ok: false, reason, next: '/', clearCookie: true });

export async function exchangeCode(cfg: NaverConfig, code: string, state: string, fetchImpl: typeof fetch): Promise<NaverTokens | null> {
  const res = await fetchImpl(cfg.endpoints?.token ?? NAVER.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    // client_secret_post (Naver does not list client_secret_basic); state is documented as required
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      state,
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  // Naver reports errors with HTTP 200 + { error, error_description }
  if (j.error || typeof j.access_token !== 'string') return null;
  return { access_token: j.access_token, refresh_token: typeof j.refresh_token === 'string' ? j.refresh_token : undefined };
}

export async function fetchProfile(cfg: NaverConfig, accessToken: string, fetchImpl: typeof fetch): Promise<NaverProfile | null> {
  const res = await fetchImpl(cfg.endpoints?.me ?? NAVER.me, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { resultcode?: string; response?: Record<string, unknown> };
  const id = j.response?.id;
  if (j.resultcode !== '00' || typeof id !== 'string' || !/^[A-Za-z0-9_\-+/=]{1,128}$/.test(id)) return null;
  const r = j.response!;
  return {
    id,
    nickname: typeof r.nickname === 'string' ? r.nickname : undefined,
    profile_image: typeof r.profile_image === 'string' ? r.profile_image : undefined,
    email: typeof r.email === 'string' ? r.email : undefined,
  };
}

export async function completeNaverLogin(
  cfg: NaverConfig,
  input: { url: URL; stateCookie: string | undefined; stateSecret: string; nowSec?: number },
  deps: { fetchImpl?: typeof fetch; users: UserDirectory; sessions: SessionIssuer },
): Promise<BridgeResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const q = input.url.searchParams;
  if (!input.stateCookie) return fail('state_missing');
  const st = verify(input.stateCookie, input.stateSecret, input.nowSec ?? Math.floor(Date.now() / 1000));
  if (st === 'invalid') return fail('state_invalid');
  if (st === 'expired') return fail('state_expired');
  const returned = q.get('state') ?? '';
  if (returned.length !== st.s.length || !crypto.timingSafeEqual(Buffer.from(returned), Buffer.from(st.s))) {
    return fail('state_mismatch');
  }
  const err = q.get('error');
  if (err) return fail(err === 'access_denied' ? 'cancelled' : 'provider_error');
  const code = q.get('code');
  if (!code) return fail('code_missing');

  const tokens = await exchangeCode(cfg, code, st.s, fetchImpl).catch(() => null);
  if (!tokens) return fail('token_error');
  const profile = await fetchProfile(cfg, tokens.access_token, fetchImpl).catch(() => null);
  if (!profile) return fail('profile_error');

  let user: { userId: string; created: boolean };
  try {
    user = await deps.users.findOrCreateByNaverId(profile.id);
  } catch {
    return fail('user_error');
  }
  try {
    const session = await deps.sessions.issue(user.userId, profile.id);
    return { ok: true, userId: user.userId, created: user.created, next: st.next, session, naverTokens: tokens };
  } catch {
    return fail('session_error');
  }
}

/** P3-16: unlink on account deletion. Naver returns 200 even if the token is already gone. */
export async function revokeNaverToken(cfg: NaverConfig, token: string, hint: 'access_token' | 'refresh_token', fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(cfg.endpoints?.revoke ?? NAVER.revoke, {
    method: 'POST',
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, token, token_type_hint: hint }),
    signal: AbortSignal.timeout(5000),
  });
  return res.status === 200;
}
