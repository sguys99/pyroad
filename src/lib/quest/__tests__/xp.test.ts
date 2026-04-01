import { describe, it, expect } from 'vitest';
import {
  calculateXP,
  calculateLevel,
  getLevelTitle,
  getXPProgress,
  LEVEL_THRESHOLDS,
  LEVEL_TITLES,
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

describe('calculateLevel', () => {
  it.each([
    [0, 1],
    [99, 1],
    [100, 2],
    [299, 2],
    [300, 3],
    [599, 3],
    [600, 4],
    [999, 4],
    [1000, 5],
  ])('XP %i → 레벨 %i', (xp, expectedLevel) => {
    expect(calculateLevel(xp)).toBe(expectedLevel);
  });

  it('임계값 초과 XP도 최대 레벨 5', () => {
    expect(calculateLevel(9999)).toBe(5);
  });
});

describe('getLevelTitle', () => {
  it.each([
    [1, '코딩 새싹'],
    [2, '코딩 탐험가'],
    [3, '코딩 모험가'],
    [4, '코딩 용사'],
    [5, '코딩 마법사'],
  ])('레벨 %i → %s', (level, title) => {
    expect(getLevelTitle(level)).toBe(title);
  });

  it('유효하지 않은 레벨은 폴백 반환', () => {
    expect(getLevelTitle(99)).toBe('코딩 새싹');
    expect(getLevelTitle(0)).toBe('코딩 새싹');
  });
});

describe('getXPProgress', () => {
  it('시작점 XP 0', () => {
    const result = getXPProgress(0);
    expect(result).toEqual({
      currentLevel: 1,
      currentLevelXP: 0,
      nextLevelXP: 100,
      progressPercent: 0,
    });
  });

  it('레벨 중간 XP 150', () => {
    const result = getXPProgress(150);
    expect(result).toEqual({
      currentLevel: 2,
      currentLevelXP: 100,
      nextLevelXP: 300,
      progressPercent: 25,
    });
  });

  it('최대 레벨 도달 시 100%', () => {
    const result = getXPProgress(1000);
    expect(result).toEqual({
      currentLevel: 5,
      currentLevelXP: 1000,
      nextLevelXP: null,
      progressPercent: 100,
    });
  });

  it('최대 레벨 초과 XP도 100%', () => {
    const result = getXPProgress(5000);
    expect(result.progressPercent).toBe(100);
    expect(result.nextLevelXP).toBeNull();
  });

  it('레벨 경계 정확히', () => {
    const result = getXPProgress(300);
    expect(result.currentLevel).toBe(3);
    expect(result.currentLevelXP).toBe(300);
    expect(result.nextLevelXP).toBe(600);
    expect(result.progressPercent).toBe(0);
  });
});
