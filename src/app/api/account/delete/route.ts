import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deleteUserAnalytics } from '@/lib/analytics/server';

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

  return NextResponse.json({ success: true });
}
