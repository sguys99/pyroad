import { describe, expect, it } from 'vitest';

import { toWorldMapData, type WorldMapRaw } from '../mapData';
import { WORLDS } from '../worlds';

const ME = 'user-me';
const OTHER = 'user-other';

const stage = (id: string, order: number, questIds: string[]) => ({
  id,
  world_id: 'w1',
  order,
  title: `스테이지 ${order}`,
  theme_name: 't',
  description: '',
  is_final: false,
  created_at: '2026-01-01T00:00:00Z',
  world: { order: 1 },
  // 일부러 order 역순으로 넣어 정렬 확인
  quests: questIds
    .map((qid, i) => ({
      id: qid,
      order: i + 1,
      title: `퀘스트 ${qid}`,
      quest_type: 'code',
      is_mobile_friendly: i === 0,
    }))
    .reverse(),
});

function raw(over: Partial<WorldMapRaw> = {}): WorldMapRaw {
  return {
    stages: [stage('s1', 1, ['q1', 'q2']), stage('s2', 2, ['q3'])],
    progress: [
      {
        user_id: ME,
        quest_id: 'q1',
        status: 'completed',
        best_stars: 3,
        completed_at: '2026-11-08T01:00:00Z',
      },
      {
        user_id: ME,
        quest_id: 'q2',
        status: 'in_progress',
        best_stars: 0,
        completed_at: null,
      },
      // RLS 가 막지만, 섞여 와도 무시돼야 함
      {
        user_id: OTHER,
        quest_id: 'q2',
        status: 'completed',
        best_stars: 2,
        completed_at: '2026-11-08T02:00:00Z',
      },
    ],
    profile: {
      id: ME,
      total_xp: 120,
      current_level: 2,
      user_public_profiles: { public_name: '파이', avatar_skin: null },
    },
    badges: [
      { user_id: ME, badge_type: 'first_code', earned_at: '2026-11-08' },
      { user_id: OTHER, badge_type: 'streak_3', earned_at: '2026-11-08' },
    ],
    apiKeys: { enabled: true, keys: {} },
    ...over,
  };
}

describe('toWorldMapData (P5-13)', () => {
  it('스테이지별 퀘스트 목록: order 순, 공개 열 + 내 진행만', () => {
    const data = toWorldMapData(ME, raw(), WORLDS);
    expect(data.questsByStage.s1).toEqual([
      {
        id: 'q1',
        order: 1,
        title: '퀘스트 q1',
        quest_type: 'code',
        is_mobile_friendly: true,
        status: 'completed',
        best_stars: 3,
      },
      {
        id: 'q2',
        order: 2,
        title: '퀘스트 q2',
        quest_type: 'code',
        is_mobile_friendly: false,
        status: 'in_progress',
        best_stars: 0,
      },
    ]);
    expect(data.questsByStage.s2[0]).toMatchObject({
      status: null,
      best_stars: 0,
    });
  });

  it('남의 진행·뱃지·프로필은 버린다', () => {
    const data = toWorldMapData(ME, raw(), WORLDS);
    // 남의 q2 완료가 섞였으면 s1 이 클리어돼 s2 가 열렸을 것
    expect(data.progress.current?.stages.map((s) => s.status)).toEqual([
      'in_progress',
      'locked',
    ]);
    expect(data.badges).toEqual([
      { badge_type: 'first_code', earned_at: '2026-11-08' },
    ]);
    expect(data.completedAt).toEqual(['2026-11-08T01:00:00Z']);
    expect(
      toWorldMapData(OTHER, raw({ progress: [], badges: [] }), WORLDS).profile,
    ).toBeNull();
  });

  it('HUD 프로필과 API 키 안내', () => {
    const data = toWorldMapData(ME, raw(), WORLDS);
    expect(data.profile).toMatchObject({
      id: ME,
      name: '파이',
      total_xp: 120,
      current_level: 2,
    });
    expect(data.showApiKeyAlert).toBe(true);
    expect(
      toWorldMapData(
        ME,
        raw({ apiKeys: { enabled: true, keys: { a: 'k' } } }),
        WORLDS,
      ).showApiKeyAlert,
    ).toBe(false);
    expect(
      toWorldMapData(ME, raw({ apiKeys: { enabled: false, keys: {} } }), WORLDS)
        .showApiKeyAlert,
    ).toBe(false);
    expect(
      toWorldMapData(ME, raw({ apiKeys: null }), WORLDS).showApiKeyAlert,
    ).toBe(false);
  });
});
