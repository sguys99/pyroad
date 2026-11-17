import { BackLink } from '@/components/ui/back-link';
import { PageTransition } from '@/components/shared/PageTransition';
import { CreatePostForm } from '@/components/board/CreatePostForm';

export default function BoardCreatePage() {
  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-4 sm:py-6 md:max-w-2xl">
      <BackLink href="/board">게시판</BackLink>

      <h1 className="mt-2 mb-5 font-display text-h2">글쓰기</h1>

      <CreatePostForm />
    </PageTransition>
  );
}
