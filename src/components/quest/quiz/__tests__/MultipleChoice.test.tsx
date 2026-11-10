// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';
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
import { optionCode, optionMark } from '../MultipleChoice';
import { QUIZ_INPUTS } from '../quizInputs';
import { QUEST_RENDERERS } from '../../questRenderers';
import { QuizQuest } from '../QuizQuest';
import { getQuestKind } from '@/lib/quest/questKind';

const QUIZ: QuizPrompt = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'for i in range(3):\n    print(i)',
  options: [
    { id: 'opt-w9fa', text: '0 1 2 3' },
    { id: 'opt-k7qz', text: '0 1 2' },
    { id: 'opt-b2mx', text: '1 2 3' },
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

function panel(over: Partial<QuizPanelProps> = {}) {
  const props: QuizPanelProps = {
    title: '반복문 맞혀 보기',
    quiz: QUIZ,
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
    nextHref: '/quest/next',
    mapHref: '/world',
    ...over,
  };
  render(<QuizPanel {...props} />);
  return props;
}

const options = () => screen.getAllByTestId('quiz-option');

afterEach(cleanup);

describe('렌더러 선택', () => {
  it("quest_type 'quiz' 면 단계와 상관없이 QuizQuest", () => {
    expect(getQuestKind({}, 'quiz')).toBe('quiz');
    expect(getQuestKind({ steps: [] }, 'quiz')).toBe('quiz');
    expect(getQuestKind({}, 'code')).toBe('code');
    expect(getQuestKind({ steps: [] })).toBe('project');
    expect(QUEST_RENDERERS.quiz).toBe(QuizQuest);
    expect(QUIZ_INPUTS.multiple_choice).toBeDefined();
  });
});

describe('MultipleChoice', () => {
  it('서버가 준 순서대로 라디오 보기를 그리고, 고르면 보기 id 를 올린다', () => {
    const p = panel();
    expect(options().map((o) => o.textContent)).toEqual([
      '0 1 2 3',
      '0 1 2',
      '1 2 3',
    ]);
    const group = screen.getByRole('group', { name: QUIZ.question });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    // 문제 코드는 코드 글꼴 블록
    expect(screen.getByText('문제 코드')).toBeInTheDocument();
    // 아직 안 골랐으면 정답 확인이 꺼짐
    expect(screen.getByTestId('quiz-submit')).toBeDisabled();

    fireEvent.click(screen.getByText('0 1 2'));
    expect(p.onChange).toHaveBeenCalledWith('opt-k7qz');
  });

  it('고르면 정답 확인이 켜지고 누르면 제출', () => {
    const p = panel({ value: 'opt-b2mx' });
    expect(screen.getByRole('radio', { name: '1 2 3' })).toBeChecked();
    expect(options()[2]).toHaveAttribute('data-mark', 'selected');
    const submit = screen.getByTestId('quiz-submit');
    expect(submit).toHaveTextContent('정답 확인');
    fireEvent.click(submit);
    expect(p.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('오답: 고른 보기에 X + "고른 답", 해설과 남은 기회, 다시 풀기. 정답은 드러내지 않음', () => {
    const p = panel({
      value: 'opt-b2mx',
      submitted: 'opt-b2mx',
      misses: ['opt-b2mx'],
      result: reply({ explanation: '0부터 세요' }),
    });
    expect(options()[2]).toHaveAttribute('data-mark', 'wrong');
    expect(options()[2]).toHaveTextContent('고른 답');
    expect(
      options().filter((o) => o.getAttribute('data-mark') === 'correct'),
    ).toHaveLength(0);
    const verdict = screen.getByTestId('quiz-verdict');
    expect(verdict).toHaveTextContent('아쉬워요');
    expect(verdict).toHaveTextContent('2번 더 도전할 수 있어요');
    expect(verdict).toHaveTextContent('0부터 세요');
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
    fireEvent.click(screen.getByTestId('quiz-retry'));
    expect(p.onRetry).toHaveBeenCalledTimes(1);
  });

  it('다시 풀 때 이번 회차에 틀린 보기는 흐리게 + 고를 수 없음', () => {
    panel({ misses: ['opt-b2mx'] });
    expect(options()[2]).toHaveAttribute('data-mark', 'miss');
    expect(options()[2]).toHaveTextContent('아니었어요');
    expect(options()[2].querySelector('input')).toBeDisabled();
    expect(screen.getByRole('radio', { name: '0 1 2' })).toBeEnabled();
  });

  it('정답: 체크 + "정답", 통과 도장과 서버 별·XP 보상 띠', () => {
    panel({
      value: 'opt-k7qz',
      submitted: 'opt-k7qz',
      result: reply({
        correct: true,
        stars: 3,
        best_stars: 3,
        xp_awarded: 30,
        explanation: '0, 1, 2',
      }),
    });
    expect(options()[1]).toHaveAttribute('data-mark', 'correct');
    expect(screen.getByTestId('quiz-verdict')).toHaveTextContent('정답이에요');
    const strip = screen.getByTestId('quest-reward');
    expect(strip).toHaveTextContent('퀴즈 통과');
    expect(within(strip).getByTestId('reward-stars')).toHaveAttribute(
      'aria-label',
      '별 3개 / 3개',
    );
    // XP 는 0에서 30까지 세어 올라감 (CountUp)
    expect(within(strip).getByTestId('reward-xp')).toBeInTheDocument();
    expect(screen.getByTestId('next-quest')).toHaveAttribute(
      'href',
      '/quest/next',
    );
    expect(screen.getByTestId('quiz-retry')).toHaveTextContent(
      '한 번 더 풀어 보기',
    );
  });

  it('공개: 서버가 준 정답 보기에 "정답", 고른 보기는 "고른 답", 별 1개', () => {
    panel({
      submitted: 'opt-w9fa',
      misses: ['opt-b2mx'],
      result: reply({
        attempt_no: 3,
        stars: 1,
        best_stars: 1,
        xp_awarded: 10,
        revealed: { answer: 'opt-k7qz', explanation: 'range(3)은 0부터' },
      }),
    });
    expect(options().map((o) => o.getAttribute('data-mark'))).toEqual([
      'wrong',
      'answer',
      'miss',
    ]);
    expect(screen.getByTestId('quiz-verdict')).toHaveTextContent(
      'range(3)은 0부터',
    );
    expect(screen.getByTestId('reward-stars')).toHaveAttribute(
      'aria-label',
      '별 1개 / 3개',
    );
  });

  it('연습: 들어올 때 안내와 딱지, 연습 정답은 별·XP 없이 안내', () => {
    panel({ mode: 'practice' });
    expect(screen.getByTestId('quiz-mode-note')).toHaveTextContent(
      '내일 다시 도전하면 별을 더 모을 수 있어요',
    );
    cleanup();
    panel({
      mode: 'practice',
      submitted: 'opt-k7qz',
      result: reply({ correct: true, mode: 'practice', best_stars: 2 }),
    });
    const strip = screen.getByTestId('quest-reward');
    expect(strip).toHaveTextContent('연습 완료');
    expect(strip).toHaveTextContent(
      '내일 다시 도전하면 별을 더 모을 수 있어요',
    );
    expect(screen.queryByTestId('reward-stars')).toBeNull();
    expect(screen.queryByTestId('reward-xp')).toBeNull();
  });

  it('복습 도전 딱지와 지금 별 수', () => {
    panel({ mode: 'review', bestStars: 1 });
    expect(screen.getByText('복습 도전')).toBeInTheDocument();
    expect(screen.getByTestId('quiz-mode-note')).toHaveTextContent(
      '지금 별 1개',
    );
  });
});

describe('보기 글자 규칙', () => {
  it('`로 감싸거나 여러 줄이거나 출력 예측형이면 코드', () => {
    expect(optionCode('`print("hi")`', false)).toEqual({
      code: true,
      text: 'print("hi")',
    });
    expect(optionCode('a\nb', false).code).toBe(true);
    expect(optionCode('0 1 2', true).code).toBe(true);
    expect(optionCode('반복문', false)).toEqual({
      code: false,
      text: '반복문',
    });
  });
  it('optionMark: 결과가 없으면 고름 > 틀렸던 답', () => {
    const base = { value: null, result: null, misses: [] as string[] };
    expect(optionMark('x', base)).toBe('none');
    expect(optionMark('x', { ...base, value: 'x' })).toBe('selected');
    expect(optionMark('x', { ...base, misses: ['x'] })).toBe('miss');
  });
});
