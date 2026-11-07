'use client';

import { HeartHandshake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConsentStatus } from './ConsentProvider';

export const GUARDIAN_CONSENT_HREF = '/onboarding/guardian';

/**
 * 제한 모드 안내 (P3-15): 게시판 글쓰기·댓글 자리 대신. 혼내는 말투가 아니라 "보호자와 함께 하면 바로 돼요".
 * 금색 틴트 면(경고 = 금색, 빨간색 아님) + 손잡은 하트 아이콘 + [보호자 동의하기]. `compact`는 댓글 자리용 한 줄.
 */
export function RestrictedNotice({
  what = '게시판에 글을 쓰려면',
  compact = false,
  className,
}: {
  /** "…하려면" 앞 말 (예: "댓글을 달려면") */
  what?: string;
  compact?: boolean;
  className?: string;
}) {
  const status = useConsentStatus();
  const days =
    status?.state === 'pending' && status.daysLeft !== null
      ? status.daysLeft
      : null;
  return (
    <div
      className={cn('cs-notice', className)}
      data-compact={compact || undefined}
      data-testid="restricted-notice"
    >
      <span className="cs-notice-icon" aria-hidden>
        <HeartHandshake />
      </span>
      <div className="cs-notice-main">
        <p className="cs-notice-title">{what} 보호자 동의가 필요해요</p>
        {!compact && (
          <p className="cs-notice-body">
            보호자와 함께 동의하면 바로 쓸 수 있어요. 그동안 퀘스트 공부는
            마음껏 할 수 있어요!
            {days !== null && days <= 7 && (
              <>
                {' '}
                <strong>{days}일 안에</strong> 동의하지 않으면 계정이 지워져요.
              </>
            )}
          </p>
        )}
      </div>
      <Button
        href={GUARDIAN_CONSENT_HREF}
        variant="reward"
        size="sm"
        className="cs-notice-cta"
        data-testid="restricted-notice-cta"
      >
        보호자 동의하기
      </Button>
    </div>
  );
}
