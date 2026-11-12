import { describe, expect, it } from 'vitest';

import {
  formatTimeLeft,
  missionReady,
  msUntilKstMidnight,
  readyCount,
  type DailyMission,
} from '../missions';

// 데일리 미션 화면 계산 (P8-07): 받기 가능·받을 수 · KST 자정까지 남은 시간

const m = (over: Partial<DailyMission> = {}): DailyMission => ({
  id: 'quest_2',
  title: '퀘스트 2개 클리어',
  kind: 'quest_clear',
  difficulty: 2,
  target: 2,
  progress: 0,
  coins: 15,
  xp: 15,
  claimed: false,
  ...over,
});

describe('missions', () => {
  it('달성했고 안 받은 것만 받기 가능, 받을 수는 오늘 + 지난날', () => {
    expect(missionReady(m({ progress: 1 }))).toBe(false);
    expect(missionReady(m({ progress: 2 }))).toBe(true);
    expect(missionReady(m({ progress: 2, claimed: true }))).toBe(false);
    expect(readyCount(null)).toBe(0);
    expect(
      readyCount({
        day: '2026-11-11',
        missions: [m({ progress: 2 }), m({ progress: 1 })],
        pending: [{ ...m({ progress: 2 }), day: '2026-11-10' }],
      }),
    ).toBe(2);
  });

  it('KST 자정 경계: 23:59:59 KST → 1초, 자정 정각 → 다음 자정까지 24시간 (실행 TZ 무관)', () => {
    expect(msUntilKstMidnight('2026-11-11T14:59:59.000Z')).toBe(1000);
    expect(msUntilKstMidnight('2026-11-11T15:00:00.000Z')).toBe(86_400_000);
    expect(msUntilKstMidnight('2026-11-11T12:30:00.000Z')).toBe(
      2.5 * 3_600_000,
    );
  });

  it('남은 시간 글자', () => {
    expect(formatTimeLeft(1000)).toBe('1분 안');
    expect(formatTimeLeft(61_000)).toBe('2분');
    expect(formatTimeLeft(2.5 * 3_600_000)).toBe('2시간 30분');
    expect(formatTimeLeft(3 * 3_600_000)).toBe('3시간');
    expect(formatTimeLeft(86_400_000)).toBe('24시간');
  });
});
