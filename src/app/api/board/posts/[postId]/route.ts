import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { postId } = await params;
  const adminClient = createAdminClient();

  // 소유권 검증
  const { data: post } = await adminClient
    .from('board_posts')
    .select('user_id')
    .eq('id', postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (post.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  let body: { title?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title || title.length > 100) {
      return NextResponse.json({ error: '제목은 1~100자로 입력해주세요.' }, { status: 400 });
    }
    updates.title = title;
  }
  if (body.content !== undefined) {
    const content = body.content.trim();
    if (!content || content.length > 2000) {
      return NextResponse.json({ error: '내용은 1~2000자로 입력해주세요.' }, { status: 400 });
    }
    updates.content = content;
  }

  const { error } = await supabase
    .from('board_posts')
    .update(updates)
    .eq('id', postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { postId } = await params;
  const adminClient = createAdminClient();

  const { data: post } = await adminClient
    .from('board_posts')
    .select('user_id')
    .eq('id', postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (post.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { error } = await supabase
    .from('board_posts')
    .delete()
    .eq('id', postId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
