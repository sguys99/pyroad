import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreateNoticeForm } from '@/components/notice/CreateNoticeForm';
import { isAdmin } from '@/lib/admin';

export default async function NoticeEditPage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  if (!(await isAdmin())) redirect('/notice');

  const supabase = await createClient();
  const { noticeId } = await params;

  const { data: notice } = await supabase
    .from('notices')
    .select('id, title, content')
    .eq('id', noticeId)
    .single();

  if (!notice) notFound();

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link
          href={`/notice/${noticeId}`}
          className="text-sm text-primary underline"
        >
          ← 돌아가기
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">공지 수정</h1>

      <CreateNoticeForm
        initialData={{ id: notice.id, title: notice.title, content: notice.content }}
      />
    </PageTransition>
  );
}
