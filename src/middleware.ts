import { NextResponse, type NextRequest } from 'next/server';
import { isKnownWorldSlug, worldSlugOf } from '@/lib/world/knownWorldSlug';
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

/** `/share/<id>` 공유 페이지 */
export function isSharePage(pathname: string): boolean {
  return pathname === '/share' || pathname.startsWith('/share/');
}

export async function middleware(request: NextRequest) {
  // updateSession이 `NextResponse.next({ request })`로 요청 헤더를 넘기므로 그 전에 넣는다
  const policy = applyPageCsp(request);
  // 공유 페이지(P9-08)는 비로그인 열람·미리보기 수집기용이라 세션 갱신(Supabase getUser 왕복)을 건너뛴다.
  // matcher 에서 빼지 않는 까닭: 이 페이지의 CSP nonce 도 여기서 만든다
  let response = isSharePage(request.nextUrl.pathname)
    ? NextResponse.next({ request })
    : await updateSession(request);
  // 없는 월드 주소는 진짜 404 상태로 (로그인 사용자만 여기까지 옴 — 비로그인은 위에서 / 로 보냄, P5-14).
  // 짝 없는 경로로 바꿔 쓰면 루트 not-found 화면이 404로 그려진다. 없는 퀘스트는 DB 조회가 필요해 페이지에 맡김(200 + noindex)
  const slug = worldSlugOf(request.nextUrl.pathname);
  if (slug !== null && response.status === 200 && !isKnownWorldSlug(slug)) {
    const notFound = NextResponse.rewrite(
      new URL('/_world-not-found', request.url),
      { request: { headers: request.headers } },
    );
    response.cookies.getAll().forEach((c) => notFound.cookies.set(c));
    response = notFound;
  }
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
  // Worker 스크립트의 CSP는 next.config.ts headers가 붙인다 (B27). 사운드 파일(/sounds/)도 정적 파일이라 제외 (P2-14).
  // 정지 그림(/images/)·종이 결 타일(/textures/)·Lottie(/animations/ JSON)도 같은 이유로 제외 (P2-16).
  // 빌드 때 만든 메타데이터 파일(공유 미리보기 그림 `/opengraph-image`·`robots.txt`·`sitemap.xml`)도 제외 (P4-10):
  // 크롤러가 받는 정적 응답에 세션 갱신·페이지 CSP가 필요 없다.
  // 앱 매니페스트·파비콘(`/icon`)·홈 화면 아이콘(`/apple-icon`, 해시 쿼리·`/icon/<id>` 변형 포함)도 같은 이유 (P4-11).
  // manifest 아이콘 `/pwa/*.png`는 확장자 규칙으로 이미 빠진다.
  // 공유 카드 API(`/api/share-cards`, P9-08)도 제외: 이미지는 비로그인·수집기가 받는 CDN 캐시 응답, 만들기 API 는 스스로 getUser.
  // 공유 페이지 `/share`는 nonce CSP 때문에 남기고 세션 갱신만 건너뛴다(위 isSharePage)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/share-cards(?:$|/)|pyodide/|workers/|sounds/|images/|textures/|animations/|opengraph-image|twitter-image|robots\\.txt$|sitemap\\.xml$|manifest\\.webmanifest$|icon(?:$|/)|apple-icon(?:$|/)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)',
  ],
};
