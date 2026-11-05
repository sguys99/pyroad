// 시안 A×B 화면 사이에서 이어지는 작은 상태 (HUD 재화·고른 스테이지·고른 퀘스트·소리·토스트)
// 프로토타입 전용: 새로 고치면 처음으로 돌아간다 (보상은 앱에서 서버가 준다, §2.3)
import { useSyncExternalStore } from 'react';
import { SAMPLE_PLAYER } from '../shared/content';
import { DEMO_QUEST, stageStars } from './data';

export interface AbState {
  nickname: string;
  level: number;
  xp: number;
  xpNext: number;
  coins: number;
  stars: number;
  keys: number;
  sound: boolean;
  stage: number;
  quest: { stage: number; order: number };
  /** 월드맵에서 파이뱀이 서 있는 스테이지 */
  pyAt: number;
  toast: { id: number; text: string; tone: 'info' | 'lock' | 'good' } | null;
  /** 보상이 막 들어온 HUD 칸 (팝 연출) */
  bump: { id: number; coins?: number; xp?: number; stars?: number } | null;
}

const totalStars = [1, 2, 3].reduce((n, s) => n + stageStars(s).got, 0);

let state: AbState = {
  nickname: SAMPLE_PLAYER.nickname,
  level: SAMPLE_PLAYER.level,
  xp: SAMPLE_PLAYER.xp,
  xpNext: SAMPLE_PLAYER.xpNext,
  coins: SAMPLE_PLAYER.coins,
  stars: totalStars,
  keys: 2,
  sound: true,
  stage: 3,
  quest: DEMO_QUEST,
  pyAt: 3,
  toast: null,
  bump: null,
};
const listeners = new Set<() => void>();

export function getAb() {
  return state;
}
export function setAb(patch: Partial<AbState> | ((s: AbState) => Partial<AbState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function useAb<T>(pick: (s: AbState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pick(state),
    () => pick(state),
  );
}

let toastTimer = 0;
export function toast(text: string, tone: 'info' | 'lock' | 'good' = 'info') {
  window.clearTimeout(toastTimer);
  setAb({ toast: { id: Date.now(), text, tone } });
  toastTimer = window.setTimeout(() => setAb({ toast: null }), 2600);
}

/** 보상 지급 (프로토타입): HUD 숫자 + 팝 */
export function grant(r: { coins?: number; xp?: number; stars?: number }) {
  setAb((s) => {
    let xp = s.xp + (r.xp ?? 0);
    let level = s.level;
    let xpNext = s.xpNext;
    if (xp >= xpNext) {
      xp -= xpNext;
      level += 1;
      xpNext += 100;
    }
    return { coins: s.coins + (r.coins ?? 0), stars: s.stars + (r.stars ?? 0), xp, level, xpNext, bump: { id: Date.now(), ...r } };
  });
}
