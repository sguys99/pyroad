import { describe, expect, it } from 'vitest';

import type { StageQuestItem } from '../mapData';
import { pickPhoneQuiz } from '../phoneQuiz';

// 폰 퀴즈 추천 (P7-11, §12-Q3 C): 어느 퀴즈를 고르는지

const q = (
  id: string,
  order: number,
  extra: Partial<StageQuestItem> = {},
): StageQuestItem => ({
  id,
  order,
  title: `퀘스트 ${id}`,
  concept: '',
  quest_type: 'code',
  quiz_kind: null,
  is_mobile_friendly: false,
  status: null,
  best_stars: 0,
  ...extra,
});
const quiz = (id: string, order: number, extra: Partial<StageQuestItem> = {}) =>
  q(id, order, {
    quest_type: 'quiz',
    quiz_kind: 'multiple_choice',
    is_mobile_friendly: true,
    ...extra,
  });
const TODAY = '2026-11-10';
const done = (stars: number, judged = '2026-11-09') => ({
  status: 'completed',
  best_stars: stars,
  stars_judged_on: judged,
});

const stages = [
  { id: 's1', order: 1, status: 'completed' as const },
  { id: 's2', order: 2, status: 'in_progress' as const },
  { id: 's3', order: 3, status: 'locked' as const },
];
const base = {
  s1: [q('a1', 1, done(3)), quiz('a2', 2), quiz('a3', 3, done(2))],
  s2: [
    q('b1', 1, done(3)),
    quiz('b2', 2, { ...done(1), quiz_kind: 'parsons' }),
    q('b3', 3),
    quiz('b4', 4, { quiz_kind: 'fill_blank' }),
  ],
  s3: [q('c1', 1), quiz('c2', 2)],
};
const pick = (
  over: Partial<Parameters<typeof pickPhoneQuiz>[0]> = {},
): ReturnType<typeof pickPhoneQuiz> =>
  pickPhoneQuiz({
    phone: true,
    continueQuestId: 'b3',
    stages,
    questsByStage: base,
    today: TODAY,
    ...over,
  });

describe('pickPhoneQuiz', () => {
  it('폰이 아니면 없음', () => {
    expect(pick({ phone: false })).toBeNull();
  });

  it('이어하기가 없거나 이미 퀴즈거나 이 월드 밖이면 없음', () => {
    expect(pick({ continueQuestId: null })).toBeNull();
    expect(pick({ continueQuestId: 'b4' })).toBeNull();
    expect(pick({ continueQuestId: 'zz' })).toBeNull();
  });

  it('① 이어하기 스테이지의 안 푼 퀴즈가 먼저 (같은 스테이지 복습보다)', () => {
    expect(pick()).toEqual({
      questId: 'b4',
      title: '퀘스트 b4',
      kind: 'fill_blank',
      stageOrder: 2,
      review: false,
    });
  });

  it('② 그다음 같은 스테이지의 별 3개 미만 복습 (다른 스테이지의 안 푼 퀴즈보다)', () => {
    const s2 = base.s2.map((x) => (x.id === 'b4' ? { ...x, ...done(3) } : x));
    expect(pick({ questsByStage: { ...base, s2 } })).toMatchObject({
      questId: 'b2',
      kind: 'parsons',
      review: true,
    });
  });

  it('③ 다른 열린 스테이지의 안 푼 퀴즈 → ④ 그 복습. 잠긴 스테이지·별 3개는 고르지 않음', () => {
    const s2 = [q('b1', 1, done(3)), q('b3', 3)];
    expect(pick({ questsByStage: { ...base, s2 } })).toMatchObject({
      questId: 'a2',
      stageOrder: 1,
      review: false,
    });
    const s1 = [
      q('a1', 1, done(3)),
      quiz('a2', 2, done(3)),
      quiz('a3', 3, done(2)),
    ];
    expect(pick({ questsByStage: { ...base, s1, s2 } })).toMatchObject({
      questId: 'a3',
      review: true,
    });
    const s1All3 = s1.map((x) => ({ ...x, ...done(3) }));
    expect(pick({ questsByStage: { ...base, s1: s1All3, s2 } })).toBeNull();
  });

  it('오늘 판정한 퀴즈는 다시 풀어도 연습이라 복습으로 고르지 않음 (P7-10)', () => {
    const s2 = base.s2.map((x) =>
      x.id === 'b4'
        ? { ...x, ...done(3) }
        : x.id === 'b2'
          ? { ...x, ...done(1, TODAY) }
          : x,
    );
    const s1 = [q('a1', 1, done(3)), quiz('a3', 3, done(2, TODAY))];
    expect(pick({ questsByStage: { ...base, s1, s2 } })).toBeNull();
  });

  it('다른 스테이지끼리는 이어하기 스테이지에 가까운 쪽', () => {
    const four = [
      { id: 's1', order: 1, status: 'completed' as const },
      { id: 's2', order: 2, status: 'completed' as const },
      { id: 's3', order: 3, status: 'in_progress' as const },
    ];
    expect(
      pickPhoneQuiz({
        phone: true,
        continueQuestId: 'c1',
        stages: four,
        questsByStage: {
          s1: [quiz('a2', 1)],
          s2: [quiz('b2', 1)],
          s3: [q('c1', 1)],
        },
      }),
    ).toMatchObject({ questId: 'b2' });
  });

  it('종류를 모르는 퀴즈 행은 건너뜀', () => {
    const s2 = [q('b3', 1), quiz('b4', 2, { quiz_kind: null })];
    expect(pick({ questsByStage: { ...base, s2 } })).toMatchObject({
      questId: 'a2',
    });
  });
});
