import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardianWriteGate } from '@/lib/consent/server';
import {
  BOARD_MESSAGES,
  boardError,
  boardServerError,
  checkPostInput,
  isUuid,
  readJsonObject,
} from '@/lib/board/server';

// 글 수정·삭제: getUser() 로 확인한 사용자가 작성자인지 본 뒤 service_role 로 씀 (P1-18, B19).
// 숨김(is_hidden)은 바꾸지 않음. 신고로 숨겨진 글도 작성자가 고치거나 지울 수 있음

type OwnedPost =
  | { ok: false; response: NextResponse }
  | { ok: true; admin: ReturnType<typeof createAdminClient>; userId: string };

async function loadOwnedPost(postId: string): Promise<OwnedPost> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      ok: false,
      response: boardError(401, BOARD_MESSAGES.unauthorized),
    };
  if (!isUuid(postId)) {
    return {
      ok: false,
      response: boardError(404, BOARD_MESSAGES.postNotFound, {
        code: 'not_found',
      }),
    };
  }

  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from('board_posts')
    .select('user_id')
    .eq('id', postId)
    .maybeSingle();

  if (error)
    return { ok: false, response: boardServerError(error, 'post_owner') };
  if (!post) {
    return {
      ok: false,
      response: boardError(404, BOARD_MESSAGES.postNotFound, {
        code: 'not_found',
      }),
    };
  }
  if (post.user_id !== user.id) {
    return {
      ok: false,
      response: boardError(403, BOARD_MESSAGES.notPostOwner, {
        code: 'forbidden',
      }),
    };
  }
  return { ok: true, admin, userId: user.id };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const owned = await loadOwnedPost(postId);
  if (!owned.ok) return owned.response;
  // 제한 모드(P3-15): 고치기도 다른 사람에게 보이는 쓰기라 막음. 지우기(DELETE)는 그대로 허용
  const consentBlock = await guardianWriteGate(owned.userId, owned.admin);
  if (consentBlock) return consentBlock;

  const body = await readJsonObject(request);
  if (!body) {
    return boardError(400, BOARD_MESSAGES.badRequest, { code: 'validation' });
  }
  const checked = checkPostInput(body, { partial: true });
  if (!checked.ok) return checked.response;

  const { error } = await owned.admin
    .from('board_posts')
    .update({ ...checked.value, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', owned.userId);

  if (error) return boardServerError(error, 'post_update');
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const owned = await loadOwnedPost(postId);
  if (!owned.ok) return owned.response;

  const { error } = await owned.admin
    .from('board_posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', owned.userId);

  if (error) return boardServerError(error, 'post_delete');
  return NextResponse.json({ ok: true });
}
