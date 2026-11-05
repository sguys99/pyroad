// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { QuestCompleteResponse } from '../rewards';

const mocks = vi.hoisted(() => ({
  runtime: {
    status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
    restarting: null as 'timeout' | 'stop' | null,
    isRunning: false,
    generation: 1,
    runtimeInfo: null,
    runCode: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
  },
  tutor: {
    sendTutorRequest: vi.fn(),
    sendTutorStreamRequest: vi.fn(),
    isLoading: false,
    setIsLoading: vi.fn(),
    hasApiKey: true,
  },
  upserts: [] as Array<{ payload: Record<string, unknown>; options: unknown }>,
  refresh: vi.fn(),
  confetti: vi.fn(),
}));

vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => mocks.runtime,
}));
// TutorRateLimitError 는 실제 클래스를 써서 instanceof 판별까지 확인한다 (P1-19)
vi.mock('@/lib/tutor/useTutor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tutor/useTutor')>()),
  useTutor: () => mocks.tutor,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));
vi.mock('@/lib/confetti', () => ({ fireConfetti: mocks.confetti }));
vi.mock('@/lib/supabase/loadClient', () => ({
  loadBrowserClient: async () => ({
    from: () => ({
      upsert: (payload: Record<string, unknown>, options: unknown) => {
        mocks.upserts.push({ payload, options });
        return { then: (fn?: () => void) => fn?.() };
      },
    }),
  }),
}));

import { TutorRateLimitError } from '@/lib/tutor/useTutor';
import { TUTOR_UNAVAILABLE_HINT_MESSAGE } from '@/lib/tutor/messages';
import {
  useQuestSession,
  tutorFailure,
  AUTO_SAVE_DELAY_MS,
  STEP_ADVANCE_DELAY_MS,
  CELEBRATION_DELAY_MS,
  type QuestSessionOptions,
} from '../useQuestSession';

// ── 픽스처 ────────────────────────────────────────────────────────────

const STAGE = { id: 's1', title: '시작의 숲', order: 1, theme_name: 'forest' };

const CODE_QUEST = {
  id: 'q-code',
  stage_id: 's1',
  order: 1,
  title: '변수 상자',
  concept: '변수',
  validation_type: 'exact_match',
  xp_reward: 50,
  created_at: '',
  stage: STAGE,
  prompt_skeleton: {
    topic: '변수',
    learning_goals: [],
    story_context: '숲 이야기',
    exercise_description: 'x에 10을 넣어요',
    starter_code: 'x = ___',
    expected_output_hint: '10',
    fallback_text: '변수를 배워 봐요!',
  },
} as unknown as QuestWithStage;

const PROJECT_QUEST = {
  ...CODE_QUEST,
  id: 'q-proj',
  title: '나만의 게임',
  prompt_skeleton: {
    ...CODE_QUEST.prompt_skeleton,
    starter_code: '',
    steps: [
      {
        step_number: 1,
        step_goal: '이름 출력',
        starter_code: 'name = ___',
        validation_type: 'exact_match',
        fallback_text: '1단계 안내',
      },
      {
        step_number: 2,
        step_goal: '점수 출력',
        starter_code: 'score = ___',
        validation_type: 'contains',
        fallback_text: '2단계 안내',
      },
    ],
  },
} as unknown as QuestWithStage;

function progressRow(fields: Partial<UserProgress>): UserProgress {
  return {
    status: 'in_progress',
    code_submitted: null,
    current_step: null,
    step_submissions: null,
    hints_used: 0,
    ...fields,
  } as UserProgress;
}

function options(
  quest: QuestWithStage,
  progress: UserProgress | null = null,
): QuestSessionOptions {
  return {
    quest,
    progress,
    userId: 'u1',
    initialXP: 100,
    initialLevel: 1,
    initialGoldenKeys: 3,
  };
}

const OK_RUN: RunResult = {
  stdout: '10\n',
  stderr: '',
  success: true,
  outcome: 'ok',
};

function completion(
  fields: Partial<QuestCompleteResponse> = {},
): QuestCompleteResponse {
  return {
    already_completed: false,
    xp_gained: 50,
    total_xp: 150,
    level_before: 1,
    level_after: 1,
    new_badges: [],
    stage_cleared: null,
    next_quest_id: 'q-next',
    golden_keys: 3,
    hints_used: 0,
    used_golden_key: false,
    ...fields,
  };
}

// ── fetch ─────────────────────────────────────────────────────────────

