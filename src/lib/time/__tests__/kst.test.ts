import { afterAll, describe, expect, it } from 'vitest';
import {
  addKstDays,
  formatKstDate,
  KST_OFFSET_MS,
  kstDayNumber,
  kstDayNumberOf,
  kstDaysBetween,
  kstStartOfDay,
  kstToday,
  nextKstMidnight,
  toKstDateKey,
} from '../kst';

/** Intl을 쓰지 않는 기준 계산: UTC+9 고정 오프셋 */
function oracleKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

describe('toKstDateKey — KST 자정 경계', () => {
  it.each([
    ['2026-11-03T14:59:59.999Z', '2026-11-03'], // KST 23:59:59.999
    ['2026-11-03T15:00:00.000Z', '2026-11-04'], // KST 00:00
    ['2026-11-04T00:00:00.000Z', '2026-11-04'], // KST 09:00 (UTC로는 날짜가 바뀌는 때)
    ['2026-11-04T14:59:00Z', '2026-11-04'],
    ['2026-11-04T15:00:00Z', '2026-11-05'],
    // 오프셋이 붙은 문자열·숫자·Date 모두 같은 순간이면 같은 키
    ['2026-11-04T00:00:00+09:00', '2026-11-04'],
    ['2026-11-03T23:59:59+09:00', '2026-11-03'],
  ])('%s → %s', (iso, key) => {
    expect(toKstDateKey(iso)).toBe(key);
    expect(toKstDateKey(new Date(iso))).toBe(key);
    expect(toKstDateKey(new Date(iso).getTime())).toBe(key);
  });

  it('연말: UTC 12-31 15:00 은 KST 새해 첫날', () => {
    expect(toKstDateKey('2026-12-31T14:59:59Z')).toBe('2026-12-31');
    expect(toKstDateKey('2026-12-31T15:00:00Z')).toBe('2027-01-01');
  });

  it('윤년: 2028-02-29 는 있고 2027 은 02-28 → 03-01', () => {
    expect(toKstDateKey('2028-02-28T15:00:00Z')).toBe('2028-02-29');
    expect(toKstDateKey('2028-02-29T15:00:00Z')).toBe('2028-03-01');
    expect(toKstDateKey('2027-02-28T15:00:00Z')).toBe('2027-03-01');
  });

  it('잘못된 입력은 RangeError', () => {
    expect(() => toKstDateKey('not a date')).toThrow(RangeError);
    expect(() => toKstDateKey(Number.NaN)).toThrow(RangeError);
  });
});

describe('서머타임 없음 · Intl 결과와 고정 오프셋 계산이 같음', () => {
  it('2024~2030 매시 30분마다 Intl 키 == UTC+9 키', () => {
    const start = Date.UTC(2024, 0, 1);
    const end = Date.UTC(2031, 0, 1);
    for (let ms = start; ms < end; ms += 30 * 60 * 1000) {
      const key = toKstDateKey(ms);
      if (key !== oracleKey(ms)) {
        throw new Error(
          `${new Date(ms).toISOString()}: ${key} != ${oracleKey(ms)}`,
        );
      }
    }
  });

  it('1년 내내 하루의 시작은 UTC 15:00 (오프셋이 바뀌지 않음)', () => {
    let key = '2026-01-01';
    for (let i = 0; i < 366; i++) {
      expect(kstStartOfDay(key).getUTCHours()).toBe(15);
      key = addKstDays(key, 1);
    }
  });
});

