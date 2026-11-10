// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type { QuizAnswerResponse } from '@/lib/quest/quizAnswer';
import { quizStatus } from '@/lib/quest/useQuizSession';

const mocks = vi.hoisted(() => ({
  track: vi.fn(),
  runtime: {
    status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
    restarting: null,
    loadStage: null,
    isRunning: false,
    start: vi.fn(),
    stop: vi.fn(),
    retry: vi.fn(),
    runCode: vi.fn(async () => ({
      stdout: '0\n1\n2\n',
      stderr: '',
      success: true,
    })),
  },
}));
vi.mock('@/components/providers/SoundProvider', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => mocks.runtime,
}));
vi.mock('@/lib/analytics/track', () => ({ track: mocks.track }));

import { QuizPanel, type QuizPanelProps } from '../QuizPanel';
import { QuizTryRunView } from '../QuizTryRun';

const PREDICT: QuizPrompt = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'for i in range(3):\n    print(i)',
  options: [
    { id: 'opt-k7qz', text: '0 1 2' },
    { id: 'opt-w9fa', text: '1 2 3' },
  ],
};

const FILL: QuizPrompt = {
  kind: 'fill_blank',
  question: '빈칸',
  code: '{{bk-r2fa}}("안녕")',
  tokens: [
    { id: 'tok-m4xe', text: 'print' },
    { id: 'tok-c3pd', text: 'input' },
  ],
};

function reply(over: Partial<QuizAnswerResponse>): QuizAnswerResponse {
  return {
    correct: false,
    attempt_no: 1,
    mode: 'first',
    stars: 0,
    best_stars: 0,
    xp_awarded: 0,
    total_xp: 0,
    level_before: 1,
    level_after: 1,
    explanation: null,
    revealed: null,
    next_review_on: null,
    next_quiz: null,
    ...over,
  };
}

function panel(over: Partial<QuizPanelProps>) {
  const props: QuizPanelProps = {
    title: '퀴즈',
    quiz: PREDICT,
    value: null,
    onChange: vi.fn(),
    status: quizStatus(over.result ?? null),
    result: null,
    submitted: null,
    misses: [],
    mode: 'first',
    bestStars: 0,
    isSubmitting: false,
    error: null,
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    nextHref: null,
    mapHref: '/world',
    ...over,
  };
  return render(<QuizPanel {...props} />);
}

beforeEach(() => {
  mocks.track.mockClear();
  mocks.runtime.start.mockClear();
  mocks.runtime.runCode.mockClear();
});
afterEach(cleanup);

describe('QuizPanel "직접 실행해 보기" (P7-07)', () => {
  it('고르는 중·오답에는 없고, 정답이면 버튼 → 누르면 실행 칸을 불러와 Worker를 그때 start', async () => {
    panel({});
    expect(screen.queryByTestId('quiz-try-toggle')).toBeNull();
    cleanup();
    panel({ result: reply({}), submitted: 'opt-w9fa' });
    expect(screen.queryByTestId('quiz-try-toggle')).toBeNull();
    cleanup();

    panel({
      result: reply({ correct: true, stars: 3 }),
      submitted: 'opt-k7qz',
    });
    const toggle = screen.getByTestId('quiz-try-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(mocks.runtime.start).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(await screen.findByTestId('quiz-try')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(mocks.runtime.start).toHaveBeenCalled();
    expect(screen.getByTestId('quiz-try-dare')).toHaveTextContent('숫자');
  });

  it('문제 코드가 없는 객관식은 정답이어도 버튼 없음', () => {
    const { code: _, ...noCode } = PREDICT as Extract<
      QuizPrompt,
      { kind: 'multiple_choice' }
    >;
    void _;
    panel({
      quiz: noCode,
      result: reply({ correct: true, stars: 3 }),
      submitted: 'opt-k7qz',
    });
    expect(screen.queryByTestId('quiz-try-toggle')).toBeNull();
  });

  it('정답 공개면 공개된 정답(revealed.answer)으로 조립', async () => {
    panel({
      quiz: FILL,
      result: reply({
        attempt_no: 3,
        stars: 1,
        revealed: { answer: { 'bk-r2fa': 'tok-m4xe' }, explanation: '…' },
      }),
      submitted: { 'bk-r2fa': 'tok-c3pd' },
    });
    fireEvent.click(screen.getByTestId('quiz-try-toggle'));
    await screen.findByTestId('quiz-try');
    expect(screen.getByTestId('quiz-try-dare')).toHaveTextContent('글자');
    fireEvent.click(screen.getByTestId('run-button'));
    await act(async () => {});
    expect(mocks.runtime.runCode).toHaveBeenCalledWith(
      'print("안녕")',
      expect.anything(),
    );
  });
});

describe('QuizTryRunView', () => {
  it('실행: 공용 runCode 한 번 + 출력 쪽지, 분석은 종류·바꿨는지만', async () => {
    render(
      <QuizTryRunView
        code="print(1)"
        kind="multiple_choice"
        runtime={mocks.runtime}
      />,
    );
    fireEvent.click(screen.getByTestId('run-button'));
    await act(async () => {});
    expect(mocks.runtime.runCode).toHaveBeenCalledWith(
      'print(1)',
      expect.anything(),
    );
    expect(mocks.track).toHaveBeenCalledWith('quiz_try_run', {
      kind: 'multiple_choice',
      edited: false,
    });
    expect(screen.getByTestId('output-panel')).toHaveTextContent('0');
  });

  it('바꾼 코드면 edited: true, "처음 코드로"가 켜짐', async () => {
    render(
      <QuizTryRunView
        code="print(1)"
        kind="parsons"
        runtime={mocks.runtime}
        initial={{ code: 'print(5)' }}
      />,
    );
    expect(screen.getByTestId('reset-code')).toBeEnabled();
    fireEvent.click(screen.getByTestId('run-button'));
    await act(async () => {});
    expect(mocks.runtime.runCode).toHaveBeenCalledWith(
      'print(5)',
      expect.anything(),
    );
    expect(mocks.track).toHaveBeenCalledWith('quiz_try_run', {
      kind: 'parsons',
      edited: true,
    });
  });
});
