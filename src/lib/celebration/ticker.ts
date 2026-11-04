'use client';

import { useEffect, useRef } from 'react';

/**
 * 축하 연출이 함께 쓰는 requestAnimationFrame 루프 하나 (§2.10: 무거운 이펙트는 rAF 하나로).
 * 구독자가 있을 때만 돌고, 마지막 구독이 풀리면 멈춘다. 콜백이 true를 돌려주면 그 구독은 끝난다.
 */
type Tick = (now: number) => boolean | void;

const subscribers = new Set<Tick>();
let frame: number | null = null;

function loop(now: number) {
  for (const tick of subscribers) {
    if (tick(now) === true) subscribers.delete(tick);
  }
  frame = subscribers.size > 0 ? requestAnimationFrame(loop) : null;
}

export function subscribeTick(tick: Tick): () => void {
  subscribers.add(tick);
  if (frame === null && typeof requestAnimationFrame !== 'undefined') {
    frame = requestAnimationFrame(loop);
  }
  return () => {
    subscribers.delete(tick);
    if (subscribers.size === 0 && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

interface CountUpOptions {
  from: number;
  to: number;
  durationMs: number;
  delayMs?: number;
  /** false면 처음부터 to를 보여 준다 (reduced-motion) */
  animate: boolean;
  format?: (n: number) => string;
  /** 마지막 값에 도착했을 때 (한 번) */
  onDone?: () => void;
}

/**
 * 숫자 카운트업. React 상태 대신 span의 글자만 바꿔서 프레임마다 다시 그리지 않는다.
 * 처음 그릴 때부터 숫자가 보인다(from, reduced면 to) — 글자를 opacity 0으로 숨기지 않음 (§2.10).
 */
export function useCountUp<T extends HTMLElement>({
  from,
  to,
  durationMs,
  delayMs = 0,
  animate,
  format = String,
  onDone,
}: CountUpOptions) {
  const ref = useRef<T>(null);
  const formatRef = useRef(format);
  formatRef.current = format;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const initial = format(animate ? from : to);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const write = (n: number) => {
      const text = formatRef.current(n);
      if (node.textContent !== text) node.textContent = text;
    };
    if (!animate || from === to) {
      write(to);
      onDoneRef.current?.();
      return;
    }
    let start: number | null = null;
    return subscribeTick((now) => {
      start ??= now + delayMs;
      const t = Math.min(Math.max((now - start) / durationMs, 0), 1);
      // 버림: 마지막 값은 끝나는 순간에만 (레벨 1→2는 끝에서 한 번 바뀌며 pop)
      write(t >= 1 ? to : from + Math.trunc((to - from) * easeOutCubic(t)));
      if (t >= 1) {
        onDoneRef.current?.();
        return true;
      }
    });
  }, [from, to, durationMs, delayMs, animate]);

  return { ref, initial };
}
