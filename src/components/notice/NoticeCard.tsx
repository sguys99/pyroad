import Link from 'next/link';
import type { Notice } from '@/lib/types/database';
import { formatKstDate } from '@/lib/time/kst';

interface NoticeCardProps {
  notice: Notice;
}

export function NoticeCard({ notice }: NoticeCardProps) {
  const date = formatKstDate(notice.created_at);

  return (
    <Link href={`/notice/${notice.id}`}>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50">
        <h3 className="mb-1 truncate text-sm font-bold text-foreground">
          {notice.title}
        </h3>
        <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
          {notice.content}
        </p>
        <div className="flex items-center justify-end text-[11px] text-muted-foreground">
          <span>{date}</span>
        </div>
      </div>
    </Link>
  );
}
