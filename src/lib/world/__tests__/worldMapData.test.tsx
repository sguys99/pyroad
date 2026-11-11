// @vitest-environment jsdom
// "데이터만 추가하면 지도가 나온다" (P5-03, Q48): 실제 content/ 에 테스트 월드(e2e/fixtures/content)를
// 디렉토리째 더하고, 코드는 그대로 둔 채 빌드 결과·지도 렌더가 나오는지 본다.
import { cpSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorldMap } from '@/components/world/WorldMap';
import { toWorldInfos } from '@/lib/content/build';
import { loadContent } from '@/lib/content/load';
import type { StageWithStatus } from '@/lib/types/database';

import {
  HERE_MARKER,
  mapPath,
  mapRoute,
  markerSide,
  nodePercent,
  PET_SLOT,
  petOffset,
  WORLDS,
} from '../worlds';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock('@/components/providers/SoundProvider', () => ({
  useSfx: () => () => {},
}));

const ROOT = resolve(__dirname, '../../../..');
const FIXTURE = join(ROOT, 'e2e/fixtures/content/worlds/test-meadow');

/** content/ 복사본 + 테스트 월드 디렉토리 */
function contentWithFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'pyroad-worlds-'));
  cpSync(join(ROOT, 'content'), dir, { recursive: true });
  cpSync(FIXTURE, join(dir, 'worlds/test-meadow'), { recursive: true });
  return dir;
}

afterEach(cleanup);

