// 지도 앰비언트 자리 (P5-09). map.yaml `ambient` 스위치 + 레이아웃 좌표 → 구름·반짝임·나뭇잎을 둘 viewBox 좌표.
// 움직임(CSS, full만)은 MapArt·worldMap.css가 맡고, 여기서는 "어디에 몇 개"만 정한다. 개수 상한이 동시 애니메이션 수 상한이다.

import type {
  MapAmbient,
  MapLayout,
  WorldMapConfig,
} from '@/lib/content/schema';
import type { MapPoint } from './worlds';

/** 종류별 상한. 한 레이아웃에서 도는 앰비언트 애니메이션 = 물결·배·새(장식 수) + 아래 합 */
export const AMBIENT_CAP = { clouds: 3, sparkles: 5, leaves: 3 } as const;

/** 지도 상자에 대한 비율 (가로·세로 0~1). 노드·랜드마크와 겹쳐도 구름은 길 아래 레이어라 가리지 않는다 */
const CLOUDS: ReadonlyArray<MapPoint> = [
  [0.06, 0.08],
  [0.46, 0.17],
  [0.76, 0.04],
];
const LEAVES: ReadonlyArray<MapPoint> = [
  [0.22, 0.18],
  [0.6, 0.34],
  [0.86, 0.52],
];

export interface AmbientPlan {
  clouds: MapPoint[];
  /** 바다 반짝임: 물결 장식 옆 */
  seaSparks: MapPoint[];
  /** 길 반짝임: 짝수 번째 길 조각의 가운데 (길 레이어, 패럴랙스 없음) */
  roadSparks: MapPoint[];
  leaves: MapPoint[];
}

/** i → i+1 길 조각의 가운데 점. mapPath 의 catmull_rom(3차 베지어 t=0.5) 과 같은 곡선 */
function segmentMid(
  p: readonly MapPoint[],
  i: number,
  curve: WorldMapConfig['path'],
): MapPoint {
  const p1 = p[i];
  const p2 = p[i + 1];
  if (curve === 'straight') return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const p0 = p[i - 1] ?? p1;
  const p3 = p[i + 2] ?? p2;
  const t = 0.5 / 3;
  const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
  const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
  const mid = (k: 0 | 1) => (p1[k] + 3 * c1[k] + 3 * c2[k] + p2[k]) / 8;
  return [mid(0), mid(1)];
}

const scaled = (layout: MapLayout, pts: ReadonlyArray<MapPoint>) =>
  pts.map(([fx, fy]): MapPoint => [fx * layout.width, fy * layout.height]);

export function ambientPlan(
  layout: MapLayout,
  curve: WorldMapConfig['path'],
  ambient: MapAmbient | undefined,
): AmbientPlan {
  const none: AmbientPlan = {
    clouds: [],
    seaSparks: [],
    roadSparks: [],
    leaves: [],
  };
  if (!ambient) return none;
  const sea: MapPoint[] = [];
  const road: MapPoint[] = [];
  if (ambient.sparkles) {
    for (const d of layout.decorations ?? [])
      if (d.kind === 'waves') sea.push([d.x + 34 * (d.scale ?? 1), d.y - 10]);
    for (let i = 0; i < layout.nodes.length - 1; i += 2)
      road.push(segmentMid(layout.nodes, i, curve));
  }
  // 바다 쪽을 먼저 채우고 남는 만큼 길에
  const seaSparks = sea.slice(0, AMBIENT_CAP.sparkles);
  return {
    clouds: ambient.clouds
      ? scaled(layout, CLOUDS.slice(0, AMBIENT_CAP.clouds))
      : [],
    seaSparks,
    roadSparks: road.slice(0, AMBIENT_CAP.sparkles - seaSparks.length),
    leaves:
      ambient.weather === 'leaves'
        ? scaled(layout, LEAVES.slice(0, AMBIENT_CAP.leaves))
        : [],
  };
}
