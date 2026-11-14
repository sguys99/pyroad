'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { usePolicyLive } from '@/components/legal/PolicyLive';
import { ShareSheet, type ShareSheetProps } from './ShareSheet';

/**
 * 누르면 공유 시트(P9-09)를 여는 버튼. 서버 컴포넌트 화면(프로필)에서도 그대로 놓을 수 있게 열림 상태를 안에 둔다.
 * 축하 화면 "자랑하기"(P9-10)도 이 버튼이나 `ShareSheet`를 직접 쓴다. 처리방침 시행일 전에는 그리지 않음(B79)
 */
export function ShareButton({
  kind,
  cardRef,
  onShared,
  children = '자랑하기',
  variant = 'secondary',
  size = 'sm',
  className,
  onOpenChange,
  testId = 'share-open',
}: Pick<ShareSheetProps, 'kind' | 'cardRef' | 'onShared'> &
  Pick<ButtonProps, 'variant' | 'size' | 'className' | 'children'> & {
    /** 시트가 열리고 닫힐 때 (축하 카드: 열린 동안 자동 넘김·키보드 멈춤, P9-10) */
    onOpenChange?: (open: boolean) => void;
    testId?: string;
  }) {
  const live = usePolicyLive();
  const [open, setRawOpen] = useState(false);
  if (!live) return null;
  const setOpen = (next: boolean) => {
    setRawOpen(next);
    onOpenChange?.(next);
  };
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={<Share2 aria-hidden />}
        className={className}
        onClick={() => setOpen(true)}
        data-testid={testId}
      >
        {children}
      </Button>
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        cardRef={cardRef}
        onShared={onShared}
      />
    </>
  );
}
