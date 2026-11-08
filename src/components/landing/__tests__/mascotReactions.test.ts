import { describe, expect, it } from 'vitest';
import {
  COMBO_GAP_MS,
  DIZZY,
  DIZZY_AT,
  REACTIONS,
  createTapTracker,
} from '../hero/mascotReactions';
import { PYBAEM } from '@/components/characters/rig';

// 히어로 파이뱀 반응 (P4-01): 순서대로 돌고, 연타하면 어지러워

describe('createTapTracker', () => {
  it('천천히 누르면 반응이 순서대로 돌고 같은 반응이 연달아 나오지 않는다', () => {
    const t = createTapTracker();
    const got = Array.from({ length: REACTIONS.length * 2 }, (_, i) =>
      t.tap(i * 1000),
    );
    expect(got.slice(0, REACTIONS.length)).toEqual(REACTIONS);
    for (let i = 1; i < got.length; i++) expect(got[i]).not.toBe(got[i - 1]);
  });

  it(`${COMBO_GAP_MS}ms 안에 ${DIZZY_AT}번 이어 누르면 "어지러워", 그 뒤로는 다시 처음부터 센다`, () => {
    const t = createTapTracker();
    const got = Array.from({ length: DIZZY_AT }, (_, i) => t.tap(i * 200));
    expect(got.at(-1)).toBe(DIZZY);
    expect(got.slice(0, -1)).not.toContain(DIZZY);
    expect(t.tap(DIZZY_AT * 200)).not.toBe(DIZZY);
  });

  it('간격이 벌어지면 연타가 끊긴다', () => {
    const t = createTapTracker();
    let now = 0;
    for (let i = 0; i < DIZZY_AT * 2; i++) {
      now += i % (DIZZY_AT - 1) === 0 ? COMBO_GAP_MS + 1 : 100;
      expect(t.tap(now)).not.toBe(DIZZY);
    }
  });

  it('모든 반응 상태가 파이뱀 리그에 있는 상태다', () => {
    for (const r of [...REACTIONS, DIZZY]) {
      expect(PYBAEM.stateLabel[r.state]).toBeTruthy();
      expect(r.line.length).toBeGreaterThan(0);
      expect(r.hold).toBeGreaterThan(0);
    }
  });
});
