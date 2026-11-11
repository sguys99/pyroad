import { describe, expect, it } from 'vitest';

import type { StageQuestItem } from '@/lib/world/mapData';
import {
  dailyQuizResults,
  isDailyQuizDone,
  pickDailyQuizzes,
  type QuizAttemptRow,
} from '../dailyQuiz';

// 오늘의 퀴즈 (P7-10): 고르기·결정성·복습 우선·KST 자정 경계·완료 계산

const TODAY = '2026-11-10';
const YESTERDAY = '2026-11-09';

const quiz = (
  id: string,
  extra: Partial<StageQuestItem> = {},
): StageQuestItem => ({
  id,
  order: 1,
  title: `퀴즈 ${id}`,
  concept: '',
  quest_type: 'quiz',
  quiz_kind: 'multiple_choice',
  is_mobile_friendly: true,
  status: null,
  best_stars: 0,
  stars_judged_on: null,
  completed_at: null,
  ...extra,
});
const code = (id: string): StageQuestItem => ({
  ...quiz(id),
  quest_type: 'code',
  quiz_kind: null,
});
const judged = (
  stars: number,
  on: string,
  completedAt = '2026-11-01T01:00:00Z',
) => ({
  status: 'completed',
  best_stars: stars,
  stars_judged_on: on,
  completed_at: completedAt,
});

const stages = [
  { id: 's1', order: 1, status: 'completed' },
  { id: 's2', order: 2, status: 'in_progress' },
  { id: 's3', order: 3, status: 'locked' },
];

const pick = (
  questsByStage: Record<string, StageQuestItem[]>,
  over: { userId?: string; today?: string } = {},
) =>
  pickDailyQuizzes({
    userId: over.userId ?? 'u1',
    today: over.today ?? TODAY,
    stages,
    questsByStage,
  });

describe('pickDailyQuizzes', () => {
  it('저장한 목록(P8-07 fixed, §12-Q61)이 있으면 그 문제만 그 순서로 — 새로 열린 퀴즈가 끼어들지 않고, 잠긴 문제는 빠짐', () => {
    const byStage = {
      s1: [quiz('a'), quiz('b')],
      s2: [quiz('new1'), quiz('new2')],
      s3: [quiz('locked')],
    };
    const got = pickDailyQuizzes({
      userId: 'u1',
      today: TODAY,
      stages,
      questsByStage: byStage,
      fixed: ['b', 'locked', 'a'],
    });
    expect(got.map((p) => p.questId)).toEqual(['b', 'a']);
    // 빈 목록은 고정하지 않음 (그날 아침 퀴즈가 없던 학생)
    expect(
      pickDailyQuizzes({
        userId: 'u1',
        today: TODAY,
        stages,
        questsByStage: byStage,
        fixed: [],
      }),
    ).toHaveLength(3);
  });

  it('복습 가능(별<3, 어제 판정) → 안 푼 것 → 나머지 순, 최대 3개, 잠긴 스테이지·코드 퀘스트 제외', () => {
    const got = pick({
      s1: [
        code('c1'),
        quiz('full', judged(3, YESTERDAY)),
        quiz('r1', judged(1, YESTERDAY)),
        quiz('n1'),
      ],
      s2: [quiz('r2', judged(2, '2026-10-01')), quiz('n2'), quiz('n3')],
      s3: [quiz('locked', judged(1, YESTERDAY))],
    });
    expect(got).toHaveLength(3);
    expect(
      got
        .slice(0, 2)
        .map((p) => p.questId)
        .sort(),
    ).toEqual(['r1', 'r2']);
    expect(got.slice(0, 2).every((p) => p.review)).toBe(true);
    expect(['n1', 'n2', 'n3']).toContain(got[2].questId);
    expect(got[2].review).toBe(false);
    expect(got.map((p) => p.questId)).not.toContain('locked');
  });

  it('별 3개·종류 모르는 퀴즈만 남으면 나머지에서 채우고, 퀴즈가 없으면 빈 목록', () => {
    expect(
      pick({
        s1: [
          quiz('full', judged(3, YESTERDAY)),
          quiz('x', { quiz_kind: null }),
        ],
      }),
    ).toEqual([
      {
        questId: 'full',
        title: '퀴즈 full',
        kind: 'multiple_choice',
        stageOrder: 1,
        review: false,
      },
    ]);
    expect(pick({ s1: [code('c1')] })).toEqual([]);
  });

  it('같은 사용자·같은 날이면 같은 문제, 날이나 사용자가 바뀌면 섞임이 달라짐', () => {
    const many = { s1: Array.from({ length: 12 }, (_, i) => quiz(`n${i}`)) };
    const ids = (o?: { userId?: string; today?: string }) =>
      pick(many, o).map((p) => p.questId);
    expect(ids()).toEqual(ids());
    expect(ids()).toEqual(
      pick({ s1: [...many.s1].reverse() }).map((p) => p.questId),
    );
    const days = new Set(
      ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((d) =>
        ids({ today: d }).join(),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
    expect(ids({ userId: 'u2' })).not.toEqual(ids());
  });

  it('오늘 판정한 퀴즈는 오늘 아침 칸 그대로 (풀어도 목록이 안 바뀜)', () => {
    const morning = {
      s1: [
        quiz('r1', judged(1, YESTERDAY)),
        quiz('n1'),
        quiz('full', judged(3, YESTERDAY)),
      ],
      s2: [quiz('n2')],
    };
    const before = pick(morning);
    const after = pick({
      // r1 복습으로 별 3개, n1 처음 완료 (둘 다 오늘 판정)
      s1: [
        quiz('r1', judged(3, TODAY)),
        quiz('n1', judged(2, TODAY, '2026-11-10T03:00:00Z')),
        quiz('full', judged(3, YESTERDAY)),
      ],
      s2: [quiz('n2')],
    });
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ questId: 'r1', review: true });
  });

  it('KST 자정 경계: 어제 판정(UTC 오후 = KST 다음 날 새벽 전)은 오늘 복습 가능', () => {
    // 2026-11-09T14:59Z 는 KST 11-09 23:59 → 판정일 11-09, 오늘 11-10 이면 복습
    const q = quiz('r1', judged(1, YESTERDAY, '2026-11-09T14:59:00Z'));
    expect(pick({ s1: [q] })[0].review).toBe(true);
    // 같은 날로 보면(오늘 = 11-09) 처음 완료가 오늘이라 "안 푼 칸"
    expect(
      pick(
        { s1: [{ ...q, stars_judged_on: YESTERDAY }] },
        { today: YESTERDAY },
      )[0].review,
    ).toBe(false);
  });
});

