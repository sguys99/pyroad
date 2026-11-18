import { redirect } from 'next/navigation';
import { BackLink } from '@/components/ui/back-link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreateNoticeForm } from '@/components/notice/CreateNoticeForm';
import { isAdmin } from '@/lib/admin';

export default async function NoticeCreatePage() {
  if (!(await isAdmin())) redirect('/notice');

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-2xl">
      <BackLink href="/notice">공지사항</BackLink>

      <h1 className="mt-2 mb-5 font-display text-h2">공지 작성</h1>

      <CreateNoticeForm />
    </PageTransition>
  );
}
