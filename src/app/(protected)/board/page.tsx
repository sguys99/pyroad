import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  PenLine,
} from 'lucide-react';
import { PageTransition } from '@/components/shared/PageTransition';
import { BackLink } from '@/components/ui/back-link';
import { Button } from '@/components/ui/button';
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

  // getAuthUser()와 게시글 목록 쿼리를 병렬 실행 (user.id 불필요)
  // 작성자 이름·아바타는 user_profiles_public(닉네임 → 모험가NNNN + 파이뱀 스킨, 00018·00021). 신고로 숨긴 글은 RLS 가 작성자에게만 보여 줌
  const [{ user }, { data: posts, count }] = await Promise.all([
    getAuthUser(),
    supabase
      .from('board_posts')
      .select(
        '*, user_profiles_public!board_posts_user_id_fkey(display_name, avatar_skin, avatar_look), board_comments(count)',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to),
  ]);
  if (!user) redirect('/');

  const boardPosts: BoardPostWithAuthor[] = (posts ?? []).map((post) => ({
    ...post,
    user_profiles_public: (post as Record<string, unknown>)
      .user_profiles_public as BoardPostWithAuthor['user_profiles_public'],
    comment_count:
      (
        (post as Record<string, unknown>).board_comments as { count: number }[]
      )?.[0]?.count ?? 0,
  }));

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-2xl">
      {/* 위 줄·제목은 상점·프로필과 같은 짜임 (B100) */}
      <BackLink href="/world">월드맵</BackLink>

      <div className="mt-2 mb-5 flex items-center justify-between gap-3">
        <h1 className="m-0 font-display text-h2">게시판</h1>
        <Button href="/board/create" size="sm" icon={<PenLine aria-hidden />}>
          글쓰기
        </Button>
      </div>

      {boardPosts.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-3xl bg-surface p-8 text-center shadow-card">
          <MessagesSquare className="size-8 text-primary-text" aria-hidden />
          <p className="m-0 font-display text-h3">아직 글이 없어요</p>
          <p className="m-0 text-small text-muted-foreground">
            모험하다 궁금한 것이나 자랑하고 싶은 것을 첫 글로 남겨 볼까요?
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
        <div className="mt-6 flex items-center justify-center gap-3">
          {currentPage > 1 && (
            <Button
              href={`/board?page=${currentPage - 1}`}
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
              href={`/board?page=${currentPage + 1}`}
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
