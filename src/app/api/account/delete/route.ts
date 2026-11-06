import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteUserAccount } from '@/lib/account/deleteUserAccount';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 삭제 순서(provider 연결 끊기 → Auth 삭제 = 모든 행 CASCADE → 분석 이벤트)는 src/lib/account/deleteUserAccount.ts 한 곳
  // (P3-15 미동의 계정 파기 크론과 같은 경로). 클라이언트에는 users·user_progress·user_badges DELETE 권한이 없습니다(P1-01·P1-04, B28).
  // - Kakao: 어드민 키로 identity 회원번호마다 unlink (P3-16). 실패·키 없음이어도 탈퇴는 계속
  // - Naver: 토큰을 저장하지 않으므로 여기서는 못 한다. 탈퇴 화면이 직전에 네이버 재인증을 받아 /auth/callback 이 폐기한다
  // identities 는 세션 사용자 값을 쓰고, 없으면 관리자 API 로 다시 읽는다
  const result = await deleteUserAccount(
    createAdminClient(),
    user.id,
    user.identities,
  );

  if (!result.ok) {
    console.error('[Delete API] Auth user delete failed:', result.error);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // unlinked: provider 쪽 연결 끊기 결과 (화면 안내용, 식별자 없음)
  return NextResponse.json({ success: true, unlinked: result.unlinked });
}
