import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { BoardCard } from '@/components/board/BoardCard';
import type { BoardPostWithAuthor } from '@/lib/types/database';

const PAGE_SIZE = 10;

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const supabase = await createClient();
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // getAuthUser()와 게시글 목록 쿼리를 병렬 실행 (user.id 불필��)
  const [{ user }, { data: posts, count }] = await Promise.all([
    getAuthUser(),
    supabase
      .from('board_posts')
      .select(
        '*, user_profiles_public!board_posts_user_id_fkey(display_name, avatar_url), board_comments(count)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);
  if (!user) redirect('/');

  const boardPosts: BoardPostWithAuthor[] = (posts ?? []).map((post) => ({
    ...post,
    user_profiles_public: (post as Record<string, unknown>).user_profiles_public as BoardPostWithAuthor['user_profiles_public'],
    comment_count: ((post as Record<string, unknown>).board_comments as { count: number }[])?.[0]?.count ?? 0,
  }));

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href="/world" className="text-sm text-primary underline">
          ← 월드맵으로
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">게시판</h1>
        <Link
          href="/board/create"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          글쓰기
        </Link>
      </div>

      {boardPosts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            아직 게시글이 없습니다. 첫 번째 글을 작성해보세요!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {boardPosts.map((post) => (
            <BoardCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/board?page=${currentPage - 1}`}
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
              href={`/board?page=${currentPage + 1}`}
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
