import type { PybaemState } from '@/components/characters/rig/pybaem';
import type { SfxId } from '@/lib/sound/manifest';

/**
 * 히어로 파이뱀을 누를 때의 반응 (P4-01). 순서대로 돌고(같은 반응이 연달아 나오지 않음),
 * 짧은 시간에 여러 번 누르면 "어지러워" 반응. DOM 없는 순수 로직 → 단위 테스트.
 */
export interface MascotReaction {
  state: PybaemState;
  line: string;
  sfx: SfxId;
  /** 재생 속도(=음높이). 같은 소리도 반응마다 다르게 */
  rate?: number;
  /** 이 시간(ms)이 지나면 대기 상태로 돌아간다 */
  hold: number;
}

/** 처음 말풍선 (서버 렌더) */
export const GREETING = '안녕, 모험가! 나는 파이뱀이야. 나를 콕 눌러 볼래?';

export const REACTIONS: readonly MascotReaction[] = [
  {
    state: 'happy',
    line: '히히, 간지러워! 한 번 더 눌러 볼래?',
    sfx: 'tap',
    rate: 1.12,
    hold: 1900,
  },
  {
    state: 'surprised',
    line: '우와, 깜짝이야! 손이 정말 빠르구나.',
    sfx: 'tap',
    rate: 1.26,
    hold: 1500,
  },
  {
    state: 'teach',
    line: 'print("안녕!") 한 줄이면 나도 말할 수 있어!',
    sfx: 'blip',
    hold: 2600,
  },
  {
    state: 'dance',
    line: '신난다! 같이 춤출래? 하나, 둘, 하나, 둘!',
    sfx: 'star',
    hold: 2600,
  },
  {
    state: 'proud',
    line: '퀘스트를 깨면 경험치가 쑥쑥 올라가!',
    sfx: 'star',
    rate: 1.26,
    hold: 2200,
  },
  {
    state: 'cheer',
    line: '준비됐지? 같이 섬 끝까지 가 보자!',
    sfx: 'tap',
    rate: 1.5,
    hold: 2100,
  },
];

export const DIZZY: MascotReaction = {
  state: 'confused',
  line: '어지러워… 조금만 살살 눌러 줘!',
  sfx: 'blip',
  rate: 0.8,
  hold: 2200,
};

/** 이 간격(ms) 안에 이어서 누르면 연타로 센다 */
export const COMBO_GAP_MS = 450;
/** 연타가 이만큼이면 어지러워 */
export const DIZZY_AT = 6;

export interface TapTracker {
  /** 누른 시각(ms)을 넘기면 이번 반응을 돌려준다 */
  tap(now: number): MascotReaction;
}

export function createTapTracker(): TapTracker {
  let next = 0;
  let combo = 0;
  let last = -Infinity;
  return {
    tap(now) {
      combo = now - last <= COMBO_GAP_MS ? combo + 1 : 1;
      last = now;
      if (combo >= DIZZY_AT) {
        combo = 0;
        return DIZZY;
      }
      const r = REACTIONS[next % REACTIONS.length];
      next += 1;
      return r;
    },
  };
}
