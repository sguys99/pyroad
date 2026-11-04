import { describe, it, expect } from 'vitest';
import { buildCelebrationEvents } from '../celebrationEvents';
import type { QuestCompleteResponse } from '../rewards';

const base: QuestCompleteResponse = {
  already_completed: false,
  xp_gained: 50,
  total_xp: 150,
  level_before: 1,
  level_after: 1,
  new_badges: [],
  stage_cleared: null,
  next_quest_id: 'q2',
  golden_keys: 3,
  hints_used: 0,
  used_golden_key: false,
};
const stage = { stage_id: 's1', order: 1, title: '시작의 숲', concepts: ['print'] };

describe('buildCelebrationEvents (완료 응답 → 축하 이벤트 목록)', () => {
  it('코드 퀘스트: 스테이지 클리어 → 레벨 업 → 뱃지(받은 순서)', () => {
    expect(
      buildCelebrationEvents(
        { ...base, level_after: 2, stage_cleared: stage, new_badges: ['first_code', 'stage_clear'] },
        { kind: 'code', questTitle: '변수' },
      ),
    ).toEqual([
      { type: 'stage_clear', stage },
      { type: 'level_up', level: 2, title: expect.any(String) },
      { type: 'badge', badge: 'first_code' },
      { type: 'badge', badge: 'stage_clear' },
    ]);
  });

  it('새로 일어난 일이 없으면 빈 목록', () => {
    expect(buildCelebrationEvents(base, { kind: 'code', questTitle: '변수' })).toEqual([]);
  });

  it('프로젝트는 항상 프로젝트 완성부터 (스테이지 클리어는 따로 보여 주지 않음)', () => {
    expect(
      buildCelebrationEvents(
        { ...base, stage_cleared: stage, new_badges: ['first_code'] },
        { kind: 'project', questTitle: '나만의 게임' },
      ),
    ).toEqual([
      { type: 'project_complete', questTitle: '나만의 게임', xpGained: 50 },
      { type: 'badge', badge: 'first_code' },
    ]);
  });

  it('이미 완료한 퀘스트(already_completed)는 빈 목록', () => {
    expect(
      buildCelebrationEvents(
        { ...base, already_completed: true, level_after: 3, new_badges: ['first_code'] },
        { kind: 'project', questTitle: 'x' },
      ),
    ).toEqual([]);
  });
});
