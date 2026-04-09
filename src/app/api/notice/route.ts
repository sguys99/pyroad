import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('notices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notices: data ?? [], total: count ?? 0 });
}

export async function POST(request: Request) {
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

  if (content.length > 5000) {
    return NextResponse.json(
      { error: '내용은 5000자 이내로 입력해주세요.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('notices')
    .insert({ user_id: user.id, title, content })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notice: data });
}
