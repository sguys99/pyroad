import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/back-link';
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
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-2xl">
      <BackLink href={`/notice/${noticeId}`}>공지</BackLink>

      <h1 className="mt-2 mb-5 font-display text-h2">공지 수정</h1>

      <CreateNoticeForm
        initialData={{
          id: notice.id,
          title: notice.title,
          content: notice.content,
        }}
      />
    </PageTransition>
  );
}
