import { describe, expect, it } from 'vitest';
import { AMBIENT_CAP, ambientPlan } from '../ambient';
import { WORLDS, mapPath } from '../worlds';

const island = WORLDS.find((w) => w.slug === 'python-island')!.map!;

describe('지도 앰비언트 자리 (P5-09)', () => {
  it('ambient가 없으면 아무것도 두지 않는다', () => {
    const p = ambientPlan(island.layouts.wide, island.path, undefined);
    expect(Object.values(p).flat()).toEqual([]);
  });

  it('스위치를 끄면 그 종류만 빠진다', () => {
    const p = ambientPlan(island.layouts.wide, island.path, {
      clouds: false,
      sparkles: true,
      weather: 'none',
    });
    expect(p.clouds).toEqual([]);
    expect(p.leaves).toEqual([]);
    expect(p.seaSparks.length + p.roadSparks.length).toBeGreaterThan(0);
  });

  for (const name of ['wide', 'tall'] as const) {
    it(`${name}: 종류별 상한을 넘지 않고, 모든 자리가 지도 안`, () => {
      const layout = island.layouts[name];
      const p = ambientPlan(layout, island.path, island.ambient);
      expect(p.clouds.length).toBeLessThanOrEqual(AMBIENT_CAP.clouds);
      expect(p.leaves.length).toBeLessThanOrEqual(AMBIENT_CAP.leaves);
      expect(p.seaSparks.length + p.roadSparks.length).toBeLessThanOrEqual(
        AMBIENT_CAP.sparkles,
      );
      for (const [x, y] of Object.values(p).flat()) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(layout.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(layout.height);
      }
    });
  }

  it('길 반짝임은 길 곡선 위(mapPath 조각의 가운데)에 놓인다', () => {
    const layout = island.layouts.wide;
    const p = ambientPlan(layout, island.path, island.ambient);
    // 첫 조각 "C c1x c1y c2x c2y x y" 의 t=0.5
    const seg = mapPath(layout.nodes, island.path).split(/ (?=C)/)[1];
    const [c1x, c1y, c2x, c2y, x2, y2] = seg
      .slice(1)
      .trim()
      .split(/\s+/)
      .map(Number);
    const [x1, y1] = layout.nodes[0];
    const mid = [
      (x1 + 3 * c1x + 3 * c2x + x2) / 8,
      (y1 + 3 * c1y + 3 * c2y + y2) / 8,
    ];
    expect(p.roadSparks[0][0]).toBeCloseTo(mid[0], 0);
    expect(p.roadSparks[0][1]).toBeCloseTo(mid[1], 0);
  });
});
