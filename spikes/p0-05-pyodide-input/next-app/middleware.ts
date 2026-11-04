import { NextResponse, type NextRequest } from 'next/server';

// D. middleware로 /mw/quest/* 에만 COOP/COEP를 붙이는 경우 (repo의 src/middleware.ts와 같은 위치에서 처리하는 방식)
export function middleware(request: NextRequest) {
  const res = NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/mw/quest/')) {
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.headers.set('Cross-Origin-Embedder-Policy', process.env.COEP ?? 'require-corp');
  }
  return res;
}

export const config = { matcher: ['/mw/:path*'] };
