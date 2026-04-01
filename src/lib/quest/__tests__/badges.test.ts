import { describe, it, expect } from 'vitest';
import { getBadgeDefinition, BADGE_DEFINITIONS } from '../badges';
import type { BadgeType } from '../badges';

describe('BADGE_DEFINITIONS', () => {
  it('5개 뱃지가 정의되어 있다', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(5);
  });

  it('모든 type이 유니크하다', () => {
    const types = BADGE_DEFINITIONS.map((b) => b.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('getBadgeDefinition', () => {
  it.each([
    ['first_code', '첫 코드', 'Code'],
    ['hint_master', '힌트 마스터', 'Lightbulb'],
    ['stage_clear', '스테이지 클리어', 'Map'],
    ['streak_3', '3일 연속', 'Flame'],
    ['project_builder', '프로젝트 빌더', 'Trophy'],
  ] as [BadgeType, string, string][])(
    '%s → name: %s, icon: %s',
    (type, name, icon) => {
      const def = getBadgeDefinition(type);
      expect(def.type).toBe(type);
      expect(def.name).toBe(name);
      expect(def.icon).toBe(icon);
    },
  );

  it('존재하지 않는 타입은 첫 번째 정의로 폴백', () => {
    const def = getBadgeDefinition('unknown_type' as BadgeType);
    expect(def.type).toBe('first_code');
  });
});
