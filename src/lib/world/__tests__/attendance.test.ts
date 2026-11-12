import { describe, expect, it } from 'vitest';
import {
  afterStamp,
  attendanceCells,
  shieldSavedYesterday,
  type AttendanceStatus,
} from '../attendance';

// 출석 달력 (P8-08): 서버 상태 → 7칸, 찍은 뒤 화면 상태, 방패가 어제를 지켰는지

const status = (over: Partial<AttendanceStatus> = {}): AttendanceStatus => ({
  today: '2026-11-11',
  total: 2,
  stamped_today: false,
  day_n: 3,
  cycle: ['2026-11-01', '2026-11-09'],
  ...over,
});

describe('attendanceCells', () => {
  it('찍은 칸은 날짜, 오늘 찍을 칸은 next, 나머지는 남음 · 코인 5·5·10·10·15·20·30 · 7일째 상자', () => {
    const cells = attendanceCells(status());
    expect(cells.map((c) => c.coins)).toEqual([5, 5, 10, 10, 15, 20, 30]);
    expect(cells.map((c) => c.day ?? null)).toEqual([
      '2026-11-01',
      '2026-11-09',
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(cells.filter((c) => c.next).map((c) => c.n)).toEqual([3]);
    expect(cells.filter((c) => c.chest).map((c) => c.n)).toEqual([7]);
  });

  it('오늘 찍었으면 next 칸 없음', () => {
    const cells = attendanceCells(
      status({
        stamped_today: true,
        day_n: 2,
        cycle: ['2026-11-10', '2026-11-11'],
      }),
    );
    expect(cells.some((c) => c.next)).toBe(false);
    expect(cells[1].day).toBe('2026-11-11');
  });
});

describe('afterStamp', () => {
  const res = {
    stamped: true as const,
    already_stamped: false,
    day_n: 3,
    coins_earned: 10,
    coins_balance: 50,
    shield_granted: 0,
    shields: 0,
  };
  it('오늘 날짜를 사이클 끝에 더하고 찍음으로', () => {
    expect(afterStamp(status(), res)).toMatchObject({
      stamped_today: true,
      total: 3,
      day_n: 3,
      cycle: ['2026-11-01', '2026-11-09', '2026-11-11'],
    });
  });
  it('새 사이클(1일째)은 빈 사이클에서 시작', () => {
    expect(
      afterStamp(status({ total: 7, day_n: 1, cycle: [] }), {
        ...res,
        day_n: 1,
      }).cycle,
    ).toEqual(['2026-11-11']);
  });
  it('이미 찍은 상태면 그대로', () => {
    const s = status({ stamped_today: true });
    expect(afterStamp(s, res)).toBe(s);
  });
});

describe('shieldSavedYesterday', () => {
  it('어제(KST)가 방패 날이면 true, 그 전 날만이면 false · 월 경계', () => {
    expect(
      shieldSavedYesterday({ shield_days: ['2026-11-10'] }, '2026-11-11'),
    ).toBe(true);
    expect(
      shieldSavedYesterday({ shield_days: ['2026-11-09'] }, '2026-11-11'),
    ).toBe(false);
    expect(
      shieldSavedYesterday({ shield_days: ['2026-11-30'] }, '2026-12-01'),
    ).toBe(true);
  });
});