type Handler = (body: Record<string, unknown>) => {
  status?: number;
  json: unknown;
};
let routes: Record<string, Handler>;
let calls: Array<{ url: string; body: Record<string, unknown> }>;

function stubFetch() {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      calls.push({ url, body });
      const handler = routes[url];
      if (!handler) throw new Error(`unexpected fetch ${url}`);
      const { status = 200, json } = handler(body);
      return Response.json(json, { status });
    }),
  );
}

const callsTo = (url: string) => calls.filter((c) => c.url === url);

/** 대기 중인 Promise 체인을 흘려 보냄 */
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  mocks.runtime.status = 'ready';
  mocks.runtime.isRunning = false;
  mocks.runtime.runCode.mockReset().mockResolvedValue(OK_RUN);
  mocks.runtime.stop.mockReset();
  mocks.tutor.sendTutorRequest
    .mockReset()
    .mockResolvedValue({ message: '잘했어요', is_fallback: false });
  mocks.tutor.sendTutorStreamRequest
    .mockReset()
    .mockResolvedValue({ message: '안내', is_fallback: false });
  mocks.tutor.setIsLoading.mockReset();
  mocks.upserts.length = 0;
  mocks.refresh.mockReset();
  mocks.confetti.mockReset();
  routes = {
    '/api/quest/validate': () => ({ json: { passed: true } }),
    '/api/quest/complete': () => ({ json: completion() }),
    '/api/quest/golden-key': () => ({
      json: {
        solution_code: 'x = 10\nprint(x)',
        golden_keys: 2,
        charged: true,
      },
    }),
  };
  stubFetch();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── 자동 저장 ──────────────────────────────────────────────────────────

describe('useQuestSession: 자동 저장 (P1-04 진행 저장 컬럼만)', () => {
  it('코드 퀘스트: 마지막으로 고친 뒤 2초 뒤 code_submitted 만 upsert', async () => {
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });
    mocks.upserts.length = 0;

    act(() => result.current.setCode('x = 1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS / 2);
    });
    act(() => result.current.setCode('x = 10'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });

    expect(mocks.upserts).toEqual([
      {
        payload: {
          user_id: 'u1',
          quest_id: 'q-code',
          code_submitted: 'x = 10',
        },
        options: { onConflict: 'user_id,quest_id' },
      },
    ]);
  });

  it('프로젝트: 단계·단계별 코드도 함께 저장하고 상태·힌트 수는 보내지 않는다', async () => {
    const { result } = renderHook(() =>
      useQuestSession(
        options(
          PROJECT_QUEST,
          progressRow({
            current_step: 2,
            step_submissions: { '1': 'name = "파이"' },
            hints_used: 2,
          }),
        ),
      ),
    );
    // 저장된 코드가 없으면 이전 단계 코드 + 이번 단계 시작 코드
    expect(result.current.code).toBe('name = "파이"\nscore = ___');

    act(() => result.current.setCode('name = "파이"\nscore = 3'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });
    const last = mocks.upserts.at(-1)!.payload;
    expect(last).toEqual({
      user_id: 'u1',
      quest_id: 'q-proj',
      code_submitted: 'name = "파이"\nscore = 3',
      current_step: 2,
      step_submissions: { '1': 'name = "파이"' },
    });
    expect(Object.keys(last)).not.toContain('status');
    expect(Object.keys(last)).not.toContain('hints_used');
  });

  it('완료한 퀘스트는 자동 저장하지 않는다', async () => {
    const { result } = renderHook(() =>
      useQuestSession(
        options(CODE_QUEST, progressRow({ status: 'completed' })),
      ),
    );
    act(() => result.current.setCode('print(1)'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS * 2);
      await flush();
    });
    expect(mocks.upserts).toEqual([]);
  });
});

// ── 실행·채점·완료 ─────────────────────────────────────────────────────

