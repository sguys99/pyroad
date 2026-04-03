'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CreatePostFormProps {
  initialData?: { id: string; title: string; content: string };
}

export function CreatePostForm({ initialData }: CreatePostFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle || !trimmedContent) {
      setError('제목과 내용을 모두 입력해주세요.');
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
        const data = await res.json();
        setError(data.error || '오류가 발생했습니다.');
        return;
      }

      if (isEdit) {
        router.push(`/board/${initialData.id}`);
      } else {
        router.push('/board');
      }
      router.refresh();
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

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
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {title.length}/100
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
          maxLength={2000}
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {content.length}/2000
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? '저장 중...' : isEdit ? '수정하기' : '게시하기'}
      </button>
    </form>
  );
}
