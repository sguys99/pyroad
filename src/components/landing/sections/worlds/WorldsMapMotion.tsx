'use client';

import { useEffect, useRef, useState } from 'react';
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { pickRevealMode, supportsViewTimeline } from './revealMode';
import { LOCKED_TIP } from './worldsData';

/** 잠긴 월드 안내 말풍선이 떠 있는 시간 (ms) */
export const TIP_MS = 2600;

/**
 * 세계관 지도의 클라이언트 부분 (P4-04). 그리는 것은 화면 낭독기용 알림 한 줄뿐이고, 지도(서버 HTML)에 속성만 붙인다.
 *
 * - 펼침 방식(`revealMode.ts`): `scroll`은 CSS가 전부 한다. `once`면 지도가 아직 화면 아래에 있을 때 접어 두고
 *   (`data-armed`) 화면에 들어오면 한 번 펼친다(`data-open`). `static`은 아무것도 하지 않는다(처음부터 펼친 상태).
 *   JS가 없거나 늦어도 지도는 펼쳐진 상태로 보인다(접는 것은 JS가 할 때만)
 * - 잠긴 월드를 누르면(위임 클릭) 자물쇠가 흔들리고 "앞 월드를 끝내면 열려요!" 말풍선 + 알림. 효과음은 누른 뒤에만
 */
export function WorldsMapMotion() {
  const { tier, reduced } = useMotionTier();
  const play = useSfx();
  const liveRef = useRef<HTMLParagraphElement>(null);
  const opened = useRef(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const map = liveRef.current?.closest<HTMLElement>('.ld-worlds-map');
    if (!map) return;
    const mode = pickRevealMode(tier, reduced, supportsViewTimeline());
    map.dataset.reveal = mode;
    if (mode !== 'once') {
      delete map.dataset.armed;
      delete map.dataset.open;
      return;
    }
    if (opened.current) return;
    const open = () => {
      opened.current = true;
      map.dataset.open = 'true';
    };
    // 이미 지나간 지도(위로 스크롤해 둔 상태)는 접지 않는다
    if (map.getBoundingClientRect().bottom < 0) {
      open();
      return;
    }
    map.dataset.armed = 'true';
    if (typeof IntersectionObserver === 'undefined') {
      open();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        // 접힌 상태가 한 번 그려진 뒤 펼쳐야 전환이 보인다
        requestAnimationFrame(() => requestAnimationFrame(open));
      },
      { rootMargin: '0px 0px -18% 0px' },
    );
    io.observe(map);
    return () => io.disconnect();
  }, [tier, reduced]);

  useEffect(() => {
    const map = liveRef.current?.closest<HTMLElement>('.ld-worlds-map');
    if (!map) return;
    const timers = new Map<HTMLElement, number>();
    let announce = 0;
    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target?.closest<HTMLElement>('[data-locked-world]');
      const card = btn?.closest<HTMLElement>('.ld-worlds-card');
      if (!btn || !card || !map.contains(btn)) return;
      play('tap');
      // 다시 눌러도 흔들림이 처음부터 돌게 속성을 뗐다 붙인다
      card.removeAttribute('data-tip');
      void card.offsetWidth;
      card.dataset.tip = 'on';
      window.clearTimeout(timers.get(card));
      timers.set(
        card,
        window.setTimeout(() => card.removeAttribute('data-tip'), TIP_MS),
      );
      // 같은 문장도 다시 읽히게 비웠다가 채운다
      setMessage('');
      window.clearTimeout(announce);
      announce = window.setTimeout(
        () => setMessage(`아직 잠겨 있어요. ${LOCKED_TIP}`),
        60,
      );
    };
    map.addEventListener('click', onClick);
    return () => {
      map.removeEventListener('click', onClick);
      window.clearTimeout(announce);
      for (const t of timers.values()) window.clearTimeout(t);
    };
  }, [play]);

  return (
    <p ref={liveRef} className="sr-only" aria-live="polite">
      {message}
    </p>
  );
}
