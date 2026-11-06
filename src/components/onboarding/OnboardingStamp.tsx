import { forwardRef } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAMP_ROTATE_DEG } from '@/lib/celebration/onboardingFx';

export interface OnboardingStampProps {
  /** 찍혔는지. 아니면 빈 도장 자리(점선 고리 + "도장") */
  stamped: boolean;
  /** 도장 글자 (기본 "등록") */
  text?: string;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * 금색 도장 (도장 = 완료 기록, §12-Q31). 최종 시안 `.f-stamp`: 둥근 고리 2.5px 금색 글자색 + 옅은 금색 면 + Jua 글자,
 * -8° 기울임. 찍히는 연출은 부르는 쪽이 `stampSlam(ref)`(`src/lib/celebration/onboardingFx.ts`)로 — 여기는 모양만.
 * 찍히기 전에는 점선 고리 "도장" 자리(장식). 글자 대비: 금색 글자 on 금색 틴트 5.28 (tokens.md §1.1).
 */
export const OnboardingStamp = forwardRef<
  HTMLSpanElement,
  OnboardingStampProps
>(function OnboardingStamp(
  { stamped, text = '등록', size = 'md', className },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn('ob-stamp', className)}
      data-size={size}
      data-stamped={stamped || undefined}
      style={
        stamped ? { transform: `rotate(${STAMP_ROTATE_DEG}deg)` } : undefined
      }
      data-testid="onboarding-stamp"
      aria-hidden={!stamped}
      role={stamped ? 'img' : undefined}
      aria-label={stamped ? `${text} 도장` : undefined}
    >
      {stamped ? (
        <>
          <Star aria-hidden className="ob-stamp-star" />
          <span className="ob-stamp-text font-display">{text}</span>
        </>
      ) : (
        <span className="ob-stamp-slot">도장</span>
      )}
    </span>
  );
});
