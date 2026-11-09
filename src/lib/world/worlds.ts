// 월드 목록·지도 설정 (P5-03). 원본은 content/worlds/<slug>/world.yaml·map.yaml,
// `npm run content:build`가 worlds.generated.ts 로 만듭니다. 지도 좌표를 코드에 쓰지 않습니다.

import type {
  MapLayout,
  WorldMapConfig,
  WorldUnlockRule,
} from '@/lib/content/schema';

import { WORLDS } from './worlds.generated';

export { WORLDS };

export interface WorldInfo {
  slug: string;
  order: number;
  /** 화면 이름 (가칭이면 world.yaml 에서만 바꿈) */
  title: string;
  /** 테마 키 (world.yaml theme) */
  theme: string;
  unlock_rule: WorldUnlockRule;
  /** 스테이지가 있는지. false 면 "준비 중" */
  ready: boolean;
  /** 지도 설정. 준비 중 월드는 null */
  map: WorldMapConfig | null;
}

export type MapPoint = MapLayout['nodes'][number];

export function getWorld(slug: string): WorldInfo | undefined {
  return WORLDS.find((w) => w.slug === slug);
}

/** 노드를 잇는 길의 SVG path. catmull_rom 은 시안 smooth()(Catmull-Rom → 3차 베지어) */
export function mapPath(
  points: readonly MapPoint[],
  curve: WorldMapConfig['path'],
): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (curve === 'straight') {
      d += ` L${p2[0]} ${p2[1]}`;
      continue;
    }
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const t = 0.5 / 3;
    d += ` C${round(p1[0] + (p2[0] - p0[0]) * t)} ${round(p1[1] + (p2[1] - p0[1]) * t)} ${round(p2[0] - (p3[0] - p1[0]) * t)} ${round(p2[1] - (p3[1] - p1[1]) * t)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** 노드 위치를 지도 상자에 대한 백분율로 (absolute 배치용) */
export function nodePercent(
  layout: MapLayout,
  [x, y]: MapPoint,
): { left: string; top: string } {
  return {
    left: `${round((x / layout.width) * 100)}%`,
    top: `${round((y / layout.height) * 100)}%`,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
