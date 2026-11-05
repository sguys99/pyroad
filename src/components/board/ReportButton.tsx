'use client';

import { useId, useState } from 'react';
import { m } from 'framer-motion';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { Check, Flag } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/board/limits';
import { cn } from '@/lib/utils';

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
}

type Phase = 'choose' | 'sending' | 'done';

const TARGET_LABEL: Record<ReportTargetType, string> = {
  post: '글',
  comment: '댓글',
};

/**
 * 게시글·댓글 신고 (P1-18). 사유를 고르면 /api/board/reports 로 보냄.
 * 자기 글에는 보여 주지 않음(서버도 거부). 같은 대상은 한 번만 신고됨(서버 UNIQUE).
 */
export function ReportButton({ targetType, targetId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('choose');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reported, setReported] = useState(false);
  const groupName = useId();
  // 동작 줄이기: 기기 설정 + 사용자 설정 (P2-15)
  const { reduced: reduceMotion } = useMotionTier();
  const target = TARGET_LABEL[targetType];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !reported) {
      setPhase('choose');
      setReason(null);
      setError('');
    }
  }

  async function submit() {
    if (!reason) {
      setError('신고하는 까닭을 골라 주세요.');
      return;
    }
    setPhase('sending');
    setError('');
    try {
      const res = await fetch('/api/board/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.error || '앗, 신고를 보내지 못했어요. 잠시 뒤에 다시 해 볼까요?',
        );
        setPhase('choose');
        return;
      }
      setMessage(data.message || '알려 줘서 고마워요! 어른이 살펴볼게요.');
      setReported(true);
      setPhase('done');
    } catch {
      setError('인터넷 연결을 확인하고 다시 해 볼까요?');
      setPhase('choose');
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label={
          reported ? `이 ${target}은 신고했어요` : `이 ${target} 신고하기`
        }
      >
        <Flag className="size-3" aria-hidden="true" />
        {reported ? '신고함' : '신고'}
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        {phase === 'done' ? (
          <>
            <div
              className="flex flex-col items-center gap-3 py-2 text-center"
              role="status"
            >
              <m.div
                className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary"
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 420, damping: 18 }
                }
              >
                <Check className="size-6" aria-hidden="true" />
              </m.div>
              <AlertDialogTitle>{message}</AlertDialogTitle>
              <AlertDialogDescription>
                신고한 사람이 누구인지는 다른 친구에게 알려지지 않아요.
              </AlertDialogDescription>
            </div>
            <AlertDialogFooter className="group-data-[size=sm]/alert-dialog-content:grid-cols-1">
              <Button onClick={() => setOpen(false)}>확인</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>이 {target}을 신고할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                어떤 점이 문제인지 하나 골라 주세요. 어른이 살펴볼게요.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <fieldset
              className="flex flex-col gap-2"
              disabled={phase === 'sending'}
            >
              <legend className="sr-only">신고하는 까닭</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted',
                    reason === r && 'border-primary bg-primary/10',
                  )}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={r}
                    checked={reason === r}
                    onChange={() => {
                      setReason(r);
                      setError('');
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {REPORT_REASON_LABELS[r].label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {REPORT_REASON_LABELS[r].hint}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={phase === 'sending'}
              >
                그만두기
              </Button>
              <Button
                variant="destructive"
                onClick={submit}
                disabled={phase === 'sending'}
              >
                {phase === 'sending' ? '보내는 중…' : '신고하기'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
