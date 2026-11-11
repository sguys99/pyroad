import { describe, it, expect } from 'vitest';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import {
  autoAdvanceMs,
  introMs,
  planCelebrations,
  stepSummary,
  sfxSchedule,
  STEP_SPECS,
  type CelebrationStep,
} from '../plan';
import { CONFETTI_PRESETS, LEVEL_POP_BURST } from '../confettiPresets';

const stage = {
  stage_id: 's1',
  order: 1,
  title: '시작의 숲',
  concepts: ['print'],
};
const kinds = (steps: CelebrationStep[]) => steps.map((s) => s.kind);

describe('planCelebrations (축하 단계 계획, P1-10)', () => {
  it('우선순위: 퀘스트 결과 → 레벨 업 → 뱃지 → 별·코인, 스테이지를 끝낸 카드는 맨 뒤(지도로). 받은 순서가 달라도', () => {
    const events: CelebrationEvent[] = [
      { type: 'coin', amount: 10 },
      { type: 'badge', badge: 'first_code' },
      { type: 'level_up', level: 2, fromLevel: 1, title: '새싹' },
      { type: 'star', stars: 3, gained: 3 },
      { type: 'stage_clear', stage },
    ];
    expect(kinds(planCelebrations(events))).toEqual([
      'level_up',
      'badges',
      'rewards',
      'stage_clear',
    ]);
  });

  it('뱃지는 여러 개여도 한 단계로 묶는다 (받은 순서, 중복 제거)', () => {
    const steps = planCelebrations([
      { type: 'badge', badge: 'first_code' },
      { type: 'level_up', level: 2, fromLevel: 1, title: '새싹' },
      { type: 'badge', badge: 'stage_clear' },
      { type: 'badge', badge: 'first_code' },
    ]);
    expect(steps.at(-1)).toMatchObject({
      kind: 'badges',
      badges: ['first_code', 'stage_clear'],
    });
    expect(steps).toHaveLength(2);
  });

  it('프로젝트 완성 + 스테이지 클리어가 따로 와도 프로젝트 카드 하나에 담는다', () => {
    const steps = planCelebrations([
      { type: 'stage_clear', stage },
      {
        type: 'project_complete',
        questTitle: '게임',
        xpGained: 100,
        stage: null,
      },
    ]);
    expect(steps).toEqual([
      expect.objectContaining({ kind: 'project_complete', stage }),
    ]);
  });

  it('황금키 확인이 가장 먼저, 스테이지 클리어는 맨 뒤', () => {
    expect(
      kinds(
        planCelebrations([
          { type: 'stage_clear', stage },
          { type: 'golden_key', kind: 'code', questTitle: '변수' },
          { type: 'badge', badge: 'first_code' },
        ]),
      ),
    ).toEqual(['golden_key', 'badges', 'stage_clear']);
  });

  it('스테이지 마지막 프로젝트도 맨 뒤, 스테이지가 없는 프로젝트는 그대로 앞', () => {
    const project = (s: typeof stage | null) =>
      ({
        type: 'project_complete',
        questTitle: '게임',
        xpGained: 100,
        stage: s,
      }) as const;
    const badge = { type: 'badge', badge: 'first_code' } as const;
    expect(kinds(planCelebrations([project(stage), badge]))).toEqual([
      'badges',
      'project_complete',
    ]);
    expect(kinds(planCelebrations([project(null), badge]))).toEqual([
      'project_complete',
      'badges',
    ]);
  });

  it('보물상자(P8-06, SHOW_CHEST)는 상자 카드 하나 — 효과음 chest', () => {
    const steps = planCelebrations([
      {
        type: 'chest',
        stageTitle: '시작의 숲',
        goal: 15,
        contents: { coins: 30, goldenKeys: 0 },
      },
    ]);
    expect(kinds(steps)).toEqual(['chest']);
    expect(STEP_SPECS.chest.sfx).toBe('chest');
  });

  it('등장 연출은 모두 짧다 (§12-Q28: 레벨 업 최대 3.6초 안)', () => {
    const steps = planCelebrations([
      { type: 'level_up', level: 9, fromLevel: 1, title: '마법사' },
      { type: 'stage_clear', stage },
      { type: 'golden_key', kind: 'code', questTitle: '변수' },
      ...(['first_code', 'hint_master', 'stage_clear'] as const).map(
        (badge) => ({ type: 'badge' as const, badge }),
      ),
    ]);
    for (const s of steps) expect(introMs(s)).toBeLessThanOrEqual(3600);
    expect(introMs(steps.find((s) => s.kind === 'level_up')!)).toBe(1900);
  });

  it('aria-live 한 줄: 받은 것을 글자로', () => {
    const [lv, b] = planCelebrations([
      { type: 'level_up', level: 3, fromLevel: 2, title: '새싹' },
      { type: 'badge', badge: 'first_code' },
    ]);
    expect(stepSummary(lv)).toBe('레벨 업! 레벨 3 달성, 새 칭호 새싹.');
    expect(stepSummary(b)).toMatch(/^새 뱃지: /);
  });

  it('별·코인은 "보상" 한 단계: 코인은 더하고 별은 가장 높은 것', () => {
    const [step] = planCelebrations([
      { type: 'coin', amount: 10 },
      { type: 'star', stars: 2, gained: 2 },
      { type: 'coin', amount: 5 },
      { type: 'star', stars: 3, gained: 1 },
    ]);
    expect(step).toMatchObject({
      kind: 'rewards',
      coins: 15,
      stars: { stars: 3 },
    });
  });

  it('단계 id는 묶음 번호로 겹치지 않는다', () => {
    const a = planCelebrations([{ type: 'badge', badge: 'first_code' }], 0);
    const b = planCelebrations([{ type: 'badge', badge: 'first_code' }], 1);
    expect(a[0].id).not.toBe(b[0].id);
  });

  it('빈 목록이면 빈 계획', () => {
    expect(planCelebrations([])).toEqual([]);
  });
});

