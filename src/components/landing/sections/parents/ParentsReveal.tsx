'use client';

import type { ReactNode } from 'react';
import { useInView } from '../../useInView';

/**
 * 보호자 섹션 등장 표시 (P4-07): 화면에 꽤 들어오면 `data-in="true"`만 붙인다. 연출은 parents.css가
 * 연출 단계를 보고 정한다(transform만, full·lite). 내용은 서버가 그린 children 그대로라 처음부터 보이는 상태다.
 */
export function ParentsReveal({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({
    rootMargin: '0px 0px -15% 0px',
  });
  return (
    <div ref={ref} className={className} data-in={inView}>
      {children}
    </div>
  );
}
