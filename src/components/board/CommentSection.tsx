'use client';

import { useState } from 'react';
import type { BoardCommentWithAuthor } from '@/lib/types/database';

interface CommentSectionProps {
  postId: string;
  comments: BoardCommentWithAuthor[];
  currentUserId: string;
  currentUserName?: string;
}

export function CommentSection({
  postId,
  comments: initialComments,
  currentUserId,
  currentUserName,
}: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/board/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        const optimisticComment: BoardCommentWithAuthor = {
          id: data.comment?.id ?? crypto.randomUUID(),
          post_id: postId,
          user_id: currentUserId,
          content: trimmed,
          created_at: new Date().toISOString(),
          user_profiles_public: {
            display_name: currentUserName ?? '나',
            avatar_url: null,
          },
        };
        setComments((prev) => [...prev, optimisticComment]);
        setContent('');
      }
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
            const date = new Date(comment.created_at).toLocaleDateString(
              'ko-KR',
            );
            const authorName =
              comment.user_profiles_public?.display_name || '익명';

            return (
              <div
                key={comment.id}
                className="rounded-lg border border-border/50 bg-background p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{authorName}</span>
                    <span>{date}</span>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="text-[11px] text-destructive hover:underline disabled:opacity-50"
                    >
                      삭제
                    </button>
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
          아직 댓글이 없습니다.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="댓글을 작성하세요"
          className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="self-end rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          등록
        </button>
      </form>
    </div>
  );
}
