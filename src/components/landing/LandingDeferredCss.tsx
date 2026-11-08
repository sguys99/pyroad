'use client';

import { useEffect } from 'react';
import { loadDeferredCss } from './deferredCss';

/**
 * 랜딩 아래쪽 섹션 CSS 받기 (P4-12). 그리는 것 없음. 하이드레이션 직후 받기 시작한다
 * (바로가기는 `ScrollLink`가 CSS를 기다렸다가 스크롤).
 *
 * 주소에 `#worlds`처럼 아래쪽 섹션이 있으면 브라우저가 처음 스크롤한 뒤 위쪽 섹션 높이가 CSS를 받으며 바뀌므로,
 * 아이가 그동안 스크롤하지 않았으면 CSS가 붙은 뒤 그 섹션으로 한 번 더 맞춘다.
 */
export function LandingDeferredCss() {
  useEffect(() => {
    let moved = false;
    const mark = () => {
      moved = true;
    };
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    for (const ev of events)
      window.addEventListener(ev, mark, { passive: true, once: true });
    let alive = true;
    loadDeferredCss().then(
      () => {
        if (!alive || moved) return;
        const id = decodeURIComponent(window.location.hash.slice(1));
        const target = id ? document.getElementById(id) : null;
        if (target?.closest('[data-deferred-css]'))
          target.scrollIntoView({ block: 'start' });
      },
      () => {},
    );
    return () => {
      alive = false;
      for (const ev of events) window.removeEventListener(ev, mark);
    };
  }, []);
  return null;
}
