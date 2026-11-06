import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/safeNext';
import { trackLoginSuccess } from '@/lib/analytics/server';
import { loginProviderFromUser } from '@/lib/auth/loginProvider';
import { withLastLoginFragment } from '@/lib/auth/lastLogin';
import {
  loginErrorPath,
  parseVia,
  reasonFromExchangeError,
  reasonFromRedirectParams,
  safeCode,
  shouldReportLoginError,
  type LoginErrorReason,
} from '@/lib/auth/loginError';
import { reportServerError } from '@/lib/api/serverError';

/**
 * OAuth 콜백 (Supabase PKCE). 성공하면 `next`(B23 `safeNext`)로, 실패·취소·동의 거부면 사유별 친근한 안내로 (P3-10).
 * 사유 표와 안내 문구: `src/lib/auth/loginError.ts`, `src/components/auth/loginErrorCopy.ts`.
 * provider·GoTrue 원문은 주소·화면에 넘기지 않고, 운영자가 알아야 하는 사유만 코드 이름으로 Sentry에 남긴다(개인정보 없음).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // B23: 같은 출처의 경로만 허용 (`//evil.com`·`https://…`·`/\evil.com` 등은 /world로)
  const next = safeNext(searchParams.get('next'));
  // 시도한 provider (로그인 버튼이 redirectTo에 붙임). 실패 안내에만 쓰는 UI 힌트
  const via = parseVia(searchParams.get('via'));

  const redirect = (path: string) => {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';
    if (isLocalEnv) return NextResponse.redirect(`${origin}${path}`);
    if (forwardedHost)
      return NextResponse.redirect(`https://${forwardedHost}${path}`);
    return NextResponse.redirect(`${origin}${path}`);
  };

  const fail = (reason: LoginErrorReason, detail: string | null) => {
    if (shouldReportLoginError(reason)) {
      reportServerError(
        new Error(`login_error ${reason}${detail ? ` (${detail})` : ''}`),
        { area: 'auth', op: 'callback' },
      );
    }
    return redirect(loginErrorPath(reason, { next, via }));
  };

  // provider가 거절·취소했거나 GoTrue가 오류를 붙여 돌려보냄 (code 없음)
  const fromParams = reasonFromRedirectParams({
    error: searchParams.get('error'),
    errorCode: searchParams.get('error_code'),
    errorDescription: searchParams.get('error_description'),
  });
  if (fromParams) {
    return fail(
      fromParams,
      safeCode(searchParams.get('error_code')) ??
        safeCode(searchParams.get('error')),
    );
  }

  if (!code) return fail('unknown', 'no_code');

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const reason = reasonFromExchangeError(error);
    // 같은 콜백을 두 번 연 경우(새로고침·미리 불러오기): 첫 번째가 이미 로그인시켰으면 그대로 들어간다
    if (reason === 'reused') {
      const { data: current } = await supabase.auth.getUser();
      if (current?.user) return redirect(next);
    }
    return fail(
      reason,
      safeCode((error as { code?: unknown }).code) ?? 'exchange',
    );
  }

  // 로그인 성공 (P1-17). 서버가 직접 기록하고 리다이렉트를 기다리게 하지 않음
  if (data?.user) trackLoginSuccess(request.headers, data.user);
  // "최근에 ○○로 로그인했어요" 배지 (P3-08): 방금 쓴 provider를 #lp= 조각으로 넘기면 도착 화면이 이 기기에 저장한다.
  // next는 이미 safeNext를 통과한 같은 출처 경로이고, 조각은 서버로 가지 않는다 (src/lib/auth/lastLogin.ts)
  return redirect(
    withLastLoginFragment(next, loginProviderFromUser(data?.user)),
  );
}
