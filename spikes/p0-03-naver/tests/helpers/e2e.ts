/**
 * E2E helpers. Runs inside a container on the local Supabase stack network
 * (scripts/e2e.sh), so:
 *   SUPABASE_URL      = http://supabase_kong_p003naver:8000  (API as seen in-network)
 *   PUBLIC_API_ORIGIN = http://127.0.0.1:55421               (API_EXTERNAL_URL GoTrue puts in redirect_uri)
 * The "browser" below follows redirects by hand and maps PUBLIC_API_ORIGIN to SUPABASE_URL,
 * the same way a real browser would reach the public Supabase URL.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = must('SUPABASE_URL');
export const PUBLIC_API_ORIGIN = must('PUBLIC_API_ORIGIN');
export const ANON_KEY = must('ANON_KEY');
export const SERVICE_ROLE_KEY = must('SERVICE_ROLE_KEY');
export const MOCK_BASE = process.env.MOCK_BASE ?? 'http://p003-mock-naver:8080';
export const APP_CALLBACK = 'http://127.0.0.1:3000/auth/callback';

function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} (run via scripts/e2e.sh)`);
  return v;
}

export function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

/** Browser-like client: PKCE flow, in-memory storage (stands in for SSR cookies). */
export function browserClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      flowType: 'pkce',
      storage: memoryStorage(),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toInternal(u: string): string {
  return u.startsWith(PUBLIC_API_ORIGIN) ? SUPABASE_URL + u.slice(PUBLIC_API_ORIGIN.length) : u;
}

async function hop(url: string): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(toInternal(url), { redirect: 'manual' });
  const body = res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), body };
}

export type LoginOptions = {
  provider: `custom:${string}`;
  mockUser?: 'alice' | 'bob' | 'idonly' | 'linker' | 'collide';
  deny?: boolean;
  /** replace the state that comes back from Naver */
  tamperState?: (state: string) => string;
  queryParams?: Record<string, string>;
  client?: SupabaseClient;
  /** manual linking: client must already hold a session; uses auth.linkIdentity */
  link?: boolean;
};

export type LoginTrace = {
  client: SupabaseClient;
  gotrueAuthorizeUrl: string;
  providerAuthorizeUrl: URL | null;
  providerCallbackUrl: URL | null;
  appCallbackUrl: URL | null;
  /** body when GoTrue answered with an error page instead of a redirect */
  errorBody?: string;
};

/** Walks: app -> GoTrue /authorize -> (mock) Naver /authorize -> GoTrue /callback -> app /auth/callback */
export async function oauthLogin(opts: LoginOptions): Promise<LoginTrace> {
  const client = opts.client ?? browserClient();
  const options = { redirectTo: APP_CALLBACK, skipBrowserRedirect: true, queryParams: opts.queryParams };
  const { data, error } = opts.link
    ? await client.auth.linkIdentity({ provider: opts.provider, options })
    : await client.auth.signInWithOAuth({ provider: opts.provider, options });
  if (error || !data.url) throw error ?? new Error('no authorize url');
  const trace: LoginTrace = {
    client,
    gotrueAuthorizeUrl: data.url,
    providerAuthorizeUrl: null,
    providerCallbackUrl: null,
    appCallbackUrl: null,
  };

  // signInWithOAuth returns GoTrue's /authorize URL; linkIdentity already returns the provider URL
  let providerAuthorize: URL;
  if (data.url.startsWith(SUPABASE_URL) || data.url.startsWith(PUBLIC_API_ORIGIN)) {
    const a = await hop(data.url);
    if (!a.location) return { ...trace, errorBody: a.body };
    providerAuthorize = new URL(a.location);
  } else {
    providerAuthorize = new URL(data.url);
  }
  trace.providerAuthorizeUrl = new URL(providerAuthorize);

  // the user picks an account / presses cancel on the (mock) Naver consent screen
  providerAuthorize.searchParams.set('mock_user', opts.mockUser ?? 'alice');
  if (opts.deny) providerAuthorize.searchParams.set('mock_deny', '1');
  const b = await hop(providerAuthorize.toString());
  if (!b.location) return { ...trace, errorBody: b.body };
  const providerCallback = new URL(b.location);
  if (opts.tamperState) {
    providerCallback.searchParams.set('state', opts.tamperState(providerCallback.searchParams.get('state') ?? ''));
  }
  trace.providerCallbackUrl = providerCallback;

  const c = await hop(providerCallback.toString());
  if (!c.location) return { ...trace, errorBody: c.body };
  trace.appCallbackUrl = new URL(c.location);
  return trace;
}

/** What src/app/auth/callback/route.ts does: exchange ?code for a session. */
export async function finishAtAppCallback(trace: LoginTrace) {
  const code = trace.appCallbackUrl?.searchParams.get('code');
  if (!code) throw new Error(`no code at app callback: ${trace.appCallbackUrl} ${trace.errorBody ?? ''}`);
  const { data, error } = await trace.client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return data;
}

/** error / error_code / error_description GoTrue appends to the app callback URL (query or fragment). */
export function callbackError(u: URL | null) {
  if (!u) return null;
  const params = new URLSearchParams(u.search);
  const frag = new URLSearchParams(u.hash.replace(/^#/, ''));
  const get = (k: string) => params.get(k) ?? frag.get(k);
  if (!get('error') && !get('error_code')) return null;
  return { error: get('error'), code: get('error_code'), description: get('error_description') };
}

export async function mockLog(): Promise<Array<Record<string, unknown>>> {
  return (await fetch(`${MOCK_BASE}/__mock/log`)).json();
}

export async function countUsersWithIdentity(admin: SupabaseClient, provider: string, providerId: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  // listUsers does not load identities (identities: null) -> fetch each user
  const full = await Promise.all(data.users.map((u) => admin.auth.admin.getUserById(u.id)));
  return full
    .map((r) => r.data.user!)
    .filter((u) => u.identities?.some((i) => i.provider === provider && i.id === providerId));
}
