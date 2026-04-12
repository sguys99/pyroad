import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { commentId } = await params;
  const adminClient = createAdminClient();

  const { data: comment } = await adminClient
    .from('board_comments')
    .select('user_id')
    .eq('id', commentId)
    .single();

  if (!comment) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (comment.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('board_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
