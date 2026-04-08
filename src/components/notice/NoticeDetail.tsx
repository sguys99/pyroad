import type { Notice } from '@/lib/types/database';
import { DeleteNoticeButton } from './DeleteNoticeButton';
import Link from 'next/link';

interface NoticeDetailProps {
  notice: Notice;
  isAdmin: boolean;
}

export function NoticeDetail({ notice, isAdmin }: NoticeDetailProps) {
  const date = new Date(notice.created_at).toLocaleDateString('ko-KR');
  const isEdited = notice.updated_at !== notice.created_at;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h1 className="mb-2 text-lg font-bold text-foreground">{notice.title}</h1>
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{date}</span>
        {isEdited && <span>(수정됨)</span>}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {notice.content}
      </p>
      {isAdmin && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/notice/${notice.id}/edit`}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
          >
            수정
          </Link>
          <DeleteNoticeButton noticeId={notice.id} />
        </div>
      )}
    </div>
  );
}
