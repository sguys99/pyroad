import type { BoardPostWithAuthor } from '@/lib/types/database';
import { DeletePostButton } from './DeletePostButton';
import { ReportButton } from './ReportButton';
import Link from 'next/link';
import { EyeOff } from 'lucide-react';
import { formatKstDate } from '@/lib/time/kst';
import { authorName } from '@/lib/board/display';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { publicLook } from '@/lib/avatar/look';

interface PostDetailProps {
  post: BoardPostWithAuthor;
  isOwner: boolean;
}

export function PostDetail({ post, isOwner }: PostDetailProps) {
  const date = formatKstDate(post.created_at);
  const isEdited = post.updated_at !== post.created_at;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {post.is_hidden && (
        // 숨긴 글은 작성자에게만 보임 (00014 RLS). 해제·삭제는 관리자 (런북 "게시판 신고 처리")
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            신고가 여러 번 들어와서 지금은 나만 볼 수 있어요. 어른이 살펴본 뒤
            다시 보이거나 지워질 수 있어요.
          </p>
        </div>
      )}
      <h1 className="mb-2 text-lg font-bold text-foreground">{post.title}</h1>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <UserAvatar {...publicLook(post.user_profiles_public)} size={32} />
        <span>{authorName(post.user_profiles_public)}</span>
        <span>{date}</span>
        {isEdited && <span>(수정됨)</span>}
        {!isOwner && (
          <span className="ml-auto">
            <ReportButton targetType="post" targetId={post.id} />
          </span>
        )}
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
