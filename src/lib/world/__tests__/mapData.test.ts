import { describe, expect, it } from 'vitest';

import {
  pickContinue,
  toWorldMapData,
  type ProgressRow,
  type WorldMapRaw,
} from '../mapData';
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
      concept: `개념 ${qid}`,
      quest_type: 'code',
      quiz_kind: null,
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
        used_golden_key: false,
        created_at: '2026-11-08T00:00:00Z',
      },
      {
        user_id: ME,
        quest_id: 'q2',
        status: 'in_progress',
        best_stars: 0,
        completed_at: null,
        used_golden_key: false,
        created_at: '2026-11-08T00:00:00Z',
      },
      // RLS 가 막지만, 섞여 와도 무시돼야 함
      {
        user_id: OTHER,
        quest_id: 'q2',
        status: 'completed',
        best_stars: 2,
        completed_at: '2026-11-08T02:00:00Z',
        used_golden_key: false,
        created_at: '2026-11-08T00:00:00Z',
      },
    ],
    profile: {
      id: ME,
      total_xp: 120,
      current_level: 2,
      user_public_profiles: { public_name: '파이', avatar_skin: null },
    },
    apiKeys: { enabled: true, keys: {} },
    seen: [],
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
        concept: '개념 q1',
        quest_type: 'code',
        quiz_kind: null,
        is_mobile_friendly: true,
        status: 'completed',
        best_stars: 3,
        stars_judged_on: null,
        completed_at: '2026-11-08T01:00:00Z',
      },
      {
        id: 'q2',
        order: 2,
        title: '퀘스트 q2',
        concept: '개념 q2',
        quest_type: 'code',
        quiz_kind: null,
        is_mobile_friendly: false,
        status: 'in_progress',
        best_stars: 0,
        stars_judged_on: null,
        completed_at: null,
      },
    ]);
    expect(data.questsByStage.s2[0]).toMatchObject({
      status: null,
      best_stars: 0,
    });
  });

  it('남의 진행·프로필은 버린다', () => {
    const data = toWorldMapData(ME, raw(), WORLDS);
    // 남의 q2 완료가 섞였으면 s1 이 클리어돼 s2 가 열렸을 것
    expect(data.progress.current?.stages.map((s) => s.status)).toEqual([
      'in_progress',
      'locked',
    ]);
    expect(data.completedAt).toEqual(['2026-11-08T01:00:00Z']);
    expect(
      toWorldMapData(OTHER, raw({ progress: [] }), WORLDS).profile,
    ).toBeNull();
  });

  it('오늘의 퀴즈 (P7-10): 열린 스테이지 퀴즈를 고르고, 오늘 내 시도로만 끝난 문제를 센다', () => {
    const base = raw();
    const plain = stage('s1', 1, ['q1', 'q2']);
    const s1 = {
      ...plain,
      quests: plain.quests.map((q) =>
        q.id === 'q2'
          ? { ...q, quest_type: 'quiz', quiz_kind: 'parsons' as string | null }
          : q,
      ),
    };
    const attempt = (user_id: string) => ({
      user_id,
      quest_id: 'q2',
      attempt_no: 1,
      is_correct: true,
      created_at: '2026-11-10T01:00:00Z',
    });
    const at = (attempts: ReturnType<typeof attempt>[]) =>
      toWorldMapData(
        ME,
        { ...base, stages: [s1, base.stages[1]], attempts },
        WORLDS,
        '2026-11-10',
      ).daily;
    expect(at([attempt(OTHER)])).toEqual({
      today: '2026-11-10',
      picks: [
        {
          questId: 'q2',
          title: '퀘스트 q2',
          kind: 'parsons',
          stageOrder: 1,
          review: false,
        },
      ],
      results: {},
    });
    expect(at([attempt(ME)]).results).toEqual({ q2: 'correct' });
    // 시도를 못 읽었으면(null) 끝난 문제 없음
    expect(toWorldMapData(ME, base, WORLDS, '2026-11-10').daily.picks).toEqual(
      [],
    );
  });

  it('황금키로 완료한 시각은 스트릭에서 뺀다', () => {
    const base = raw();
    const data = toWorldMapData(
      ME,
      {
        ...base,
        progress: base.progress.map((p) => ({ ...p, used_golden_key: true })),
      },
      WORLDS,
    );
    expect(data.completedAt).toEqual([]);
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

describe('이어하기 대상 pickContinue (P5-10)', () => {
  const stages = [stage('s1', 1, ['q1', 'q2', 'q3']), stage('s2', 2, ['q4'])];
  const row = (
    quest_id: string,
    status: string,
    created_at = '2026-11-08T00:00:00Z',
  ): ProgressRow => ({
    user_id: ME,
    quest_id,
    status,
    best_stars: 0,
    completed_at: status === 'completed' ? created_at : null,
    used_golden_key: false,
    created_at,
  });
  const pick = (progress: ProgressRow[]) =>
    toWorldMapData(ME, { ...raw(), stages, progress }, WORLDS).continueTarget;

  it('진행이 하나도 없으면 첫 퀘스트로 "모험 시작하기"', () => {
    expect(pick([])).toEqual({
      questId: 'q1',
      questTitle: '퀘스트 q1',
      stageOrder: 1,
      stageTitle: '스테이지 1',
      kind: 'start',
    });
  });

  it('하던 퀘스트가 없으면 다음 차례 (현재 스테이지 첫 미완료)', () => {
    expect(pick([row('q1', 'completed')])).toMatchObject({
      questId: 'q2',
      kind: 'next',
    });
  });

  it('하다 만 퀘스트가 있으면 차례보다 그 퀘스트, 여럿이면 가장 늦게 시작한 것', () => {
    expect(
      pick([row('q1', 'completed'), row('q3', 'in_progress')]),
    ).toMatchObject({ questId: 'q3', kind: 'recent' });
    expect(
      pick([
        row('q1', 'completed'),
        row('q3', 'in_progress', '2026-11-08T03:00:00Z'),
        row('q2', 'in_progress', '2026-11-08T05:00:00Z'),
      ]),
    ).toMatchObject({ questId: 'q2', kind: 'recent' });
  });

  it('잠긴 스테이지의 퀘스트는 가리키지 않는다 (진행 행이 남아 있어도)', () => {
    expect(
      pick([
        row('q1', 'completed'),
        row('q4', 'in_progress', '2026-11-09T00:00:00Z'),
      ]),
    ).toMatchObject({ questId: 'q2', kind: 'next', stageOrder: 1 });
  });

  it('다음 스테이지로 넘어가면 그 스테이지 차례', () => {
    expect(
      pick(['q1', 'q2', 'q3'].map((q) => row(q, 'completed'))),
    ).toMatchObject({ questId: 'q4', stageOrder: 2, kind: 'next' });
  });

  it('열린 퀘스트를 다 깼으면 없음', () => {
    expect(
      pick(['q1', 'q2', 'q3', 'q4'].map((q) => row(q, 'completed'))),
    ).toBeNull();
  });

  it('스테이지가 없으면 없음', () => {
    const empty = toWorldMapData(ME, { ...raw(), stages: [] }, WORLDS);
    expect(pickContinue(empty.progress, [], {})).toBeNull();
  });
});

describe('toWorldMapData 잠금 해제 본 기록 (P5-05)', () => {
  it('기록이 없으면 지금 열린 스테이지를 조용히 기록', () => {
    expect(toWorldMapData(ME, raw(), WORLDS).unlocks).toEqual({
      silent: true,
      stageIds: ['s1'],
    });
  });

  it('남의 행은 무시하고, 본 기록과 비교해 새로 열린 스테이지만', () => {
    const done = raw({
      progress: [
        ...raw().progress,
        {
          user_id: ME,
          quest_id: 'q2',
          status: 'completed',
          best_stars: 0,
          completed_at: '2026-11-08T03:00:00Z',
          used_golden_key: false,
          created_at: '2026-11-08T00:00:00Z',
        },
      ].filter((p) => !(p.user_id === ME && p.status === 'in_progress')),
      seen: [
        { user_id: ME, stage_id: 's1' },
        { user_id: OTHER, stage_id: 's2' },
      ],
    });
    expect(toWorldMapData(ME, done, WORLDS).unlocks).toEqual({
      silent: false,
      stageIds: ['s2'],
    });
  });

  it('본 기록을 읽지 못했으면(00025 전 DB) null', () => {
    expect(toWorldMapData(ME, raw({ seen: null }), WORLDS).unlocks).toBeNull();
  });
});
