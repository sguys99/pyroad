import Link from 'next/link';
import { EyeOff } from 'lucide-react';
import type { BoardPostWithAuthor } from '@/lib/types/database';
import { formatKstDate } from '@/lib/time/kst';
import { authorName } from '@/lib/board/display';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { publicLook } from '@/lib/avatar/look';

interface BoardCardProps {
  post: BoardPostWithAuthor;
}

export function BoardCard({ post }: BoardCardProps) {
  const date = formatKstDate(post.created_at);

  return (
    <Link href={`/board/${post.id}`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50">
        {post.is_hidden && (
          // 숨긴 글은 RLS 로 작성자에게만 보임 (00014)
          <p className="mb-1 inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            <EyeOff className="size-3" aria-hidden="true" />
            나만 볼 수 있어요
          </p>
        )}
        <h3 className="mb-1 truncate text-sm font-bold text-foreground">
          {post.title}
        </h3>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          {post.content}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <UserAvatar {...publicLook(post.user_profiles_public)} size={32} />
            <span className="truncate">
              {authorName(post.user_profiles_public)}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <span>{date}</span>
            <span>댓글 {post.comment_count ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
