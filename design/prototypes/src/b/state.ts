// 시안 B 화면 사이 공유 상태 (고른 스테이지·퀘스트, 재화, 소리, 토스트). 해시 화면 이동과 따로 산다.
import { useSyncExternalStore } from 'react';
import { SAMPLE_PLAYER } from '../shared/content';
import { CURRENT_STAGE, TOTAL_STARS } from './data';

export interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'good' | 'warn';
}
export interface BState {
  stage: number;
  questId: string;
  coins: number;
  xp: number;
  xpNext: number;
  level: number;
  stars: number;
  keys: number;
  muted: boolean;
  toasts: Toast[];
  /** 보상·레벨업 연출 중: 뒤에 있는 파이뱀 리그를 쉬게 한다 (축하 예산) */
  celebrating: boolean;
}

let state: BState = {
  stage: CURRENT_STAGE,
  questId: '2-1',
  coins: SAMPLE_PLAYER.coins,
  // 첫 성공(+50)에서 레벨업이 이어지게 다음 레벨 바로 앞 (P2-05 데모)
  xp: 470,
  xpNext: SAMPLE_PLAYER.xpNext,
  level: SAMPLE_PLAYER.level,
  stars: TOTAL_STARS,
  keys: 2,
  muted: false,
  toasts: [],
  celebrating: false,
};
const ls = new Set<() => void>();

export function getB() {
  return state;
}
export function setB(patch: Partial<BState> | ((s: BState) => Partial<BState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  ls.forEach((l) => l());
}
export function useB<T>(pick: (s: BState) => T): T {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => pick(state),
    () => pick(state),
  );
}

let toastId = 1;
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const t = { id: toastId++, text, tone };
  setB((s) => ({ toasts: [...s.toasts.slice(-2), t] }));
  setTimeout(() => setB((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), 2600);
}
