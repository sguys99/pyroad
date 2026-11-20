'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface CreateNoticeFormProps {
  initialData?: { id: string; title: string; content: string };
}

export function CreateNoticeForm({ initialData }: CreateNoticeFormProps) {
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
      const url = isEdit ? `/api/notice/${initialData.id}` : '/api/notice';
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
        router.push(`/notice/${initialData.id}`);
      } else {
        router.push('/notice');
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
        <p className="rounded-lg bg-error-soft px-3 py-2 text-sm text-destructive">
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
        <p
          id="content-help"
          className="mb-1 text-caption text-muted-foreground"
        >
          소제목은 줄 맨 앞에 ###, 목록은 - 를 씁니다. https:// 주소와 메일
          주소는 자동으로 링크가 됩니다.
        </p>
        <textarea
          id="content"
          aria-describedby="content-help"
          maxLength={5000}
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-right text-[11px] text-muted-foreground">
          {content.length}/5000
        </p>
      </div>

      <Button type="submit" loading={submitting}>
        {submitting ? '저장 중…' : isEdit ? '수정하기' : '게시하기'}
      </Button>
    </form>
  );
}
