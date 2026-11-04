// Kakao 로그인 목업 서버 (의존성 없음, TLS 는 run.sh 의 임시 CA)
// 두 이름으로 같은 서버에 접속한다 (docker 네트워크 별칭)
//   - https://kapi.kakao.com      : GoTrue 내장 kakao provider 의 GOTRUE_EXTERNAL_KAKAO_URL.
//                                    kakao.go 는 URL 하나로 kauth·kapi 를 모두 바꾸므로 /oauth/* 와 /v2/user/me 를 한 서버에 둔다.
//   - https://mock-kauth.p004.test : custom:kakao(OIDC) 용 discovery_url. 문서의 issuer 는 실제 값 https://kauth.kakao.com
//
// 흉내 내는 Kakao 동작 (developers.kakao.com 문서 + 실제 discovery 문서, 2026-11-03 확인)
// - 앱에 설정하지 않은 동의항목이 scope 에 있으면 동의 화면 전에 KOE205(invalid_scope) 에러 페이지 (리다이렉트 없음)
// - 일반 앱(비즈앱 아님)은 account_email 을 설정할 수 없음
// - 등록하지 않은 redirect_uri → KOE006, 잘못된 앱 키 → KOE101, client_secret 누락/불일치 → KOE010, 재사용 코드 → KOE320
// - 토큰 엔드포인트 인증은 client_secret_post 만 지원 (token_endpoint_auth_methods_supported)
// - PKCE S256 지원 (code_challenge_methods_supported)
// - 사용자가 취소하면 redirect_uri?error=access_denied&error_description=User%20denied%20access
// - /v2/user/me: kakao_account.profile.{nickname, profile_image_url, thumbnail_image_url, is_default_image, is_default_nickname}
// - ID 토큰: iss=https://kauth.kakao.com, aud=앱 키, sub=회원번호, nickname, picture(110x110), email(동의·유효할 때만)
import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash, generateKeyPairSync, sign } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8080);
const CLIENT_ID = process.env.MOCK_CLIENT_ID ?? 'mock-rest-api-key';
const CLIENT_SECRET = process.env.MOCK_CLIENT_SECRET ?? 'mock-client-secret';
const REDIRECT_URIS = (process.env.MOCK_REDIRECT_URIS ?? '').split(',').filter(Boolean);
const OIDC_HOST = process.env.MOCK_OIDC_HOST ?? 'mock-kauth.p004.test';
const ISSUER = 'https://kauth.kakao.com';

