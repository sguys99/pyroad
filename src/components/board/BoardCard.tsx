import Link from 'next/link';
import type { BoardPostWithAuthor } from '@/lib/types/database';
import { formatKstDate } from '@/lib/time/kst';

interface BoardCardProps {
  post: BoardPostWithAuthor;
}

export function BoardCard({ post }: BoardCardProps) {
  const date = formatKstDate(post.created_at);
  const authorName = post.user_profiles_public?.display_name || '익명';

  return (
    <Link href={`/board/${post.id}`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50">
        <h3 className="mb-1 truncate text-sm font-bold text-foreground">
          {post.title}
        </h3>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          {post.content}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{authorName}</span>
          <div className="flex items-center gap-2">
            <span>{date}</span>
            <span>댓글 {post.comment_count ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
