'use client';

import Link from 'next/link';

export function ApiKeyBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center dark:bg-amber-950/30 dark:border-amber-800">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
        AI 튜터를 사용하려면 API 키가 필요해요!
      </p>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        지금은 미리 준비된 텍스트로 학습이 진행돼요.{' '}
        <Link
          href="/settings"
          className="font-medium underline hover:text-amber-800 dark:hover:text-amber-200"
        >
          설정에서 API 키 입력하기
        </Link>
      </p>
    </div>
  );
}
