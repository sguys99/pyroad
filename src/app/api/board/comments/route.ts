import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { post_id: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!body.post_id || !content) {
    return NextResponse.json(
      { error: '댓글 내용을 입력해주세요.' },
      { status: 400 },
    );
  }

  if (content.length > 500) {
    return NextResponse.json(
      { error: '댓글은 500자 이내로 입력해주세요.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('board_comments')
    .insert({ post_id: body.post_id, user_id: user.id, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, comment: data });
}
