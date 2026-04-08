import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreateNoticeForm } from '@/components/notice/CreateNoticeForm';
import { isAdmin } from '@/lib/admin';

export default async function NoticeCreatePage() {
  if (!(await isAdmin())) redirect('/notice');

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href="/notice" className="text-sm text-primary underline">
          ← 공지사항으로
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">공지 작성</h1>

      <CreateNoticeForm />
    </PageTransition>
  );
}
