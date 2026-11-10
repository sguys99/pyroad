// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { QuizPrompt } from '../questKind';
import type { QuizAnswerResponse } from '../quizAnswer';

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  refresh: vi.fn(),
  confetti: vi.fn(),
}));
const router = vi.hoisted(() => ({
  refresh: (): void => mocks.refresh(),
  push: (): void => {},
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/confetti', () => ({
  fireConfetti: mocks.confetti,
  resetConfetti: vi.fn(),
}));
vi.mock('@/components/providers/SoundProvider', () => ({
  useSfx: () => mocks.play,
}));
// useQuestSession 모듈을 상수(ANSWER_CONFETTI 등)만 쓰려고 불러오므로 그 의존성도 가볍게
vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => ({}),
}));

import {
  useQuizSession,
  quizEntryMode,
  quizStatus,
  WRONG_GAIN,
} from '../useQuizSession';
import { getQuizCombo, resetQuizCombo } from '../quizCombo';
import { CELEBRATION_DELAY_MS } from '../useQuestSession';

const QUIZ: QuizPrompt = {
  kind: 'multiple_choice',
  question: '무엇이 나올까?',
  code: 'print(1)',
  options: [
    { id: 'opt-a1bc', text: '1' },
    { id: 'opt-d2ef', text: '2' },
    { id: 'opt-g3hi', text: '3' },
  ],
};
const RESHUFFLED: QuizPrompt = {
  ...QUIZ,
  options: [...QUIZ.options].reverse(),
};

const QUEST = {
  id: '00000000-0000-4000-8000-000000000001',
  title: '퀴즈',
  quest_type: 'quiz',
  stage: { id: 's1', title: '숲', order: 1, theme_name: 'forest' },
  prompt_skeleton: {
    topic: 't',
    learning_goals: ['g'],
    story_context: '이야기',
    fallback_text: 'f',
    quiz: QUIZ,
  },
} as unknown as QuestWithStage;

const props = (progress: Partial<UserProgress> | null = null) => ({
  quest: QUEST,
  progress: progress as UserProgress | null,
  userId: 'u1',
  initialXP: 100,
  initialLevel: 2,
  initialGoldenKeys: 3,
});

