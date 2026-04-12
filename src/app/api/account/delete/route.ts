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

  // FK 순서대로 삭제: user_badges → user_progress → users
  const { error: badgesError } = await supabase
    .from('user_badges')
    .delete()
    .eq('user_id', user.id);

  if (badgesError) {
    return NextResponse.json(
      { error: '뱃지 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  const { error: progressError } = await supabase
    .from('user_progress')
    .delete()
    .eq('user_id', user.id);

  if (progressError) {
    return NextResponse.json(
      { error: '진행 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  const { error: userError } = await supabase
    .from('users')
    .delete()
    .eq('id', user.id);

  if (userError) {
    return NextResponse.json(
      { error: '사용자 데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  // Admin API로 Auth 계정 삭제
  const adminClient = createAdminClient();

  const { error: authError } = await adminClient.auth.admin.deleteUser(
    user.id,
  );

  if (authError) {
    return NextResponse.json(
      { error: 'Auth 계정 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
