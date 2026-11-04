'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOARD_LIMITS } from '@/lib/board/limits';
import { BoardFormMessage, type BoardFormError } from './BoardFormMessage';

interface CreatePostFormProps {
  initialData?: { id: string; title: string; content: string };
}

export function CreatePostForm({ initialData }: CreatePostFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [error, setError] = useState<BoardFormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      setError({ message: '제목과 내용을 모두 써 주세요.' });
      return;
    }

    setSubmitting(true);

    try {
      const url = isEdit
        ? `/api/board/posts/${initialData.id}`
        : '/api/board/posts';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle, content: trimmedContent }),
      });

      if (!res.ok) {
        // 서버는 아이용 문구만 보냄 (DB 오류 내용은 서버 로그로, B19). 금칙어는 code: 'moderation'
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        setError({
          message: data.error || '앗, 지금은 저장하지 못했어요. 잠시 뒤에 다시 해 볼까요?',
          code: data.code,
        });
        return;
      }

      if (isEdit) {
        router.push(`/board/${initialData.id}`);
      } else {
        router.push('/board');
      }
      router.refresh();
    } catch {
      setError({ message: '인터넷 연결을 확인하고 다시 해 볼까요?' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <BoardFormMessage error={error} />}

      <div>
        <label
          htmlFor="title"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          제목
        </label>
        <input
          id="title"
          type="text"
          maxLength={BOARD_LIMITS.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {title.length}/{BOARD_LIMITS.title}
        </p>
      </div>

      <div>
        <label
          htmlFor="content"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          내용
        </label>
        <textarea
          id="content"
          maxLength={BOARD_LIMITS.content}
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {content.length}/{BOARD_LIMITS.content}
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? '저장 중...' : isEdit ? '수정하기' : '게시하기'}
      </button>
      <p className="text-center text-[11px] text-muted-foreground">
        전화번호, 주소, 학교 같은 개인정보와 친구가 속상할 말은 쓰지 않아요.
      </p>
    </form>
  );
}
