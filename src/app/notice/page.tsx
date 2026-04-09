import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { NoticeCard } from '@/components/notice/NoticeCard';
import type { Notice } from '@/lib/types/database';

const PAGE_SIZE = 10;

export default async function NoticePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ user }, { data: notices, count }] = await Promise.all([
    getAuthUser(),
    supabase
      .from('notices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);

  const isAdminUser = user?.email === process.env.ADMIN_EMAIL;
  const noticeList: Notice[] = notices ?? [];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link
          href={user ? '/world' : '/'}
          className="text-sm text-primary underline"
        >
          {user ? '← 월드맵으로' : '← 홈으로'}
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">공지사항</h1>
        {isAdminUser && (
          <Link
            href="/notice/create"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            공지 작성
          </Link>
        )}
      </div>

      {noticeList.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            아직 공지사항이 없습니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {noticeList.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/notice?page=${currentPage - 1}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              이전
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/notice?page=${currentPage + 1}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              다음
            </Link>
          )}
        </div>
      )}
    </PageTransition>
  );
}