const state = {
  bizApp: false,
  // true: 클라이언트 인증 실패(KOE101) 요청에서도 인가 코드를 소모한다고 가정 (Kakao 실제 동작은 P3 에서 실측)
  burnCodeOnClientError: false,
  log: [],
  codes: new Map(),
};

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'p004-mock-key';
const JWK = { ...publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' };

const configuredScopes = () =>
  state.bizApp
    ? ['profile_nickname', 'profile_image', 'account_email']
    : ['profile_nickname', 'profile_image'];

const DEFAULT_IMG =
  'http://img1.kakaocdn.net/thumb/R640x640.q70/?fname=http://t1.kakaocdn.net/account_images/default_profile.jpeg';
const DEFAULT_THUMB =
  'http://img1.kakaocdn.net/thumb/R110x110.q70/?fname=http://t1.kakaocdn.net/account_images/default_profile.jpeg';

// 사용자 시나리오 (값은 가짜)
const personas = {
  kid: { id: 4012345678, nickname: '파이썬꿈나무', image: 'http://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_640x640.jpg', thumb: 'http://k.kakaocdn.net/dn/bXyZ12/btsAbCdEf/AbCdEfGhIjKl/img_110x110.jpg', isDefaultImage: false },
  'kid-default': { id: 4012345679, nickname: '이서연', image: DEFAULT_IMG, thumb: DEFAULT_THUMB, isDefaultImage: true },
  // 선택 동의(닉네임·사진)를 모두 거부한 사용자
  'kid-noconsent': { id: 4012345680, nickname: '거부한아이', image: DEFAULT_IMG, thumb: DEFAULT_THUMB, isDefaultImage: true, declines: ['profile_nickname', 'profile_image'] },
  // 비즈앱 + 이메일 동의 (비교용)
  'parent-email': { id: 4012345682, nickname: 'coding_parent', image: DEFAULT_IMG, thumb: DEFAULT_THUMB, isDefaultImage: true, email: 'kid.parent@kakao.com' },
  // 수동 연결 시나리오용
  'kid-link': { id: 4012345690, nickname: 'link_bear', image: DEFAULT_IMG, thumb: DEFAULT_THUMB, isDefaultImage: true },
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body === 'object';
  res.writeHead(status, {
    'content-type': isJson ? 'application/json;charset=UTF-8' : 'text/html;charset=UTF-8',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

function kakaoErrorPage(code, desc) {
  return `<html><body><h1>${code}</h1><p>${desc}</p></body></html>`;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function idToken(rec) {
  const { persona: p, scopes, nonce } = rec;
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: ISSUER, aud: CLIENT_ID, sub: String(p.id), iat: now, exp: now + 7199, auth_time: now };
  if (nonce) claims.nonce = nonce;
  if (scopes.includes('profile_nickname')) claims.nickname = p.nickname;
  if (scopes.includes('profile_image')) claims.picture = p.thumb;
  if (scopes.includes('account_email') && p.email) claims.email = p.email;
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const body = b64url(JSON.stringify(claims));
  const sig = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

const handler = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);

  if (url.pathname === '/__log') return send(res, 200, state.log);
  if (url.pathname === '/__reset') {
    state.log = [];
    state.bizApp = url.searchParams.get('biz') === 'true';
    state.burnCodeOnClientError = url.searchParams.get('burn') === 'true';
    return send(res, 200, { ok: true, bizApp: state.bizApp, burn: state.burnCodeOnClientError });
  }

  // OIDC discovery (실제 kauth.kakao.com 문서와 같은 모양, 엔드포인트만 목업 호스트)
  if (url.pathname === '/.well-known/openid-configuration') {
    state.log.push({ type: 'discovery' });
    const base = `https://${OIDC_HOST}`;
    return send(res, 200, {
      issuer: ISSUER,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      userinfo_endpoint: `${base}/v1/oidc/userinfo`,
      jwks_uri: `${base}/.well-known/jwks.json`,
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      subject_types_supported: ['pairwise'],
      id_token_signing_alg_values_supported: ['RS256'],
      request_uri_parameter_supported: false,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      claims_supported: ['iss', 'aud', 'sub', 'auth_time', 'exp', 'iat', 'nonce', 'nickname', 'picture', 'email'],
    });
  }
  if (url.pathname === '/.well-known/jwks.json') {
    state.log.push({ type: 'jwks' });
    return send(res, 200, { keys: [JWK] });
  }

  // 인가 코드 요청 (kauth.kakao.com/oauth/authorize)
  if (req.method === 'GET' && url.pathname === '/oauth/authorize') {
    const q = Object.fromEntries(url.searchParams);
    const requested = (q.scope ?? '').split(/[\s,]+/).filter(Boolean);
    const entry = { type: 'authorize', host: req.headers.host, query: q, requestedScopes: requested };
    state.log.push(entry);

    if (q.client_id !== CLIENT_ID) return send(res, 401, kakaoErrorPage('KOE101', 'invalid_client: 잘못된 앱 키'));
    if (!REDIRECT_URIS.includes(q.redirect_uri)) return send(res, 400, kakaoErrorPage('KOE006', `등록하지 않은 리다이렉트 URI: ${q.redirect_uri}`));
    const unconfigured = requested.filter((s) => !configuredScopes().includes(s) && s !== 'openid');
    if (unconfigured.length > 0) {
      entry.result = 'KOE205';
      return send(res, 400, kakaoErrorPage('KOE205', `invalid_scope: 설정하지 않은 동의항목: ${unconfigured.join(',')}`));
    }

    const redirect = new URL(q.redirect_uri);
    if (q.state) redirect.searchParams.set('state', q.state);
    const personaKey = q.mock_user ?? 'kid';
    if (personaKey === 'cancel') {
      entry.result = 'access_denied';
      redirect.searchParams.set('error', 'access_denied');
      redirect.searchParams.set('error_description', 'User denied access');
      return send(res, 302, '', { location: redirect.toString() });
    }
    const persona = personas[personaKey];
    if (!persona) return send(res, 400, kakaoErrorPage('MOCK', `unknown mock_user ${personaKey}`));

    // scope 를 보내면 그 항목만 동의 화면에 나옴. 사용자가 거부한 선택 항목은 빠짐
    const scopes = (requested.length ? requested : configuredScopes()).filter((s) => !(persona.declines ?? []).includes(s));
    const code = randomBytes(12).toString('hex');
    state.codes.set(code, {
      persona,
      scopes,
      used: false,
      redirect_uri: q.redirect_uri,
      nonce: q.nonce,
      codeChallenge: q.code_challenge,
      codeChallengeMethod: q.code_challenge_method,
    });
    entry.result = 'code';
    redirect.searchParams.set('code', code);
    return send(res, 302, '', { location: redirect.toString() });
  }

  // 토큰 요청 (kauth.kakao.com/oauth/token) - client_secret_post 만 지원
  if (req.method === 'POST' && url.pathname === '/oauth/token') {
    const form = new URLSearchParams(await readBody(req));
    const entry = {
      type: 'token',
      host: req.headers.host,
      hasBasicAuthHeader: /^Basic /i.test(req.headers.authorization ?? ''),
      bodyKeys: [...form.keys()].sort(),
    };
    state.log.push(entry);
    const rec = state.codes.get(form.get('code') ?? '');
    if (form.get('client_id') !== CLIENT_ID) {
      entry.result = 'KOE101';
      if (state.burnCodeOnClientError && rec) rec.used = true;
      return send(res, 401, { error: 'invalid_client', error_description: 'Not exist client_id', error_code: 'KOE101' });
    }
    if (form.get('client_secret') !== CLIENT_SECRET) {
      entry.result = 'KOE010';
      return send(res, 401, { error: 'invalid_client', error_description: 'Bad client credentials', error_code: 'KOE010' });
    }
    if (!rec || rec.used) {
      entry.result = 'KOE320';
      return send(res, 400, { error: 'invalid_grant', error_description: 'authorization code not found', error_code: 'KOE320' });
    }
    if (rec.codeChallenge) {
      const verifier = form.get('code_verifier') ?? '';
      const expected = createHash('sha256').update(verifier).digest('base64url');
      entry.pkce = expected === rec.codeChallenge ? 'ok' : 'mismatch';
      if (entry.pkce !== 'ok') {
        entry.result = 'KOE_PKCE';
        return send(res, 400, { error: 'invalid_grant', error_description: 'code_verifier mismatch' });
      }
    }
    rec.used = true;
    const accessToken = 'at-' + randomBytes(12).toString('hex');
    state.codes.set(accessToken, rec);
    entry.result = 'ok';
    const body = {
      token_type: 'bearer',
      access_token: accessToken,
      expires_in: 21599,
      refresh_token: 'rt-' + randomBytes(12).toString('hex'),
      refresh_token_expires_in: 5183999,
      scope: rec.scopes.join(' '),
    };
    if (rec.scopes.includes('openid')) body.id_token = idToken(rec);
    return send(res, 200, body);
  }

  // 사용자 정보 (kapi.kakao.com/v2/user/me)
  if (url.pathname === '/v2/user/me') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const rec = state.codes.get(token);
    state.log.push({ type: 'me', ok: !!rec });
    if (!rec) return send(res, 401, { msg: 'this access token does not exist', code: -401 });
    const { persona: p, scopes } = rec;
    const account = {};
    if (scopes.includes('profile_nickname') || scopes.includes('profile_image')) {
      account.profile = {};
      if (scopes.includes('profile_nickname')) {
        account.profile_nickname_needs_agreement = false;
        account.profile.nickname = p.nickname;
        account.profile.is_default_nickname = false;
      }
      if (scopes.includes('profile_image')) {
        account.profile_image_needs_agreement = false;
        account.profile.thumbnail_image_url = p.thumb;
        account.profile.profile_image_url = p.image;
        account.profile.is_default_image = p.isDefaultImage;
      }
    } else {
      account.profile_nickname_needs_agreement = true;
      account.profile_image_needs_agreement = true;
    }
    if (scopes.includes('account_email') && p.email) {
      Object.assign(account, { email_needs_agreement: false, is_email_valid: true, is_email_verified: true, email: p.email });
    }
    return send(res, 200, { id: p.id, connected_at: '2026-11-03T00:00:00Z', kakao_account: account });
  }

  send(res, 404, { error: 'not found', path: url.pathname });
};

const tls = process.env.TLS_CERT && process.env.TLS_KEY
  ? { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }
  : null;
const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
server.listen(PORT, () => console.log(`mock-kakao listening on ${tls ? 'https' : 'http'} :${PORT}`));
