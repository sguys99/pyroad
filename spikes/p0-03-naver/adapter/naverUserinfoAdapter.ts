/**
 * 대안 B: "userinfo adapter" for a custom:naver **OAuth2** provider.
 *
 * GoTrue's custom OAuth2 provider decodes the userinfo JSON straight into its
 * flat Claims struct (sub, email, nickname, picture, ...). Naver returns
 * { resultcode, message, response: { id, ... } }, so `sub` ends up empty and
 * sign-in fails ("error missing provider id"). attribute_mapping only does
 * flat key copies on the already-decoded Claims, so it cannot reach response.id.
 *
 * This adapter is registered as the provider's userinfo_url instead of
 * https://openapi.naver.com/v1/nid/me. GoTrue calls it with
 * `Authorization: Bearer <naver access token>`; it forwards the token to Naver
 * and returns flat, minimal claims.
 *
 * Production shape: a Next.js Route Handler, e.g.
 *   export const GET = (req: Request) => handleNaverUserinfoAdapter(req, { naverUserinfoUrl: NAVER_ME })
 * It needs no secrets (it only relays the caller's own token), but it must be
 * public HTTPS (GoTrue rejects http/localhost/private IPs at provider creation).
 *
 * Only needed if the OIDC path (custom:naver with issuer https://nid.naver.com)
 * turns out unusable with the real Naver app. See docs/spikes/P0-03-naver-login.md.
 */

export type AdapterDeps = {
  naverUserinfoUrl?: string;
  fetchImpl?: typeof fetch;
  /** include nickname/picture in the claims. Default false: children's data minimisation (§2.6). */
  includeProfile?: boolean;
};

export const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me';

type NaverMe = {
  resultcode?: string;
  message?: string;
  response?: Record<string, unknown>;
};

const NAVER_ID_RE = /^[A-Za-z0-9_\-+/=]{1,128}$/;

/** Pure mapping, exported for unit tests and for P0-04 metadata normalisation. */
export function flattenNaverProfile(body: NaverMe, includeProfile = false): Record<string, unknown> | null {
  if (body?.resultcode !== '00' || !body.response) return null;
  const r = body.response;
  const id = typeof r.id === 'string' ? r.id : typeof r.id === 'number' ? String(r.id) : '';
  if (!NAVER_ID_RE.test(id)) return null;
  const claims: Record<string, unknown> = { sub: id };
  if (includeProfile) {
    if (typeof r.nickname === 'string' && r.nickname) claims.nickname = r.nickname;
    if (typeof r.profile_image === 'string' && r.profile_image) claims.picture = r.profile_image;
  }
  // Never forward email: Naver's "연락처 이메일" can be changed by the user and is not
  // a verified login identifier. Forwarding it with email_verified=true would let
  // GoTrue auto-link to an existing Google account with the same address.
  // name / mobile / birthyear / birthday / gender / age are never forwarded.
  return claims;
}

export async function handleNaverUserinfoAdapter(req: Request, deps: AdapterDeps = {}): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const auth = req.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9+/=._~-]{10,512}$/.test(auth)) {
    return Response.json({ error: 'invalid_token' }, { status: 401 });
  }
  let upstream: Response;
  try {
    upstream = await fetchImpl(deps.naverUserinfoUrl ?? NAVER_USERINFO_URL, {
      headers: { authorization: auth },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502 });
  }
  if (upstream.status === 401) return Response.json({ error: 'invalid_token' }, { status: 401 });
  if (!upstream.ok) return Response.json({ error: 'upstream_error' }, { status: 502 });
  const claims = flattenNaverProfile((await upstream.json()) as NaverMe, deps.includeProfile ?? false);
  if (!claims) return Response.json({ error: 'invalid_profile' }, { status: 502 });
  return Response.json(claims, { headers: { 'cache-control': 'no-store' } });
}
