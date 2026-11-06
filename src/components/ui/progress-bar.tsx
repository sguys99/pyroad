'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/**
 * 진행바 (P2-11, docs/design/components.md §7). 최종 시안 `InkProgress`·XP 바: 보조 면 홈 + 주색(또는 금색) 채움.
 *
 * - 채움은 `transform: scaleX()`만 움직인다(레이아웃·페인트 없음, §2.10). 길이 `DURATION.progress` ease-out,
 *   lite 70%, minimal 150ms, 동작 줄이기 즉시 (`.g-prog-fill`)
 * - 값이 오르면 빛 띠가 한 번 지나간다(full·lite, `data-rising`). 동작 줄이기·minimal은 없음
 * - `animateOnMount`: 처음에 0에서 채워 올라감 (월드맵 XP 바처럼 화면에 들어올 때 보여 주고 싶을 때)
 * - `role="progressbar"` + `aria-valuenow/min/max`, 이름은 `label`(또는 `aria-labelledby`), 읽는 값은 `valueText`
 */
interface ProgressBarProps {
  value: number;
  max?: number;
  /** 화면 낭독기 이름 ("다음 레벨까지 경험치") */
  label?: string;
  'aria-labelledby'?: string;
  /** 낭독기가 읽을 값 ("120 / 200 XP"). 없으면 백분율 */
  valueText?: string;
  tone?: 'primary' | 'reward';
  size?: 'sm' | 'md' | 'lg';
  animateOnMount?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  'aria-labelledby': labelledBy,
  valueText,
  tone = 'primary',
  size = 'md',
  animateOnMount = false,
  className,
  'data-testid': testId,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(max, value));
  const ratio = max > 0 ? clamped / max : 0;
  const [shown, setShown] = useState(animateOnMount ? 0 : ratio);
  const [rising, setRising] = useState<'a' | 'b' | null>(null);
  const prev = useRef(animateOnMount ? 0 : ratio);

  useEffect(() => {
    if (ratio > prev.current) setRising((r) => (r === 'a' ? 'b' : 'a'));
    prev.current = ratio;
    // 마운트 직후 0 → 값: 한 프레임 뒤에 바꿔야 전환이 일어난다
    if (typeof requestAnimationFrame !== 'function') {
      setShown(ratio);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(ratio));
    return () => cancelAnimationFrame(raf);
  }, [ratio]);

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      data-tone={tone}
      data-size={size}
      data-rising={rising ?? undefined}
      data-testid={testId}
      className={cn('g-prog', className)}
      style={{ '--g-prog': shown } as CSSProperties}
    >
      <span className="g-prog-fill" />
      <span className="g-prog-shine" />
    </span>
  );
}
