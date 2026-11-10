import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { getStageStatuses, getWorldStatuses } from '../getStageStatuses';
import type { WorldInfo } from '../worlds';
import { toWorldInfos } from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';
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
  extra: Partial<UserProgress> = {},
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
    ...extra,
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

  it('퀴즈는 보너스: 잠금·클리어·수·이어하기에서 빠지고 별에는 들어감 (§12-Q60)', () => {
    const withQuiz = [
      makeStage(1, [
        { id: 'c1' },
        { id: 'z1', quest_type: 'quiz', quiz_kind: 'multiple_choice' },
        { id: 'c2' },
      ]),
      makeStage(2, [{ id: 'c3' }]),
    ];
    const result = getStageStatuses(withQuiz, [
      makeProgress('c1'),
      makeProgress('c2', 'completed', { best_stars: 2 }),
    ]);
    expect(result[0].status).toBe('completed');
    expect(result[0].completedQuestCount).toBe(2);
    expect(result[0].totalQuestCount).toBe(2);
    expect(result[0].quests.map((q) => q.id)).toEqual(['c1', 'z1', 'c2']);
    expect(result[0].maxStars).toBe(9);
    expect(result[0].stars).toBe(2);
    expect(result[1].status).toBe('in_progress');

    const partial = getStageStatuses(withQuiz, [makeProgress('c1')]);
    expect(partial[0].firstIncompleteQuestId).toBe('c2');
  });
});

// P5-12: 월드 단위 상태
function world(
  order: number,
  slug: string,
  ready = true,
  type: 'open' | 'previous_world_cleared' = order === 1
    ? 'open'
    : 'previous_world_cleared',
): WorldInfo {
  return {
    slug,
    order,
    title: slug,
    theme: slug,
    unlock_rule: { type },
    ready,
    map: null,
  };
}

/** 실제 content/ (1월드 + 준비 중 2·3월드) 에 테스트 월드(test-meadow, order 9)를 더한 월드 목록 */
function worldsWithFixture(): WorldInfo[] {
  const root = resolve(__dirname, '../../../..');
  const dir = mkdtempSync(join(tmpdir(), 'pyroad-status-'));
  cpSync(join(root, 'content'), dir, { recursive: true });
  cpSync(
    join(root, 'e2e/fixtures/content/worlds/test-meadow'),
    join(dir, 'worlds/test-meadow'),
    { recursive: true },
  );
  return toWorldInfos(loadContent(dir));
}

