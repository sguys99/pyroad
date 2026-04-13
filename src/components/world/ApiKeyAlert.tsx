'use client';

import Link from 'next/link';

export function ApiKeyAlert() {
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
        AI 튜터가 기본 제공되고 있어요
      </p>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        더 다양한 AI 모델을 사용하려면 나만의 API 키를 등록해보세요.
      </p>
      <Link
        href="/settings"
        className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
      >
        API 키 등록하기
      </Link>
    </div>
  );
}
