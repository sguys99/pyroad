'use client';

import { useEffect } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { createParallax } from './parallax';

/**
 * 히어로 다층 패럴랙스 (P4-01). 그리는 것은 없고, 히어로 요소에 CSS 변수 `--hx`·`--hy`(포인터, -1~1)와
 * `--hs`(스크롤 px)만 쓴다. 레이어 이동은 hero.css `.hero-par`가 transform으로 (full 단계만).
 *
 * - `budget.parallax`(full + 동작 줄이기 꺼짐)일 때만 듣는다. 다른 단계에서는 리스너도 rAF도 없다
 * - 마우스·펜: 포인터 위치를 따라 레이어가 깊이만큼 반대로 움직인다(부드럽게 따라감, 멈추면 rAF도 멈춤)
 * - 터치: 기울기 센서 대신 스크롤 + 탭한 곳 쪽으로 살짝 기울었다 돌아온다
 * - 히어로가 화면 밖이면 아무것도 쓰지 않는다
 */
export function HeroParallax({ targetId }: { targetId: string }) {
  const { budget } = useMotionTier();
  const on = budget.parallax;

  useEffect(() => {
    if (!on) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    const fx = createParallax({
      write: (x, y, s) => {
        el.style.setProperty('--hx', x.toFixed(4));
        el.style.setProperty('--hy', y.toFixed(4));
        el.style.setProperty('--hs', s.toFixed(1));
      },
      raf: (cb) => requestAnimationFrame(cb),
      cancelRaf: (id) => cancelAnimationFrame(id),
    });

    let visible = true;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            visible = entries[entries.length - 1].isIntersecting;
          })
        : null;
    io?.observe(el);

    let release = 0;
    const onMove = (e: PointerEvent) => {
      if (!visible || e.pointerType === 'touch') return;
      fx.pointer(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    };
    const onLeave = () => fx.pointer(0, 0);
    // 터치: 탭한 곳 쪽으로 잠깐 기울었다가 돌아온다
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !visible) return;
      fx.pointer(
        ((e.clientX / window.innerWidth) * 2 - 1) * 0.6,
        ((e.clientY / window.innerHeight) * 2 - 1) * 0.6,
      );
      window.clearTimeout(release);
      release = window.setTimeout(() => fx.pointer(0, 0), 650);
    };
    const onScroll = () => {
      const h = el.offsetHeight;
      fx.scroll(Math.min(Math.max(window.scrollY, 0), h));
    };

    onScroll();
    window.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(release);
      io?.disconnect();
      fx.destroy();
      el.style.removeProperty('--hx');
      el.style.removeProperty('--hy');
      el.style.removeProperty('--hs');
    };
  }, [on, targetId]);

  return null;
}
