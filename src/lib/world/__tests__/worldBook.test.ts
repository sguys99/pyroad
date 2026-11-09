import { describe, expect, it, vi } from 'vitest';

import type { WorldStatus, WorldWithStatus } from '../getStageStatuses';
import { serverWorlds } from '../serverWorlds';
import {
  bookNo,
  toBook,
  unlockAfter,
  unlockText,
  worldPath,
} from '../worldBook';
import { WORLDS } from '../worlds';

vi.mock('server-only', () => ({}));

function world(slug: string, title: string, status: WorldStatus) {
  return {
    world: { slug, title, order: 0 },
    status,
    stages: [],
    completedStageCount: 0,
    completedQuestCount: 0,
    totalQuestCount: 0,
  } as unknown as WorldWithStatus;
}

// 실제 구성: 1 파이썬 섬(열림) · 2 코드 바다·3 메이커 시티(준비 중) · 테스트 월드(잠김)
const WORLD_LIST = [
  world('python-island', '파이썬 섬', 'open'),
  world('code-sea', '코드 바다', 'coming_soon'),
  world('maker-city', '메이커 시티', 'coming_soon'),
  world('test-meadow', '테스트 들판', 'locked'),
];

describe('월드 책 문구 (P5-01)', () => {
  it('해제 조건은 바로 앞 월드, 받침에 맞는 조사', () => {
    expect(unlockText(WORLD_LIST, 1)).toBe('파이썬 섬을 다 모험하면 열려요');
    const two = [
      world('a', '파이썬 섬', 'cleared'),
      world('b', '코드 바다', 'open'),
      world('c', '메이커 시티', 'locked'),
    ];
    expect(unlockText(two, 2)).toBe('코드 바다를 다 모험하면 열려요');
  });

  it('준비 중 월드는 건너뛰고 그 앞의 진짜 월드 기준', () => {
    expect(unlockAfter(WORLD_LIST, 3)?.world.slug).toBe('python-island');
    expect(unlockText(WORLD_LIST, 2)).toBe('파이썬 섬을 다 모험하면 열려요');
    expect(unlockText(WORLD_LIST, 3)).toBe('파이썬 섬을 다 모험하면 열려요');
  });

  it('앞 월드가 없으면 일반 문구', () => {
    expect(unlockAfter(WORLD_LIST, 0)).toBeNull();
    expect(unlockText([world('x', '혼자 섬', 'locked')], 0)).toBe(
      '앞 월드를 다 모험하면 열려요',
    );
  });

  it('권 번호·주소·카드 값', () => {
    expect(bookNo(WORLD_LIST, 'test-meadow')).toBe(4);
    expect(worldPath('code-sea')).toBe('/world/code-sea');
    expect(worldPath(undefined)).toBe('/world');
    expect(toBook(WORLD_LIST[0])).toMatchObject({
      slug: 'python-island',
      status: 'open',
      totalStages: 0,
    });
  });
});

describe('serverWorlds (e2e 테스트 월드)', () => {
  it('운영 env 에서는 커밋한 월드만', () => {
    expect(serverWorlds({ NODE_ENV: 'production' })).toBe(WORLDS);
    // 파일 경로가 있어도 테스트 페이지가 꺼져 있으면 무시
    expect(
      serverWorlds({ NODE_ENV: 'production', PYROAD_E2E_WORLDS: '/x.json' }),
    ).toBe(WORLDS);
  });

  it('파일이 없으면 커밋한 월드만', () => {
    expect(
      serverWorlds({
        NODE_ENV: 'production',
        PYROAD_TEST_PAGES: '1',
        PYROAD_E2E_WORLDS: '/no/such/worlds.json',
      }),
    ).toBe(WORLDS);
  });
});
