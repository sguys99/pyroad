import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isValidElement, type ReactElement } from 'react';

// 퀘스트 페이지의 스테이지 잠금 가드 (B38)

const QUEST = {
  id: 'q2',
  stage_id: 's2',
  order: 1,
  title: '조건 다리',
  concept: '조건문',
  validation_type: 'exact_match',
  xp_reward: 50,
  created_at: '',
  stage: {
    id: 's2',
    title: '갈림길',
    order: 2,
    theme_name: 'bridge',
    quests: [
      { id: 'q1', order: 1, title: '첫 다리' },
      { id: 'q2', order: 2, title: '조건 다리' },
    ],
  },
  prompt_skeleton: {
    topic: '조건문',
    learning_goals: [],
    story_context: '',
    exercise_description: '',
    starter_code: '',
    expected_output_hint: '',
    fallback_text: '',
  },
};

const mocks = vi.hoisted(() => ({
  user: { current: { id: 'u1' } as { id: string } | null },
  quest: { current: null as unknown },
  progress: { current: null as unknown },
  stageUnlocked: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

function chain(table: string) {
  const result = () =>
    table === 'quests'
      ? { data: mocks.quest.current, error: null }
      : table === 'user_progress'
        ? { data: mocks.progress.current, error: null }
        : {
            data: { total_xp: 120, current_level: 2, golden_keys: 1 },
            error: null,
          };
  const q = {
    select: () => q,
    eq: () => q,
    // user_progress: 스테이지 퀘스트들의 진행을 한 번에 (P6-02)
    in: () => q,
    then: (resolve: (r: unknown) => void) => resolve(result()),
    single: async () => result(),
    maybeSingle: async () => result(),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: (table: string) => chain(table) }),
}));
vi.mock('@/lib/supabase/auth', () => ({
  getAuthUser: async () => ({ user: mocks.user.current, error: null }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (fn: string, args: unknown) => {
      if (fn !== 'is_stage_unlocked') throw new Error(`unexpected rpc ${fn}`);
      return mocks.stageUnlocked(args);
    },
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/analytics/server', () => ({ trackQuestStart: vi.fn() }));
// 렌더러(클라이언트 컴포넌트)는 불러오지 않고 무엇을 넘겼는지만 본다
vi.mock('@/components/quest/questRenderers', () => ({
  QUEST_RENDERERS: {
    code: function CodeQuest() {},
    project: function ProjectQuest() {},
  },
}));

import QuestPage from '../page';
import { STAGE_LOCKED_REDIRECT } from '@/lib/world/stageLock';

const render = () => QuestPage({ params: Promise.resolve({ questId: 'q2' }) });

beforeEach(() => {
  mocks.user.current = { id: 'u1' };
  mocks.quest.current = structuredClone(QUEST);
  mocks.progress.current = [];
  mocks.stageUnlocked
    .mockReset()
    .mockResolvedValue({ data: true, error: null });
  mocks.redirect.mockClear();
  mocks.notFound.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('퀘스트 페이지: 스테이지 잠금 (B38)', () => {
  it('잠긴 스테이지의 퀘스트는 렌더하지 않고 월드맵 안내로 보낸다', async () => {
    mocks.stageUnlocked.mockResolvedValue({ data: false, error: null });
    await expect(render()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.redirect).toHaveBeenCalledWith(STAGE_LOCKED_REDIRECT);
    // 인증된 사용자 id 와 퀘스트의 스테이지로 확인 (요청 값을 넘기지 않음)
    expect(mocks.stageUnlocked).toHaveBeenCalledWith({
      p_user_id: 'u1',
      p_stage_id: 's2',
    });
  });

  it('리다이렉트 목적지는 고정된 내부 경로다 (오픈 리다이렉트 없음)', () => {
    expect(STAGE_LOCKED_REDIRECT).toBe('/world?notice=stage-locked');
  });

  it('열린 스테이지면 렌더러에 퀘스트·진행을 넘긴다', async () => {
    mocks.progress.current = [
      { quest_id: 'q1', status: 'completed', hints_used: 0 },
      { quest_id: 'q2', status: 'in_progress', hints_used: 1 },
    ];
    const el = (await render()) as ReactElement<Record<string, unknown>>;
    expect(isValidElement(el)).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(el.props).toMatchObject({
      userId: 'u1',
      progress: { status: 'in_progress' },
      initialXP: 120,
      initialLevel: 2,
      initialGoldenKeys: 1,
    });
    expect((el.props.quest as { id: string }).id).toBe('q2');
    // 헤더 진행 점(P6-02): 스테이지 퀘스트마다 내 완료 여부 + 스테이지 열림
    expect(el.props.quest).toMatchObject({
      stage: {
        unlocked: true,
        quests: [
          { id: 'q1', completed: true },
          { id: 'q2', completed: false },
        ],
      },
    });
  });

  it('이미 완료한 퀘스트는 스테이지가 잠겨도 복습할 수 있다', async () => {
    mocks.stageUnlocked.mockResolvedValue({ data: false, error: null });
    mocks.progress.current = [
      { quest_id: 'q2', status: 'completed', hints_used: 0 },
    ];
    const el = (await render()) as ReactElement<Record<string, unknown>>;
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(el.props).toMatchObject({ progress: { status: 'completed' } });
  });

  it('잠금 확인이 실패하면 막지 않고 렌더한다 (fail-open, 보상은 완료 RPC 가 막음)', async () => {
    mocks.stageUnlocked.mockResolvedValue({
      data: null,
      error: { code: '42883', message: 'function not found' },
    });
    const el = await render();
    expect(isValidElement(el)).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[stageLock] is_stage_unlocked 실패 (quest_page):',
      '42883 function not found',
    );
  });

  it('없는 퀘스트는 잠금을 확인하지 않고 404', async () => {
    mocks.quest.current = null;
    await expect(render()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.stageUnlocked).not.toHaveBeenCalled();
  });

  it('로그인하지 않았으면 첫 화면으로', async () => {
    mocks.user.current = null;
    await expect(render()).rejects.toThrow('NEXT_REDIRECT /');
    expect(mocks.stageUnlocked).not.toHaveBeenCalled();
  });
});
