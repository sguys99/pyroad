import { describe, expect, it } from 'vitest';

import { kstToday } from '@/lib/time/kst';
import {
  buildCalendarMonth,
  calendarMonths,
  learnLevel,
  quizAccuracy,
  recentAchievements,
} from '../profileStats';

const empty = {
  days: {},
  shieldDays: new Set<string>(),
  stampDays: new Set<string>(),
};

describe('quizAccuracy', () => {
  it('정답 시도 / 전체 시도, 반올림', () => {
    expect(quizAccuracy(2, 3)).toBe(67);
    expect(quizAccuracy(5, 5)).toBe(100);
  });
  it('시도가 없으면 null (0%로 보이지 않게)', () => {
    expect(quizAccuracy(0, 0)).toBeNull();
  });
});

describe('learnLevel', () => {
  it('0 · 1 · 2~3 · 4+', () => {
    expect([0, 1, 2, 3, 4, 9].map(learnLevel)).toEqual([0, 1, 2, 2, 3, 3]);
  });
});

describe('calendarMonths', () => {
  it('기록이 없으면 이번 달 하나', () => {
    expect(calendarMonths('2026-11-12', [])).toEqual(['2026-11']);
  });
  it('첫 기록 달부터 이번 달까지, 해를 넘김', () => {
    expect(calendarMonths('2027-01-03', ['2026-11-30', '2026-12-01'])).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });
  it('최대 12개월', () => {
    const m = calendarMonths('2026-11-12', ['2024-01-01']);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-12');
    expect(m.at(-1)).toBe('2026-11');
  });
});

describe('buildCalendarMonth', () => {
  it('2026년 11월: 일요일 시작 30일, 5주', () => {
    const c = buildCalendarMonth('2026-11', empty, '2026-11-12');
    expect(c.title).toBe('2026년 11월');
    expect(c.weeks).toHaveLength(5);
    expect(c.weeks[0][0]?.day).toBe(1); // 11월 1일 = 일요일
    expect(c.weeks.flat().filter(Boolean)).toHaveLength(30);
    expect(c.weeks.every((w) => w.length === 7)).toBe(true);
  });
  it('2026년 12월은 화요일 시작, 2028년 2월은 29일', () => {
    const dec = buildCalendarMonth('2026-12', empty, '2026-12-01');
    expect(dec.weeks[0].slice(0, 2)).toEqual([null, null]);
    expect(dec.weeks[0][2]?.day).toBe(1);
    const feb = buildCalendarMonth('2028-02', empty, '2028-02-01');
    expect(feb.weeks.flat().filter(Boolean)).toHaveLength(29);
  });
  it('학습 수·방패·출석·오늘·미래·낭독', () => {
    const c = buildCalendarMonth(
      '2026-11',
      {
        days: { '2026-11-10': 1, '2026-11-12': 3, '2026-10-31': 5 },
        shieldDays: new Set(['2026-11-11']),
        stampDays: new Set(['2026-11-12']),
      },
      '2026-11-12',
    );
    const by = new Map(
      c.weeks.flat().flatMap((x) => (x ? [[x.day, x] as const] : [])),
    );
    expect(by.get(12)).toMatchObject({
      solved: 3,
      level: 2,
      stamp: true,
      today: true,
    });
    expect(by.get(12)?.label).toBe('오늘, 11월 12일, 퀘스트 3개, 출석 도장');
    expect(by.get(11)?.label).toBe('11월 11일, 방패로 지킨 날');
    expect(by.get(13)?.future).toBe(true);
    expect(by.get(13)?.label).toBe('11월 13일');
    expect(c.learnedDays).toBe(2);
    expect(c.solved).toBe(4); // 10월 31일은 다른 달
  });
  it('KST 경계: UTC 11-12 15:00 은 KST 11월 13일이 오늘', () => {
    const today = kstToday(Date.parse('2026-11-12T15:00:00Z'));
    expect(today).toBe('2026-11-13');
    const c = buildCalendarMonth('2026-11', empty, today);
    const cells = c.weeks.flat();
    expect(cells.find((x) => x?.today)?.day).toBe(13);
    expect(cells.find((x) => x?.day === 13)?.future).toBe(false);
  });
});

describe('recentAchievements', () => {
  it('얻은 시각 늦은 순 3개, 같은 시각은 정렬 순', () => {
    const defs = ['a', 'b', 'c', 'd', 'e'].map((id, sort) => ({ id, sort }));
    const owned = [
      { achievement_id: 'a', achieved_at: '2026-11-01T00:00:00Z' },
      { achievement_id: 'c', achieved_at: '2026-11-05T00:00:00Z' },
      { achievement_id: 'd', achieved_at: '2026-11-05T00:00:00Z' },
      { achievement_id: 'e', achieved_at: '2026-11-03T00:00:00Z' },
    ];
    expect(recentAchievements(defs, owned).map((x) => x.id)).toEqual([
      'c',
      'd',
      'e',
    ]);
  });
});
