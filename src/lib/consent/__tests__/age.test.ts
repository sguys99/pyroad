import { describe, expect, it } from 'vitest';
import { ageBand, ageYearOptions, boundaryYear } from '../age';

// 2026-11-06 12:00 KST
const NOW = '2026-11-06T03:00:00Z';

describe('만 14세 미만 확인 (P3-15)', () => {
  it('보기: 올해-5 ~ 올해-16, 경계 해 = 올해-14 (KST)', () => {
    expect(ageYearOptions(NOW)).toEqual([
      2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010,
    ]);
    expect(boundaryYear(NOW)).toBe(2012);
    // 12월 31일 15:00Z = 1월 1일 KST → 해가 바뀜
    expect(boundaryYear('2026-12-31T15:00:00Z')).toBe(2013);
  });

  it.each([
    [{ year: 2016 }, 'under14'],
    [{ year: 2013 }, 'under14'],
    [{ year: 2011 }, '14plus'],
    [{ year: 'older' as const }, '14plus'],
    [{ year: 'unknown' as const }, 'under14'],
    [{ year: 2030 }, 'under14'],
    [{ year: 2012, month: 3 }, '14plus'],
    [{ year: 2012, month: 12 }, 'under14'],
    [{ year: 2012, month: 11, birthdayPassed: true }, '14plus'],
    [{ year: 2012, month: 11, birthdayPassed: false }, 'under14'],
    [{ year: 2012, month: 13 }, 'under14'],
  ])('%j → %s', (answer, band) => {
    expect(ageBand(answer, NOW)).toEqual({ band });
  });

  it('경계 해는 달을, 이번 달이면 생일을 더 묻는다', () => {
    expect(ageBand({ year: 2012 }, NOW)).toEqual({ need: 'month' });
    expect(ageBand({ year: 2012, month: 11 }, NOW)).toEqual({
      need: 'birthday',
    });
  });
});
