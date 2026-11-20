import { describe, expect, it } from 'vitest';

import {
  alertsOf,
  parseRange,
  pct,
  ratio,
  type MonitoringSummary,
} from '../metrics';
import { sampleSummary } from '../sample';

/** 빈 DB 의 monitoring_summary 모양 (모든 수 0) */
function empty(): MonitoringSummary {
  const z = sampleSummary();
  const zero = <T extends object>(o: T) =>
    Object.fromEntries(Object.keys(o).map((k) => [k, 0])) as T;
  return {
    ...z,
    events: zero(z.events),
    cohort: zero(z.cohort),
    accounts: zero(z.accounts),
    retention: zero(z.retention),
    sessions: zero(z.sessions),
    mobile: zero(z.mobile),
    motion: zero(z.motion),
    health: zero(z.health),
    tutor_today: {},
    daily: z.daily.map((d) => ({ ...d, users: 0, visitors: 0 })),
  };
}

describe('monitoring metrics (P12-09)', () => {
  it('기간은 1·7·28만, 나머지는 7', () => {
    expect(parseRange('1')).toBe(1);
    expect(parseRange('28')).toBe(28);
    expect(parseRange('30')).toBe(7);
    expect(parseRange(undefined)).toBe(7);
    expect(parseRange('abc')).toBe(7);
  });

  it('0으로 나누면 null → "—"', () => {
    expect(ratio(3, 0)).toBeNull();
    expect(pct(ratio(3, 0))).toBe('—');
    expect(pct(ratio(1, 3))).toBe('33.3%');
    expect(pct(0)).toBe('0%');
  });

  it('빈 데이터는 경고 없음', () => {
    expect(alertsOf(empty())).toEqual([]);
  });

  it('코인 불일치·파기 밀림·숨김·한도 초과는 하나만 있어도 경고', () => {
    const s = empty();
    s.health.coin_mismatches = 1;
    s.health.purge_overdue = 2;
    s.health.hidden_comments = 1;
    s.tutor_today = { hint_generator: { allowed: 5, denied: 3 } };
    expect(alertsOf(s).map((a) => a.text)).toEqual([
      '코인 잔액과 원장이 다른 계정 1개',
      '파기 기한이 지났는데 남은 계정 2개 — 파기 크론 확인',
      '신고로 숨겨져 살펴볼 글·댓글·작품 1개',
      '오늘 튜터 요청 한도 초과 3번',
    ]);
  });

  it('연출 하향: 30% 초과·되돌림 10% 초과면 경고, 표본 20 미만은 판정 안 함 (P12-04 기준)', () => {
    const s = empty();
    s.motion = { client_users: 100, downgraded: 30, back_to_full: 3 };
    expect(alertsOf(s)).toEqual([]); // 정확히 30%·10%는 경고 아님
    s.motion = { client_users: 100, downgraded: 31, back_to_full: 3 };
    expect(alertsOf(s).map((a) => a.text)).toEqual([
      '연출 자동 하향 31% (기준 30%)',
    ]); // 되돌림 3/31 = 9.7%
    s.motion = { client_users: 100, downgraded: 40, back_to_full: 5 };
    expect(alertsOf(s).map((a) => a.text)).toEqual([
      '연출 자동 하향 40% (기준 30%)',
      '하향 뒤 “풍성하게”로 되돌림 12.5% (기준 10%)',
    ]);
    s.motion = { client_users: 10, downgraded: 9, back_to_full: 9 };
    expect(alertsOf(s)).toEqual([]);
  });
});
