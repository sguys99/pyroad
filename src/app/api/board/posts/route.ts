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

  let body: { title: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const title = body.title?.trim();
  const content = body.content?.trim();

  if (!title || !content) {
    return NextResponse.json(
      { error: '제목과 내용을 모두 입력해주세요.' },
      { status: 400 },
    );
  }

  if (title.length > 100) {
    return NextResponse.json(
      { error: '제목은 100자 이내로 입력해주세요.' },
      { status: 400 },
    );
  }

  if (content.length > 2000) {
    return NextResponse.json(
      { error: '내용은 2000자 이내로 입력해주세요.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('board_posts')
    .insert({ user_id: user.id, title, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, post: data });
}
