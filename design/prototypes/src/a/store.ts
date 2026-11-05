// 시안 A 프로토타입 상태 (가짜 학생 진행·재화·선택). 화면 사이에서 공유한다.
// 공개 정보는 닉네임 + 캐릭터만 (§2.6). 저장하지 않는다 (새로고침하면 처음부터).
import { useSyncExternalStore } from 'react';
import { SAMPLE_PLAYER, STAGES } from '../shared/content';

export type StageStatus = 'done' | 'current' | 'locked';

/** 스테이지별 퀘스트 별 (null = 잠김, 0 = 열렸지만 아직 안 깸). 1·2 완료, 3 진행 중, 4~7 잠김 */
const QUEST_STARS: (number | null)[][] = STAGES.map((s, i) => {
  const n = s.quests.length;
  if (i === 0) return [3, 3, 3, 2, 3, 3, 3].slice(0, n);
  if (i === 1) return [3, 3, 2, 3, 1, 3, 2].slice(0, n);
  if (i === 2) return Array.from({ length: n }, (_, k) => (k < 3 ? [3, 2, 2][k] : k === 3 ? 0 : null));
  return Array.from({ length: n }, () => null);
});

export function stageStatus(i: number): StageStatus {
  return i < 2 ? 'done' : i === 2 ? 'current' : 'locked';
}
export function questStars(stageIdx: number): (number | null)[] {
  return QUEST_STARS[stageIdx] ?? [];
}
export function stageStars(i: number): { got: number; max: number } {
  const q = questStars(i);
  return { got: q.reduce<number>((a, b) => a + (b ?? 0), 0), max: q.length * 3 };
}

export const CURRENT_STAGE = 2;

/** 가짜 실행으로 채점할 수 있는 퀘스트 (프로토타입). 나머지는 대표 퀘스트 2-1을 보여 준다 */
export const PLAYABLE: Record<string, { expected: string; wrong: string; answer: string }> = {
  '1-1': { expected: '안녕하세요!', wrong: 'print("안녕하세요!)', answer: 'print("안녕하세요!")' },
  '1-2': { expected: '나는 파이썬 모험가!\n반가워!', wrong: 'print("나는 파이썬 모험가!")\nprint(반가워!)', answer: 'print("나는 파이썬 모험가!")\nprint("반가워!")' },
  '2-1': { expected: '파이뱀', wrong: '# 변수에 이름을 넣어보세요!\nname = 파이뱀\nprint(name)', answer: '# 변수에 이름을 넣어보세요!\nname = "파이뱀"\nprint(name)' },
  '2-2': {
    expected: '10\n안녕',
    wrong: '# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = 10\ngreeting = \nprint(number)\nprint(greeting)',
    answer: '# 숫자와 글자를 각각 변수에 넣어보세요!\nnumber = 10\ngreeting = "안녕"\nprint(number)\nprint(greeting)',
  },
  '2-3': {
    expected: '파랑',
    wrong: '# 색깔을 바꿔보세요!\ncolor = "빨강"\n# 아래에서 color를 "파랑"으로 바꿔보세요!\n\nprint(colour)',
    answer: '# 색깔을 바꿔보세요!\ncolor = "빨강"\n# 아래에서 color를 "파랑"으로 바꿔보세요!\ncolor = "파랑"\nprint(color)',
  },
};

interface State {
  coins: number;
  stars: number;
  xp: number;
  xpNext: number;
  level: number;
  keys: number;
  sound: boolean;
  /** 지도에서 고른 스테이지 (0부터) */
  stage: number;
  /** 고른 퀘스트 "스테이지-퀘스트" */
  quest: string;
  quiz: boolean;
}

const totalStars = STAGES.reduce((a, _s, i) => a + stageStars(i).got, 0);

let state: State = {
  coins: SAMPLE_PLAYER.coins,
  stars: totalStars,
  xp: SAMPLE_PLAYER.xp,
  xpNext: SAMPLE_PLAYER.xpNext,
  level: SAMPLE_PLAYER.level,
  keys: 2,
  sound: true,
  stage: 1,
  quest: '2-1',
  quiz: false,
};
const listeners = new Set<() => void>();

export function getStore() {
  return state;
}
export function setStore(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function useStore(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
