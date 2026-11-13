// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { QuestCompleteResponse } from '../rewards';
import { kstToday } from '@/lib/time/kst';

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
    start: vi.fn(),
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
  resetConfetti: vi.fn(),
}));

vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => mocks.runtime,
}));
// TutorRateLimitError 는 실제 클래스를 써서 instanceof 판별까지 확인한다 (P1-19)
vi.mock('@/lib/tutor/useTutor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tutor/useTutor')>()),
  useTutor: () => mocks.tutor,
}));
// Next의 useRouter처럼 같은 객체 (렌더마다 새 객체면 router를 deps로 둔 effect가 매번 정리됨)
const router = vi.hoisted(() => ({
  refresh: (): void => {},
  push: (): void => {},
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/confetti', () => ({
  fireConfetti: mocks.confetti,
  resetConfetti: mocks.resetConfetti,
}));
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
  ASK_QUESTIONS,
  type QuestSessionOptions,
} from '../useQuestSession';
import { achv } from '@/lib/quest/__tests__/achievementFixture';

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
    new_achievements: [],
    stage_cleared: null,
    next_quest_id: 'q-next',
    golden_keys: 3,
    hints_used: 0,
    used_golden_key: false,
    coins_earned: 10,
    coins_balance: 10,
    level_ups: [],
    stars: 3,
    best_stars: 3,
    new_stars: 3,
    solved_directly: false,
    solution_copy: false,
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
  router.refresh = mocks.refresh;
  mocks.confetti.mockReset();
  mocks.resetConfetti.mockReset();
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
        coins_earned: 30,
        coins_balance: 30,
        level_ups: [{ level: 2, coins: 20 }],
        new_achievements: [achv('first_code'), achv('stage_clear')],
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
      had_error: false,
    });
    expect(result.current.isCompleted).toBe(true);
    expect(result.current.earnedXP).toBe(50);
    // 보상 띠의 코인은 퀘스트 코인만 (레벨 업 20은 레벨 업 카드가 보여 줌, P8-04)
    expect(result.current.earnedCoins).toBe(10);
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
      json: completion({
        already_completed: true,
        xp_gained: 0,
        new_stars: 0,
      }),
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

  it('별 3개를 다 모은 퀘스트를 다시 풀면 복습: 실행·채점·컨페티는 하고 완료 API·튜터는 부르지 않는다 (Q57, P8-05)', async () => {
    const { result } = renderHook(() =>
      useQuestSession(
        options(
          CODE_QUEST,
          progressRow({
            status: 'completed',
            code_submitted: 'print(10)',
            best_stars: 3,
          }),
        ),
      ),
    );
    await act(async () => {
      await flush();
    });
    expect(result.current.completion).toBe('before');
    // 첫 진입은 저장된 코드 그대로
    expect(result.current.code).toBe('print(10)');
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(mocks.runtime.runCode).toHaveBeenCalledTimes(1);
    expect(callsTo('/api/quest/validate')).toHaveLength(1);
    expect(callsTo('/api/quest/complete')).toHaveLength(0);
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();
    expect(mocks.confetti).toHaveBeenCalledTimes(1);
    expect(result.current.validation?.passed).toBe(true);
    expect(result.current.completion).toBe('review');
    expect(result.current.earnedXP).toBeNull();
  });

  it('복습 도전(별 3개 미만 + 판정 다음 날): 뼈대 코드에서 시작, 통과하면 완료 API를 retry로 불러 새 별·별 코인만 (P8-05, Q64)', async () => {
    routes['/api/quest/complete'] = () => ({
      json: completion({
        already_completed: true,
        xp_gained: 0,
        total_xp: 100,
        stars: 3,
        best_stars: 3,
        new_stars: 2,
        coins_earned: 10,
        coins_balance: 30,
      }),
    });
    const { result } = renderHook(() =>
      useQuestSession(
        options(
          CODE_QUEST,
          progressRow({
            status: 'completed',
            code_submitted: 'print(10)',
            best_stars: 1,
            stars_judged_on: '2026-01-01',
          }),
        ),
      ),
    );
    expect(result.current.bestStars).toBe(1);
    expect(result.current.reviewChallenge).toBe(true);
    // 저장된 코드 대신 처음 뼈대 코드 (저장 코드는 자동 저장하지 않아 그대로)
    expect(result.current.code).toBe(result.current.starterCode);
    expect(result.current.code).not.toBe('print(10)');
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(callsTo('/api/quest/complete')).toHaveLength(1);
    expect(callsTo('/api/quest/complete')[0].body).toMatchObject({
      retry: true,
      code_submitted: result.current.starterCode,
    });
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();
    expect(result.current.completion).toBe('review');
    expect(result.current.bestStars).toBe(3);
    expect(result.current.newStars).toBe(2);
    expect(result.current.earnedCoins).toBe(10);
    expect(result.current.earnedXP).toBe(0);
    expect(result.current.celebrations).toEqual([]);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('별을 판정한 날 다시 풀면 연습: 저장된 코드 그대로, 완료 API를 부르지 않음 (Q64)', async () => {
    const { result } = renderHook(() =>
      useQuestSession(
        options(
          CODE_QUEST,
          progressRow({
            status: 'completed',
            code_submitted: 'print(10)',
            best_stars: 1,
            stars_judged_on: kstToday(),
          }),
        ),
      ),
    );
    expect(result.current.reviewChallenge).toBe(false);
    expect(result.current.code).toBe('print(10)');
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.completion).toBe('review');
    expect(callsTo('/api/quest/complete')).toHaveLength(0);
  });

  it('처음 통과하면 completion은 just, 그다음 다시 풀어 통과하면 review', async () => {
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    expect(result.current.completion).toBeNull();
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.completion).toBe('just');
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(callsTo('/api/quest/complete')).toHaveLength(1);
    expect(result.current.completion).toBe('review');
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

  it('실행 에러를 만난 뒤 통과하면 완료 요청에 had_error (P8-09 실패 칭찬 업적), 보낸 뒤엔 비움', async () => {
    mocks.runtime.runCode.mockResolvedValueOnce({
      stdout: '',
      stderr: 'Traceback\nNameError',
      success: false,
      hadException: true,
      outcome: 'error',
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(callsTo('/api/quest/complete')).toHaveLength(0);
    await act(async () => {
      await result.current.handleRun();
    });
    expect(callsTo('/api/quest/complete')[0].body).toMatchObject({
      had_error: true,
    });
  });

  it('오류·오답 실행은 AI 피드백을 자동으로 부르지 않고, 더 물어보기를 누르면 대화를 열고 그 결과로 묻는다 (Q56)', async () => {
    const ERR = 'Traceback\nNameError: name x is not defined';
    mocks.runtime.runCode.mockResolvedValue({
      stdout: '',
      stderr: ERR,
      success: false,
      hadException: true,
      outcome: 'error',
    });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockClear();
    act(() => result.current.setCode('print(x)'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();

    // 출력이 다름도 자동 호출 없음
    mocks.runtime.runCode.mockResolvedValue(OK_RUN);
    routes['/api/quest/validate'] = () => ({ json: { passed: false } });
    act(() => result.current.setCode('print(1)'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();

    expect(result.current.askOpen).toBe(false);
    await act(async () => {
      result.current.askAboutRun();
      await flush();
    });
    expect(result.current.askOpen).toBe(true);
    expect(mocks.tutor.sendTutorStreamRequest.mock.calls[0][0]).toEqual({
      type: 'code_feedback',
      quest_id: 'q-code',
      student_code: 'print(1)',
      execution_result: { stdout: '10\n', stderr: '', passed: false },
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
  it('단계를 통과하면 박자(STEP_ADVANCE_DELAY_MS) 뒤 통과한 코드로 다음 단계로 간다 (그 사이 고친 코드가 아니라)', async () => {
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

  it('"다음 단계" 박자: 통과한 단계를 알리고, 건너뛰면 바로 넘어가며 예약한 넘김은 다시 돌지 않는다 (P6-12)', async () => {
    const { result } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    act(() => result.current.setCode('name = "파이"'));
    await act(async () => {
      await result.current.handleRun();
    });
    expect(result.current.stepCleared).toBe(1);
    expect(result.current.tab).toBe('result');

    act(() => result.current.skipStepBeat());
    expect(result.current.stepCleared).toBeNull();
    expect(result.current.currentStep).toBe(2);
    // 모바일: 다음 단계 코드를 쓸 공책 쪽으로
    expect(result.current.tab).toBe('code');
    expect(result.current.isSubmitting).toBe(false);

    // 남은 타이머가 한 번 더 넘기지 않는다 (2 → 3 아님)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STEP_ADVANCE_DELAY_MS);
      await flush();
    });
    expect(result.current.currentStep).toBe(2);
    expect(mocks.upserts.at(-1)!.payload).toMatchObject({ current_step: 2 });
  });

  it('단계 통과는 박자 전에 저장: 박자 중에 떠나도 다음 단계가 남는다 (P6-16)', async () => {
    const { result, unmount } = renderHook(() =>
      useQuestSession(options(PROJECT_QUEST)),
    );
    // 고친 직후 실행: 고친 코드의 자동 저장 타이머가 박자 중에 남아 있다
    act(() => result.current.setCode('name = "파이"'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.stepCleared).toBe(1);
    expect(result.current.currentStep).toBe(1);
    expect(mocks.upserts.at(-1)!.payload).toEqual({
      user_id: 'u1',
      quest_id: 'q-proj',
      code_submitted: 'name = "파이"\nscore = ___',
      current_step: 2,
      step_submissions: { '1': 'name = "파이"' },
    });
    // 박자 중 자동 저장 타이머가 예전 단계로 덮어쓰지 않는다
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });
    expect(mocks.upserts.at(-1)!.payload).toMatchObject({ current_step: 2 });
    unmount();
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
    expect(result.current.usedGoldenKey).toBe(true);
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
    expect(callsTo('/api/quest/golden-key')).toHaveLength(0);
    expect(result.current.isCompleted).toBe(false);
    expect(result.current.messages.at(-1)?.role).toBe('system');
  });
});

// ── 힌트 ──────────────────────────────────────────────────────────────

describe('useQuestSession: 힌트', () => {
  it('받은 힌트는 단계·번호가 붙은 쪽지 메시지로 남는다 (P6-09)', async () => {
    mocks.tutor.sendTutorStreamRequest.mockImplementation(
      async (req: { type: string }) =>
        req.type === 'hint_generator'
          ? { message: 'print()를 써 봐요', is_fallback: true }
          : { message: '안내', is_fallback: false },
    );
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    // 퀘스트 소개가 대화를 채운 뒤
    await act(async () => {
      await flush();
    });
    await act(async () => {
      await result.current.handleHintRequest();
    });
    const notes = result.current.messages.filter((m) => m.hint);
    expect(notes).toEqual([
      { role: 'system', content: '힌트 1/3', hint: { level: 1, step: 1 } },
      {
        role: 'tutor',
        content: 'print()를 써 봐요',
        isFallback: true,
        hint: { level: 1, step: 1 },
      },
    ]);
  });

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

  it('더 물어본 오답 피드백이 한도에 걸리면 한도 문구', async () => {
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
    await act(async () => {
      result.current.askAboutRun();
      await flush();
    });
    expect(result.current.messages.at(-1)).toEqual({
      role: 'tutor',
      content: LIMIT,
      isFallback: false,
    });
  });

  it('더 물어본 오답 피드백이 다른 이유로 실패하면 준비한 문구 (저장된 답변)', async () => {
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
    await act(async () => {
      result.current.askAboutRun();
      await flush();
    });
    expect(result.current.messages.at(-1)).toMatchObject({
      role: 'tutor',
      isFallback: true,
    });
    expect(result.current.messages.at(-1)?.content).not.toBe(LIMIT);
  });
});

describe('useQuestSession: 파이뱀에게 물어보기 (P6-10)', () => {
  it('what: 소개를 되풀이하지 않고 LLM 없이 지금 할 일만, 프로젝트는 지금 단계 (Q58)', async () => {
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      result.current.handleAsk('what');
      await flush();
    });
    expect(mocks.tutor.sendTutorStreamRequest).not.toHaveBeenCalled();
    expect(result.current.messages.slice(-2)).toMatchObject([
      { role: 'student', content: ASK_QUESTIONS.what },
      { role: 'tutor' },
    ]);
    expect(result.current.messages.at(-1)?.content).toContain('지금 할 일');

    const project = renderHook(() => useQuestSession(options(PROJECT_QUEST)));
    await act(async () => {
      await flush();
    });
    await act(async () => {
      project.result.current.handleAsk('what');
      await flush();
    });
    expect(project.result.current.messages.at(-1)?.content).toMatch(
      /1\/2단계.*이름 출력/,
    );
  });

  it('concept: 이 퀘스트 개념 설명(concept_explain) 요청 (Q58)', async () => {
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      result.current.handleAsk('concept');
      await flush();
    });
    expect(mocks.tutor.sendTutorStreamRequest.mock.calls[0][0]).toEqual({
      type: 'concept_explain',
      quest_id: 'q-code',
    });
    expect(result.current.messages.slice(-2)).toMatchObject([
      { role: 'student', content: ASK_QUESTIONS.concept },
      { role: 'tutor', content: '안내' },
    ]);
  });

  it('why: 돌린 코드 그대로일 때만, 그 실행 결과로 묻는다', async () => {
    routes['/api/quest/validate'] = () => ({ json: { passed: false } });
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    expect(result.current.canAskWhy).toBe(false);
    act(() => result.current.setCode('x = 1\nprint(x)'));
    await act(async () => {
      await result.current.handleRun();
      await flush();
    });
    expect(result.current.canAskWhy).toBe(true);
    mocks.tutor.sendTutorStreamRequest.mockClear();
    await act(async () => {
      result.current.handleAsk('why');
      await flush();
    });
    expect(mocks.tutor.sendTutorStreamRequest.mock.calls[0][0]).toEqual({
      type: 'code_feedback',
      quest_id: 'q-code',
      student_code: 'x = 1\nprint(x)',
      execution_result: { stdout: '10\n', stderr: '', passed: false },
    });

    // 코드를 고치면 그 결과는 지금 코드의 것이 아님
    act(() => result.current.setCode('x = 2\nprint(x)'));
    expect(result.current.canAskWhy).toBe(false);
  });
  it('자유 질문 (P9-17): 보내면 내 말풍선 + 답·남은 수, 거르면 말풍선을 거두고 안내, 위험 신호는 대화에 남김', async () => {
    const { result } = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await flush();
    });
    mocks.tutor.sendTutorRequest.mockResolvedValueOnce({
      message: '변수는 상자예요',
      is_fallback: false,
      remaining: 19,
    });
    let out: unknown;
    await act(async () => {
      out = await result.current.handleFreeAsk('  변수가 뭐예요? ');
    });
    expect(out).toEqual({ status: 'sent' });
    expect(mocks.tutor.sendTutorRequest).toHaveBeenLastCalledWith({
      type: 'free_question',
      quest_id: 'q-code',
      question: '변수가 뭐예요?',
    });
    expect(result.current.messages.slice(-2)).toMatchObject([
      { role: 'student', content: '변수가 뭐예요?' },
      { role: 'tutor', content: '변수는 상자예요' },
    ]);
    expect(result.current.freeRemaining).toBe(19);

    const before = result.current.messages.length;
    mocks.tutor.sendTutorRequest.mockResolvedValueOnce({
      message: '개인정보 안내',
      is_fallback: false,
      blocked: 'personal',
      remaining: 18,
    });
    await act(async () => {
      out = await result.current.handleFreeAsk('내 번호 010-1234-5678');
    });
    expect(out).toEqual({
      status: 'note',
      message: '개인정보 안내',
      block: 'personal',
    });
    expect(result.current.messages).toHaveLength(before);
    expect(result.current.freeRemaining).toBe(18);

    mocks.tutor.sendTutorRequest.mockResolvedValueOnce({
      message: '믿을 수 있는 어른에게 말해 줘요',
      is_fallback: false,
      blocked: 'wellbeing',
    });
    await act(async () => {
      out = await result.current.handleFreeAsk('너무 힘들어요');
    });
    expect(out).toEqual({ status: 'sent' });
    expect(result.current.messages.at(-1)).toMatchObject({
      role: 'tutor',
      content: '믿을 수 있는 어른에게 말해 줘요',
    });
  });
});

// ── 퀘스트 사이 이동 (P6-15) ───────────────────────────────────────────
// 퀘스트 페이지는 렌더러를 key={quest.id}로 다시 마운트한다. 앞 퀘스트 세션이 남긴 예약·늦은 응답·컨페티가
// 다음 퀘스트 화면에 나타나지 않는지 (unmount 뒤 아무 일도 일어나지 않아야 함)

describe('useQuestSession: 퀘스트를 떠나면 앞 퀘스트의 일이 남지 않는다 (P6-15)', () => {
  it('축하 지연 중에 떠나면 축하가 쌓이지 않고, 떠 있는 컨페티를 지운다', async () => {
    routes['/api/quest/complete'] = () => ({
      json: completion({ new_achievements: [achv('first_code')] }),
    });
    const { result, unmount } = renderHook(() =>
      useQuestSession(options(CODE_QUEST)),
    );
    await act(async () => {
      await result.current.handleRun();
    });
    expect(mocks.confetti).toHaveBeenCalled();
    const store = result.current.celebrationStore;
    unmount();
    expect(mocks.resetConfetti).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.code * 2);
    expect(store.get()).toEqual([]);
  });

  it('완료 응답이 떠난 뒤에 오면 축하·Router Cache 새로 받기를 하지 않는다', async () => {
    let answer!: () => void;
    const gate = new Promise<void>((resolve) => (answer = resolve));
    const fetchMock = vi.mocked(fetch);
    const real = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, init) => {
      if (url === '/api/quest/complete') await gate;
      return real(url, init);
    });
    routes['/api/quest/complete'] = () => ({
      json: completion({ new_achievements: [achv('first_code')] }),
    });
    const { result, unmount } = renderHook(() =>
      useQuestSession(options(CODE_QUEST)),
    );
    let run!: Promise<unknown>;
    act(() => {
      run = result.current.handleRun();
    });
    await act(flush);
    const store = result.current.celebrationStore;
    unmount();
    answer();
    await run;
    await vi.advanceTimersByTimeAsync(CELEBRATION_DELAY_MS.code * 2);
    expect(store.get()).toEqual([]);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('진행을 바꾼 퀘스트를 떠날 때만 Router Cache를 새로 받는다 (뒤로 가면 저장한 코드가 보이게)', async () => {
    const untouched = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });
    untouched.unmount();
    expect(mocks.refresh).not.toHaveBeenCalled();

    const edited = renderHook(() => useQuestSession(options(CODE_QUEST)));
    act(() => edited.result.current.setCode('x = 10'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTO_SAVE_DELAY_MS);
      await flush();
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
    edited.unmount();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);

    const hinted = renderHook(() => useQuestSession(options(CODE_QUEST)));
    await act(async () => {
      await hinted.result.current.handleHintRequest();
    });
    hinted.unmount();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it('새 퀘스트 세션은 앞 세션과 상태를 나누지 않는다 (코드·결과·힌트·대화·축하 저장소)', async () => {
    const a = renderHook(() =>
      useQuestSession(options(CODE_QUEST, progressRow({ hints_used: 2 }))),
    );
    act(() => a.result.current.setCode('print("A")'));
    await act(async () => {
      await a.result.current.handleRun();
    });
    const storeA = a.result.current.celebrationStore;
    a.unmount();

    const QUEST_B = {
      ...CODE_QUEST,
      id: 'q-b',
      prompt_skeleton: {
        ...CODE_QUEST.prompt_skeleton,
        starter_code: 'y = ___',
      },
    } as unknown as QuestWithStage;
    const b = renderHook(() => useQuestSession(options(QUEST_B)));
    const s = b.result.current;
    expect(s.code).toBe('y = ___');
    expect(s.runResult).toBeNull();
    expect(s.validation).toBeNull();
    expect(s.isCompleted).toBe(false);
    expect(s.hintsUsed).toBe(0);
    expect(s.tab).toBe('story');
    expect(s.askOpen).toBe(false);
    expect(s.celebrationStore).not.toBe(storeA);
    expect(s.celebrations).toEqual([]);
    expect(s.stepCleared).toBeNull();
    b.unmount();
  });
});
