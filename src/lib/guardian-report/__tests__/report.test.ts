import { describe, expect, it } from 'vitest';
import {
  GUARDIAN_TOKEN,
  barRatios,
  guardianReportSchema,
  reportSummary,
  weekOffset,
  weekRange,
  type GuardianReport,
} from '../report';
import { normalizePath } from '@/lib/analytics/events';

const day = (date: string, quests: number, extra = {}) => ({
  date,
  quests,
  stamp: false,
  future: false,
  ...extra,
});

const base: GuardianReport = {
  nickname: '코딩왕',
  skin: null,
  level: 3,
  week: { start: '2026-11-09', end: '2026-11-15', offset: 0 },
  days: [
    day('2026-11-09', 2, { stamp: true }),
    day('2026-11-10', 0),
    day('2026-11-11', 5),
    day('2026-11-12', 0),
    day('2026-11-13', 1),
    day('2026-11-14', 0, { future: true }),
    day('2026-11-15', 0, { future: true }),
  ],
  totals: { quests: 4, xp: 120, stars: 10, active_days: 3, stamps: 1 },
  learned: [
    { stage: '파이썬 마을 입구', title: '첫 번째 인사', concept: 'print()' },
  ],
  bosses: [],
  streak: 1,
  next: { stage: '파이썬 마을 입구', title: '따옴표의 비밀' },
};

describe('보호자 리포트 도우미 (P9-15)', () => {
  it('RPC 반환 모양을 받고, 요일이 7칸이 아니면 거절', () => {
    expect(guardianReportSchema.safeParse(base).success).toBe(true);
    expect(
      guardianReportSchema.safeParse({ ...base, days: base.days.slice(1) })
        .success,
    ).toBe(false);
  });

  it('주: week=last 만 지난 주, 나머지(배열·다른 글자)는 이번 주', () => {
    expect(weekOffset('last')).toBe(1);
    expect(weekOffset(undefined)).toBe(0);
    expect(weekOffset(['last'])).toBe(0);
    expect(weekOffset('<script>')).toBe(0);
    expect(weekRange(base)).toBe('11월 9일(월) ~ 11월 15일(일)');
  });

  it('요약은 어른 존댓말, 이번 주·지난 주·기록 없음·복습만 갈래', () => {
    expect(reportSummary(base)).toBe(
      '이번 주에는 지금까지 3일 동안 공부하며 새 퀘스트 4개를 마쳤습니다.',
    );
    const last = { ...base, week: { ...base.week, offset: 1 as const } };
    expect(reportSummary(last)).toMatch(/^지난 주에는 3일/);
    const none = {
      ...base,
      totals: { ...base.totals, active_days: 0, quests: 0 },
    };
    expect(reportSummary(none)).toMatch(/아직 학습 기록이 없습니다/);
    const review = { ...base, totals: { ...base.totals, quests: 0 } };
    expect(reportSummary(review)).toMatch(/복습과 퀴즈로/);
  });

  it('막대 비율: 가장 많은 날 = 1, 기준은 최소 3', () => {
    expect(barRatios(base)).toEqual([0.4, 0, 1, 0, 0.2, 0, 0]);
    expect(barRatios({ days: [day('2026-11-09', 1)] })).toEqual([1 / 3]);
  });

  it('토큰 모양은 22자 base64url, 분석 경로에서는 [id] 로 지워짐', () => {
    expect(GUARDIAN_TOKEN.test('rG6TzuP93C8blCS4ZdyehQ')).toBe(true);
    expect(GUARDIAN_TOKEN.test('short')).toBe(false);
    expect(GUARDIAN_TOKEN.test("rG6TzuP93C8blCS4Zdyeh'")).toBe(false);
    expect(normalizePath('/guardian/rG6TzuP93C8blCS4ZdyehQ?week=last')).toBe(
      '/guardian/[id]',
    );
  });
});