function reply(over: Partial<QuizAnswerResponse>): QuizAnswerResponse {
  return {
    correct: false,
    attempt_no: 1,
    mode: 'first',
    stars: 0,
    best_stars: 0,
    xp_awarded: 0,
    total_xp: 100,
    level_before: 2,
    level_after: 2,
    explanation: null,
    revealed: null,
    next_review_on: null,
    next_quiz: RESHUFFLED,
    ...over,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: object, status = 200) =>
  fetchMock.mockResolvedValueOnce(Response.json(body, { status }));

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  mocks.play.mockReset();
  mocks.refresh.mockReset();
  mocks.confetti.mockReset();
  resetQuizCombo();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('quizEntryMode · quizStatus', () => {
  it('별 판정 전 first · 어제 이전 review · 오늘 practice', () => {
    expect(quizEntryMode(null, '2026-11-10')).toBe('first');
    expect(
      quizEntryMode({ stars_judged_on: null } as UserProgress, '2026-11-10'),
    ).toBe('first');
    expect(quizEntryMode({ stars_judged_on: '2026-11-09' }, '2026-11-10')).toBe(
      'review',
    );
    expect(quizEntryMode({ stars_judged_on: '2026-11-10' }, '2026-11-10')).toBe(
      'practice',
    );
  });
  it('결과 → 상태', () => {
    expect(quizStatus(null)).toBe('answering');
    expect(quizStatus(reply({ correct: true }))).toBe('correct');
    expect(quizStatus(reply({}))).toBe('wrong');
    expect(
      quizStatus(reply({ revealed: { answer: 'opt-a1bc', explanation: 'x' } })),
    ).toBe('revealed');
  });
});

describe('useQuizSession', () => {
  it('연속 정답 콤보: 정답마다 늘고 다시 풀어도 이어지며 오답이면 0 (P7-09)', async () => {
    const { result } = renderHook(() => useQuizSession(props()));
    for (const expected of [1, 2]) {
      act(() => result.current.setValue('opt-a1bc'));
      respond(reply({ correct: true, mode: 'practice' }));
      await act(() => result.current.submit());
      expect(result.current.combo).toBe(expected);
      act(() => result.current.retry());
    }
    act(() => result.current.setValue('opt-d2ef'));
    respond(reply({ mode: 'practice' }));
    await act(() => result.current.submit());
    expect(result.current.combo).toBe(0);
    expect(getQuizCombo()).toBe(0);
  });

  it('고른 보기 id 를 quest_id 와 함께 보내고, 오답이면 틀린 답을 쌓고 다시 풀면 next_quiz 로 바꾼다', async () => {
    const { result } = renderHook(() => useQuizSession(props()));
    expect(result.current.status).toBe('answering');
    expect(result.current.quiz).toBe(QUIZ);

    act(() => result.current.setValue('opt-d2ef'));
    respond(reply({ explanation: '하나 더 세었어요' }));
    await act(() => result.current.submit());

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/quest/answer',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      quest_id: QUEST.id,
      answer: 'opt-d2ef',
    });
    expect(result.current.status).toBe('wrong');
    expect(result.current.submitted).toBe('opt-d2ef');
    expect(result.current.misses).toEqual(['opt-d2ef']);
    expect(mocks.play).toHaveBeenCalledWith('wrong', { gain: WRONG_GAIN });
    expect(mocks.confetti).not.toHaveBeenCalled();

    // 결과가 보이는 동안은 답을 바꾸거나 다시 보낼 수 없음
    act(() => result.current.setValue('opt-a1bc'));
    expect(result.current.value).toBe('opt-d2ef');
    await act(() => result.current.submit());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    expect(result.current.status).toBe('answering');
    expect(result.current.quiz).toEqual(RESHUFFLED);
    expect(result.current.value).toBeNull();
    expect(result.current.misses).toEqual(['opt-d2ef']);
    expect(result.current.mode).toBe('first');
  });

  it('오답 뒤 왜 틀렸어요?: 답 없이 quiz_explain 만 보내고, 결과에 묶여 다시 풀면 사라진다 (P7-08)', async () => {
    const { result } = renderHook(() => useQuizSession(props()));
    act(() => result.current.setValue('opt-d2ef'));
    respond(reply({}));
    await act(() => result.current.submit());
    expect(result.current.explain).toBeNull();

    let done!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (done = r)));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.askWhy();
    });
    expect(result.current.explain).toEqual(
      expect.objectContaining({ state: 'loading' }),
    );
    expect(fetchMock.mock.calls[1][0]).toBe('/api/tutor');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      type: 'quiz_explain',
      quest_id: QUEST.id,
    });
    await act(async () => {
      done(
        Response.json({ message: '처음엔 몇부터 셀까요?', is_fallback: true }),
      );
      await pending;
    });
    expect(result.current.explain).toEqual({
      state: 'done',
      text: '처음엔 몇부터 셀까요?',
      fallback: true,
    });
    // 같은 결과에 다시 묻지 않음
    await act(() => result.current.askWhy());
    expect(fetchMock).toHaveBeenCalledTimes(2);

    act(() => result.current.retry());
    expect(result.current.explain).toBeNull();
  });

  it('왜 틀렸어요?: 한도(429)면 서버 문구, 그 밖의 실패는 준비한 문구', async () => {
    const { result } = renderHook(() => useQuizSession(props()));
    act(() => result.current.setValue('opt-d2ef'));
    respond(reply({}));
    await act(() => result.current.submit());
    respond({ message: '1분 뒤에 다시 물어봐요' }, 429);
    await act(() => result.current.askWhy());
    expect(result.current.explain).toEqual(
      expect.objectContaining({
        state: 'error',
        text: '1분 뒤에 다시 물어봐요',
      }),
    );
  });

  it('정답(별 판정): XP·레벨 반영, 새로고침, 레벨 업 축하는 성공 장면 뒤에', async () => {
    const { result } = renderHook(() => useQuizSession(props()));
    act(() => result.current.setValue('opt-a1bc'));
    respond(
      reply({
        correct: true,
        stars: 3,
        best_stars: 3,
        xp_awarded: 30,
        total_xp: 130,
        level_after: 3,
      }),
    );
    await act(() => result.current.submit());

    expect(result.current.status).toBe('correct');
    expect(result.current.userXP).toBe(130);
    expect(result.current.userLevel).toBe(3);
    expect(result.current.earnedXP).toBe(30);
    expect(result.current.bestStars).toBe(3);
    expect(mocks.confetti).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    // 정답 소리는 통과 도장(PassStamp)이 냄
    expect(mocks.play).not.toHaveBeenCalled();

    expect(result.current.celebrationStore.get()).toEqual([]);
    act(() => vi.advanceTimersByTime(CELEBRATION_DELAY_MS.quiz));
    expect(result.current.celebrationStore.get()).toEqual([
      expect.objectContaining({ type: 'level_up', level: 3, fromLevel: 2 }),
    ]);

    // 회차가 끝났으니 다시 풀면 오늘은 연습
    act(() => result.current.retry());
    expect(result.current.mode).toBe('practice');
    expect(result.current.quiz).toEqual(RESHUFFLED);
  });

  it('3번째 오답(공개): 틀린 기록을 비우고 다음은 연습. 연습 정답은 XP·새로고침 없음', async () => {
    const { result } = renderHook(() =>
      useQuizSession(props({ stars_judged_on: null })),
    );
    act(() => result.current.setValue('opt-g3hi'));
    respond(
      reply({
        attempt_no: 3,
        stars: 1,
        best_stars: 1,
        xp_awarded: 10,
        total_xp: 110,
        revealed: { answer: 'opt-a1bc', explanation: '1이 나와요' },
      }),
    );
    await act(() => result.current.submit());
    expect(result.current.status).toBe('revealed');
    expect(result.current.misses).toEqual([]);
    expect(mocks.play).toHaveBeenCalledWith('wrong', { gain: WRONG_GAIN });
    expect(result.current.userXP).toBe(110);

    act(() => result.current.retry());
    expect(result.current.mode).toBe('practice');
    mocks.refresh.mockReset();

    act(() => result.current.setValue('opt-a1bc'));
    respond(
      reply({ correct: true, mode: 'practice', best_stars: 1, total_xp: 110 }),
    );
    await act(() => result.current.submit());
    expect(result.current.status).toBe('correct');
    expect(result.current.mode).toBe('practice');
    expect(result.current.earnedXP).toBe(10);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('오늘 이미 별을 받은 퀴즈는 연습으로 시작, 서버 오류 문구는 그대로 보여 주고 다시 보낼 수 있다', async () => {
    const { result } = renderHook(() =>
      useQuizSession(props({ stars_judged_on: '2999-01-01', best_stars: 2 })),
    );
    expect(result.current.mode).toBe('practice');
    expect(result.current.bestStars).toBe(2);

    act(() => result.current.setValue('opt-a1bc'));
    respond({ error: '조금 천천히 풀어 볼까요?', code: 'rate_limited' }, 429);
    await act(() => result.current.submit());
    expect(result.current.error).toBe('조금 천천히 풀어 볼까요?');
    expect(result.current.status).toBe('answering');

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/보내지 못했어요/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
