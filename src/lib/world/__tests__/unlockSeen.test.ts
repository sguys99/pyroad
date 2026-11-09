import { describe, expect, it } from 'vitest';

import { planUnlocks, pickUnlockIndex } from '../unlockSeen';
import { mapPath, mapSegment } from '../worlds';

describe('planUnlocks (P5-05)', () => {
  it('본 기록을 못 읽으면 아무것도 안 함', () => {
    expect(planUnlocks(['s1', 's2'], null)).toBeNull();
  });

  it('기록이 하나도 없는 사용자(기존·새 사용자)는 지금 열린 전부를 조용히 기록', () => {
    expect(planUnlocks(['s1', 's2', 's3'], [])).toEqual({
      silent: true,
      stageIds: ['s1', 's2', 's3'],
    });
  });

  it('열렸는데 기록이 없는 것만 새로 열린 스테이지 (열린 순서 그대로)', () => {
    expect(planUnlocks(['s1', 's2', 's3'], ['s1'])).toEqual({
      silent: false,
      stageIds: ['s2', 's3'],
    });
  });

  it('다 봤으면 빈 목록, 진행 리셋으로 다시 잠긴 스테이지의 기록은 무시', () => {
    expect(planUnlocks(['s1'], ['s1', 's2'])).toEqual({
      silent: false,
      stageIds: [],
    });
  });
});

describe('pickUnlockIndex', () => {
  const stages = [
    { id: 's1', status: 'completed' },
    { id: 's2', status: 'completed' },
    { id: 's3', status: 'in_progress' },
    { id: 's4', status: 'locked' },
  ];

  it('이 지도에서 새로 열린 것 중 가장 뒤', () => {
    expect(pickUnlockIndex(stages, ['s2', 's3'])).toBe(2);
  });

  it('다른 월드 스테이지만 새로 열렸거나 잠긴 것이면 -1', () => {
    expect(pickUnlockIndex(stages, ['other-world'])).toBe(-1);
    expect(pickUnlockIndex(stages, ['s4'])).toBe(-1);
  });
});

describe('mapSegment', () => {
  const pts: [number, number][] = [
    [0, 0],
    [100, 50],
    [200, 0],
    [300, 80],
  ];

  it('전체 길의 i번째 조각과 같은 곡선, i번째 노드에서 시작', () => {
    const segs = mapPath(pts, 'catmull_rom').split(/ (?=[CL])/);
    expect(mapSegment(pts, 'catmull_rom', 1)).toBe(`M100 50 ${segs[2]}`);
    expect(mapSegment(pts, 'straight', 2)).toBe('M200 0 L300 80');
  });

  it('마지막 노드 뒤는 빈 문자열', () => {
    expect(mapSegment(pts, 'catmull_rom', 3)).toBe('');
  });
});
