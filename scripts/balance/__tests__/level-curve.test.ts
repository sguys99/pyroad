import { describe, expect, it } from 'vitest';
import {
  SCENARIOS,
  simulate,
  tailDays,
  worldQuests,
  worldXp,
} from '../level-curve';

// F1 목표가 콘텐츠·곡선이 바뀌어도 지켜지는지 (P8-01, docs/balance.md "레벨 곡선"). 1·2월드는 실제 콘텐츠
describe('레벨 곡선 시뮬레이션', () => {
  const [careful, normal, reviewed, hinty] = simulate();

  it('보통 학생: 1월드 Lv 10 · 2월드 Lv 20 · 3월드 ≈ Lv 30 (퀴즈·보스 복습까지 하면 11 · 21)', () => {
    expect(normal.worlds.map((w) => w.level)).toEqual([10, 20, 30]);
    expect(reviewed.worlds.map((w) => w.level)).toEqual([11, 21, 32]);
  });

  it('1월드 끝 레벨은 Lv 8~12 안 (힌트를 많이 써도, 꼼꼼해도 — 보스 포함)', () => {
    expect(hinty.worlds[0].level).toBeGreaterThanOrEqual(8);
    expect(careful.worlds[0].level).toBeLessThanOrEqual(12);
  });

  // world2.md §9 · balance.md 7절: "보통" 2월드 ≈ 5,600 XP (미션 XP 빼고), ±3%
  it('2월드 실제 콘텐츠: 보통 학생 5,600 XP ± 3%', () => {
    const xp = worldXp(worldQuests(2), SCENARIOS[1]);
    expect(xp).toBeGreaterThanOrEqual(5600 * 0.97);
    expect(xp).toBeLessThanOrEqual(5600 * 1.03);
  });

  it('Lv 30 → 50 은 학습 XP 없이는 닿지 않음, 하루 45 XP면 약 1년', () => {
    expect(tailDays(0)).toBeNull();
    expect(tailDays(45)).toBe(346);
  });
});
