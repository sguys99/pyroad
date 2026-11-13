'use client';

import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics/track';
import type { ShareViewKind } from '@/lib/analytics/events';

/** "나도 해보기" 가는 곳: 랜딩의 30초 체험 (로그인한 사람은 랜딩이 /world 로 보냄) */
export const SHARE_CTA_HREF = '/#try';

/**
 * 공유 페이지 "나도 해보기" (P9-08). 열람(`share_view`)과 누름(`share_cta_click`)을 카드 종류만으로 남긴다 —
 * 카드 id·닉네임은 보내지 않는다 (docs/analytics.md). 정적 페이지가 아니라 서버가 알 수 있지만, 봇·미리보기 수집기를
 * 세지 않으려고 브라우저에서 보낸다(랜딩 `landing_view`와 같은 방식).
 */
export function ShareCta({
  kind,
  className,
}: {
  kind: ShareViewKind;
  className?: string;
}) {
  useEffect(() => {
    track('share_view', { kind });
  }, [kind]);
  return (
    <Button
      href={SHARE_CTA_HREF}
      size="lg"
      iconRight={<ArrowRight aria-hidden />}
      className={className}
      onClick={() => track('share_cta_click', { kind }, { immediate: true })}
      data-testid="share-cta"
    >
      나도 해보기
    </Button>
  );
}
