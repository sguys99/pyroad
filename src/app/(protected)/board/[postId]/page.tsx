import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { PostDetail } from '@/components/board/PostDetail';
import { CommentSection } from '@/components/board/CommentSection';
import type {
  BoardPostWithAuthor,
  BoardCommentWithAuthor,
} from '@/lib/types/database';

export default async function BoardPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { postId } = await params;

  const [postResult, commentsResult] = await Promise.all([
    supabase
      .from('board_posts')
      .select(
        '*, user_profiles_public!board_posts_user_id_fkey(display_name, avatar_url)',
      )
      .eq('id', postId)
      .single(),
    supabase
      .from('board_comments')
      .select(
        '*, user_profiles_public!board_comments_user_id_fkey(display_name, avatar_url)',
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true }),
  ]);

  if (!postResult.data) notFound();

  const post: BoardPostWithAuthor = {
    ...postResult.data,
    user_profiles_public: (postResult.data as Record<string, unknown>)
      .user_profiles_public as BoardPostWithAuthor['user_profiles_public'],
    comment_count: commentsResult.data?.length ?? 0,
  };

  const comments: BoardCommentWithAuthor[] = (commentsResult.data ?? []).map(
    (c) => ({
      ...c,
      user_profiles_public: (c as Record<string, unknown>)
        .user_profiles_public as BoardCommentWithAuthor['user_profiles_public'],
    }),
  );

  const isOwner = post.user_id === user.id;

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href="/board" className="text-sm text-primary underline">
          ← 게시판으로
        </Link>
      </div>

      <PostDetail post={post} isOwner={isOwner} />
      <CommentSection
        postId={postId}
        comments={comments}
        currentUserId={user.id}
      />
    </PageTransition>
  );
}