describe('단계 사양 (자동 넘김·컨페티·효과음)', () => {
  const [stageStep] = planCelebrations([{ type: 'stage_clear', stage }]);
  const [level] = planCelebrations([
    { type: 'level_up', level: 2, fromLevel: 1, title: '새싹' },
  ]);
  const [golden] = planCelebrations([
    { type: 'golden_key', kind: 'code', questTitle: '변수' },
  ]);
  const badges = (n: number) =>
    planCelebrations(
      (
        [
          'first_code',
          'hint_master',
          'stage_clear',
          'streak_3',
          'project_builder',
        ] as const
      )
        .slice(0, n)
        .map((badge) => ({ type: 'badge' as const, badge })),
    )[0];

  it('자동 넘김: 스테이지 클리어는 기다리고, 뱃지는 개수만큼 길게(상한 9초)', () => {
    expect(autoAdvanceMs(stageStep)).toBeNull();
    expect(autoAdvanceMs(level)).toBe(6000);
    expect(autoAdvanceMs(golden)).toBe(4500);
    expect(autoAdvanceMs(badges(1))).toBe(4500);
    expect(autoAdvanceMs(badges(2))).toBe(6000);
    expect(autoAdvanceMs(badges(5))).toBe(9000);
  });

  it('컨페티 세기: 스테이지 클리어 > 레벨 업 > 뱃지 > 황금키(0)', () => {
    const total = (kind: CelebrationStep['kind']) =>
      CONFETTI_PRESETS[STEP_SPECS[kind].confetti].reduce(
        (n, b) => n + b.particleCount,
        0,
      ) + (kind === 'level_up' ? LEVEL_POP_BURST.particleCount : 0);
    expect(total('stage_clear')).toBeGreaterThan(total('level_up'));
    expect(total('project_complete')).toBe(total('stage_clear'));
    expect(total('level_up')).toBeGreaterThan(total('badges'));
    expect(total('badges')).toBeGreaterThan(0);
    expect(total('golden_key')).toBe(0);
  });

  it('효과음: 뱃지는 등장 간격마다 음을 올린다', () => {
    expect(sfxSchedule(level)).toEqual([{ id: 'levelup', at: 150 }]);
    expect(sfxSchedule(badges(3))).toEqual([
      { id: 'star', at: 150, rate: 1 },
      { id: 'star', at: 330, rate: 1.26 },
      { id: 'star', at: 510, rate: 1.5 },
    ]);
  });
});
