import { describe, expect, it } from 'vitest';
import { SOUND_MANIFEST } from '@/lib/sound/manifest';
import { sfxSchedule } from '../plan';
import { COIN_TICK_MS, COIN_TICKS_MAX, rewardSfx } from '../rewardSfx';

const coinsOf = (cues: ReturnType<typeof rewardSfx>) =>
  cues.filter((c) => c.id === 'coin');

describe('rewardSfx (P6-14)', () => {
  it('별은 하나씩 음을 올린다 (1 → 1.26 → 1.5)', () => {
    expect(
      rewardSfx({ stars: 3, coins: 0, starsAtMs: 450, starGapMs: 150 }),
    ).toEqual([
      { id: 'star', at: 450, rate: 1 },
      { id: 'star', at: 600, rate: 1.26 },
      { id: 'star', at: 750, rate: 1.5 },
    ]);
  });

  it('코인 카운트업: 많아도 최대 6번, 엔진 동시 상한도 6', () => {
    const ticks = coinsOf(
      rewardSfx({ stars: 0, coins: 500, countAtMs: 520, countMs: 2000 }),
    );
    expect(ticks).toHaveLength(COIN_TICKS_MAX);
    expect(COIN_TICKS_MAX).toBe(6);
    expect(SOUND_MANIFEST.sfx.coin.maxVoices).toBe(COIN_TICKS_MAX);
    expect(ticks[0].at).toBe(520);
    expect(ticks.at(-1)!.at).toBe(2520);
  });

  it('코인 카운트업: 간격은 COIN_TICK_MS 이상, 코인 수보다 많이 울리지 않음', () => {
    const ticks = coinsOf(rewardSfx({ stars: 0, coins: 50, countMs: 300 }));
    expect(ticks).toHaveLength(Math.floor(300 / COIN_TICK_MS));
    for (let i = 1; i < ticks.length; i++)
      expect(ticks[i].at - ticks[i - 1].at).toBeGreaterThanOrEqual(
        COIN_TICK_MS,
      );
    expect(
      coinsOf(rewardSfx({ stars: 0, coins: 2, countMs: 700 })),
    ).toHaveLength(2);
  });

  it('움직임 없음: 별은 한꺼번에(화음), 코인은 한 번', () => {
    const cues = rewardSfx({ stars: 2, coins: 30 });
    expect(cues.map((c) => c.at)).toEqual([0, 0, 0]);
    expect(coinsOf(cues)).toHaveLength(1);
  });

  it('보상 카드는 시퀀서가 같은 박자로', () => {
    const step = {
      kind: 'rewards' as const,
      id: 'r',
      stars: { type: 'star', stars: 2, gained: 2 } as never,
      coins: 10,
    };
    const full = sfxSchedule(step, { springs: true, effectDuration: 1 });
    expect(full.filter((c) => c.id === 'star').map((c) => c.at)).toEqual([
      0, 150,
    ]);
    expect(coinsOf(full)[0].at).toBe(650);
    const minimal = sfxSchedule(step, { springs: false, effectDuration: 0.5 });
    expect(minimal.every((c) => c.at === 0)).toBe(true);
  });
});
