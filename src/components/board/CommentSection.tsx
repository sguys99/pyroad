'use client';

import { useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { BoardCommentWithAuthor } from '@/lib/types/database';
import { formatKstDate } from '@/lib/time/kst';
import { authorName } from '@/lib/board/display';
import { BOARD_LIMITS } from '@/lib/board/limits';
import { BoardFormMessage, type BoardFormError } from './BoardFormMessage';
import { ReportButton } from './ReportButton';

interface CommentSectionProps {
  postId: string;
  comments: BoardCommentWithAuthor[];
  currentUserId: string;
}

export function CommentSection({
  postId,
  comments: initialComments,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<BoardFormError | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/board/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        comment?: { id: string; created_at: string; author_name?: string };
      };
      if (!res.ok || !data.comment) {
        // 금칙어·개인정보면 code: 'moderation' (P1-18). 쓴 내용은 지우지 않고 고칠 수 있게 둠
        setError({
          message:
            data.error ||
            '앗, 댓글을 저장하지 못했어요. 잠시 뒤에 다시 해 볼까요?',
          code: data.code,
        });
        return;
      }
      const newComment: BoardCommentWithAuthor = {
        id: data.comment.id,
        post_id: postId,
        user_id: currentUserId,
        content: trimmed,
        created_at: data.comment.created_at,
        is_hidden: false,
        hidden_at: null,
        user_profiles_public: {
          display_name: data.comment.author_name ?? null,
        },
      };
      setComments((prev) => [...prev, newComment]);
      setContent('');
    } catch {
      setError({ message: '인터넷 연결을 확인하고 다시 해 볼까요?' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    setDeletingId(commentId);
    const prevComments = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      const res = await fetch(`/api/board/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setComments(prevComments);
      }
    } catch {
      setComments(prevComments);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-foreground">
        댓글 {comments.length}
      </h2>

      {comments.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3">
          {comments.map((comment) => {
            const isOwner = comment.user_id === currentUserId;
            const date = formatKstDate(comment.created_at);

            return (
              <div
                key={comment.id}
                className="rounded-lg border border-border/50 bg-background p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{authorName(comment.user_profiles_public)}</span>
                    <span>{date}</span>
                    {comment.is_hidden && (
                      <span className="inline-flex items-center gap-1">
                        <EyeOff className="size-3" aria-hidden="true" />
                        신고가 쌓여 나만 볼 수 있어요
                      </span>
                    )}
                  </div>
                  {isOwner ? (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-[11px] text-destructive hover:underline disabled:opacity-50"
                    >
                      삭제
                    </button>
                  ) : (
                    <ReportButton targetType="comment" targetId={comment.id} />
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {comment.content}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted-foreground">
          아직 댓글이 없어요. 첫 댓글을 남겨 볼까요?
        </p>
      )}

      {error && <BoardFormMessage error={error} className="mb-2" />}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          maxLength={BOARD_LIMITS.comment}
          rows={2}
          placeholder="댓글을 작성하세요"
          aria-label="댓글"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-lip disabled:opacity-50"
        >
          등록
        </button>
      </form>
    </div>
  );
}
