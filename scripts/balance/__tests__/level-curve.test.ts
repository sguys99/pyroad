import { describe, expect, it } from 'vitest';
import { simulate, tailDays, world1Quests } from '../level-curve';

// F1 목표가 콘텐츠·곡선이 바뀌어도 지켜지는지 (P8-01, docs/balance.md "레벨 곡선")
describe('레벨 곡선 시뮬레이션', () => {
  const [careful, normal, reviewed, hinty] = simulate(world1Quests());

  it('보통 학생: 1월드 Lv 10 · 2월드 ≈ Lv 20 · 3월드 ≈ Lv 30 (퀴즈 복습까지 하면 3월드 30)', () => {
    expect(normal.worlds.map((w) => w.level)).toEqual([10, 19, 29]);
    expect(reviewed.worlds.map((w) => w.level)).toEqual([10, 19, 30]);
  });

  it('1월드 끝 레벨은 Lv 8~11 안 (힌트를 많이 써도, 꼼꼼해도)', () => {
    expect(hinty.worlds[0].level).toBeGreaterThanOrEqual(8);
    expect(careful.worlds[0].level).toBeLessThanOrEqual(11);
  });

  it('Lv 30 → 50 은 학습 XP 없이는 닿지 않음, 하루 45 XP면 약 1년', () => {
    expect(tailDays(0)).toBeNull();
    expect(tailDays(45)).toBe(346);
  });
});
