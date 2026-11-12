import { describe, it, expect } from 'vitest';
import {
  calculateXP,
  calculateLevel,
  codeQuestStars,
  getLevelTitle,
  getXPProgress,
  isMilestoneLevel,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
  levelUpCoins,
  MAX_LEVEL,
} from '../xp';

describe('calculateXP', () => {
  it('힌트 0회 시 1.5배 보너스', () => {
    expect(calculateXP(100, 0)).toBe(150);
  });

  it('힌트 1회 시 1.25배 보너스', () => {
    expect(calculateXP(100, 1)).toBe(125);
  });

  it('힌트 2회 시 보너스 없음', () => {
    expect(calculateXP(100, 2)).toBe(100);
  });

  it('힌트 3회 이상도 보너스 없음', () => {
    expect(calculateXP(100, 5)).toBe(100);
  });

  it('반올림 처리', () => {
    expect(calculateXP(33, 1)).toBe(Math.round(33 * 1.25));
    expect(calculateXP(33, 0)).toBe(Math.round(33 * 1.5));
  });

  it('baseXP 0이면 결과도 0', () => {
    expect(calculateXP(0, 0)).toBe(0);
    expect(calculateXP(0, 1)).toBe(0);
  });
});

describe('레벨 곡선 (P8-01)', () => {
  it('Lv 1~50, 문턱은 200 × (N − 1)^1.3 을 10 단위로 반올림, 늘 커짐', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(50);
    LEVEL_THRESHOLDS.forEach((t, i) => {
      expect(t).toBe(Math.round((200 * Math.pow(i, 1.3)) / 10) * 10);
      if (i > 0) expect(t).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
    });
    expect(LEVEL_THRESHOLDS.slice(0, 3)).toEqual([0, 200, 490]);
    expect(LEVEL_THRESHOLDS[MAX_LEVEL - 1]).toBe(31500);
  });

  it('월드 목표(F1): Lv 10·20·30 문턱이 docs/balance.md 시뮬레이션 값', () => {
    expect([10, 20, 30].map((l) => LEVEL_THRESHOLDS[l - 1])).toEqual([
      3480, 9190, 15930,
    ]);
  });
});

describe('calculateLevel', () => {
  it.each([
    [-5, 1],
    [0, 1],
    [199, 1],
    [200, 2],
    [489, 2],
    [490, 3],
    [3480, 10],
    [31499, 49],
    [31500, 50],
    [9_999_999, 50],
  ])('XP %i → 레벨 %i', (xp, expectedLevel) => {
    expect(calculateLevel(xp)).toBe(expectedLevel);
  });
});

describe('getLevelTitle', () => {
  it('50종, 겹치지 않음, 1~5는 예전 칭호 그대로', () => {
    expect(LEVEL_TITLES).toHaveLength(MAX_LEVEL);
    expect(new Set(LEVEL_TITLES).size).toBe(MAX_LEVEL);
    expect([1, 2, 3, 4, 5].map(getLevelTitle)).toEqual([
      '코딩 새싹',
      '코딩 탐험가',
      '코딩 모험가',
      '코딩 용사',
      '코딩 마법사',
    ]);
    expect(getLevelTitle(50)).toBe('전설의 파이썬 마스터');
  });

  it('칭호는 공유 카드·축하 도장에 들어가게 12자 이하', () => {
    for (const t of LEVEL_TITLES) expect(t.length).toBeLessThanOrEqual(12);
  });

  it('범위 밖 레벨은 첫 칭호', () => {
    expect(getLevelTitle(99)).toBe('코딩 새싹');
    expect(getLevelTitle(0)).toBe('코딩 새싹');
  });
});

describe('큰 칭호·레벨 업 코인 (§12-Q62)', () => {
  it('5레벨마다 큰 칭호', () => {
    const big = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).filter(
      isMilestoneLevel,
    );
    expect(big).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  });

  it('레벨 업 코인: 보통 20, 5레벨마다 100, Lv 1·범위 밖 0', () => {
    expect([1, 2, 4, 5, 6, 10, 49, 50, 51].map(levelUpCoins)).toEqual([
      0, 20, 20, 100, 20, 100, 20, 100, 0,
    ]);
    const total = Array.from({ length: MAX_LEVEL }, (_, i) =>
      levelUpCoins(i + 1),
    ).reduce((a, b) => a + b, 0);
    expect(total).toBe(39 * 20 + 10 * 100);
  });
});

describe('getXPProgress', () => {
  it('시작점 XP 0', () => {
    expect(getXPProgress(0)).toEqual({
      currentLevel: 1,
      currentLevelXP: 0,
      nextLevelXP: 200,
      progressPercent: 0,
    });
  });

  it('레벨 중간', () => {
    expect(getXPProgress(345)).toEqual({
      currentLevel: 2,
      currentLevelXP: 200,
      nextLevelXP: 490,
      progressPercent: 50,
    });
  });

  it('레벨 경계 정확히', () => {
    expect(getXPProgress(490)).toMatchObject({
      currentLevel: 3,
      currentLevelXP: 490,
      nextLevelXP: 830,
      progressPercent: 0,
    });
  });

  it('최고 레벨(50)과 그 너머는 100%', () => {
    for (const xp of [31500, 99999]) {
      expect(getXPProgress(xp)).toEqual({
        currentLevel: 50,
        currentLevelXP: 31500,
        nextLevelXP: null,
        progressPercent: 100,
      });
    }
  });
});

describe('codeQuestStars', () => {
  it('힌트 0회 3 · 1회 2 · 2회 이상 1, 황금키는 힌트와 상관없이 1', () => {
    expect([0, 1, 2, 3].map((h) => codeQuestStars(h, false))).toEqual([
      3, 2, 1, 1,
    ]);
    expect(codeQuestStars(0, true)).toBe(1);
  });
});
