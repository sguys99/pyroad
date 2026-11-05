import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BOARD_MESSAGES,
  boardError,
  boardServerError,
  isUuid,
} from '@/lib/board/server';

// 댓글 삭제: 작성자 확인 후 service_role 로 (P1-18, B19)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return boardError(401, BOARD_MESSAGES.unauthorized);
  }

  const { commentId } = await params;
  if (!isUuid(commentId)) {
    return boardError(404, BOARD_MESSAGES.commentNotFound, {
      code: 'not_found',
    });
  }

  const admin = createAdminClient();
  const { data: comment, error: findError } = await admin
    .from('board_comments')
    .select('user_id')
    .eq('id', commentId)
    .maybeSingle();

  if (findError) return boardServerError(findError, 'comment_owner');
  if (!comment) {
    return boardError(404, BOARD_MESSAGES.commentNotFound, {
      code: 'not_found',
    });
  }
  if (comment.user_id !== user.id) {
    return boardError(403, BOARD_MESSAGES.notCommentOwner, {
      code: 'forbidden',
    });
  }

  const { error } = await admin
    .from('board_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id);

  if (error) return boardServerError(error, 'comment_delete');
  return NextResponse.json({ ok: true });
}
