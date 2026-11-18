import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/back-link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreatePostForm } from '@/components/board/CreatePostForm';

export default async function BoardEditPage({
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

  const { data: post } = await supabase
    .from('board_posts')
    .select('id, user_id, title, content')
    .eq('id', postId)
    .single();

  if (!post) notFound();
  if (post.user_id !== user.id) redirect('/board');

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-2xl">
      <BackLink href={`/board/${postId}`}>내 글</BackLink>

      <h1 className="mt-2 mb-5 font-display text-h2">글 수정</h1>

      <CreatePostForm
        initialData={{ id: post.id, title: post.title, content: post.content }}
      />
    </PageTransition>
  );
}
