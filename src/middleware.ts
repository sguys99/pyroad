import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import {
  CSP_REPORT_GROUP,
  buildPageCsp,
  createNonce,
  cspHeaderName,
  isCspReportOnly,
  isStaticPagePath,
  sentryCspReportUri,
} from '@/lib/security/csp';

const isDev = process.env.NODE_ENV === 'development';
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.VERCEL_ENV;
const cspHeader = cspHeaderName(isCspReportOnly());
const reportUri = sentryCspReportUri(sentryDsn, environment);

/**
 * 페이지 CSP (B27). 동적 렌더 페이지는 요청마다 nonce를 만들어 요청 헤더로 넘긴다:
 * Next가 서버 렌더 때 요청의 CSP에서 nonce를 읽어 자기 `<script>`에 붙인다.
 * 정적 페이지(랜딩)는 빌드 때 만든 HTML이라 nonce 없는 정책을 받는다 (`src/lib/security/csp.ts`).
 * API 응답의 CSP는 `next.config.ts`가 붙인다.
 */
function applyPageCsp(request: NextRequest): string | null {
  const { pathname, protocol } = request.nextUrl;
  if (pathname.startsWith('/api/')) return null;
  const nonce = isStaticPagePath(pathname) ? undefined : createNonce();
  const policy = buildPageCsp({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sentryDsn,
    environment,
    isDev,
    isHttps: protocol === 'https:',
  });
  // Next는 요청의 `Content-Security-Policy`(Report-Only가 아닌 것도 함께)에서 nonce를 찾는다
  if (nonce) request.headers.set('Content-Security-Policy', policy);
  return policy;
}

export async function middleware(request: NextRequest) {
  // updateSession이 `NextResponse.next({ request })`로 요청 헤더를 넘기므로 그 전에 넣는다
  const policy = applyPageCsp(request);
  const response = await updateSession(request);
  if (policy) {
    response.headers.set(cspHeader, policy);
    if (reportUri) {
      response.headers.set(
        'Reporting-Endpoints',
        `${CSP_REPORT_GROUP}="${reportUri}"`,
      );
    }
  }
  return response;
}

export const config = {
  // Pyodide 자체 호스팅 파일(/pyodide/)과 Worker 스크립트(/workers/)는 정적 파일이라 세션 갱신이 필요 없다 (B26).
  // Worker 스크립트의 CSP는 next.config.ts headers가 붙인다 (B27). 사운드 파일(/sounds/)도 정적 파일이라 제외 (P2-14)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|pyodide/|workers/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
