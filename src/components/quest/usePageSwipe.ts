'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { DURATION, EASING } from '@/lib/motion/tokens';

// 책 펼침(두 쪽이 한꺼번에 보임)에서는 넘길 쪽이 없다. questWorkspace.css의 64rem과 같다
const WIDE_QUERY = '(min-width: 64rem)';
// 스와이프를 받지 않는 곳 (§12-Q55 "에디터 안 스와이프는 제외"): 에디터(가로 스크롤·글자 고르기), 코드 키보드 띠(옆으로 넘김),
// 입력칸, 그리고 직접 표시한 곳. 시트·대화 상자는 body로 포털되어 이 상자 밖이라 처음부터 닿지 않는다
const IGNORE = '.cm-editor, .ck, input, textarea, select, [data-no-swipe]';
// 손가락이 이만큼 움직이기 전에는 방향을 정하지 않는다 (톡 누르기·떨림)
const LOCK_PX = 10;

/**
 * 손을 뗀 순간 몇 쪽 옮길지 (-1 · 0 · 1). 쪽 너비의 1/4 이상 끌었거나, 30px 이상을 빠르게(0.4px/ms) 튕겼으면 넘김.
 * 오른쪽으로 끌면(dx > 0) 앞 쪽, 끝 쪽에서는 넘기지 않음
 */
export function swipeStep({
  dx,
  ms,
  width,
  index,
  count,
}: {
  dx: number;
  ms: number;
  width: number;
  index: number;
  count: number;
}): -1 | 0 | 1 {
  const far = Math.abs(dx) >= width / 4;
  const flick = Math.abs(dx) >= 30 && Math.abs(dx) / Math.max(ms, 1) >= 0.4;
  if (!far && !flick) return 0;
  const step = dx < 0 ? 1 : -1;
  const to = index + step;
  return to < 0 || to >= count ? 0 : step;
}