describe('useQuestSession: 실행·채점·완료', () => {
  it('실행 중 다시 눌러도 한 번만 실행하고, 끝날 때까지 isSubmitting', async () => {
    let finish!: (r: RunResult) => void;
    mocks.runtime.runCode.mockImplementation(
      () => new Promise<RunResult>((r) => (finish = r)),
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));

    let first!: Promise<void>;
    await act(async () => {
      first = result.current.handleRun();
      void result.current.handleRun();
      await flush();
    });
    expect(result.current.isSubmitting).toBe(true);
    expect(mocks.runtime.runCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(OK_RUN);
      await first;
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(callsTo('/api/quest/complete')).toHaveLength(1);
  });

  it('실행 중 stdout 조각을 출력 저장소로 흘려 보낸다', async () => {
    mocks.runtime.runCode.mockImplementation(
      async (_code: string, opts: { onStdout?: (t: string) => void }) => {
        opts.onStdout?.('1\n');
        opts.onStdout?.('2\n');
        return { ...OK_RUN, stdout: '1\n2\n' };
      },
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.liveOutput.getSnapshot().text).toBe('1\n2\n');
  });

  it('완료 응답 → 축하 이벤트 목록 (스테이지 클리어 → 레벨 업 → 뱃지) + Router Cache 새로 받기', async () => {
    routes['/api/quest/complete'] = () => ({
      json: completion({
        level_after: 2,
        new_badges: ['first_code', 'stage_clear'],
        stage_cleared: {
          stage_id: 's1',
          order: 1,
          title: '시작의 숲',
          concepts: ['print', '변수'],
        },
        next_quest_id: null,
      }),
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));

    await act(async () => {
      await result.current.handleRun();
    });
    expect(callsTo('/api/quest/complete')[0].body).toEqual({
      quest_id: 'q-code',
      code_submitted: 'x = ___',
      stdout: '10\n',
    });
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.earnedXP).toBe(50);
    expect(result.current.userXP).toBe(150);
    expect(result.current.userLevel).toBe(2);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    // 컨페티를 본 뒤에 오버레이
    expect(result.current.celebrations).toEqual([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.code);
    });
    expect(result.current.celebrations.map((e) => e.type)).toEqual([
      'stage_clear',
      'level_up',
      'badge',
      'badge',
    ]);

    act(() => result.current.dismissCelebrations(1));
    expect(result.current.celebrations[0]).toMatchObject({
      type: 'level_up',
      level: 2,
    });
  });

  it('이미 완료한 퀘스트 응답이면 축하·새로 받기 없이 완료만 표시', async () => {
    routes['/api/quest/complete'] = () => ({
      json: completion({ already_completed: true, xp_gained: 0 }),
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleRun();
      await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.code);
    });
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.earnedXP).toBeNull();
    expect(result.current.celebrations).toEqual([]);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('완료 기록에 실패하면 완료하지 않고 다시 누를 수 있다 (B06)', async () => {
    routes['/api/quest/complete'] = () => ({
      status: 500,
      json: { error: '잠시 뒤에 다시 해 볼까요?', code: 'internal' },
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.messages.at(-1)).toEqual({
      role: 'system',
      content: '잠시 뒤에 다시 해 볼까요?',
    });
  });

  it('멈추기로 끝난 실행은 채점·튜터 피드백을 하지 않는다', async () => {
    mocks.runtime.runCode.mockResolvedValue({
      stdout: '1\n',
      stderr: '',
      success: false,
      isStopped: true,
      outcome: 'stopped',
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.runResult?.isStopped).toBe(true);
    expect(callsTo('/api/quest/validate')).toHaveLength(0);
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();
  });

  it('퀘스트를 떠나면 돌던 코드를 멈춘다 (Worker는 레이아웃이 계속 가짐)', () => {
    const { unmount } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    unmount();
    expect(mocks.runtime.stop).toHaveBeenCalled();
  });
});

// ── 프로젝트 단계 ──────────────────────────────────────────────────────

