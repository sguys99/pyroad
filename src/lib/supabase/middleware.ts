import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * 보호 경로: 미인증 → / 리다이렉트. `src/app/(protected)/` 의 모든 라우트 폴더 + /onboarding(P3-11, (protected) 밖이지만 로그인 필요).
 * 폴더를 더하면 여기에도 — 빠지면 단위 테스트가 실패 (B120, P12-05 L2: /gallery·/shop·/worlds 가 빠져 있었음)
 */
export const PROTECTED_PATHS = [
  '/world',
  '/worlds',
  '/daily',
  '/quest',
  '/profile',
  '/board',
  '/settings',
  '/gallery',
  '/shop',
  '/onboarding',
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  );

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 인증된 사용자가 /에 접근 → /world 리다이렉트
  if (user && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/world';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
