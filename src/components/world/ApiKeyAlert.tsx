'use client';

import Link from 'next/link';

export function ApiKeyAlert() {
  return (
    <div className="mb-4 rounded-xl border border-accent/50 bg-warning-soft p-4">
      <p className="text-sm font-bold text-warning">
        AI 튜터가 기본 제공되고 있어요
      </p>
      <p className="mt-1 text-xs text-warning">
        더 다양한 AI 모델을 사용하려면 나만의 API 키를 등록해보세요.
      </p>
      <Link
        href="/settings"
        className="mt-2 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary-lip"
      >
        API 키 등록하기
      </Link>
    </div>
  );
}
