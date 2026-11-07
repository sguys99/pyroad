import type { Metadata } from 'next';
// 앱 화면 웹폰트 (P2-10). 랜딩이 아니라 여기서 import
import '@/fonts/app.css';
import { AuthErrorView } from '@/components/auth/AuthErrorView';
import { isLoginErrorReason, parseVia } from '@/lib/auth/loginError';
import { safeNext } from '@/lib/auth/safeNext';

export const metadata: Metadata = {
  title: '로그인 안내',
  robots: { index: false, follow: false },
};

/**
 * 로그인 실패 안내 화면 (P3-10). 랜딩 밖에서 시작한 흐름(`next`가 있는 로그인·계정 연결)이 실패하면 `/auth/callback`이
 * `/auth/error?reason=…&next=…`로 보낸다(`loginErrorPath`). 랜딩에서 시작한 로그인은 랜딩의 로그인 시트가 안내한다.
 * 시도한 수단은 주소에 없고(B43) `AuthErrorView`가 sessionStorage에서 읽는다. 예전 주소의 `via`도 받는다.
 * 주소 값은 다시 검증한다: 사유는 enum만(아니면 unknown), `next`는 `safeNext`. 요청마다 그린다(쿼리를 읽음 → nonce CSP).
 */
export default async function LoginErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; via?: string; next?: string }>;
}) {
  const { reason, via, next } = await searchParams;
  const back = safeNext(next ?? null, '');
  const toSettings = back.startsWith('/settings');
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-gutter py-10 font-sans">
      <AuthErrorView
        reason={isLoginErrorReason(reason) ? reason : 'unknown'}
        via={parseVia(via)}
        backHref={back || null}
        backLabel={toSettings ? '설정으로 돌아가기' : '돌아가기'}
      />
    </main>
  );
}
