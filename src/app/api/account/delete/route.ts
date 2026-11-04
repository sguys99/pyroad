import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Auth 계정을 지우면 public.users(ON DELETE CASCADE)와 그 사용자의 user_progress·user_badges·게시글·댓글이
  // 함께 지워집니다. 사용자 클라이언트로 user_badges·user_progress 를 지우지 않습니다
  // (P1-04 에서 DELETE 정책을 없앰, P1-03). 새 테이블도 users 를 ON DELETE CASCADE 로 참조해야 함
  const adminClient = createAdminClient();

  const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);

  if (authError) {
    console.error('[Delete API] Auth user delete failed:', authError.message);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
