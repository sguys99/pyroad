'use client';

import Link from 'next/link';

export function ApiKeyAlert() {
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
        AI 튜터를 사용하려면 API 키를 설정해주세요
      </p>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
        API 키가 없으면 미리 준비된 텍스트로만 학습이 진행돼요.
      </p>
      <Link
        href="/settings"
        className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
      >
        설정에서 API 키 입력하기
      </Link>
    </div>
  );
}
