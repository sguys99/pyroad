import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { isAdminUser } from '@/lib/admin';
import { ChevronLeft, ChevronRight, Megaphone, PenLine } from 'lucide-react';
import { PageTransition } from '@/components/shared/PageTransition';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
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

  const isAdmin = isAdminUser(user);
  const noticeList: Notice[] = notices ?? [];
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6">
      {/* 위 줄·제목은 상점·프로필과 같은 짜임 (B100) */}
      <BackLink href={user ? '/world' : '/'}>
        {user ? '월드맵' : '처음 화면'}
      </BackLink>

      <div className="mt-2 mb-5 flex min-h-touch items-center justify-between gap-3">
        <h1 className="m-0 font-display text-h2">공지사항</h1>
        {isAdmin && (
          <Button
            href="/notice/create"
            size="sm"
            icon={<PenLine aria-hidden />}
          >
            공지 작성
          </Button>
        )}
      </div>

      {noticeList.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-3xl bg-surface p-8 text-center shadow-card">
          <Megaphone className="size-8 text-primary-text" aria-hidden />
          <p className="m-0 font-display text-h3">아직 공지가 없어요</p>
          <p className="m-0 text-small text-muted-foreground">
            새 소식이 생기면 여기에 알려 줄게요.
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
        <div className="mt-6 flex items-center justify-center gap-3">
          {currentPage > 1 && (
            <Button
              href={`/notice?page=${currentPage - 1}`}
              variant="secondary"
              size="sm"
              icon={<ChevronLeft aria-hidden />}
            >
              이전
            </Button>
          )}
          <span className="text-small text-muted-foreground tabular-nums">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Button
              href={`/notice?page=${currentPage + 1}`}
              variant="secondary"
              size="sm"
              iconRight={<ChevronRight aria-hidden />}
            >
              다음
            </Button>
          )}
        </div>
      )}
    </PageTransition>
  );
}
