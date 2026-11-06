import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { guardianWriteGate } from '@/lib/consent/server';
import {
  BOARD_MESSAGES,
  boardError,
  boardServerError,
  checkCommentInput,
  readJsonObject,
} from '@/lib/board/server';

// 댓글 쓰기: 길이·빈 값·금칙어 검사 후 service_role 로 저장 (P1-18, B19).
// 글이 없거나 숨겨졌는데 남의 글이면 404 (숨긴 글에는 작성자만 댓글을 달 수 있음 = 작성자만 보이므로)
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return boardError(401, BOARD_MESSAGES.unauthorized);
  }

  // 제한 모드(만 14세 미만 + 보호자 동의 전, P3-15): 다른 사람에게 보이는 쓰기는 막음
  const consentBlock = await guardianWriteGate(user.id);
  if (consentBlock) return consentBlock;

  const body = await readJsonObject(request);
  if (!body) {
    return boardError(400, BOARD_MESSAGES.badRequest, { code: 'validation' });
  }

  const checked = checkCommentInput(body);
  if (!checked.ok) return checked.response;
  const { postId, content } = checked.value;

  const admin = createAdminClient();
  const { data: post, error: postError } = await admin
    .from('board_posts')
    .select('user_id, is_hidden')
    .eq('id', postId)
    .maybeSingle();

  if (postError) return boardServerError(postError, 'comment_post');
  if (!post || (post.is_hidden && post.user_id !== user.id)) {
    return boardError(404, BOARD_MESSAGES.postNotFound, { code: 'not_found' });
  }

  const { data, error } = await admin
    .from('board_comments')
    .insert({ post_id: postId, user_id: user.id, content })
    .select('id, created_at')
    .single();

  if (error || !data) {
    return boardServerError(
      error ?? new Error('insert 결과 없음'),
      'comment_create',
    );
  }

  // 화면에 바로 붙일 작성자 이름·아바타 (다른 사람에게 보이는 것과 같은 값: 닉네임 → 모험가NNNN, 파이뱀 스킨). 못 읽어도 저장은 성공
  const { data: author } = await admin
    .from('user_profiles_public')
    .select('display_name, avatar_skin')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    comment: {
      id: data.id,
      created_at: data.created_at,
      author_name: author?.display_name ?? null,
      author_skin: author?.avatar_skin ?? null,
    },
  });
}
