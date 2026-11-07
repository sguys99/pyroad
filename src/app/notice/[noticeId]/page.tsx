import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { isAdminUser } from '@/lib/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { NoticeDetail } from '@/components/notice/NoticeDetail';
import type { Notice } from '@/lib/types/database';

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const supabase = await createClient();
  const { noticeId } = await params;

  const [{ user }, { data: notice }] = await Promise.all([
    getAuthUser(),
    supabase.from('notices').select('*').eq('id', noticeId).single(),
  ]);

  if (!notice) notFound();

  const isAdmin = isAdminUser(user);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href="/notice" className="text-sm text-primary-text underline">
          ← 공지사항으로
        </Link>
      </div>

      <NoticeDetail notice={notice as Notice} isAdmin={isAdmin} />
    </PageTransition>
  );
}
