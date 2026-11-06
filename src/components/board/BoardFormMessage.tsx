import { HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BoardFormError {
  message: string;
  /** API 응답의 code. 'moderation' 이면 금칙어·개인정보 안내 (P1-18) */
  code?: string;
}

/**
 * 글·댓글 저장 실패 안내. 금칙어·개인정보에 걸린 경우는 꾸짖는 빨간 오류 대신 부드러운 안내로 보여 줌.
 */
export function BoardFormMessage({
  error,
  className,
}: {
  error: BoardFormError;
  className?: string;
}) {
  if (error.code === 'moderation') {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-start gap-2 rounded-lg border border-accent bg-accent/15 px-3 py-2 text-sm text-foreground',
          className,
        )}
      >
        <HeartHandshake
          className="mt-0.5 size-4 shrink-0 text-accent-foreground"
          aria-hidden="true"
        />
        <p>{error.message}</p>
      </div>
    );
  }
  return (
    <p
      role="alert"
      className={cn(
        'rounded-lg bg-error-soft px-3 py-2 text-sm text-destructive',
        className,
      )}
    >
      {error.message}
    </p>
  );
}
