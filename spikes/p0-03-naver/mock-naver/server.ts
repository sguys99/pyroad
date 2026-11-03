/**
 * Mock Naver login server (P0-03 spike). Zero dependencies, node:http only.
 *
 * Mirrors the documented Naver behaviour (developers.naver.com, checked 2026-11-03):
 * - OIDC:   /.well-known/openid-configuration, /oauth2/authorize, /oauth2/token, /oauth2/jwks, /oauth2/revoke
 * - Legacy: /oauth2.0/authorize, /oauth2.0/token, /oauth2.0/revoke (no id_token, state required)
 * - Profile: /v1/nid/me -> nested { resultcode, message, response: { id, ... } }
 * - Token endpoint accepts client_secret_post only (discovery: token_endpoint_auth_methods_supported).
 *   A Basic-auth-only request gets 401 invalid_client and the code is NOT consumed.
 * - expires_in is a string ("3600"), id_token is RS256 with only iss/sub/aud/azp/exp/iat/jti/nonce.
 *
 * Test controls (appended by the test client to the authorize URL, never by GoTrue):
 *   mock_user=alice|bob|idonly|linker|collide   which Naver account "logs in"
 *   mock_deny=1                          user presses cancel on the consent screen
 *
 * Also mounts the 대안 B userinfo adapter at /adapter/v1/nid/me (see ../adapter).
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { handleNaverUserinfoAdapter } from '../adapter/naverUserinfoAdapter.ts';

const PORT = Number(process.env.PORT ?? 8080);
// Issuer / server-to-server base (reachable from the GoTrue container)
const ISSUER = process.env.MOCK_ISSUER ?? `http://127.0.0.1:${PORT}`;
// Browser-facing base (reachable from the test client on the host)
const PUBLIC_BASE = process.env.MOCK_PUBLIC_BASE ?? ISSUER;
const CLIENT_ID = process.env.MOCK_CLIENT_ID ?? 'p003-naver-client';
const CLIENT_SECRET = process.env.MOCK_CLIENT_SECRET ?? 'p003-naver-secret';
const ALLOWED_REDIRECTS = (process.env.MOCK_REDIRECT_URIS ?? '').split(',').filter(Boolean);

type Profile = Record<string, string>;
const USERS: Record<string, Profile> = {
  alice: {
    id: 'Zq3mT8xWc1v0nVb7kLp2Rs9dHf4gJy6uEaQo5iNt1Ck',
    nickname: '코딩앨리스',
    name: '김앨리스',
    email: 'alice.parent@naver.com',
    gender: 'F',
    age: '30-39',
    birthday: '03-14',
    profile_image: 'https://phinf.pstatic.net/contact/20260101_1/sample_alice.png',
    birthyear: '1990',
    mobile: '010-0000-0000',
  },
  // declined email (optional consent item)
  bob: {
    id: 'Bv8pLq2Wn5xZc7Ty0Ua3Hd6Fk9Js1Gm4Er2Oi8Nw5Pq',
    nickname: 'bob***',
    profile_image: 'https://ssl.pstatic.net/static/pwe/address/img_profile.png',
  },
  // app requested only the user identifier
  idonly: { id: 'Hc4rN7tYq0wPz3Lm6Vb9Xs2Kd5Fg8Ju1Ia4Oe7Ty0Rw' },
  // used by the linkIdentity test (linked onto an existing email account)
  linker: { id: 'Lk7mN2bV5cX8zA1sD4fG7hJ0kL3qW6eR9tY2uI5oP8a', nickname: 'linker' },
  // same email as an existing (e.g. Google) account in the project
  collide: {
    id: 'Qw1eR2tY3uI4oP5aS6dF7gH8jK9lZ0xC1vB2nM3qW4e',
    nickname: 'collider',
    email: 'victim@example.com',
  },
};

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'mock-' + crypto.randomBytes(4).toString('hex');
const publicJwk = { ...(publicKey.export({ format: 'jwk' }) as object), kid: KID, kty: 'RSA' };

type CodeRecord = {
  user: string;
  redirectUri: string;
  oidc: boolean;
  codeChallenge?: string;
  nonce?: string;
  expiresAt: number;
};
const codes = new Map<string, CodeRecord>();
const accessTokens = new Map<string, string>(); // token -> user
const refreshTokens = new Map<string, string>();
const requestLog: Array<Record<string, unknown>> = [];

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

function signIdToken(claims: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const payload = b64url(JSON.stringify(claims));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), privateKey);
  return `${header}.${payload}.${b64url(sig)}`;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json;charset=utf-8' });
  res.end(JSON.stringify(body));
}

function redirect(res: http.ServerResponse, location: string) {
  res.writeHead(302, { location });
  res.end();
}

async function readBody(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

function discovery() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${PUBLIC_BASE}/oauth2/authorize`,
    token_endpoint: `${ISSUER}/oauth2/token`,
    jwks_uri: `${ISSUER}/oauth2/jwks`,
    revocation_endpoint: `${ISSUER}/oauth2/revoke`,
    userinfo_endpoint: `${ISSUER}/v1/nid/me`,
    response_types_supported: ['code'],
    scopes_supported: ['openid', 'profile'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    revocation_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    subject_types_supported: ['pairwise'],
    id_token_signing_alg_values_supported: ['RS256'],
    prompt_values_supported: ['none', 'login', 'consent'],
    claims_supported: ['iss', 'sub', 'aud', 'exp', 'iat', 'jti', 'azp', 'nonce'],
  };
}

function handleAuthorize(url: URL, res: http.ServerResponse, oidc: boolean) {
  const q = url.searchParams;
  const redirectUri = q.get('redirect_uri') ?? '';
  const state = q.get('state');
  if (q.get('client_id') !== CLIENT_ID) return json(res, 400, { error: 'invalid_client' });
  if (ALLOWED_REDIRECTS.length && !ALLOWED_REDIRECTS.includes(redirectUri)) {
    // Naver shows an error page when the callback URL is not registered
    return json(res, 400, { error: 'invalid_request', error_description: 'redirect_uri mismatch' });
  }
  if (q.get('response_type') !== 'code') return json(res, 400, { error: 'unsupported_response_type' });
  if (oidc && !(q.get('scope') ?? '').split(' ').includes('openid')) {
    return json(res, 400, { error: 'invalid_scope', error_description: "'openid' scope 필수" });
  }
  if (!oidc && !state) return json(res, 400, { error: 'invalid_request', error_description: 'state required' });

  const back = new URL(redirectUri);
  if (state) back.searchParams.set('state', state);
  if (q.get('mock_deny') === '1') {
    back.searchParams.set('error', 'access_denied');
    back.searchParams.set('error_description', 'Canceled By User');
    return redirect(res, back.toString());
  }
  const user = q.get('mock_user') ?? 'alice';
  if (!USERS[user]) return json(res, 400, { error: 'mock_unknown_user' });
  const challenge = q.get('code_challenge') ?? undefined;
  if (challenge && (q.get('code_challenge_method') ?? 'S256') !== 'S256') {
    return json(res, 400, { error: 'invalid_request', error_description: 'only S256' });
  }
  const code = crypto.randomBytes(12).toString('base64url');
  codes.set(code, {
    user,
    redirectUri,
    oidc,
    codeChallenge: challenge,
    nonce: q.get('nonce') ?? undefined,
    expiresAt: Date.now() + 60_000,
  });
  back.searchParams.set('code', code);
  return redirect(res, back.toString());
}

async function handleToken(req: http.IncomingMessage, url: URL, res: http.ServerResponse, oidc: boolean) {
  const body = req.method === 'POST' ? await readBody(req) : new URLSearchParams();
  const p = (k: string) => body.get(k) ?? url.searchParams.get(k);
  const usedBasic = (req.headers.authorization ?? '').startsWith('Basic ');
  requestLog.push({ at: 'token', oidc, usedBasic, hasPostSecret: !!p('client_secret'), grant: p('grant_type') });

  // client_secret_post only
  if (p('client_id') !== CLIENT_ID || p('client_secret') !== CLIENT_SECRET) {
    return json(res, 401, { error: 'invalid_client', error_description: 'Client authentication failed.' });
  }
  const grant = p('grant_type');
  if (grant === 'refresh_token') {
    const user = refreshTokens.get(p('refresh_token') ?? '');
    if (!user) return json(res, 200, { error: 'invalid_request', error_description: 'invalid refresh token' });
    const at = crypto.randomBytes(24).toString('base64');
    accessTokens.set(at, user);
    return json(res, 200, { access_token: at, token_type: 'bearer', expires_in: '3600' });
  }
  if (grant !== 'authorization_code') return json(res, 200, { error: 'unsupported_grant_type' });

  const code = p('code') ?? '';
  const rec = codes.get(code);
  if (!rec || rec.expiresAt < Date.now() || rec.oidc !== oidc) {
    // Naver answers HTTP 200 with an error body for a bad/used code
    return json(res, 200, { error: 'invalid_request', error_description: 'no valid data in session' });
  }
  if (oidc && p('redirect_uri') !== rec.redirectUri) {
    return json(res, 200, { error: 'invalid_request', error_description: 'redirect_uri mismatch' });
  }
  if (rec.codeChallenge) {
    const verifier = p('code_verifier') ?? '';
    const calc = crypto.createHash('sha256').update(verifier).digest('base64url');
    if (calc !== rec.codeChallenge) {
      return json(res, 200, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }
  }
  codes.delete(code); // one-time use

  const at = crypto.randomBytes(24).toString('base64');
  const rt = crypto.randomBytes(24).toString('base64url');
  accessTokens.set(at, rec.user);
  refreshTokens.set(rt, rec.user);
  const out: Record<string, string> = {
    access_token: at,
    refresh_token: rt,
    token_type: 'bearer',
    expires_in: '3600',
  };
  if (oidc) {
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = {
      iss: ISSUER,
      sub: USERS[rec.user].id,
      aud: CLIENT_ID,
      azp: CLIENT_ID,
      exp: now + 1800,
      iat: now,
      jti: crypto.randomUUID(),
    };
    if (rec.nonce) claims.nonce = rec.nonce;
    out.id_token = signIdToken(claims);
  }
  return json(res, 200, out);
}

function handleProfile(req: http.IncomingMessage, res: http.ServerResponse) {
  const auth = req.headers.authorization ?? '';
  const user = auth.startsWith('Bearer ') ? accessTokens.get(auth.slice(7)) : undefined;
  requestLog.push({ at: 'nid/me', ok: !!user });
  if (!auth) return json(res, 401, { resultcode: '028', message: 'Authentication header not exists' });
  if (!user) return json(res, 401, { resultcode: '024', message: 'Authentication failed' });
  return json(res, 200, { resultcode: '00', message: 'success', response: USERS[user] });
}

async function handleRevoke(req: http.IncomingMessage, res: http.ServerResponse) {
  const body = await readBody(req);
  if (body.get('client_id') !== CLIENT_ID || body.get('client_secret') !== CLIENT_SECRET) {
    return json(res, 401, { error: 'unauthorized_client', error_description: 'Client authentication failed.' });
  }
  const token = body.get('token') ?? '';
  accessTokens.delete(token);
  refreshTokens.delete(token);
  res.writeHead(200);
  res.end();
}

const handler: http.RequestListener = async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', ISSUER);
    const path = url.pathname;
    if (path === '/__mock/health') return json(res, 200, { ok: true, issuer: ISSUER });
    if (path === '/__mock/log') return json(res, 200, requestLog.splice(0));
    if (path === '/.well-known/openid-configuration') return json(res, 200, discovery());
    if (path === '/oauth2/jwks') return json(res, 200, { keys: [publicJwk] });
    if (path === '/oauth2/authorize') return handleAuthorize(url, res, true);
    if (path === '/oauth2.0/authorize') return handleAuthorize(url, res, false);
    if (path === '/oauth2/token') return await handleToken(req, url, res, true);
    if (path === '/oauth2.0/token') return await handleToken(req, url, res, false);
    if (path === '/oauth2/revoke' || path === '/oauth2.0/revoke') return await handleRevoke(req, res);
    if (path === '/v1/nid/me') return handleProfile(req, res);
    if (path === '/adapter/v1/nid/me') {
      const request = new Request(url, { headers: { authorization: req.headers.authorization ?? '' } });
      const response = await handleNaverUserinfoAdapter(request, {
        naverUserinfoUrl: `${ISSUER}/v1/nid/me`,
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(await response.text());
    }
    json(res, 404, { error: 'not_found', path });
  } catch (e) {
    json(res, 500, { error: 'mock_error', message: String(e) });
  }
};

// TLS when MOCK_TLS_CERT/MOCK_TLS_KEY are set: GoTrue only talks to https:// providers
// that resolve to non-private IPs (see scripts/lab-up.sh). Listens inside the container
// only; nothing is published to the host.
const server =
  process.env.MOCK_TLS_CERT && process.env.MOCK_TLS_KEY
    ? https.createServer(
        { cert: fs.readFileSync(process.env.MOCK_TLS_CERT), key: fs.readFileSync(process.env.MOCK_TLS_KEY) },
        handler,
      )
    : http.createServer(handler);
server.listen(PORT, () => {
  console.log(`mock-naver listening :${PORT} issuer=${ISSUER} public=${PUBLIC_BASE}`);
});
