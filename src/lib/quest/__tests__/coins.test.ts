import { describe, expect, it } from 'vitest';
import { COIN_RULES, coinReward, levelUpCoinsTotal } from '../coins';

// 금액 하나하나는 reward-rules.json "coins" 행(rewardRules.test.ts ↔ SQL RW-1)이 본다. 여기는 모양만
describe('coins (P8-04 금액표)', () => {
  it('§3 초기 밸런스안 범위 안 (미션 10~20 · 출석 5~30 · 상자 30~50 · 업적 10~100)', () => {
    const inRange = (xs: readonly number[], lo: number, hi: number) =>
      xs.every((x) => x >= lo && x <= hi);
    expect(COIN_RULES.quest).toBe(10);
    expect(COIN_RULES.project).toBe(4 * COIN_RULES.quest); // §12-Q65 (a)
    expect(COIN_RULES.star).toBe(5);
    expect(inRange(COIN_RULES.mission, 10, 20)).toBe(true);
    expect(inRange(COIN_RULES.attendance, 5, 30)).toBe(true);
    expect(COIN_RULES.attendance).toHaveLength(7);
    expect(inRange(COIN_RULES.chest, 30, 50)).toBe(true);
    expect(inRange(COIN_RULES.achievement, 10, 100)).toBe(true);
  });

  it('표 종류는 n 없이·소수·범위 밖이면 0', () => {
    expect(coinReward('mission')).toBe(0);
    expect(coinReward('attendance', 1.5)).toBe(0);
    expect(coinReward('chest', 0)).toBe(0);
    expect(coinReward('level_up')).toBe(0);
  });

  it('여러 레벨을 한 번에 넘은 코인 합 (이미 받은 레벨 0 포함, 응답이 없으면 0)', () => {
    expect(
      levelUpCoinsTotal([
        { level: 4, coins: 20 },
        { level: 5, coins: 100 },
        { level: 6, coins: 0 },
      ]),
    ).toBe(120);
    expect(levelUpCoinsTotal(undefined)).toBe(0);
  });
});
