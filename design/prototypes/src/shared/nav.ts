// 해시 화면 이동·뷰포트 프레임 상태 (app.tsx와 PrototypeChrome이 함께 씀)
import { useSyncExternalStore } from 'react';

export type FrameMode = 'full' | 'mobile' | 'tablet';
export const FRAME_SIZE: Record<Exclude<FrameMode, 'full'>, { w: number; h: number }> = {
  mobile: { w: 390, h: 844 },
  tablet: { w: 820, h: 1180 },
};

// ───────────── 해시 화면 (맨 해시 토큰만: #landing, #world, #quest, #motion)

export function readHash(): string {
  return decodeURIComponent(location.hash.replace(/^#/, ''));
}
function subscribeHash(l: () => void) {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
}

/** 현재 해시 토큰. ids에 없으면 fallback */
export function useHashScreen<T extends string>(ids: readonly T[], fallback: T): T {
  const h = useSyncExternalStore(subscribeHash, readHash, () => '');
  return (ids as readonly string[]).includes(h) ? (h as T) : fallback;
}

export function goScreen(id: string) {
  if (readHash() !== id) location.hash = id;
}

// ───────────── 프레임 상태 (검토 도구가 바꿈)

const FRAME_KEY = 'pyroad-proto-frame';
let frame: FrameMode = (() => {
  try {
    const v = localStorage.getItem(FRAME_KEY);
    return v === 'mobile' || v === 'tablet' ? v : 'full';
  } catch {
    return 'full';
  }
})();
const frameListeners = new Set<() => void>();
export function setFrame(f: FrameMode) {
  frame = f;
  try {
    localStorage.setItem(FRAME_KEY, f);
  } catch {
    /* 무시 */
  }
  frameListeners.forEach((l) => l());
}
export function useFrame(): FrameMode {
  return useSyncExternalStore(
    (l) => {
      frameListeners.add(l);
      return () => frameListeners.delete(l);
    },
    () => frame,
    () => frame,
  );
}

/** 프레임 안 스크롤 상자 (프레임 보기에서는 내부 div, 전체 폭에서는 window). 화면 전환 시 맨 위로 올릴 때 쓴다 */
export function getScroller(): HTMLElement | Window {
  return (document.querySelector('.proto-frame > .proto-scroller') as HTMLElement | null) ?? window;
}
export function scrollToTop() {
  getScroller().scrollTo({ top: 0 });
}
