'use client';

import { useSfx } from '@/components/providers/soundContext';
import { cn } from '@/lib/utils';
import { useRovingRadio } from './useRovingRadio';

const GRADES = [1, 2, 3, 4, 5, 6] as const;

export interface GradePickerProps {
  value: number | null;
  onChange: (grade: number) => void;
  'aria-labelledby'?: string;
  className?: string;
}

/**
 * 학년 칩 1~6 (P3-11, 선택 항목). 라디오 묶음(←→ 옮기며 고름). 고른 칩 = 초록 면 + 흰 글자(5.12), 나머지 = 흰 면 + 아랫면.
 * 360px에서 3칸 × 2줄, 640px 이상 6칸 한 줄. 칩 높이 52px. 건너뛰기는 부르는 쪽 버튼.
 */
export function GradePicker({
  value,
  onChange,
  'aria-labelledby': labelledBy,
  className,
}: GradePickerProps) {
  const play = useSfx();
  const pick = (g: number) => {
    if (g === value) return;
    onChange(g);
    play('tap');
  };
  const { itemProps } = useRovingRadio(GRADES, value as 1 | null, pick);
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn('ob-grades', className)}
      data-testid="grade-picker"
    >
      {GRADES.map((g, i) => (
        <button
          key={g}
          type="button"
          {...itemProps(i)}
          className="ob-grade focus-ring font-display"
          data-selected={g === value || undefined}
          onClick={() => pick(g)}
        >
          {g}
          <span className="ob-grade-unit">학년</span>
        </button>
      ))}
    </div>
  );
}
