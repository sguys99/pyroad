'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Share2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { ShareSheetProps } from './ShareSheet';

// 시트는 처음 누를 때 받는다 (B104): 정적 import면 버튼만 있는 화면(퀘스트의 축하·보스 결과, 프로필)의 첫 로드 JS에
// 시트 전체가 실려 퀘스트 라우트 JS 예산(350KB, §2.10)을 넘었음. ssr: false라 서버 HTML에 preload 스크립트도 없음(CSP nonce)
const ShareSheet = dynamic(
  () => import('./ShareSheet').then((m) => m.ShareSheet),
  { ssr: false },
);

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
  onOpenChange,
  testId = 'share-open',
}: Pick<ShareSheetProps, 'kind' | 'cardRef' | 'onShared'> &
  Pick<ButtonProps, 'variant' | 'size' | 'className' | 'children'> & {
    /** 시트가 열리고 닫힐 때 (축하 카드: 열린 동안 자동 넘김·키보드 멈춤, P9-10) */
    onOpenChange?: (open: boolean) => void;
    testId?: string;
  }) {
  const [open, setRawOpen] = useState(false);
  // 한 번 열면 계속 마운트 (닫힘 연출·다시 열기)
  const [used, setUsed] = useState(false);
  const setOpen = (next: boolean) => {
    if (next) setUsed(true);
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
      {used && (
        <ShareSheet
          open={open}
          onOpenChange={setOpen}
          kind={kind}
          cardRef={cardRef}
          onShared={onShared}
        />
      )}
    </>
  );
}
