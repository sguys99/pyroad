'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REPORT_REASON_LABELS, type ReportReason } from '@/lib/board/limits';

/**
 * 운영자 패널 (P11-07, `isAdminUser` 일 때만 페이지가 그림 — API 도 다시 확인): 신고 사유별 수 + 숨기기 · 다시 보이기.
 * 다시 보이게 하면 그 뒤 신고만 자동 숨김에 센다(00055)
 */
export function ModerationPanel({
  id,
  hidden,
  reports,
}: {
  id: string;
  hidden: boolean;
  reports: Record<string, number>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const total = Object.values(reports).reduce((a, b) => a + b, 0);

  async function moderate(next: boolean) {
    setBusy(true);
    setStatus('');
    const res = await fetch(`/api/gallery/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'moderate', hidden: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setStatus('바꾸지 못했어요. 다시 해 주세요.');
    setStatus(
      next ? '숨겼어요. 갤러리에서 사라졌어요.' : '다시 보이게 했어요.',
    );
    router.refresh();
  }

  return (
    <section
      className="gl-plaque"
      aria-label="운영자 관리"
      data-testid="moderation-panel"
    >
      <p className="gl-section-k flex items-center gap-1.5">
        <ShieldAlert className="size-4 text-error" aria-hidden />
        운영자 관리 {hidden ? '· 숨김 상태' : '· 공개 중'}
      </p>
      <p className="gl-hint">
        신고 {total}건
        {total > 0 &&
          ` (${Object.entries(reports)
            .map(
              ([r, n]) =>
                `${REPORT_REASON_LABELS[r as ReportReason]?.label ?? r} ${n}`,
            )
            .join(', ')})`}
      </p>
      <Button
        variant={hidden ? 'secondary' : 'danger'}
        icon={hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
        loading={busy}
        onClick={() => moderate(!hidden)}
        data-testid="moderation-toggle"
      >
        {hidden ? '다시 보이게 하기' : '갤러리에서 숨기기'}
      </Button>
      <p role="status" className="gl-hint empty:hidden">
        {status}
      </p>
    </section>
  );
}
