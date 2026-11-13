'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { ShareSheet, type ShareSheetProps } from './ShareSheet';

/**
 * 누르면 공유 시트(P9-09)를 여는 버튼. 서버 컴포넌트 화면(프로필)에서도 그대로 놓을 수 있게 열림 상태를 안에 둔다.
 * 축하 화면 "자랑하기"(P9-10)도 이 버튼이나 `ShareSheet`를 직접 쓴다
 */
export function ShareButton({
  kind,
  cardRef,
  onShared,
  children = '자랑하기',
  variant = 'secondary',
  size = 'sm',
  className,
}: Pick<ShareSheetProps, 'kind' | 'cardRef' | 'onShared'> &
  Pick<ButtonProps, 'variant' | 'size' | 'className' | 'children'>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={<Share2 aria-hidden />}
        className={className}
        onClick={() => setOpen(true)}
        data-testid="share-open"
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
