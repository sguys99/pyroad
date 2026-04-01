import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndAwardBadges } from '../checkBadges';
import type { SupabaseClient } from '@supabase/supabase-js';

// Supabase 체이너블 쿼리 모킹 헬퍼
function createMockSupabase(config: {
  existingBadges?: { badge_type: string }[];
  completedCount?: number;
  questStageId?: string;
  stageQuests?: { id: string }[];
  stageCompletedCount?: number;
  questWithStage?: { stage_id: string; stages: { is_final: boolean } } | null;
  completions?: { completed_at: string }[];
}) {
  const insertMock = vi.fn().mockResolvedValue({ error: null });

  // 각 from().select().eq()... 체인 호출을 추적하기 위한 상태
  let fromTable = '';
  let selectCalled = false;
  let eqCalls: [string, string][] = [];
  let inCalls: [string, string[]][] = [];

  const chainable = {
    select: vi.fn().mockImplementation(() => {
      selectCalled = true;
      return chainable;
    }),
    eq: vi.fn().mockImplementation((col: string, val: string) => {
      eqCalls.push([col, val]);
      return chainable;
    }),
    in: vi.fn().mockImplementation((col: string, vals: string[]) => {
      inCalls.push([col, vals]);
      return chainable;
    }),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      // streak_3: completions 반환
      if (fromTable === 'user_progress' && config.completions) {
        return Promise.resolve({ data: config.completions, error: null });
      }
      return chainable;
    }),
    single: vi.fn().mockImplementation(() => {
      if (fromTable === 'quests' && eqCalls.some(([c]) => c === 'id')) {
        // stage_clear 또는 project_builder 분기
        if (selectCalled) {
          // project_builder: stages!inner 조인 여부
          const hasStagesJoin = (chainable.select as ReturnType<typeof vi.fn>).mock.calls
            .some((call: unknown[]) => typeof call[0] === 'string' && call[0].includes('stages'));
          if (hasStagesJoin) {
            return Promise.resolve({ data: config.questWithStage ?? null, error: null });
          }
          // stage_clear: quest의 stage_id 조회
          return Promise.resolve({
            data: config.questStageId ? { stage_id: config.questStageId } : null,
            error: null,
          });
        }
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };

  // 결과를 resolve하는 then을 추가 (Promise-like)
  const createResolvable = () => {
    const resolveByTable = () => {
      if (fromTable === 'user_badges') {
        return Promise.resolve({ data: config.existingBadges ?? [], error: null });
      }
      if (fromTable === 'user_progress') {
        // count 쿼리 vs 일반 쿼리 판별
        const isCount = (chainable.select as ReturnType<typeof vi.fn>).mock.calls
          .some((call: unknown[]) => {
            const opts = call[1] as { count?: string } | undefined;
            return opts?.count === 'exact';
          });
        if (isCount) {
          // in 호출이 있으면 stage_clear의 완료 수
          if (inCalls.length > 0) {
            return Promise.resolve({ count: config.stageCompletedCount ?? 0, error: null });
          }
          // first_code: completed count
          return Promise.resolve({ count: config.completedCount ?? 0, error: null });
        }
      }
      if (fromTable === 'quests' && !eqCalls.some(([c]) => c === 'id')) {
        // stage_clear: 스테이지의 퀘스트 목록
        return Promise.resolve({ data: config.stageQuests ?? [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    return resolveByTable();
  };

  // chainable의 마지막 호출에서 Promise를 반환하도록 설정
  // Supabase는 체인의 마지막에서 자동으로 Promise로 resolve됨
  // 이를 시뮬레이션하기 위해 then을 구현
  Object.defineProperty(chainable, 'then', {
    get() {
      return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        return createResolvable().then(resolve, reject);
      };
    },
  });

  const mockSupabase = {
    from: vi.fn().mockImplementation((table: string) => {
      fromTable = table;
      selectCalled = false;
      eqCalls = [];
      inCalls = [];

      if (table === 'user_badges' && !selectCalled) {
        // insert 호출을 위한 분기
        return {
          ...chainable,
          insert: insertMock,
        };
      }
      return chainable;
    }),
  } as unknown as SupabaseClient;

  return { mockSupabase, insertMock };
}

// 더 단순한 모킹 접근: 함수별 호출 순서 기반
function createSequentialMock(responses: {
  existingBadges: { badge_type: string }[];
  additionalQueries: Record<string, unknown>[];
}) {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  let queryIndex = 0;
  const allResponses = [
    { data: responses.existingBadges, error: null },
    ...responses.additionalQueries.map((r) => ({ ...r, error: null })),
  ];

  const makeChain = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'in', 'not', 'order', 'limit'];

    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }

    chain['single'] = vi.fn().mockImplementation(() => {
      const resp = allResponses[queryIndex++] ?? { data: null, error: null };
      return Promise.resolve(resp);
    });

    chain['insert'] = insertMock;

    // Promise-like behavior for awaiting the chain directly
    chain['then'] = undefined;
    Object.defineProperty(chain, 'then', {
      get() {
        return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
          const resp = allResponses[queryIndex++] ?? { data: null, error: null };
          return Promise.resolve(resp).then(resolve, reject);
        };
      },
    });

    return chain;
  };

  const mockSupabase = {
    from: vi.fn().mockImplementation(() => makeChain()),
  } as unknown as SupabaseClient;

  return { mockSupabase, insertMock };
}

describe('checkAndAwardBadges', () => {
  it('first_code: 첫 퀘스트 완료 시 반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        // first_code: completed count = 1
        { count: 1 },
        // stage_clear: quest stage lookup
        { data: { stage_id: 's1' } },
        // stage_clear: stage quests
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        // stage_clear: completed in stage
        { count: 1 },
        // project_builder: quest with stage
        { data: { stage_id: 's1', stages: { is_final: false } } },
        // streak_3: completions
        { data: [{ completed_at: '2026-01-01T00:00:00Z' }] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).toContain('first_code');
  });

  it('first_code: 이미 보유 시 스킵', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [{ badge_type: 'first_code' }],
      additionalQueries: [
        // stage_clear: quest stage lookup
        { data: { stage_id: 's1' } },
        // stage_clear: stage quests
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        // stage_clear: completed in stage
        { count: 1 },
        // project_builder: quest with stage
        { data: { stage_id: 's1', stages: { is_final: false } } },
        // streak_3: completions
        { data: [{ completed_at: '2026-01-01T00:00:00Z' }] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).not.toContain('first_code');
  });

  it('hint_master: 힌트 0회 시 반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 2 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        { count: 1 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 0,
    });

    expect(result).toContain('hint_master');
  });

  it('hint_master: 힌트 1회 시 미반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 2 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        { count: 1 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).not.toContain('hint_master');
  });

  it('stage_clear: 스테이지 전체 완료 시 반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 5 },
        // stage_clear: quest → stage_id
        { data: { stage_id: 's1' } },
        // stage_clear: stage의 퀘스트 목록
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        // stage_clear: 해당 스테이지 완료 수 = 퀘스트 수
        { count: 2 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).toContain('stage_clear');
  });

  it('stage_clear: 부분 완료 시 미반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 3 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }] },
        // 3개 중 2개만 완료
        { count: 2 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).not.toContain('stage_clear');
  });

  it('project_builder: is_final 스테이지 퀘스트 시 반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 10 },
        { data: { stage_id: 's7' } },
        { data: [{ id: 'q7-1' }] },
        { count: 1 },
        // project_builder: is_final = true
        { data: { stage_id: 's7', stages: { is_final: true } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q7-1',
      hintsUsed: 1,
    });

    expect(result).toContain('project_builder');
  });

  it('project_builder: is_final false 시 미반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 5 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        { count: 1 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        { data: [] },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).not.toContain('project_builder');
  });

  it('streak_3: 3일 연속 완료 시 반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 5 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        { count: 1 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        // 3일 연속 (KST)
        {
          data: [
            { completed_at: '2026-01-03T10:00:00+09:00' },
            { completed_at: '2026-01-02T15:00:00+09:00' },
            { completed_at: '2026-01-01T09:00:00+09:00' },
          ],
        },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).toContain('streak_3');
  });

  it('streak_3: 2일만 연속 시 미반환', async () => {
    const { mockSupabase } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        { count: 5 },
        { data: { stage_id: 's1' } },
        { data: [{ id: 'q1' }, { id: 'q2' }] },
        { count: 1 },
        { data: { stage_id: 's1', stages: { is_final: false } } },
        // 연속이 아님 (1일, 3일, 5일)
        {
          data: [
            { completed_at: '2026-01-05T10:00:00+09:00' },
            { completed_at: '2026-01-03T15:00:00+09:00' },
            { completed_at: '2026-01-01T09:00:00+09:00' },
          ],
        },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 1,
    });

    expect(result).not.toContain('streak_3');
  });

  it('복수 뱃지 동시 획득', async () => {
    const { mockSupabase, insertMock } = createSequentialMock({
      existingBadges: [],
      additionalQueries: [
        // first_code: count=1
        { count: 1 },
        // stage_clear: quest → stage_id
        { data: { stage_id: 's7' } },
        // stage_clear: 퀘스트 1개짜리 스테이지
        { data: [{ id: 'q7-1' }] },
        // stage_clear: 완료 수 = 1
        { count: 1 },
        // project_builder: is_final = true
        { data: { stage_id: 's7', stages: { is_final: true } } },
        // streak_3: 3일 연속
        {
          data: [
            { completed_at: '2026-01-03T10:00:00+09:00' },
            { completed_at: '2026-01-02T15:00:00+09:00' },
            { completed_at: '2026-01-01T09:00:00+09:00' },
          ],
        },
      ],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q7-1',
      hintsUsed: 0,
    });

    // first_code + hint_master + stage_clear + project_builder + streak_3
    expect(result).toContain('first_code');
    expect(result).toContain('hint_master');
    expect(result).toContain('stage_clear');
    expect(result).toContain('project_builder');
    expect(result).toContain('streak_3');
    expect(result).toHaveLength(5);

    // insert가 호출되었는지 확인
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ user_id: 'user-1', badge_type: 'first_code' }),
      ]),
    );
  });

  it('아무 조건도 미충족 시 빈 배열', async () => {
    const { mockSupabase, insertMock } = createSequentialMock({
      existingBadges: [
        { badge_type: 'first_code' },
        { badge_type: 'hint_master' },
        { badge_type: 'stage_clear' },
        { badge_type: 'project_builder' },
        { badge_type: 'streak_3' },
      ],
      additionalQueries: [],
    });

    const result = await checkAndAwardBadges({
      supabase: mockSupabase,
      userId: 'user-1',
      questId: 'q1',
      hintsUsed: 2,
    });

    expect(result).toEqual([]);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
