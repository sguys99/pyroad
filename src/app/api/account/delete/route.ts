import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteUserAnalytics } from '@/lib/analytics/server';
import { unlinkAllKakao } from '@/lib/auth/providerUnlink';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Auth 계정을 지우면 public.users(ON DELETE CASCADE)와 그 사용자의 모든 행(진행·뱃지·퀴즈 시도·공개 프로필·
  // 게시글·댓글·신고·API 키·요청 한도)이 함께 지워집니다. 클라이언트에는 users·user_progress·user_badges DELETE 권한이
  // 없습니다(P1-01·P1-04, B28). 새 테이블도 users 를 ON DELETE CASCADE 로 참조해야 함 (회귀 B28-1·2, supabase/README.md)
  const adminClient = createAdminClient();

  // provider 쪽 연결 끊기 (P3-16, §2.8): Auth 삭제 전에. Supabase deleteUser 는 provider 에 알리지 않는다.
  // - Kakao: 어드민 키로 identity 회원번호마다 unlink. 실패·키 없음이어도 탈퇴는 계속 (기록만, src/lib/auth/providerUnlink.ts)
  // - Naver: 토큰을 저장하지 않으므로 여기서는 못 한다. 탈퇴 화면이 직전에 네이버 재인증을 받아 /auth/callback 이 폐기한다
  // identities 는 세션 사용자 값을 쓰고, 없으면 관리자 API 로 다시 읽는다
  let identities = user.identities;
  if (!identities) {
    const { data } = await adminClient.auth.admin.getUserById(user.id);
    identities = data?.user?.identities;
  }
  const kakao = await unlinkAllKakao(identities);

  const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);

  if (authError) {
    console.error('[Delete API] Auth user delete failed:', authError.message);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  // 분석 이벤트는 users 를 참조하지 않으므로(익명 ID = HMAC) 따로 지운다 (P1-17). 실패해도 탈퇴는 끝난 것으로 둠
  await deleteUserAnalytics(adminClient, user.id);

  // unlinked: provider 쪽 연결 끊기 결과 (화면 안내용, 식별자 없음)
  return NextResponse.json({ success: true, unlinked: { kakao } });
}
