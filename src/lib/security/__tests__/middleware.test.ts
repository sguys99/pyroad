import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const updateSession = vi.fn(async (request: NextRequest) =>
  NextResponse.next({ request }),
);
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (request: NextRequest) => updateSession(request),
}));

const DSN = 'https://k@o1.ingest.us.sentry.io/2';

async function load(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import('@/middleware')).middleware;
}

const nonceOf = (policy: string | null) =>
  /'nonce-([^']+)'/.exec(policy ?? '')?.[1];

describe('middleware 페이지 CSP (B27)', () => {
  beforeEach(() => updateSession.mockClear());
  afterEach(() => vi.unstubAllEnvs());

  it('동적 페이지: 요청마다 새 nonce를 요청 헤더(Next 렌더용)와 응답 헤더에 같은 값으로', async () => {
    const middleware = await load();
    const req = new NextRequest('https://pyroad.vercel.app/notice');
    const res = await middleware(req);
    const policy = res.headers.get('content-security-policy');
    const nonce = nonceOf(policy);
    expect(nonce).toBeTruthy();
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain('upgrade-insecure-requests');
    expect(policy).not.toContain('unsafe-eval');
    // updateSession이 받은 요청에 CSP가 있어야 Next가 nonce를 읽는다
    const forwarded = updateSession.mock.calls[0][0].headers.get(
      'content-security-policy',
    );
    expect(forwarded).toBe(policy);

    const again = await middleware(
      new NextRequest('https://pyroad.vercel.app/notice'),
    );
    expect(nonceOf(again.headers.get('content-security-policy'))).not.toBe(
      nonce,
    );
  });

  it('랜딩(정적): nonce 없는 정책, 요청 헤더는 건드리지 않음', async () => {
    const middleware = await load();
    const res = await middleware(new NextRequest('https://pyroad.vercel.app/'));
    const policy = res.headers.get('content-security-policy');
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(nonceOf(policy)).toBeUndefined();
    expect(
      updateSession.mock.calls[0][0].headers.get('content-security-policy'),
    ).toBeNull();
  });

  it('리다이렉트 응답에도 붙음', async () => {
    updateSession.mockImplementationOnce(async () =>
      NextResponse.redirect('https://pyroad.vercel.app/'),
    );
    const middleware = await load();
    const res = await middleware(
      new NextRequest('https://pyroad.vercel.app/world'),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    );
  });

  it('API는 페이지 CSP를 붙이지 않음 (next.config의 API CSP)', async () => {
    const middleware = await load();
    const res = await middleware(
      new NextRequest('https://pyroad.vercel.app/api/notice'),
    );
    expect(res.headers.get('content-security-policy')).toBeNull();
  });

  it('Sentry DSN이 있으면 Reporting-Endpoints와 report-to', async () => {
    const middleware = await load({
      NEXT_PUBLIC_SENTRY_DSN: DSN,
      VERCEL_ENV: 'production',
    });
    const res = await middleware(
      new NextRequest('https://pyroad.vercel.app/notice'),
    );
    expect(res.headers.get('reporting-endpoints')).toBe(
      'csp="https://o1.ingest.us.sentry.io/api/2/security/?sentry_key=k&sentry_environment=production"',
    );
    expect(res.headers.get('content-security-policy')).toContain(
      'report-to csp',
    );
  });

  it('CSP_REPORT_ONLY=true면 Report-Only 헤더로 (강제 헤더 없음)', async () => {
    const middleware = await load({ CSP_REPORT_ONLY: 'true' });
    const res = await middleware(
      new NextRequest('https://pyroad.vercel.app/notice'),
    );
    expect(res.headers.get('content-security-policy')).toBeNull();
    expect(res.headers.get('content-security-policy-report-only')).toContain(
      "'strict-dynamic'",
    );
    // Next가 nonce를 읽을 요청 헤더는 그대로
    expect(
      updateSession.mock.calls[0][0].headers.get('content-security-policy'),
    ).toContain("'nonce-");
  });

  it('개발 서버만 unsafe-eval', async () => {
    const middleware = await load({ NODE_ENV: 'development' });
    const res = await middleware(
      new NextRequest('http://localhost:3000/notice'),
    );
    expect(res.headers.get('content-security-policy')).toContain(
      "'unsafe-eval'",
    );
  });
});
