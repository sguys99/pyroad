import type { Notice } from '@/lib/types/database';
import { DeleteNoticeButton } from './DeleteNoticeButton';
import Link from 'next/link';
import { formatKstDate } from '@/lib/time/kst';
import { NoticeBody } from './NoticeBody';

interface NoticeDetailProps {
  notice: Notice;
  isAdmin: boolean;
}

export function NoticeDetail({ notice, isAdmin }: NoticeDetailProps) {
  const date = formatKstDate(notice.created_at);
  const isEdited = notice.updated_at !== notice.created_at;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <h1 className="mb-2 font-display text-h3">{notice.title}</h1>
      <div className="mb-4 flex items-center gap-2 text-caption text-muted-foreground">
        <span>{date}</span>
        {isEdited && <span>(수정됨)</span>}
      </div>
      <NoticeBody content={notice.content} />
      {isAdmin && (
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/notice/${notice.id}/edit`}
            className="focus-ring inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-caption text-muted-foreground transition-colors hover:bg-accent"
          >
            수정
          </Link>
          <DeleteNoticeButton noticeId={notice.id} />
        </div>
      )}
    </div>
  );
}
