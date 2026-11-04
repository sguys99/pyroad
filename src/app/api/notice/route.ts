import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminUser } from '@/lib/admin';
import {
  NOTICE_MESSAGES,
  noticeError,
  noticeServerError,
} from '@/lib/notice/server';

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get('page')) || 1,
  );
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await supabase
    .from('notices')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return noticeServerError(error, 'list', NOTICE_MESSAGES.listFailed);
  }

  return NextResponse.json({ notices: data ?? [], total: count ?? 0 });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return noticeError(401, NOTICE_MESSAGES.unauthorized);
  }

  if (!isAdminUser(user)) {
    return noticeError(403, NOTICE_MESSAGES.forbidden);
  }

  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return noticeError(400, NOTICE_MESSAGES.badRequest);
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const content = typeof body?.content === 'string' ? body.content.trim() : '';

  if (!title || !content) {
    return noticeError(400, NOTICE_MESSAGES.titleContentRequired);
  }

  if (title.length > 100) {
    return noticeError(400, '제목은 100자 이내로 입력해주세요.');
  }

  if (content.length > 5000) {
    return noticeError(400, '내용은 5000자 이내로 입력해주세요.');
  }

  // notices 쓰기 RLS 정책이 없으므로 관리자 검증 후 서비스 역할로 기록
  const { data, error } = await createAdminClient()
    .from('notices')
    .insert({ user_id: user.id, title, content })
    .select()
    .single();

  if (error) {
    return noticeServerError(error, 'create');
  }

  return NextResponse.json({ ok: true, notice: data });
}
