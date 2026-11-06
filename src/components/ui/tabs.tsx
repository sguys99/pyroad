'use client';

import {
  useId,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

/**
 * 세그먼트 탭 (P2-11, docs/design/components.md §6). 최종 시안 `.f-seg`: 보조 면 알약 안에서 주색 엄지가 고른 칸으로 미끄러진다.
 *
 * - WAI-ARIA 탭: `role="tablist"` + `role="tab"` + `aria-selected`, 고른 탭만 Tab 키로 들어오고(roving tabindex)
 *   ←/→(끝에서 돌아감) · Home · End로 옮기며 바로 고른다(자동 활성화). 패널이 있으면 `panelId`로 `aria-controls`를 잇는다
 * - 칸 너비는 모두 같다(엄지가 transform 하나로 움직이게). 각 칸 48px 높이
 * - 연출: 엄지 이동은 face 스프링 · lite 220ms · minimal·동작 줄이기 즉시 (`.g-seg-thumb`)
 */
export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** 이 탭이 여는 패널의 id (`aria-controls`) */
  panelId?: string;
}

interface SegmentedTabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** 탭 묶음 이름 (화면 낭독기) */
  'aria-label': string;
  /** 탭 id 앞부분 (`<idBase>-<value>`, 패널의 `aria-labelledby`에 쓴다). 기본은 자동 */
  idBase?: string;
  className?: string;
}

export function tabId(idBase: string, value: string) {
  return `${idBase}-${value}`;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  idBase,
  className,
}: SegmentedTabsProps<T>) {
  const autoId = useId();
  const base = idBase ?? `tabs${autoId.replace(/:/g, '')}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    items.findIndex((t) => t.value === value),
  );

  const move = (to: number) => {
    const n = items.length;
    const i = (to + n) % n;
    refs.current[i]?.focus();
    onValueChange(items[i].value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const keys: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    move(keys[e.key]);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn('g-seg', className)}
      style={
        {
          '--g-seg-n': items.length,
          '--g-seg-i': index,
        } as CSSProperties
      }
    >
      <span className="g-seg-thumb" aria-hidden />
      {items.map((item, i) => {
        const selected = i === index;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(base, item.value)}
            aria-selected={selected}
            aria-controls={item.panelId}
            tabIndex={selected ? 0 : -1}
            className="g-seg-tab"
            onClick={() => onValueChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
