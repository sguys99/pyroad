import { describe, expect, it } from 'vitest';
import { currentStreak } from '../streak';

// 2026-11-09 12:00 KST
const NOW = '2026-11-09T03:00:00Z';

describe('currentStreak', () => {
  it('완료 없음 → 0일', () => {
    expect(currentStreak([], NOW)).toEqual({ days: 0, today: false });
  });

  it('오늘·어제·그제 → 3일, 같은 날 여러 번은 하루', () => {
    expect(
      currentStreak(
        [
          '2026-11-09T01:00:00Z',
          '2026-11-09T02:00:00Z',
          '2026-11-08T01:00:00Z',
          '2026-11-07T01:00:00Z',
          null,
        ],
        NOW,
      ),
    ).toEqual({ days: 3, today: true });
  });

  it('오늘 아직 안 함: 어제까지 이어진 일수 유지', () => {
    expect(
      currentStreak(['2026-11-08T01:00:00Z', '2026-11-07T01:00:00Z'], NOW),
    ).toEqual({ days: 2, today: false });
  });

  it('그제가 마지막이면 끊김 → 0일', () => {
    expect(currentStreak(['2026-11-07T01:00:00Z'], NOW)).toEqual({
      days: 0,
      today: false,
    });
  });

  it('하루 건너뛰면 그 앞은 세지 않음', () => {
    expect(
      currentStreak(
        [
          '2026-11-09T01:00:00Z',
          '2026-11-07T01:00:00Z',
          '2026-11-06T01:00:00Z',
        ],
        NOW,
      ).days,
    ).toBe(1);
  });

  it('KST 자정 경계: UTC 15:00 = KST 다음 날 00:00', () => {
    // KST 11-09 00:30 (UTC 11-08 15:30), KST 11-08 23:30 (UTC 11-08 14:30) → 이틀 연속
    const done = ['2026-11-08T15:30:00Z', '2026-11-08T14:30:00Z'];
    expect(currentStreak(done, '2026-11-08T15:40:00Z')).toEqual({
      days: 2,
      today: true,
    });
    // 같은 순간이 UTC로는 같은 날이지만, KST 자정 직전에 보면 11-09 완료는 아직 "미래"라 오늘(11-08)만 센다
    expect(currentStreak(done, '2026-11-08T14:50:00Z')).toEqual({
      days: 1,
      today: true,
    });
  });
});
