import { describe, expect, it } from 'vitest';

import { judge, pct, tierOk, WORLD_BUDGET } from '../worldMapBudget';

// 월드맵 성능 측정 (P5-14)의 판정 부분

describe('world-map-bench', () => {
  it('pct는 정렬한 값의 백분위', () => {
    expect(pct([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(pct([16, 17, 16, 50], 95)).toBe(50);
    expect(pct([], 95)).toBe(0);
  });
  it('예산 안이면 빈 목록, 넘으면 넘은 것만', () => {
    expect(
      judge({
        idleFull4x: { mainBusyPct: 2 },
        scroll4x: [{ tier: 'full', rafP95: 18, compositorFps: 60 }],
      }),
    ).toEqual([]);
    const fails = judge({
      idleFull4x: { mainBusyPct: WORLD_BUDGET.idleMainBusyPct + 1 },
      scroll4x: [{ tier: 'lite', rafP95: 40, compositorFps: 45 }],
    });
    expect(fails).toHaveLength(3);
    expect(fails[1]).toContain('lite');
  });
  it('자동 단계는 정적 추정보다 높을 수 없다 (실측은 내리기만)', () => {
    expect(tierOk('full', 'full')).toBe(true);
    expect(tierOk('minimal', 'lite')).toBe(true);
    expect(tierOk('full', 'lite')).toBe(false);
  });
});
