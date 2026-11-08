'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useInView, type InViewOptions } from './useInView';

export interface WhenVisibleProps extends InViewOptions {
  /** 화면 근처에 오면 그릴 것. `next/dynamic` 컴포넌트를 넣으면 그 모듈도 이때 받는다 */
  children: ReactNode;
  /** 오기 전 자리 (서버 렌더·첫 페인트에 보이는 정지 그림이나 글자). 없으면 빈 자리 */
  fallback?: ReactNode;
  /** 오기 전 자리의 최소 높이 (CSS 길이). 레이아웃이 흔들리지 않게 */
  minHeight?: string;
  className?: string;
}

/**
 * 화면에 들어올 때 무거운 연출을 그리는 자리 (P4-01, §2.10 "아래쪽 애니메이션은 화면에 들어올 때 로드").
 * 서버 HTML·첫 페인트에는 `fallback`만 있고, 300px 앞에서 `children`으로 바뀐다.
 *
 *   const LiveDemo = dynamic(() => import('./LiveDemo'), { ssr: false });
 *   <WhenVisible fallback={<DemoStill />} minHeight="20rem"><LiveDemo /></WhenVisible>
 */
export function WhenVisible({
  children,
  fallback = null,
  minHeight,
  className,
  ...opts
}: WhenVisibleProps) {
  const [ref, inView] = useInView<HTMLDivElement>(opts);
  return (
    <div
      ref={ref}
      className={cn('ld-lazy', className)}
      data-pending={!inView}
      style={
        minHeight ? ({ '--ld-lazy-h': minHeight } as CSSProperties) : undefined
      }
    >
      {inView ? children : fallback}
    </div>
  );
}