describe('useQuestSession: 프로젝트 단계 진행', () => {
  it('단계를 통과하면 1.5초 뒤 통과한 코드로 다음 단계로 간다 (그 사이 고친 코드가 아니라)', async () => {
    const { result } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    act(() => result.current.setCode('name = "파이"'));

    await act(async () => {
      await result.current.handleRun();
    });
    expect(callsTo('/api/quest/validate')[0].body).toMatchObject({
      step_number: 1,
      student_code: 'name = "파이"',
    });
    // 넘어갈 때까지 잠금
    expect(result.current.isSubmitting).toBe(true);
    expect(callsTo('/api/quest/complete')).toHaveLength(0);

    act(() => result.current.setCode('엉뚱하게 고친 코드'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS);
      await flush();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.code).toBe('name = "파이"\nscore = ___');
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.hintsUsed).toBe(0);
    expect(mocks.upserts.at(-1)!.payload).toEqual({
      user_id: 'u1',
      quest_id: 'q-proj',
      code_submitted: 'name = "파이"\nscore = ___',
      current_step: 2,
      step_submissions: { '1': 'name = "파이"' },
    });
  });

  it('B10 회귀: 황금키로 연 중간 단계는 정답 코드를 저장하고 다음 단계로 간다 (예전 코드 아님)', async () => {
    routes['/api/quest/golden-key'] = (body) => ({
      json: {
        solution_code:
          body.current_step === 1 ? 'name = "정답"\nprint(name)' : '',
        golden_keys: 2,
        charged: true,
      },
    });
    const { result } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    act(() => result.current.setCode('name = ___  # 아직 못 푼 코드'));

    await act(async () => {
      await result.current.handleGoldenKeyUse();
    });
    expect(callsTo('/api/quest/golden-key')[0].body).toEqual({
      quest_id: 'q-proj',
      current_step: 1,
    });
    // 에디터(코드)에 정답이 보이고, 정답 코드를 실행
    expect(result.current.code).toBe('name = "정답"\nprint(name)');
    expect(mocks.runtime.runCode).toHaveBeenCalledWith(
      'name = "정답"\nprint(name)',
      expect.any(Object),
    );
    expect(result.current.goldenKeys).toBe(2);
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS);
      await flush();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.code).toBe('name = "정답"\nprint(name)\nscore = ___');
    expect(mocks.upserts.at(-1)!.payload).toMatchObject({
      current_step: 2,
      step_submissions: { '1': 'name = "정답"\nprint(name)' },
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isCompleted).toBe(false);
    // 황금키로 넘긴 단계에는 단계 통과 컨페티도 없다 (P1-10)
    expect(mocks.confetti).not.toHaveBeenCalled();
  });

  it('스스로 통과한 단계는 작은 컨페티 (연출 단계 배율과 함께)', async () => {
    const { result } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    await act(async () => {
      await result.current.handleRun();
      await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS);
      await flush();
    });
    expect(result.current.currentStep).toBe(2);
    expect(mocks.confetti).toHaveBeenCalledWith(
      expect.objectContaining({ particleCount: 30 }),
      { scale: 1 },
    );
  });

  it('다음 단계로 넘어가기 전에 화면을 떠나면 넘어가지 않는다', async () => {
    const { result, unmount } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    await act(async () => {
      await result.current.handleRun();
    });
    mocks.upserts.length = 0;
    unmount();
    await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS * 2);
    await flush();
    expect(mocks.upserts).toEqual([]);
  });

  it('마지막 단계를 통과하면 완료하고 프로젝트 완성 축하를 낸다', async () => {
    const { result } = renderHook(() =>
      useQuestSession(
        options(
          PROJECT_QUEST,
          progressRow({ current_step: 2, step_submissions: { '1': 'a' } }),
        ),
      ),
    );
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.isCompleted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.project);
    });
    expect(result.current.celebrations).toEqual([
      {
        type: 'project_complete',
        questTitle: '나만의 게임',
        xpGained: 50,
        stage: null,
      },
    ]);
  });
});

// ── 황금키 ─────────────────────────────────────────────────────────────

describe('useQuestSession: 황금키', () => {
  it('코드 퀘스트: 정답을 에디터에 넣고 실행한 뒤 정답 코드로 완료 (컨페티 없이 황금키 확인만, P1-10)', async () => {
    routes['/api/quest/complete'] = () => ({
      json: completion({ xp_gained: 0, used_golden_key: true }),
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleGoldenKeyUse();
      await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.code);
    });

    expect(result.current.code).toBe('x = 10\nprint(x)');
    expect(callsTo('/api/quest/complete')[0].body).toEqual({
      quest_id: 'q-code',
      code_submitted: 'x = 10\nprint(x)',
      stdout: '10\n',
    });
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.validation?.passed).toBe(true);
    expect(result.current.nextQuestId).toBe('q-next');
    expect(result.current.celebrations).toEqual([
      { type: 'golden_key', kind: 'code', questTitle: '변수 상자' },
    ]);
    // 황금키로 연 퀘스트에는 컨페티를 쏘지 않는다 (§2.6: 보상은 학습 행동에만)
    expect(mocks.confetti).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isGoldenKeyLoading).toBe(false);
  });

  it('실행기가 준비되기 전에는 황금키를 차감하지 않고 안내만 한다 (P1-03 보고)', async () => {
    mocks.runtime.status = 'loading';
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    expect(result.current.isGoldenKeyBlocked).toBe(true);
    // 퀘스트 소개가 대화를 채운 뒤
    await act(async () => {
      await flush();
    });

    await act(async () => {
      await result.current.handleGoldenKeyUse();
    });
    expect(window.confirm).not.toHaveBeenCalled();
    expect(callsTo('/api/quest/golden-key')).toHaveLength(0);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.messages.at(-1)?.role).toBe('system');
  });

  it('확인 창에서 취소하면 아무것도 하지 않는다', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleGoldenKeyUse();
    });
    expect(callsTo('/api/quest/golden-key')).toHaveLength(0);
    expect(result.current.isSubmitting).toBe(false);
  });
});

