'use client';

import { Button } from '@/components/ui/button';

/**
 * 본인 API 키가 없을 때 월드맵 위 안내. 글자 14px 이상·버튼 44px·포커스 링은 공통 버튼으로 (P5-14 검수).
 * v1.0 운영은 서버 Gemini 키가 없어 기본 튜터 = 준비해 둔 답 (§12-Q80, B117)
 */
export function ApiKeyAlert() {
  return (
    <div className="mb-4 rounded-xl border border-accent/50 bg-warning-soft p-4">
      <p className="text-small font-bold text-warning">
        파이뱀이 준비해 둔 힌트와 답으로 도와줘요
      </p>
      <p className="mt-1 text-small text-warning">
        AI가 내 코드에 직접 답해 주길 바라면 나만의 API 키를 등록해 봐요.
      </p>
      <Button href="/settings" size="sm" className="mt-3">
        API 키 등록하기
      </Button>
    </div>
  );
}
