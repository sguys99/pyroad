import { describe, it, expect } from 'vitest';
import { getStageStatuses } from '../getStageStatuses';
import type { Quest, Stage, UserProgress } from '@/lib/types/database';

function makeStage(
  order: number,
  quests: Partial<Quest>[] = [],
  world = 1,
): Stage & { quests: Quest[]; world: { order: number } } {
  const id = world === 1 ? `stage-${order}` : `stage-w${world}-${order}`;
  return {
    id,
    world_id: `world-${world}`,
    world: { order: world },
    order,
    title: `스테이지 ${order}`,
    theme_name: `theme-${order}`,
    description: `설명 ${order}`,
    is_final: false,
    created_at: '2026-01-01',
    quests: quests.map((q, i) => ({
      id: q.id ?? `quest-${id}-${i + 1}`,
      stage_id: id,
      order: q.order ?? i + 1,
      title: `퀘스트 ${order}-${i + 1}`,
      concept: '',
      quest_type: 'code' as const,
      quiz_kind: null,
      is_mobile_friendly: false,
      prompt_skeleton: {} as Quest['prompt_skeleton'],
      validation_type: 'output_match' as const,
      expected_output: '',
      xp_reward: 50,
      created_at: '2026-01-01',
      ...q,
    })),
  };
}

function makeProgress(
  questId: string,
  status: 'completed' | 'in_progress' = 'completed',
): UserProgress {
  return {
    id: `progress-${questId}`,
    user_id: 'user-1',
    quest_id: questId,
    status,
    hints_used: 0,
    code_submitted: '',
    completed_at: status === 'completed' ? '2026-01-01' : null,
    created_at: '2026-01-01',
    current_step: null,
    step_submissions: null,
    used_golden_key: false,
    earned_xp: 0,
    stars: 0,
    best_stars: 0,
    attempts: 0,
    stars_judged_on: null,
  };
}

describe('getStageStatuses', () => {
  const stages = [
    makeStage(1, [{ id: 'q1-1' }, { id: 'q1-2' }]),
    makeStage(2, [{ id: 'q2-1' }, { id: 'q2-2' }, { id: 'q2-3' }]),
    makeStage(3, [{ id: 'q3-1' }]),
  ];

  it('빈 progress: 스테이지1=in_progress, 나머지=locked', () => {
    const result = getStageStatuses(stages, []);
    expect(result[0].status).toBe('in_progress');
    expect(result[1].status).toBe('locked');
    expect(result[2].status).toBe('locked');
  });

  it('스테이지1 부분 완료: 스테이지1=in_progress, 스테이지2=locked', () => {
    const progress = [makeProgress('q1-1')];
    const result = getStageStatuses(stages, progress);
    expect(result[0].status).toBe('in_progress');
    expect(result[1].status).toBe('locked');
  });

  it('스테이지1 전체 완료: 스테이지1=completed, 스테이지2=in_progress', () => {
    const progress = [makeProgress('q1-1'), makeProgress('q1-2')];
    const result = getStageStatuses(stages, progress);
    expect(result[0].status).toBe('completed');
    expect(result[1].status).toBe('in_progress');
    expect(result[2].status).toBe('locked');
  });

  it('연쇄 해제: 스테이지1,2 완료 → 스테이지3=in_progress', () => {
    const progress = [
      makeProgress('q1-1'),
      makeProgress('q1-2'),
      makeProgress('q2-1'),
      makeProgress('q2-2'),
      makeProgress('q2-3'),
    ];
    const result = getStageStatuses(stages, progress);
    expect(result[0].status).toBe('completed');
    expect(result[1].status).toBe('completed');
    expect(result[2].status).toBe('in_progress');
  });

  it('전체 완료', () => {
    const progress = [
      makeProgress('q1-1'),
      makeProgress('q1-2'),
      makeProgress('q2-1'),
      makeProgress('q2-2'),
      makeProgress('q2-3'),
      makeProgress('q3-1'),
    ];
    const result = getStageStatuses(stages, progress);
    result.forEach((s) => expect(s.status).toBe('completed'));
  });

  it('입력 순서가 뒤죽박죽이어도 order 기준 정렬', () => {
    const shuffled = [stages[2], stages[0], stages[1]];
    const result = getStageStatuses(shuffled, []);
    expect(result[0].id).toBe('stage-1');
    expect(result[1].id).toBe('stage-2');
    expect(result[2].id).toBe('stage-3');
  });

  // P1-08: stages."order" 는 월드 안에서만 유일
  describe('월드가 여럿일 때 (월드 order, 스테이지 order)', () => {
    const w1 = [makeStage(1, [{ id: 'a1' }]), makeStage(2, [{ id: 'a2' }])];
    const w2 = [
      makeStage(1, [{ id: 'b1' }], 2),
      makeStage(2, [{ id: 'b2' }], 2),
    ];

    it('월드 순서가 먼저, 그 안에서 스테이지 order', () => {
      const result = getStageStatuses([w2[1], w1[1], w2[0], w1[0]], []);
      expect(result.map((s) => s.id)).toEqual([
        'stage-1',
        'stage-2',
        'stage-w2-1',
        'stage-w2-2',
      ]);
    });

    it('2월드의 order 1 스테이지는 1월드 마지막 스테이지를 깨야 열림', () => {
      const all = [...w1, ...w2];
      expect(getStageStatuses(all, [makeProgress('a1')])[2].status).toBe(
        'locked',
      );
      const cleared = getStageStatuses(all, [
        makeProgress('a1'),
        makeProgress('a2'),
      ]);
      expect(cleared[2].status).toBe('in_progress');
      expect(cleared[3].status).toBe('locked');
    });

    it('world 정보가 없으면 order 만으로 (같은 월드로 봄)', () => {
      const bare = [
        makeStage(2, [{ id: 'x2' }]),
        makeStage(1, [{ id: 'x1' }]),
      ].map((stage) => ({ ...stage, world: undefined }));
      expect(getStageStatuses(bare, []).map((s) => s.order)).toEqual([1, 2]);
    });
  });

  it('firstIncompleteQuestId: 첫 미완료 퀘스트 ID 반환', () => {
    const progress = [makeProgress('q1-1')];
    const result = getStageStatuses(stages, progress);
    expect(result[0].firstIncompleteQuestId).toBe('q1-2');
  });

  it('빈 quests 배열인 스테이지는 completed 불가', () => {
    const emptyStage = [makeStage(1, [])];
    const result = getStageStatuses(emptyStage, []);
    expect(result[0].status).toBe('in_progress');
    expect(result[0].completedQuestCount).toBe(0);
    expect(result[0].totalQuestCount).toBe(0);
  });

  it('completedQuestCount / totalQuestCount 수치 정확', () => {
    const progress = [makeProgress('q2-1'), makeProgress('q2-3')];
    const result = getStageStatuses(
      [makeStage(1, [{ id: 'q1-1' }, { id: 'q1-2' }]), stages[1]],
      [makeProgress('q1-1'), makeProgress('q1-2'), ...progress],
    );
    const stage2 = result[1];
    expect(stage2.completedQuestCount).toBe(2);
    expect(stage2.totalQuestCount).toBe(3);
  });
});
