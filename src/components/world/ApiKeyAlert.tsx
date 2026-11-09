'use client';

import { Button } from '@/components/ui/button';

/** 본인 API 키가 없을 때 월드맵 위 안내. 글자 14px 이상·버튼 44px·포커스 링은 공통 버튼으로 (P5-14 검수) */
export function ApiKeyAlert() {
  return (
    <div className="mb-4 rounded-xl border border-accent/50 bg-warning-soft p-4">
      <p className="text-small font-bold text-warning">
        AI 튜터가 기본 제공되고 있어요
      </p>
      <p className="mt-1 text-small text-warning">
        더 다양한 AI 모델을 사용하려면 나만의 API 키를 등록해보세요.
      </p>
      <Button href="/settings" size="sm" className="mt-3">
        API 키 등록하기
      </Button>
    </div>
  );
}