describe('dailyQuizResults · isDailyQuizDone', () => {
  const a = (
    quest_id: string,
    created_at: string,
    is_correct: boolean,
    attempt_no = 1,
  ): QuizAttemptRow => ({
    user_id: 'u1',
    quest_id,
    created_at,
    is_correct,
    attempt_no,
  });

  it('오늘 정답 → correct, 3번째 오답 → revealed, 1·2번째 오답·어제 시도·다른 퀴즈는 끝 아님', () => {
    const r = dailyQuizResults(
      ['q1', 'q2', 'q3', 'q4'],
      [
        a('q1', '2026-11-10T01:00:00Z', false),
        a('q1', '2026-11-10T01:01:00Z', true, 2),
        a('q2', '2026-11-10T02:00:00Z', false, 3),
        a('q3', '2026-11-10T02:00:00Z', false, 2),
        // KST 11-09 23:59 = 어제
        a('q4', '2026-11-09T14:59:59Z', true),
        a('other', '2026-11-10T02:00:00Z', true),
      ],
      TODAY,
    );
    expect(r).toEqual({ q1: 'correct', q2: 'revealed' });
  });

  it('KST 자정(UTC 15:00) 바로 뒤 시도는 오늘', () => {
    expect(
      dailyQuizResults(['q1'], [a('q1', '2026-11-09T15:00:00Z', true)], TODAY),
    ).toEqual({
      q1: 'correct',
    });
  });

  it('공개 뒤 연습에서 맞히면 correct 로 덮음', () => {
    expect(
      dailyQuizResults(
        ['q1'],
        [
          a('q1', '2026-11-10T01:00:00Z', false, 3),
          a('q1', '2026-11-10T01:05:00Z', true),
        ],
        TODAY,
      ),
    ).toEqual({ q1: 'correct' });
  });

  it('모두 끝나야 완료, 문제가 없으면 완료 아님', () => {
    const picks = [{ questId: 'q1' }, { questId: 'q2' }] as never;
    expect(isDailyQuizDone({ picks, results: { q1: 'correct' } })).toBe(false);
    expect(
      isDailyQuizDone({ picks, results: { q1: 'correct', q2: 'revealed' } }),
    ).toBe(true);
    expect(isDailyQuizDone({ picks: [], results: {} })).toBe(false);
  });
});