describe('일수 계산', () => {
  it('kstDaysBetween', () => {
    expect(kstDaysBetween('2026-11-03', '2026-11-04')).toBe(1);
    expect(kstDaysBetween('2026-11-04', '2026-11-04')).toBe(0);
    expect(kstDaysBetween('2026-11-04', '2026-11-01')).toBe(-3);
    expect(kstDaysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(kstDaysBetween('2028-02-28', '2028-03-01')).toBe(2); // 윤년
    expect(kstDaysBetween('2027-02-28', '2027-03-01')).toBe(1);
    expect(kstDaysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(kstDaysBetween('2028-01-01', '2029-01-01')).toBe(366);
  });

  it('addKstDays: 연말·윤년을 넘김', () => {
    expect(addKstDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addKstDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addKstDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addKstDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addKstDays('2026-11-04', 0)).toBe('2026-11-04');
  });

  it('kstDayNumber 는 UTC 1970-01-01 = 0 기준', () => {
    expect(kstDayNumber('1970-01-01')).toBe(0);
    expect(kstDayNumber('1970-01-02')).toBe(1);
    // 순간 → 일 번호: UTC 로는 같은 날이지만 KST 로는 하루 차이
    expect(
      kstDayNumberOf('2026-11-03T15:00:00Z') -
        kstDayNumberOf('2026-11-03T14:59:59Z'),
    ).toBe(1);
  });

  it('없는 날짜·형식이 틀린 키는 RangeError', () => {
    for (const bad of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-1-5',
      '20261104',
      '',
    ]) {
      expect(() => kstDayNumber(bad)).toThrow(RangeError);
    }
    expect(() => kstDayNumber('2028-02-29')).not.toThrow();
  });
});

describe('오늘·자정', () => {
  it('kstToday: UTC 14:59 와 15:00 사이에서 날짜가 바뀜', () => {
    expect(kstToday(Date.parse('2026-11-04T14:59:59Z'))).toBe('2026-11-04');
    expect(kstToday(Date.parse('2026-11-04T15:00:00Z'))).toBe('2026-11-05');
  });

  it('kstStartOfDay: KST 00:00 = 전날 UTC 15:00', () => {
    expect(kstStartOfDay('2026-11-04').toISOString()).toBe(
      '2026-11-03T15:00:00.000Z',
    );
    expect(kstStartOfDay('2027-01-01').toISOString()).toBe(
      '2026-12-31T15:00:00.000Z',
    );
    expect(kstStartOfDay('2028-02-29').toISOString()).toBe(
      '2028-02-28T15:00:00.000Z',
    );
  });

  it('nextKstMidnight: 다음 KST 자정 (자정 정각이면 그다음 날)', () => {
    expect(nextKstMidnight('2026-11-04T03:00:00Z').toISOString()).toBe(
      '2026-11-04T15:00:00.000Z',
    );
    expect(nextKstMidnight('2026-11-04T14:59:59.999Z').toISOString()).toBe(
      '2026-11-04T15:00:00.000Z',
    );
    expect(nextKstMidnight('2026-11-04T15:00:00Z').toISOString()).toBe(
      '2026-11-05T15:00:00.000Z',
    );
    expect(nextKstMidnight('2026-12-31T16:00:00Z').toISOString()).toBe(
      '2027-01-01T15:00:00.000Z',
    );
  });
});

describe('formatKstDate', () => {
  it('세 가지 모양', () => {
    const t = '2026-11-03T15:30:00Z'; // KST 11-04 00:30
    expect(formatKstDate(t)).toBe('2026년 11월 4일');
    expect(formatKstDate(t, 'long')).toBe('2026년 11월 4일');
    expect(formatKstDate(t, 'monthDay')).toBe('11월 4일');
    expect(formatKstDate(t, 'dot')).toBe('2026. 11. 4.');
  });

  it('UTC 로는 전날이어도 KST 날짜로 표시 (Vercel 서버 컴포넌트 문제)', () => {
    expect(formatKstDate('2026-12-31T20:00:00Z')).toBe('2027년 1월 1일');
  });

  it('날짜 키는 그 날짜 그대로', () => {
    expect(formatKstDate('2026-01-05')).toBe('2026년 1월 5일');
    expect(formatKstDate('2028-02-29', 'monthDay')).toBe('2월 29일');
  });
});

/**
 * 실행 환경 시간대와 무관한지: Node 는 `process.env.TZ`를 바꾸면 즉시 로컬 시간대가 바뀝니다.
 * 같은 프로세스 안에서 여러 시간대로 바꿔 가며 결과가 같은지 봅니다
 * (`TZ=UTC npx vitest run`·`TZ=America/Los_Angeles npx vitest run`으로 전체를 돌려도 같은 결과).
 */
describe('실행 환경 시간대(TZ)와 무관', () => {
  const originalTZ = process.env.TZ;
  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  const instants = [
    '2026-11-03T14:59:59Z',
    '2026-11-03T15:00:00Z',
    '2026-12-31T15:00:00Z',
    '2028-02-28T15:00:00Z',
    // 미국 서머타임 전환 시각 근처 (LA 03-08 02:00 PST → PDT, 11-01 02:00 PDT → PST)
    '2026-03-08T10:00:00Z',
    '2026-11-01T09:00:00Z',
  ];

  function snapshot() {
    return instants.map((t) => [
      toKstDateKey(t),
      formatKstDate(t),
      formatKstDate(t, 'monthDay'),
      formatKstDate(t, 'dot'),
      kstDayNumberOf(t),
      nextKstMidnight(t).toISOString(),
      kstStartOfDay(toKstDateKey(t)).toISOString(),
      addKstDays(toKstDateKey(t), 1),
    ]);
  }

  it('UTC · Los_Angeles · Seoul · Kiritimati(+14) · Pago_Pago(-11) 에서 같은 결과', () => {
    const zones = [
      'UTC',
      'America/Los_Angeles',
      'Asia/Seoul',
      'Pacific/Kiritimati',
      'Pacific/Pago_Pago',
    ];
    const results = zones.map((tz) => {
      process.env.TZ = tz;
      return {
        tz,
        offset: new Date('2026-07-01T00:00:00Z').getTimezoneOffset(),
        out: snapshot(),
      };
    });
    // 시간대 전환이 실제로 일어났는지 (안 바뀌면 이 테스트는 의미가 없음)
    expect(new Set(results.map((r) => r.offset)).size).toBe(zones.length);
    for (const r of results) expect(r.out, r.tz).toEqual(results[0].out);
    expect(results[0].out[1][0]).toBe('2026-11-04');
  });
});
