import { describe, expect, it } from 'vitest';

import { getStageStatuses, getWorldStatuses } from '../getStageStatuses';
import {
  attachSkillChecks,
  skillCheckPassScore,
  skillPassWorldIds,
  type SkillCheckAttemptRow,
} from '../skillCheck';
import { skillCheckOfferOf } from '../worldBook';
import type { WorldInfo } from '../worlds';

// 실력 확인 퀴즈 (P10-03): 해제 규칙의 TS 사본(getStageStatuses)이 SQL is_stage_unlocked(00052, RLS SKC-2)와 같은지

const stage = (world: number, order: number, questId: string) => ({
  id: `s${world}-${order}`,
  world_id: `world-${world}`,
  world: { order: world },
  order,
  title: `스테이지 ${order}`,
  theme_name: 't',
  description: '',
  is_final: false,
  created_at: '2026-01-01',
  quests: [{ id: questId, order: 1, quest_type: 'code' }],
});
const done = (quest_id: string) => ({ quest_id, status: 'completed' });
const info = (order: number, slug: string, skill = false): WorldInfo => ({
  slug,
  order,
  title: slug === 'island' ? '파이썬 섬' : '코드 바다',
  theme: slug,
  unlock_rule: { type: order === 1 ? 'open' : 'previous_world_cleared' },
  ready: true,
  map: null,
  ...(skill && { skill_check: true as const }),
});

const worlds = [info(1, 'island'), info(2, 'sea', true)];
const stages = [
  stage(1, 1, 'a1'),
  stage(1, 2, 'a2'),
  stage(2, 1, 'b1'),
  stage(2, 2, 'b2'),
];
const passed = new Set(['world-2']);

describe('해제 규칙: 앞 월드 클리어 또는 실력 확인 퀴즈 합격', () => {
  it('합격 전에는 1월드 마지막 스테이지를 깨야 2월드가 열림', () => {
    expect(
      getWorldStatuses(worlds, stages, [done('a1')]).worlds[1].status,
    ).toBe('locked');
    expect(
      getWorldStatuses(worlds, stages, [done('a1'), done('a2')]).worlds[1]
        .status,
    ).toBe('open');
  });

  it('합격하면 2월드 첫 스테이지만 열리고 1월드 진행은 그대로', () => {
    const r = getWorldStatuses(worlds, stages, [done('a1')], passed);
    expect(r.worlds[0].stages.map((s) => s.status)).toEqual([
      'completed',
      'in_progress',
    ]);
    expect(r.worlds[1].stages.map((s) => s.status)).toEqual([
      'in_progress',
      'locked',
    ]);
    expect(r.unlockedStageIds).toEqual(['s1-1', 's1-2', 's2-1']);
  });

  it('건너뛴 학생의 지금 월드(/world)는 새 월드', () => {
    const r = getWorldStatuses(worlds, stages, [], passed);
    expect(r.current?.world.slug).toBe('sea');
    expect(r.current?.continueQuestId).toBe('b1');
  });

  it('2월드 첫 스테이지를 깨면 둘째가 평소처럼 열림, 다른 월드 합격은 무관', () => {
    const r = getStageStatuses(stages, [done('b1')], passed);
    expect(r.find((s) => s.id === 's2-2')?.status).toBe('in_progress');
    expect(
      getWorldStatuses(worlds, stages, [], new Set(['world-9'])).worlds[1]
        .status,
    ).toBe('locked');
  });
});

describe('진입점 상태 (책장·잠긴 표지)', () => {
  const row = (
    world_id: string,
    attempt_on: string,
    extra: Partial<SkillCheckAttemptRow> = {},
  ): SkillCheckAttemptRow => ({
    user_id: 'u1',
    world_id,
    attempt_on,
    passed: false,
    submitted_at: '2026-11-14T01:00:00Z',
    ...extra,
  });

  it('합격 기준은 80% (10문제면 8), 합격 행만 해제', () => {
    expect(skillCheckPassScore(10)).toBe(8);
    expect([
      ...skillPassWorldIds([
        row('world-2', '2026-11-13'),
        row('world-3', '2026-11-14', { passed: true }),
      ]),
    ]).toEqual(['world-3']);
  });

  it('오늘 낸 기록이 있으면 triedToday, 어제 것·시작만 한 것은 아님', () => {
    const at = (rows: SkillCheckAttemptRow[]) => {
      const r = getWorldStatuses(worlds, stages, []);
      attachSkillChecks(r.worlds, rows, '2026-11-14');
      return r.worlds;
    };
    expect(at([])[1].skillCheck).toEqual({ triedToday: false });
    expect(at([row('world-2', '2026-11-14')])[1].skillCheck).toEqual({
      triedToday: true,
    });
    expect(at([row('world-2', '2026-11-13')])[1].skillCheck).toEqual({
      triedToday: false,
    });
    expect(
      at([row('world-2', '2026-11-14', { submitted_at: null })])[1].skillCheck,
    ).toEqual({ triedToday: false });
    // 퀴즈가 없는 월드(1월드)에는 붙지 않음
    expect(at([])[0].skillCheck).toBeUndefined();
  });

  it('열린 월드에는 진입점이 없고, 잠긴 월드는 앞 월드 이름과 함께', () => {
    const locked = getWorldStatuses(worlds, stages, []).worlds;
    attachSkillChecks(locked, [], '2026-11-14');
    expect(skillCheckOfferOf(locked, 1)).toEqual({
      slug: 'sea',
      prevTitle: '파이썬 섬',
      triedToday: false,
    });
    const open = getWorldStatuses(worlds, stages, [], passed).worlds;
    attachSkillChecks(open, [], '2026-11-14');
    expect(skillCheckOfferOf(open, 1)).toBeNull();
  });
});
