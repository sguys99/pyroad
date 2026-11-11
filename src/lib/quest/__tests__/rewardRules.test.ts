import { describe, it, expect } from 'vitest';
import rules from '../../../../supabase/tests/fixtures/reward-rules.json';
import { calculateXP, calculateLevel, codeQuestStars } from '../xp';
import { decideNewBadges, hasThreeDayStreak } from '../checkBadges';
import { coinReward, type CoinRewardKind } from '../coins';

// 보상 규칙 대조 (P1-03, Q25): 같은 표를 SQL 쪽(00006 의 quest_xp·level_for_xp·has_three_day_streak,
// 00019 의 decide_new_badges, 00031 의 coin_reward, 00032 의 code_quest_stars)은 npm run test:rls 의 RW-1 이 확인합니다. 둘 다 통과하면 TS 와 SQL 이 같은 규칙입니다.
describe('reward-rules.json (TS ↔ SQL 대조표)', () => {
  it.each(rules.xp)(
    'XP: base $base, 힌트 $hints, 황금키 $golden → $xp',
    ({ base, hints, golden, xp }) => {
      expect(calculateXP(base, hints, golden)).toBe(xp);
    },
  );

  it.each(rules.level)('레벨: $total XP → $level', ({ total, level }) => {
    expect(calculateLevel(total)).toBe(level);
  });

  it.each(rules.streak)('3일 연속: $name', ({ completed_at, streak }) => {
    expect(hasThreeDayStreak(completed_at)).toBe(streak);
  });

  it.each(rules.coins)('코인: $kind $n → $coins', ({ kind, n, coins }) => {
    expect(coinReward(kind as CoinRewardKind, n)).toBe(coins);
  });

  it.each(rules.stars)(
    '별: 힌트 $hints, 황금키 $golden → $stars',
    ({ hints, golden, stars }) => {
      expect(codeQuestStars(hints, golden)).toBe(stars);
    },
  );

  it.each(rules.badges)('뱃지: $name', ({ facts, badges }) => {
    expect(decideNewBadges(facts)).toEqual(badges);
  });
});
