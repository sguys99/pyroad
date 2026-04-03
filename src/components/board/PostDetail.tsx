import type { BoardPostWithAuthor } from '@/lib/types/database';
import { DeletePostButton } from './DeletePostButton';
import Link from 'next/link';

interface PostDetailProps {
  post: BoardPostWithAuthor;
  isOwner: boolean;
}

export function PostDetail({ post, isOwner }: PostDetailProps) {
  const date = new Date(post.created_at).toLocaleDateString('ko-KR');
  const authorName = post.user_profiles_public?.display_name || '익명';
  const isEdited = post.updated_at !== post.created_at;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h1 className="mb-2 text-lg font-bold text-foreground">{post.title}</h1>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{authorName}</span>
        <span>{date}</span>
        {isEdited && <span>(수정됨)</span>}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {post.content}
      </p>
      {isOwner && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/board/${post.id}/edit`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            수정
          </Link>
          <DeletePostButton postId={post.id} />
        </div>
      )}
    </div>
  );
}