describe('월드 지도 데이터 (P5-03)', () => {
  it('커밋한 월드 목록: 1월드는 지도, 2·3월드는 지도 없는 "준비 중"', () => {
    expect(WORLDS.map((w) => [w.slug, w.ready, w.map !== null])).toEqual([
      ['python-island', true, true],
      ['code-sea', false, false],
      ['maker-city', false, false],
    ]);
    expect(WORLDS[1].unlock_rule).toEqual({ type: 'previous_world_cleared' });
  });

  it('월드 디렉토리만 더하면 지도 레이아웃이 나옴', () => {
    const worlds = toWorldInfos(loadContent(contentWithFixture()));
    const meadow = worlds.find((w) => w.slug === 'test-meadow');
    expect(worlds.map((w) => w.slug)).toEqual([
      'python-island',
      'code-sea',
      'maker-city',
      'test-meadow',
    ]);
    expect(meadow?.ready).toBe(true);
    const map = meadow!.map!;
    expect(map.bgm).toBe('world2');

    const stages = [1, 2, 3].map(
      (order): StageWithStatus => ({
        id: `s${order}`,
        world_id: 'w',
        order,
        title: `테스트 스테이지 ${order}`,
        theme_name: 'test',
        description: '',
        is_final: order === 3,
        created_at: '',
        status:
          order === 1 ? 'completed' : order === 2 ? 'in_progress' : 'locked',
        quests: [],
        completedQuestCount: 0,
        totalQuestCount: 1,
        firstIncompleteQuestId: order < 3 ? `q${order}` : null,
        stars: 0,
        maxStars: 3,
      }),
    );
    const { container, rerender } = render(
      <MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
        <WorldMap stages={stages} map={map} />
      </MotionConfig>,
    );
    // 동행 펫 슬롯 (P5-08): 펫이 없으면(운영 지금) DOM 없음
    expect(container.querySelector('[data-testid="world-pet"]')).toBeNull();

    const nodes = [
      ...container.querySelectorAll<HTMLElement>('.world-node.z-10'),
    ];
    expect(nodes).toHaveLength(3);
    // 노드 1: wide [200, 400] / 1000×500, tall [120, 800] / 400×900
    expect(nodes[0].style.getPropertyValue('--wl')).toBe('20%');
    expect(nodes[0].style.getPropertyValue('--wt')).toBe('80%');
    expect(nodes[0].style.getPropertyValue('--tl')).toBe('30%');
    expect(nodes[0].style.getPropertyValue('--tt')).toBe('88.89%');
    expect(nodes[2].textContent).toContain('테스트 스테이지 3');

    const box = container.querySelector<HTMLElement>('.world-map')!;
    expect(box.style.getPropertyValue('--wide-ratio')).toBe('1000 / 500');
    expect(box.style.getPropertyValue('--tall-ratio')).toBe('400 / 900');
    const viewBoxes = [...container.querySelectorAll('svg')].map((s) =>
      s.getAttribute('viewBox'),
    );
    expect(viewBoxes).toEqual(
      expect.arrayContaining(['0 0 400 900', '0 0 1000 500']),
    );

    // 펫이 있으면 지금 위치 파이뱀과 같은 겹에서 파이뱀보다 먼저(뒤에) 그려지고, 노드마다 펫 자리 변수
    rerender(
      <MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
        <WorldMap
          stages={stages}
          map={map}
          pet={{ id: 'sample', art: <i data-testid="pet-art" /> }}
        />
      </MotionConfig>,
    );
    const pet = container.querySelector('[data-testid="world-pet"]')!;
    expect(pet.getAttribute('data-pet')).toBe('sample');
    expect(pet.querySelector('[data-testid="pet-art"]')).not.toBeNull();
    const marker = container.querySelector(
      '[data-testid="world-current-marker"]',
    )!;
    expect(
      pet.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(nodes[0].style.getPropertyValue('--wpx')).not.toBe('');
    expect(nodes[0].style.getPropertyValue('--tpx')).not.toBe('');
  });
});

describe('mapPath', () => {
  const pts: [number, number][] = [
    [0, 0],
    [100, 0],
    [100, 100],
  ];

  it('catmull_rom: 노드마다 3차 베지어 한 조각, 노드를 지남', () => {
    const d = mapPath(pts, 'catmull_rom');
    expect(d.startsWith('M0 0 C')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(d.endsWith('100 100')).toBe(true);
    // 시안 smooth() 와 같은 첫 조각: 제어점 (0+100/6, 0), (100-100/6, 0-100/6)
    expect(d).toContain('C16.67 0 83.33 -16.67 100 0');
  });

  it('straight: 직선', () => {
    expect(mapPath(pts, 'straight')).toBe('M0 0 L100 0 L100 100');
  });

  it('노드가 하나뿐이면 길 없음', () => {
    expect(mapPath([[1, 1]], 'catmull_rom')).toBe('');
  });

  it('mapRoute: 지난 길·남은 길은 전체 길의 조각을 지금 노드에서 나눈 것', () => {
    const all = mapPath(pts, 'catmull_rom');
    const r = mapRoute(pts, 'catmull_rom', 1);
    expect(r.all).toBe(all);
    expect(r.done).toBe('M0 0 C16.67 0 83.33 -16.67 100 0');
    expect(r.todo.startsWith('M100 0 C')).toBe(true);
    expect(r.done + r.todo.slice('M100 0'.length)).toBe(all);
    expect(mapRoute(pts, 'catmull_rom', 0).done).toBe('');
    expect(mapRoute(pts, 'catmull_rom', -1).todo).toBe(all);
    expect(mapRoute(pts, 'straight', 2)).toEqual({
      all: 'M0 0 L100 0 L100 100',
      done: 'M0 0 L100 0 L100 100',
      todo: '',
    });
  });

  it('nodePercent', () => {
    expect(
      nodePercent(
        { width: 400, height: 1180, node_scale: 1, nodes: [] },
        [104, 1080],
      ),
    ).toEqual({ left: '26%', top: '91.53%' });
  });
});

describe('동행 펫 자리 petOffset (P5-08)', () => {
  const layout = { width: 1000, height: 500, node_scale: 1, nodes: [] };
  it('보통은 파이뱀 바깥쪽(파이뱀 뒤)', () => {
    expect(petOffset(layout, 500, -1)).toBe(
      -(HERE_MARKER.offset + PET_SLOT.gap),
    );
    expect(petOffset(layout, 500, 1)).toBe(HERE_MARKER.offset + PET_SLOT.gap);
  });
  it('바깥이 지도 밖이면 노드 쪽', () => {
    expect(petOffset(layout, 940, 1)).toBe(HERE_MARKER.offset - PET_SLOT.gap);
    expect(petOffset(layout, 60, -1)).toBe(
      -(HERE_MARKER.offset - PET_SLOT.gap),
    );
  });
});

describe('지금 위치 파이뱀이 지도 밖으로 잘리지 않음 (P5-10)', () => {
  it('첫 스테이지(지도 왼쪽 끝)에서는 오른쪽에 선다', () => {
    const wide = WORLDS[0].map!.layouts.wide;
    expect(markerSide(wide, wide.nodes[0][0], -1)).toBe(1);
    expect(markerSide(wide, wide.nodes[3][0], -1)).toBe(-1);
  });

  it('모든 월드(+ 테스트 월드) × 가로·세로 지도 × 모든 노드', () => {
    const worlds = toWorldInfos(loadContent(contentWithFixture()));
    let checked = 0;
    for (const w of worlds) {
      if (!w.map) continue;
      for (const [name, layout] of Object.entries(w.map.layouts)) {
        for (const [x, y] of layout.nodes) {
          // WorldMap nodeVars 와 같은 바라는 쪽: 가로는 왼쪽, 세로는 지도 가운데 쪽
          const prefer = name === 'wide' ? -1 : x < layout.width / 2 ? 1 : -1;
          const c = x + markerSide(layout, x, prefer) * HERE_MARKER.offset;
          const where = `${w.slug} ${name} (${x}, ${y})`;
          expect(c - HERE_MARKER.half, where).toBeGreaterThanOrEqual(0);
          expect(c + HERE_MARKER.half, where).toBeLessThanOrEqual(layout.width);
          expect(y - HERE_MARKER.height, where).toBeGreaterThanOrEqual(0);
          // 동행 펫 자리(P5-08)도 지도 안
          const side = markerSide(layout, x, prefer);
          const pc = x + petOffset(layout, x, side);
          expect(pc - PET_SLOT.half, `pet ${where}`).toBeGreaterThanOrEqual(0);
          expect(pc + PET_SLOT.half, `pet ${where}`).toBeLessThanOrEqual(
            layout.width,
          );
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(14);
  });
});
