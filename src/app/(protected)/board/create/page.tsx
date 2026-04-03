import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreatePostForm } from '@/components/board/CreatePostForm';

export default function BoardCreatePage() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6">
        <Link href="/board" className="text-sm text-primary underline">
          ← 게시판으로
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold text-foreground">글쓰기</h1>

      <CreatePostForm />
    </PageTransition>
  );
}
