'use client';

import Link from 'next/link';

export function ApiKeyBanner() {
  return (
    <div className="bg-warning-soft border-b border-accent/50 px-4 py-3 text-center">
      <p className="text-sm font-medium text-warning">
        AI 튜터가 기본 제공되고 있어요
      </p>
      <p className="mt-1 text-xs text-warning">
        더 다양한 AI 모델을 사용하려면{' '}
        <Link
          href="/settings"
          className="font-medium underline hover:text-foreground"
        >
          나만의 API 키를 등록해보세요
        </Link>
      </p>
    </div>
  );
}
