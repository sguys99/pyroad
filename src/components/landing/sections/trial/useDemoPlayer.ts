'use client';

import { useEffect, useState } from 'react';
import type { DemoFrame } from './demoScript';

/**
 * 데모 대본 재생기 (P4-02). `running`인 동안만 다음 칸으로 넘어가고, 멈추면(화면 밖·탭 숨김) 그 칸에서 기다린다.
 * 다시 돌면 지금 칸의 기다림을 처음부터 센다 (아이 눈에는 "잠깐 멈췄다 이어 침"으로 보임).
 *
 * @returns 지금 칸 번호. 마지막 칸이면 끝
 */
export function useDemoPlayer(
  frames: readonly DemoFrame[] | null,
  running: boolean,
): number {
  const [index, setIndex] = useState(0);

  // 새 대본이면 처음부터
  useEffect(() => setIndex(0), [frames]);

  useEffect(() => {
    if (!frames || !running) return;
    const next = frames[index + 1];
    if (!next) return;
    const id = window.setTimeout(() => setIndex(index + 1), next.ms);
    return () => window.clearTimeout(id);
  }, [frames, running, index]);

  return index;
}

/** 탭이 보이는지 (숨긴 탭에서는 데모를 멈춘다) */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/**
 * 요소가 화면 안에 (거의) 다 들어와 있는지 — 나가면 false (데모 멈춤). 아래 15%는 빼고 본다:
 * 스크롤해 오다 맨 아래에 걸친 순간이 아니라 눈에 들어온 뒤에 치기 시작한다.
 * IntersectionObserver가 없으면 늘 true.
 */
export function useFullyVisible<T extends Element>(): [
  (el: T | null) => void,
  boolean,
] {
  const [el, setEl] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        setVisible(e.isIntersecting && e.intersectionRatio >= 0.98);
      },
      { rootMargin: '0px 0px -15% 0px', threshold: [0, 0.5, 0.98, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  return [setEl, visible];
}
