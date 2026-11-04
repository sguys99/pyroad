/** fetch() fake for Naver's legacy endpoints, driven by fixtures/naver-samples.json */
import samples from '../../fixtures/naver-samples.json' with { type: 'json' };

export const CFG = {
  clientId: 'cid',
  clientSecret: 'csecret',
  redirectUri: 'https://pyroad.example/auth/naver/callback',
};

type Account = keyof typeof samples.userinfo;

export function fakeNaverFetch(opts: { account?: Account; tokenError?: boolean } = {}) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
    calls.push(url.pathname);
    if (url.pathname === '/oauth2.0/token') {
      const body = new URLSearchParams(String(init?.body ?? ''));
      if (opts.tokenError || body.get('client_secret') !== CFG.clientSecret) {
        return Response.json({ error: 'invalid_request', error_description: 'no valid data in session' }); // HTTP 200
      }
      const { id_token: _omit, ...legacy } = samples.tokenResponse;
      return Response.json({ ...legacy, access_token: `at-${opts.account ?? 'fullConsent'}` });
    }
    if (url.pathname === '/v1/nid/me') {
      const account = opts.account ?? 'fullConsent';
      const body = samples.userinfo[account];
      return Response.json(body, { status: account === 'invalidToken' ? 401 : 200 });
    }
    if (url.pathname === '/oauth2.0/revoke') return new Response(null, { status: 200 });
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

/** in-memory UserDirectory keyed by Naver id (never by email) */
export function memoryUsers() {
  const byNaverId = new Map<string, string>();
  return {
    byNaverId,
    async findOrCreateByNaverId(naverId: string) {
      const existing = byNaverId.get(naverId);
      if (existing) return { userId: existing, created: false };
      const id = crypto.randomUUID();
      byNaverId.set(naverId, id);
      return { userId: id, created: true };
    },
  };
}

export const fakeSessions = {
  async issue(userId: string) {
    return { access_token: `jwt-for-${userId}`, refresh_token: `rt-${userId}` };
  },
};

export { samples };
