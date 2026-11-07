'use client';

import { useRef, type KeyboardEvent } from 'react';

/**
 * 직접 만든 라디오 묶음(`role="radiogroup"` + `role="radio"` 버튼)의 키보드 (WAI-ARIA Radio Group 패턴).
 * - 고른 칸만 Tab 순서에 들어감 (아무것도 안 골랐으면 첫 칸)
 * - ←·↑ 이전, →·↓ 다음 (끝에서 돌아감), Home·End. 옮기면 바로 고름 (네이티브 라디오와 같음)
 * - Space·Enter는 버튼 클릭으로 고름
 */
export function useRovingRadio<T>(
  values: readonly T[],
  value: T | null | undefined,
  onChange: (next: T) => void,
) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const current = value == null ? -1 : values.indexOf(value);
  const focusable = current >= 0 ? current : 0;

  const move = (i: number) => {
    const n = values.length;
    const next = ((i % n) + n) % n;
    onChange(values[next]);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(i - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(i + 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(values.length - 1);
        break;
    }
  };

  const itemProps = (i: number) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    role: 'radio' as const,
    'aria-checked': i === current,
    tabIndex: i === focusable ? 0 : -1,
    onKeyDown: (e: KeyboardEvent) => onKeyDown(e, i),
  });

  return { itemProps };
}
