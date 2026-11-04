import { describe, it, expect } from 'vitest';
import {
  decideNewBadges,
  hasThreeDayStreak,
  type BadgeFacts,
} from '../checkBadges';

// 규칙 전체는 rewardRules.test.ts 가 SQL 과 같은 표로 대조합니다. 여기는 개별 규칙의 의도만
const base: BadgeFacts = {
  earned: [],
  completedCount: 2,
  stageCleared: false,
  isFinalStage: false,
  hintsUsed: 2,
  usedGoldenKey: false,
  streak3: false,
};

describe('decideNewBadges', () => {
  it('first_code: 첫 퀘스트 완료 시 반환', () => {
    expect(decideNewBadges({ ...base, completedCount: 1 })).toEqual([
      'first_code',
    ]);
  });

  it('first_code: 이미 보유 시 스킵', () => {
    expect(
      decideNewBadges({ ...base, completedCount: 1, earned: ['first_code'] }),
    ).toEqual([]);
  });

  it('hint_master: 힌트 0회 시 반환', () => {
    expect(decideNewBadges({ ...base, hintsUsed: 0 })).toEqual(['hint_master']);
  });

  it('hint_master: 힌트 1회 시 미반환', () => {
    expect(decideNewBadges({ ...base, hintsUsed: 1 })).toEqual([]);
  });

  it('hint_master: 황금키를 썼으면 힌트 0회여도 미반환 (B11)', () => {
    expect(
      decideNewBadges({ ...base, hintsUsed: 0, usedGoldenKey: true }),
    ).toEqual([]);
  });

  it('stage_clear: 스테이지 전체 완료 시 반환', () => {
    expect(decideNewBadges({ ...base, stageCleared: true })).toEqual([
      'stage_clear',
    ]);
  });

  it('project_builder: is_final 스테이지 퀘스트 시 반환', () => {
    expect(decideNewBadges({ ...base, isFinalStage: true })).toEqual([
      'project_builder',
    ]);
  });

  it('streak_3: 3일 연속 완료 시 반환', () => {
    expect(decideNewBadges({ ...base, streak3: true })).toEqual(['streak_3']);
  });

  it('여러 뱃지는 정해진 순서로', () => {
    expect(
      decideNewBadges({
        ...base,
        completedCount: 1,
        hintsUsed: 0,
        stageCleared: true,
        isFinalStage: true,
        streak3: true,
      }),
    ).toEqual([
      'first_code',
      'hint_master',
      'stage_clear',
      'project_builder',
      'streak_3',
    ]);
  });
});

describe('hasThreeDayStreak', () => {
  it('KST 기준으로 오늘·어제·그제 완료면 true', () => {
    expect(
      hasThreeDayStreak([
        '2026-11-04T03:00:00Z',
        '2026-11-03T03:00:00Z',
        '2026-11-02T03:00:00Z',
      ]),
    ).toBe(true);
  });

  it('완료가 3건 미만이면 false', () => {
    expect(hasThreeDayStreak(['2026-11-04T03:00:00Z'])).toBe(false);
  });

  it('KST 자정(UTC 15시)을 넘긴 완료는 다음 날로 센다', () => {
    // UTC 로는 11-03 하루뿐이지만 KST 로는 11-03 23:30, 11-04 00:30 → 이틀
    expect(
      hasThreeDayStreak([
        '2026-11-03T15:30:00Z',
        '2026-11-03T14:30:00Z',
        '2026-11-02T14:30:00Z',
      ]),
    ).toBe(true);
  });
});
