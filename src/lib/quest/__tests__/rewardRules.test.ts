import { describe, it, expect } from 'vitest';
import rules from '../../../../supabase/tests/fixtures/reward-rules.json';
import { calculateXP, calculateLevel, codeQuestStars } from '../xp';
import { decideNewBadges, hasThreeDayStreak } from '../checkBadges';
import { coinReward, type CoinRewardKind } from '../coins';
import { chestGoal } from '@/lib/world/chest';
import { currentStreak } from '@/lib/time/streak';

// 보상 규칙 대조 (P1-03, Q25): 같은 표를 SQL 쪽(00006 의 quest_xp·level_for_xp·has_three_day_streak,
// 00019 의 decide_new_badges, 00031 의 coin_reward, 00032 의 code_quest_stars, 00033 의 stage_chest_goal)은 npm run test:rls 의 RW-1 이 확인합니다. 둘 다 통과하면 TS 와 SQL 이 같은 규칙입니다.
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

  // 연속 학습일 (P8-08, SQL 00035 current_streak): 날짜 키를 그날 KST 정오 시각으로, 오늘도 KST 정오에 봄
  it.each(rules.streak_days)(
    '연속 학습일: $name → $streak',
    ({ days, today, streak, learned_today }) => {
      expect(
        currentStreak(
          days.map((d) => `${d}T12:00:00+09:00`),
          `${today}T12:00:00+09:00`,
        ),
      ).toEqual({ days: streak, today: learned_today });
    },
  );

  it.each(rules.coins)('코인: $kind $n → $coins', ({ kind, n, coins }) => {
    expect(coinReward(kind as CoinRewardKind, n)).toBe(coins);
  });

  it.each(rules.stars)(
    '별: 힌트 $hints, 황금키 $golden → $stars',
    ({ hints, golden, stars }) => {
      expect(codeQuestStars(hints, golden)).toBe(stars);
    },
  );

  it.each(rules.chest_goal)(
    '보물상자 목표: 코드 퀘스트 $code_quests → 별 $goal',
    ({ code_quests, goal }) => {
      expect(chestGoal(code_quests)).toBe(goal);
    },
  );

  it.each(rules.badges)('뱃지: $name', ({ facts, badges }) => {
    expect(decideNewBadges(facts)).toEqual(badges);
  });
});
