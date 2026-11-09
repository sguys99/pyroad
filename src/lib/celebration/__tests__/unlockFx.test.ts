// @vitest-environment jsdom
// 동행 펫이 잠금 해제 이동에서 파이뱀을 따라옴 (P5-08): full 은 PET_LAG 늦게 같은 길, lite 는 같이
import { afterEach, describe, expect, it, vi } from 'vitest';

import { motionBudget } from '@/lib/motion/tier';

import { PET_LAG, playUnlock, type UnlockEls } from '../unlockFx';

function el() {
  const node = document.createElement('div');
  const animate = vi.fn(() => ({ cancel() {}, finish() {} }));
  (node as unknown as { animate: typeof animate }).animate = animate;
  return { node, animate };
}

const walk = [
  { x: 0, y: 0 },
  { x: 50, y: 10 },
  { x: 100, y: 20 },
];

function play(tier: 'full' | 'lite') {
  const walker = el();
  const pet = el();
  const els: UnlockEls = {
    map: null,
    stamp: null,
    splats: [],
    roads: [],
    stitches: [],
    lock: null,
    halves: [],
    shards: [],
    drop: null,
    ink: null,
    inkAt: { x: 0, y: 0, size: 0 },
    walker: walker.node,
    walk,
    pet: pet.node,
    petWalk: walk.map((p) => ({ ...p, x: p.x + 5 })),
    plate: null,
    banner: null,
  };
  const scene = playUnlock(els, motionBudget(tier, false));
  const delay = (m: typeof walker.animate) =>
    (m.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions])[1]
      .delay as number;
  const lastFrame = (m: typeof walker.animate) => {
    const kf = (m.mock.calls[0] as unknown as [Keyframe[]])[0];
    return kf[kf.length - 1].transform;
  };
  scene.cancel();
  return { walker, pet, delay, lastFrame, total: scene.total };
}

afterEach(() => vi.useRealTimers());

describe('playUnlock 동행 펫 (P5-08)', () => {
  it('full: 펫은 PET_LAG 늦게 같은 길을 따라와 연출 안에 도착', () => {
    vi.useFakeTimers();
    const { walker, pet, delay, lastFrame, total } = play('full');
    expect(delay(pet.animate) - delay(walker.animate)).toBe(PET_LAG);
    expect(lastFrame(pet.animate)).toBe('translate(105px, 20px)');
    expect(delay(pet.animate) + 720).toBeLessThan(total);
  });

  it('lite: 펫도 파이뱀과 같이 미끄러짐', () => {
    vi.useFakeTimers();
    const { walker, pet, delay } = play('lite');
    expect(delay(pet.animate)).toBe(delay(walker.animate));
  });
});
