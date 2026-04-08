import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { noticeId } = await params;

  const { data: notice } = await supabase
    .from('notices')
    .select('id')
    .eq('id', noticeId)
    .single();

  if (!notice) {
    return NextResponse.json({ error: '공지사항을 찾을 수 없습니다.' }, { status: 404 });
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
    if (!content || content.length > 5000) {
      return NextResponse.json({ error: '내용은 1~5000자로 입력해주세요.' }, { status: 400 });
    }
    updates.content = content;
  }

  const { error } = await supabase
    .from('notices')
    .update(updates)
    .eq('id', noticeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ noticeId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { noticeId } = await params;

  const { data: notice } = await supabase
    .from('notices')
    .select('id')
    .eq('id', noticeId)
    .single();

  if (!notice) {
    return NextResponse.json({ error: '공지사항을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('notices')
    .delete()
    .eq('id', noticeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
