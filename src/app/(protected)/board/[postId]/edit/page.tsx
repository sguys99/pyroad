import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
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
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href={`/board/${postId}`} className="text-sm text-primary underline">
          ← 돌아가기
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">글 수정</h1>

      <CreatePostForm
        initialData={{ id: post.id, title: post.title, content: post.content }}
      />
    </PageTransition>
  );
}
