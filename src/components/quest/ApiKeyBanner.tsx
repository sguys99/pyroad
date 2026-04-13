'use client';

import Link from 'next/link';

export function ApiKeyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center dark:bg-amber-950/30 dark:border-amber-800">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        AI 튜터가 기본 제공되고 있어요
      </p>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        더 다양한 AI 모델을 사용하려면{' '}
        <Link
          href="/settings"
          className="font-medium underline hover:text-amber-800 dark:hover:text-amber-200"
        >
          나만의 API 키를 등록해보세요
        </Link>
      </p>
    </div>
  );
}