// ── 힌트 ──────────────────────────────────────────────────────────────

describe('useQuestSession: 힌트', () => {
  it('힌트 글자를 하나도 못 받고 실패하면 횟수와 라벨을 되돌린다', async () => {
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) => {
        if (req.type === 'hint_generator') throw new Error('fail');
        return { message: '안내', is_fallback: false };
      },
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleHintRequest();
    });
    expect(result.current.hintsUsed).toBe(0);
    expect(result.current.totalHintsUsed).toBe(0);
    expect(
      result.current.messages.some((m) => m.content.startsWith('힌트 1/3')),
    ).toBe(false);
  });

  it('힌트가 아닌 다른 실패면 연결 안내 문구 (힌트는 줄지 않았다고)', async () => {
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) => {
        if (req.type === 'hint_generator') throw new Error('fail');
        return { message: '안내', is_fallback: false };
      },
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleHintRequest();
    });
    expect(result.current.messages.at(-1)).toEqual({
      role: 'tutor',
      content: TUTOR_UNAVAILABLE_HINT_MESSAGE,
      isFallback: false,
    });
  });

  it('요청 한도(429)에 걸리면 한도 문구를 보여 주고 힌트 횟수는 되돌린다 (P1-19)', async () => {
    const limit = '파이뱀 선생님이 잠깐 쉬고 있어요. 17초 뒤에 다시 물어봐요!';
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) => {
        if (req.type === 'hint_generator')
          throw new TutorRateLimitError(limit, 17, 'minute');
        return { message: '안내', is_fallback: false };
      },
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleHintRequest();
    });
    expect(result.current.hintsUsed).toBe(0);
    expect(result.current.totalHintsUsed).toBe(0);
    expect(result.current.messages.at(-1)).toEqual({
      role: 'tutor',
      content: limit,
      isFallback: false,
    });
  });

  it('프로젝트: 단계 힌트는 다음 단계에서 0부터, 누적 힌트는 이어진다', async () => {
    const { result } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST, progressRow({ hints_used: 1 }))),
    );
    await act(async () => {
      await result.current.handleHintRequest();
    });
    expect(result.current.hintsUsed).toBe(1);
    expect(result.current.totalHintsUsed).toBe(2);

    await act(async () => {
      await result.current.handleRun();
      await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS);
    });
    expect(result.current.hintsUsed).toBe(0);
    expect(result.current.totalHintsUsed).toBe(2);
  });
});

describe('useQuestSession: 튜터 요청 한도 문구 (P1-19)', () => {
  const LIMIT =
    '파이뱀 선생님이 오늘은 이야기를 많이 해서 쉬고 있어요. 내일 다시 물어봐요! 🌙';

  it('tutorFailure: 한도 오류면 서버 문구(저장된 답변 배지 없음), 그 밖에는 준비한 문구', () => {
    expect(
      tutorFailure(new TutorRateLimitError(LIMIT, 3600, 'day'), '준비한 문구'),
    ).toEqual({ message: LIMIT, isFallback: false });
    expect(tutorFailure(new Error('HTTP 500'), '준비한 문구')).toEqual({
      message: '준비한 문구',
      isFallback: true,
    });
  });

  it('오답 피드백이 한도에 걸리면 한도 문구', async () => {
    routes['/api/quest/validate'] = () => ({ json: { passed: false } });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) => {
        if (req.type === 'code_feedback')
          throw new TutorRateLimitError(LIMIT, 3600, 'day');
        return { message: '안내', is_fallback: false };
      },
    );
    act(() => result.current.setCode('x = 1\nprint(x)'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.messages.at(-1)).toEqual({
      role: 'tutor',
      content: LIMIT,
      isFallback: false,
    });
  });

  it('오답 피드백이 다른 이유로 실패하면 준비한 문구 (저장된 답변)', async () => {
    routes['/api/quest/validate'] = () => ({ json: { passed: false } });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) => {
        if (req.type === 'code_feedback') throw new Error('fail');
        return { message: '안내', is_fallback: false };
      },
    );
    act(() => result.current.setCode('x = 1\nprint(x)'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.messages.at(-1)).toMatchObject({
      role: 'tutor',
      isFallback: true,
    });
    expect(result.current.messages.at(-1)?.content).not.toBe(LIMIT);
  });
});