describe('getWorldStatuses', () => {
  const worlds = [world(1, 'one'), world(2, 'two'), world(3, 'soon', false)];
  const stages = [
    makeStage(1, [{ id: 'a1' }, { id: 'a2' }]),
    makeStage(2, [{ id: 'a3' }]),
    makeStage(1, [{ id: 'b1' }], 2),
    makeStage(2, [{ id: 'b2' }], 2),
  ];

  it('처음: 1월드 열림(현재), 2월드 잠김, 스테이지 없는 월드는 준비 중', () => {
    const r = getWorldStatuses(worlds, stages, []);
    expect(r.worlds.map((w) => w.status)).toEqual([
      'open',
      'locked',
      'coming_soon',
    ]);
    expect(r.current?.world.slug).toBe('one');
    expect(r.current?.currentStage?.id).toBe('stage-1');
    expect(r.current?.continueQuestId).toBe('a1');
    expect(r.unlockedStageIds).toEqual(['stage-1']);
    expect(r.worlds[1].unlock).toEqual({
      rule: { type: 'previous_world_cleared' },
      previousWorld: { slug: 'one', title: 'one' },
      previousCleared: false,
    });
    expect(r.worlds[0].unlock.previousWorld).toBeNull();
  });

  it('월드마다 자기 스테이지만, 진행률은 완료 퀘스트/전체', () => {
    const r = getWorldStatuses(worlds, stages, [makeProgress('a1')]);
    expect(r.worlds[0].stages.map((s) => s.id)).toEqual(['stage-1', 'stage-2']);
    expect(r.worlds[1].stages.map((s) => s.id)).toEqual([
      'stage-w2-1',
      'stage-w2-2',
    ]);
    expect(r.worlds[0].completedQuestCount).toBe(1);
    expect(r.worlds[0].totalQuestCount).toBe(3);
    expect(r.worlds[0].completedStageCount).toBe(0);
    expect(r.worlds[2].stages).toEqual([]);
    expect(r.current?.continueQuestId).toBe('a2');
  });

  it('이전 월드 미클리어: 마지막 스테이지 하나 남으면 다음 월드는 잠김', () => {
    const r = getWorldStatuses(worlds, stages, [
      makeProgress('a1'),
      makeProgress('a2'),
    ]);
    expect(r.worlds[0].status).toBe('open');
    expect(r.worlds[0].currentStage?.id).toBe('stage-2');
    expect(r.worlds[1].status).toBe('locked');
    expect(r.worlds[1].stages.every((s) => s.status === 'locked')).toBe(true);
  });

  it('1월드 클리어 → 2월드가 현재 월드, 2월드 첫 스테이지가 새로 열림', () => {
    const before = getWorldStatuses(worlds, stages, [
      makeProgress('a1'),
      makeProgress('a2'),
    ]);
    const after = getWorldStatuses(worlds, stages, [
      makeProgress('a1'),
      makeProgress('a2'),
      makeProgress('a3'),
    ]);
    expect(after.worlds.map((w) => w.status)).toEqual([
      'cleared',
      'open',
      'coming_soon',
    ]);
    expect(after.current?.world.slug).toBe('two');
    expect(after.current?.continueQuestId).toBe('b1');
    expect(after.worlds[0].continueQuestId).toBeNull();
    expect(after.worlds[1].unlock.previousCleared).toBe(true);
    // P5-05: 저장해 둔 목록과의 차이 = 새로 열린 스테이지
    expect(
      after.unlockedStageIds.filter(
        (id) => !before.unlockedStageIds.includes(id),
      ),
    ).toEqual(['stage-w2-1']);
  });

  it('모두 클리어: 마지막으로 열린 월드가 현재 월드, 준비 중 월드는 previousCleared', () => {
    const r = getWorldStatuses(
      worlds,
      stages,
      ['a1', 'a2', 'a3', 'b1', 'b2'].map((id) => makeProgress(id)),
    );
    expect(r.current?.world.slug).toBe('two');
    expect(r.current?.status).toBe('cleared');
    expect(r.current?.currentStage).toBeNull();
    expect(r.worlds[2]).toMatchObject({
      status: 'coming_soon',
      unlock: { previousCleared: true },
    });
  });

  it('별 합계: best_stars 합, 최대는 퀘스트 수 × 3, 진행 중 기록은 완료로 안 셈', () => {
    const r = getWorldStatuses(worlds, stages, [
      makeProgress('a1', 'completed', { best_stars: 3 }),
      makeProgress('a2', 'in_progress', { best_stars: 1 }),
    ]);
    expect(r.worlds[0].stages[0]).toMatchObject({ stars: 4, maxStars: 6 });
    expect(r.worlds[0].stars).toBe(4);
    expect(r.worlds[0].maxStars).toBe(9);
    expect(r.worlds[0].completedQuestCount).toBe(1);
    expect(r.worlds[1]).toMatchObject({ stars: 0, maxStars: 6 });
  });

  it('황금키 완료도 완료로 셈 (별 0), 다음 스테이지가 열림', () => {
    const r = getWorldStatuses(worlds, stages, [
      makeProgress('a1', 'completed', { best_stars: 2 }),
      makeProgress('a2', 'completed', { used_golden_key: true }),
    ]);
    expect(r.worlds[0].stages[0]).toMatchObject({
      status: 'completed',
      stars: 2,
    });
    expect(r.worlds[0].stages[1].status).toBe('in_progress');
  });

  it('best_stars 없는 진행 기록은 별 0', () => {
    const r = getWorldStatuses(worlds, stages, [
      { quest_id: 'a1', status: 'completed' },
    ]);
    expect(r.worlds[0].stars).toBe(0);
  });

  it('스테이지 있는 월드가 없으면 current 없음', () => {
    const r = getWorldStatuses(worlds, [], []);
    expect(r.current).toBeNull();
    expect(r.worlds.every((w) => w.status === 'coming_soon')).toBe(true);
  });

  it('빈 스테이지(퀘스트 0)는 클리어 불가: 다음 월드는 잠김 (SQL 과 같음)', () => {
    const r = getWorldStatuses(
      worlds,
      [makeStage(1, []), makeStage(1, [{ id: 'b1' }], 2)],
      [],
    );
    expect(r.worlds[0].status).toBe('open');
    expect(r.worlds[0].continueQuestId).toBeNull();
    expect(r.worlds[1].status).toBe('locked');
  });

  it('입력 월드 순서와 상관없이 order 순', () => {
    const r = getWorldStatuses([...worlds].reverse(), stages, []);
    expect(r.worlds.map((w) => w.world.slug)).toEqual(['one', 'two', 'soon']);
  });

  describe('실제 월드 + 테스트 월드 픽스처 (test-meadow)', () => {
    const fixtureWorlds = worldsWithFixture();
    const island = [makeStage(1, [{ id: 'i1' }])];
    const meadow = [1, 2, 3].map((order) =>
      makeStage(order, [{ id: `m${order}` }], 9),
    );

    it('준비 중 월드(2·3)를 건너뛰고 1월드 클리어 뒤 test-meadow 가 열림', () => {
      const locked = getWorldStatuses(
        fixtureWorlds,
        [...island, ...meadow],
        [],
      );
      expect(locked.worlds.map((w) => [w.world.slug, w.status])).toEqual([
        ['python-island', 'open'],
        ['code-sea', 'coming_soon'],
        ['maker-city', 'coming_soon'],
        ['test-meadow', 'locked'],
      ]);
      const r = getWorldStatuses(
        fixtureWorlds,
        [...island, ...meadow],
        [makeProgress('i1'), makeProgress('m1')],
      );
      expect(r.current?.world.slug).toBe('test-meadow');
      expect(r.current?.currentStage?.id).toBe('stage-w9-2');
      expect(r.current?.continueQuestId).toBe('m2');
      expect(r.current?.world.map).not.toBeNull();
      expect(r.worlds[3].unlock.previousWorld?.slug).toBe('maker-city');
    });
  });
});
