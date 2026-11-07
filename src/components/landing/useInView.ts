'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface InViewOptions {
  /** 화면에 들어오기 전 미리 보는 여유 (IntersectionObserver rootMargin). 기본 '300px 0px' = 300px 전에 */
  rootMargin?: string;
  threshold?: number;
  /** 한 번 들어오면 계속 true (기본 true: 지연 로드용). false면 나갈 때 false (연출 멈춤용) */
  once?: boolean;
}

/**
 * 요소가 화면(근처)에 들어왔는지 (P4-01, 랜딩 아래쪽 섹션의 무거운 연출·모듈 지연 로드용).
 * IntersectionObserver가 없는 환경(오래된 브라우저·테스트)에서는 처음부터 true.
 *
 *   const [ref, inView] = useInView<HTMLDivElement>();
 *   return <div ref={ref}>{inView && <HeavyDemo />}</div>;
 */
export function useInView<T extends Element>({
  rootMargin = '300px 0px',
  threshold = 0,
  once = true,
}: InViewOptions = {}): [(el: T | null) => void, boolean] {
  const [inView, setInView] = useState(false);
  const [el, setEl] = useState<T | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (!el || (once && done.current)) return;
    if (typeof IntersectionObserver === 'undefined') {
      done.current = true;
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && once) {
          done.current = true;
          setInView(true);
          io.disconnect();
          return;
        }
        if (!once) setInView(hit);
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, rootMargin, threshold, once]);

  const ref = useCallback((node: T | null) => setEl(node), []);
  return [ref, inView];
}
