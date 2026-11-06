import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { reportServerError } from '@/lib/api/serverError';
import { toSocialProvider } from '@/lib/auth/loginProvider';
import { unlinkAllKakao, type UnlinkOutcome } from '@/lib/auth/providerUnlink';
import type { SocialProvider } from '@/lib/auth/socialLogin';

/**
 * 로그인 수단 연결 해제 (P3-07 ④). `POST { provider: 'google' | 'kakao' | 'naver' }`
 *
 * 1. 세션 사용자의 identity를 서버에서 다시 센다: 이 provider를 빼도 로그인 수단이 하나 이상 남아야 한다(마지막 수단은 해제 불가).
 *    GoTrue도 마지막 identity 삭제를 거절하지만(`single_identity_not_deletable`) 여기서 먼저 막는다
 * 2. 사용자 세션으로 `unlinkIdentity` (우리 쪽 연결을 먼저 끊는다: 이게 거절되면 provider 쪽은 건드리지 않음)
 * 3. provider 쪽 (P3-16 헬퍼 재사용): Kakao는 어드민 키 unlink(실패·키 없음이어도 해제는 끝난 것, 기록만).
 *    Naver는 토큰을 저장하지 않으므로 화면이 "네이버 → 연결된 서비스 관리에서 직접 끊기"를 안내(`manual`). Google은 할 일 없음
 * 응답에는 식별자를 싣지 않는다. 오류 원문은 응답에 넣지 않는다.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown = null;
  try {
    raw = ((await request.json()) as { provider?: unknown })?.provider;
  } catch {
    // 아래에서 400
  }
  const provider: SocialProvider | null =
    raw === 'google' || raw === 'kakao' || raw === 'naver' ? raw : null;
  if (!provider) {
    return NextResponse.json(
      { error: '어떤 계정을 끊을지 알 수 없어요.' },
      { status: 400 },
    );
  }

  const identities = user.identities ?? [];
  const targets = identities.filter(
    (i) => toSocialProvider(i.provider) === provider,
  );
  if (targets.length === 0) {
    return NextResponse.json(
      { error: '연결되어 있지 않은 계정이에요.' },
      { status: 404 },
    );
  }
  if (identities.length - targets.length < 1) {
    return NextResponse.json(
      { error: '로그인할 방법이 하나뿐이라 끊을 수 없어요.' },
      { status: 409 },
    );
  }

  for (const identity of targets) {
    const { error } = await supabase.auth.unlinkIdentity(identity);
    if (error) {
      if (error.code === 'single_identity_not_deletable') {
        return NextResponse.json(
          { error: '로그인할 방법이 하나뿐이라 끊을 수 없어요.' },
          { status: 409 },
        );
      }
      reportServerError(error, { area: 'account', op: 'unlink_identity' });
      return NextResponse.json(
        { error: '연결을 끊지 못했어요. 잠시 뒤에 다시 해 주세요.' },
        { status: 500 },
      );
    }
  }

  let providerSide: UnlinkOutcome | 'manual' | 'none' = 'none';
  if (provider === 'kakao') providerSide = await unlinkAllKakao(targets);
  else if (provider === 'naver') providerSide = 'manual';

  return NextResponse.json({ success: true, provider, providerSide });
}
