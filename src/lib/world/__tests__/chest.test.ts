import { describe, expect, it } from 'vitest';

import { chestCoins, chestGoal, chestState, isPerfectStage } from '../chest';

// 스테이지 보물상자 (P8-06). 목표 식은 reward-rules.json "chest_goal"(rewardRules.test.ts·RW-1)이 SQL 과 대조
describe('chest', () => {
  it('목표 = ceil(코드 퀘스트 × 3 × 0.7), 코드 퀘스트만으로 닿음', () => {
    expect(chestGoal(7)).toBe(15);
    expect(chestGoal(0)).toBe(0);
    for (let n = 1; n <= 20; n++)
      expect(chestGoal(n)).toBeLessThanOrEqual(n * 3);
  });

  it('상자 안 코인: 마지막 스테이지 50, 그 밖 30 (00031 금액표)', () => {
    expect(chestCoins(false)).toBe(30);
    expect(chestCoins(true)).toBe(50);
  });

  const s = (over: Partial<Parameters<typeof chestState>[0]> = {}) =>
    chestState({
      status: 'in_progress',
      stars: 0,
      totalQuestCount: 7,
      completedQuestCount: 5,
      chestOpened: false,
      ...over,
    });

  it('상태: 모으는 중 → 목표에 닿으면 열 수 있음 → 열었음, 잠긴 스테이지·코드 퀘스트 없음은 상자 없음', () => {
    expect(s({ stars: 14 })).toBe('locked');
    expect(s({ stars: 15 })).toBe('ready');
    expect(s({ stars: 21, status: 'completed' })).toBe('ready');
    // 리셋 뒤 별이 줄어도 연 상자는 열린 채 (원장이 남음)
    expect(s({ stars: 0, chestOpened: true })).toBe('opened');
    expect(s({ status: 'locked' })).toBe('none');
    expect(s({ totalQuestCount: 0 })).toBe('none');
  });

  it('별을 채워도 코드 퀘스트를 하나도 안 풀었으면 잠김 (§12-Q65 (c), 마지막 스테이지: 프로젝트 1개 → 목표 3 < 퀴즈 최대 6)', () => {
    expect(chestGoal(1)).toBe(3);
    expect(s({ totalQuestCount: 1, stars: 6, completedQuestCount: 0 })).toBe(
      'locked',
    );
    expect(s({ totalQuestCount: 1, stars: 6, completedQuestCount: 1 })).toBe(
      'ready',
    );
  });

  it('별 100% "완벽" (§12-Q65 (d)): 모든 별(퀴즈 포함)을 채운 열린 스테이지만', () => {
    const p = (
      stars: number,
      maxStars = 30,
      status: 'in_progress' | 'locked' | 'completed' = 'completed',
    ) => isPerfectStage({ stars, maxStars, status });
    expect(p(30)).toBe(true);
    expect(p(29)).toBe(false);
    expect(p(0, 0)).toBe(false);
    expect(p(30, 30, 'locked')).toBe(false);
  });
});
