import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/safeNext';
import { trackLoginSuccess } from '@/lib/analytics/server';
import { loginProviderFromUser } from '@/lib/auth/loginProvider';
import { withLastLoginFragment } from '@/lib/auth/lastLogin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // B23: 같은 출처의 경로만 허용 (`//evil.com`·`https://…`·`/\evil.com` 등은 /world로)
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 로그인 성공 (P1-17). 서버가 직접 기록하고 리다이렉트를 기다리게 하지 않음
      if (data?.user) trackLoginSuccess(request.headers, data.user);
      // "최근에 ○○로 로그인했어요" 배지 (P3-08): 방금 쓴 provider를 #lp= 조각으로 넘기면 도착 화면이 이 기기에 저장한다.
      // next는 이미 safeNext를 통과한 같은 출처 경로이고, 조각은 서버로 가지 않는다 (src/lib/auth/lastLogin.ts)
      const target = withLastLoginFragment(
        next,
        loginProviderFromUser(data?.user),
      );
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${target}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${target}`);
      } else {
        return NextResponse.redirect(`${origin}${target}`);
      }
    }
  }

  // 에러 시 랜딩으로 리다이렉트
  return NextResponse.redirect(`${origin}/?error=auth`);
}
