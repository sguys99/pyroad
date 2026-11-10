// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type { QuizAnswerResponse } from '@/lib/quest/quizAnswer';
import { quizStatus } from '@/lib/quest/useQuizSession';

vi.mock('@/components/providers/SoundProvider', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => ({}),
}));

import { QuizPanel, type QuizPanelProps } from '../QuizPanel';
import { quizLine } from '../QuizQuest';

afterEach(cleanup);

const QUIZ: QuizPrompt = {
  kind: 'multiple_choice',
  question: '무엇이 나올까?',
  options: [
    { id: 'opt-a1bc', text: '1' },
    { id: 'opt-d2ef', text: '2' },
  ],
};

const reply = (over: Partial<QuizAnswerResponse>): QuizAnswerResponse => ({
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
});

function panel(over: Partial<QuizPanelProps> = {}) {
  const result = over.result ?? null;
  render(
    <QuizPanel
      title="퀴즈"
      quiz={QUIZ}
      value={null}
      onChange={vi.fn()}
      submitted={result ? 'opt-a1bc' : null}
      misses={[]}
      mode="first"
      bestStars={0}
      isSubmitting={false}
      error={null}
      onSubmit={vi.fn()}
      onRetry={vi.fn()}
      nextHref={null}
      mapHref="/world"
      {...over}
      result={result}
      status={quizStatus(result)}
    />,
  );
}

describe('정답·오답 연출과 콤보 (P7-09)', () => {
  it('콤보 배지는 2연속부터 글자로', () => {
    panel({ combo: 1 });
    expect(screen.queryByTestId('quiz-combo')).toBeNull();
    cleanup();
    panel({ combo: 3 });
    expect(screen.getByTestId('quiz-combo')).toHaveTextContent('3연속 정답');
  });

  it('정답 쪽지: 받은 별 수만큼 별, 연습은 별 없이 "연습 정답"', () => {
    panel({ result: reply({ correct: true, stars: 2, best_stars: 2 }) });
    const stars = screen.getByTestId('quiz-verdict-stars');
    expect(stars.querySelectorAll('.qz-star')).toHaveLength(2);
    expect(stars).toHaveTextContent('별 2개');
    cleanup();
    panel({
      mode: 'practice',
      result: reply({ correct: true, mode: 'practice' }),
    });
    expect(screen.queryByTestId('quiz-verdict-stars')).toBeNull();
    expect(screen.getByTestId('quiz-verdict-practice')).toHaveTextContent(
      '연습 정답',
    );
  });

  it('오답은 남은 기회, 마지막이면 "마지막으로", 공개는 다정하게', () => {
    panel({ result: reply({ attempt_no: 2 }) });
    expect(screen.getByTestId('quiz-verdict')).toHaveTextContent(
      '마지막으로 1번 더 도전할 수 있어요',
    );
    cleanup();
    panel({
      result: reply({
        attempt_no: 3,
        stars: 1,
        revealed: { answer: 'opt-a1bc', explanation: '까닭' },
      }),
    });
    expect(screen.getByTestId('quiz-verdict')).toHaveTextContent(
      '같이 정답을 볼까요?',
    );
    expect(screen.queryByTestId('quiz-verdict-stars')).toBeNull();
  });

  it('파이뱀: 정답 응원 · 오답 격려 · 공개 설명', () => {
    expect(quizLine('correct', 'first').state).toBe('cheer');
    expect(quizLine('wrong', 'first', 1)).toMatchObject({
      state: 'encourage',
      text: expect.stringContaining('2번 더 도전할 수 있으니'),
    });
    expect(quizLine('revealed', 'first', 3).text).toContain(
      '같이 정답을 볼까요?',
    );
  });
});
