import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminUser } from '@/lib/admin';
import { isUuid } from '@/lib/api/serverError';
import {
  NOTICE_MESSAGES,
  noticeError,
  noticeServerError,
} from '@/lib/notice/server';

type NoticeParams = { params: Promise<{ noticeId: string }> };

/** 로그인 + 관리자 확인. 통과하면 null */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return noticeError(401, NOTICE_MESSAGES.unauthorized);
  if (!isAdminUser(user)) return noticeError(403, NOTICE_MESSAGES.forbidden);
  return null;
}

/**
 * 공지가 있는지 확인. 없으면 404, 조회 자체가 실패하면 500 (예전에는 DB 오류도 404로 보였음).
 * notices 쓰기 RLS 정책이 없으므로 관리자 검증 후 서비스 역할로 처리
 */
async function findNotice(
  admin: ReturnType<typeof createAdminClient>,
  noticeId: string,
  op: string,
): Promise<NextResponse | null> {
  if (!isUuid(noticeId)) return noticeError(404, NOTICE_MESSAGES.notFound);

  const { data: notice, error } = await admin
    .from('notices')
    .select('id')
    .eq('id', noticeId)
    .maybeSingle();

  if (error) return noticeServerError(error, `${op}.lookup`);
  if (!notice) return noticeError(404, NOTICE_MESSAGES.notFound);
  return null;
}

export async function PATCH(request: Request, { params }: NoticeParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { noticeId } = await params;
  const admin = createAdminClient();

  const missing = await findNotice(admin, noticeId, 'update');
  if (missing) return missing;

  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return noticeError(400, NOTICE_MESSAGES.badRequest);
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body?.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 100) {
      return noticeError(400, '제목은 1~100자로 입력해주세요.');
    }
    updates.title = title;
  }
  if (body?.content !== undefined) {
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 5000) {
      return noticeError(400, '내용은 1~5000자로 입력해주세요.');
    }
    updates.content = content;
  }

  const { error } = await admin
    .from('notices')
    .update(updates)
    .eq('id', noticeId);

  if (error) {
    return noticeServerError(error, 'update');
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: NoticeParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { noticeId } = await params;
  const admin = createAdminClient();

  const missing = await findNotice(admin, noticeId, 'delete');
  if (missing) return missing;

  const { error } = await admin.from('notices').delete().eq('id', noticeId);

  if (error) {
    return noticeServerError(error, 'delete', NOTICE_MESSAGES.deleteFailed);
  }

  return NextResponse.json({ ok: true });
}