/** 가로로 스크롤되는 상자 안에서 시작한 몸짓인지 (그 상자가 먼저 가로 몸짓을 받아야 함) */
function inHorizontalScroller(from: Element | null, stop: Element): boolean {
  for (let el = from; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}

/**
 * 모바일 쪽 넘기기 (P6-11, §12-Q55: 번호 탭 + 좌우 스와이프). `host`(책 상자) 위 가로 스와이프로 앞·뒤 쪽,
 * 쪽이 바뀌면(탭·스와이프·실행 뒤 결과로 자동 이동 모두) 새 쪽이 넘겨지며 들어온다.
 *
 * - 방향 잠금: 처음 10px에서 가로(|dx| > 1.2|dy|)로 정해지면 그 몸짓 동안 세로 스크롤을 막고, 세로면 끝까지 손대지 않는다(자연스러운 스크롤)
 * - 연출 단계(`budget.pageTransition`): full(slide) = 손가락을 따라 쪽이 움직이고(끝 쪽은 고무줄) 새 쪽이 책장처럼 살짝 기울어 들어옴,
 *   lite(fade) = 따라가지 않고 놓으면 12px 페이드, minimal·동작 줄이기(none) = 즉시. 모두 transform·opacity만, Web Animations 1회성
 * - 키보드·낭독기 탭 이동(SegmentedTabs ←/→)은 그대로. 터치 이벤트만 들으므로 마우스·펜 끌기와 글자 고르기는 건드리지 않는다
 */
export function usePageSwipe<T extends string>({
  host,
  order,
  tab,
  setTab,
  pageOf,
}: {
  host: RefObject<HTMLElement | null>;
  order: readonly T[];
  tab: T;
  setTab: (tab: T) => void;
  /** 그 탭이 보이는 쪽 상자 (움직일 대상) */
  pageOf: (tab: T) => HTMLElement | null;
}) {
  const transition = useMotionTier().budget.pageTransition;
  // 이벤트 처리기는 한 번만 붙이고 최신 값은 ref로 읽는다
  const live = useRef({ order, tab, setTab, pageOf, transition });
  live.current = { order, tab, setTab, pageOf, transition };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let g: {
      x: number;
      y: number;
      t: number;
      dx: number;
      lock: 'x' | null;
      page: HTMLElement | null;
    } | null = null;

    const release = (page: HTMLElement | null) => {
      if (!page?.style.transform) return;
      const from = page.style.transform;
      page.style.transform = '';
      page.animate([{ transform: from }, { transform: 'none' }], {
        duration: DURATION.base,
        easing: EASING.out,
      });
    };
    const start = (e: TouchEvent) => {
      g = null;
      if (e.touches.length !== 1 || window.matchMedia(WIDE_QUERY).matches)
        return;
      const target = e.target as Element;
      if (target.closest(IGNORE) || inHorizontalScroller(target, el)) return;
      const p = e.touches[0];
      g = {
        x: p.clientX,
        y: p.clientY,
        t: e.timeStamp,
        dx: 0,
        lock: null,
        page: live.current.pageOf(live.current.tab),
      };
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      if (e.touches.length !== 1) {
        release(g.page);
        g = null;
        return;
      }
      const p = e.touches[0];
      const dx = p.clientX - g.x;
      const dy = p.clientY - g.y;
      if (!g.lock) {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
          g = null; // 세로 몸짓: 브라우저 스크롤에 맡김
          return;
        }
        g.lock = 'x';
      }
      e.preventDefault();
      g.dx = dx;
      const { order, tab, transition } = live.current;
      if (transition !== 'slide' || !g.page) return;
      const i = order.indexOf(tab);
      const edge = (dx > 0 && i === 0) || (dx < 0 && i === order.length - 1);
      g.page.style.transform = `translateX(${edge ? dx / 4 : dx}px)`;
    };
    const end = (e: TouchEvent) => {
      if (!g?.lock) {
        g = null;
        return;
      }
      const { dx, page } = g;
      const { order, tab, setTab } = live.current;
      const i = order.indexOf(tab);
      const step = swipeStep({
        dx,
        ms: e.timeStamp - g.t,
        width: el.clientWidth,
        index: i,
        count: order.length,
      });
      g = null;
      if (step) setTab(order[i + step]);
      else release(page);
    };
    const cancel = () => {
      release(g?.page ?? null);
      g = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    // 가로로 잠근 몸짓의 세로 스크롤을 막아야 해서 passive가 아님 (막는 것은 잠근 뒤뿐)
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', cancel);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [host]);

  // 쪽이 바뀌면 새 쪽이 넘겨지며 들어온다 (앞으로 = 오른쪽에서, 뒤로 = 왼쪽에서)
  const prev = useRef(tab);
  useLayoutEffect(() => {
    const from = prev.current;
    prev.current = tab;
    if (from === tab) return;
    const { order, pageOf, transition } = live.current;
    for (const t of order) pageOf(t)?.style.removeProperty('transform');
    const page = pageOf(tab);
    if (
      !page ||
      transition === 'none' ||
      typeof page.animate !== 'function' ||
      window.matchMedia(WIDE_QUERY).matches
    )
      return;
    const dir = order.indexOf(tab) > order.indexOf(from) ? 1 : -1;
    if (transition === 'fade') {
      page.animate(
        [
          { opacity: 0.2, transform: `translateX(${dir * 12}px)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: DURATION.base, easing: EASING.out },
      );
      return;
    }
    // 책장: 책등 쪽(들어오는 반대편) 모서리를 축으로 살짝 기운 채 밀려 들어와 펴진다
    page.animate(
      [
        {
          opacity: 0.3,
          transformOrigin: dir > 0 ? 'left center' : 'right center',
          transform: `perspective(1600px) translateX(${dir * 40}px) rotateY(${dir * -10}deg)`,
        },
        {
          opacity: 1,
          transformOrigin: dir > 0 ? 'left center' : 'right center',
          transform: 'none',
        },
      ],
      { duration: DURATION.slow, easing: EASING.page },
    );
  }, [tab]);
}
