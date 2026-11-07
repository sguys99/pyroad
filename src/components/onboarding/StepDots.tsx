import { cn } from '@/lib/utils';

export interface StepDotsProps {
  /** 단계 이름 (낭독기·툴팁) */
  labels: readonly string[];
  /** 지금 단계 (0부터) */
  current: number;
  /** 낭독기 묶음 이름 */
  label?: string;
  /** 마지막 칸을 금색 별 자리로 (온보딩 = 도장) */
  goldLast?: boolean;
  className?: string;
}

/**
 * 진행 점 (P3-11 온보딩·튜토리얼). 지난 단계 = 초록 점, 지금 = 길쭉한 초록 알약, 남은 단계 = 옅은 점, 마지막(도장) = 금색.
 * 모양이 바뀌는 것은 transform(scaleX)만 — 칸 폭은 그대로라 줄이 흔들리지 않는다. 동작 줄이기는 즉시.
 * 낭독기에는 "5단계 중 2단계: 이름" 한 줄 (점 하나하나는 읽지 않음).
 */
export function StepDots({
  labels,
  current,
  label = '진행 단계',
  goldLast = false,
  className,
}: StepDotsProps) {
  const total = labels.length;
  return (
    <div
      className={cn('ob-dots', className)}
      role="group"
      aria-label={label}
      data-testid="onboarding-dots"
    >
      <span className="sr-only">
        {total}단계 중 {current + 1}단계: {labels[current]}
      </span>
      <ol aria-hidden className="ob-dots-row">
        {labels.map((name, i) => (
          <li
            key={name + i}
            className="ob-dot"
            data-state={i < current ? 'done' : i === current ? 'now' : 'next'}
            data-gold={goldLast && i === total - 1 ? '' : undefined}
            title={name}
          />
        ))}
      </ol>
    </div>
  );
}
