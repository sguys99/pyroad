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
import { bugHuntInput, lineMark, linePreviews } from '../BugHunt';
import { QUIZ_INPUTS } from '../quizInputs';

const QUIZ = {
  kind: 'bug_hunt',
  question: '틀린 줄을 찾아 고쳐요',
  lines: [
    { id: 'ln-x5pc', code: 'for i in range(3)' },
    { id: 'ln-h7jq', code: '    print(i)' },
  ],
  fixes: [
    { id: 'fx-e4kr', code: 'for i in range[3]' },
    { id: 'fx-b7nd', code: 'for i in range(3):' },
  ],
} satisfies QuizPrompt;

const RIGHT = { line: 'ln-x5pc', fix: 'fx-b7nd' };
const WRONG = { line: 'ln-h7jq', fix: 'fx-e4kr' };

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
    title: '버그 잡기',
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

const lines = () => screen.getAllByTestId('bughunt-line');

afterEach(cleanup);

describe('BugHunt', () => {
  it('등록되어 있고, 줄 번호 + 코드 순서대로 줄 라디오 그룹을 그린다', () => {
    expect(QUIZ_INPUTS.bug_hunt).toBe(bugHuntInput);
    const p = panel();
    expect(screen.getByText(/보너스 퀴즈 · 버그 찾기/)).toBeInTheDocument();
    expect(screen.getByTestId('bughunt-steps')).toHaveTextContent(
      '1. 버그가 숨은 줄을 찾아요',
    );
    const group = screen.getByRole('group', { name: QUIZ.question });
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(lines().map((l) => l.textContent)).toEqual([
      '줄 1for i in range(3)',
      '줄 2    print(i)',
    ]);
    // 줄을 고르기 전엔 수정안 쪽지 없음, 정답 확인 꺼짐
    expect(screen.queryByTestId('bughunt-fixes')).toBeNull();
    expect(screen.getByTestId('quiz-submit')).toBeDisabled();
    fireEvent.click(screen.getByText('for i in range(3)'));
    expect(p.onChange).toHaveBeenCalledWith({ line: 'ln-x5pc', fix: '' });
  });

  it('줄을 고르면 그 줄 아래 수정안 라디오 쪽지가 열리고, 고르면 {line, fix}', () => {
    const p = panel({ value: { line: 'ln-x5pc', fix: '' } });
    expect(lines()[0]).toHaveAttribute('data-mark', 'selected');
    const sheet = screen.getByTestId('bughunt-fixes');
    // 쪽지는 고른 줄 바로 다음
    expect(lines()[0].nextElementSibling).toBe(sheet);
    const fixGroup = screen.getByRole('group', {
      name: '1번 줄을 어떻게 고칠까요?',
    });
    expect(within(fixGroup).getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByTestId('quiz-submit')).toBeDisabled();
    fireEvent.click(within(sheet).getByText('for i in range(3):'));
    expect(p.onChange).toHaveBeenCalledWith(RIGHT);
  });

  it('다른 줄을 고르면 수정안은 비운다', () => {
    const p = panel({ value: RIGHT });
    fireEvent.click(screen.getByText('print(i)', { exact: false }));
    expect(p.onChange).toHaveBeenCalledWith({ line: 'ln-h7jq', fix: '' });
  });

  it('수정안을 고르면 원래 줄 취소선 + 고친 줄 미리보기, 정답 확인이 켜짐', () => {
    panel({ value: RIGHT });
    const first = lines()[0];
    expect(first.querySelector('del')).toHaveTextContent('for i in range(3)');
    expect(within(first).getByTestId('bughunt-preview')).toHaveTextContent(
      'for i in range(3):',
    );
    expect(
      screen.getByTestId('bughunt-steps').querySelector('[data-on]'),
    ).toHaveTextContent('2. 고칠 방법을 골라요');
    expect(screen.getByTestId('quiz-submit')).toBeEnabled();
  });

  it('이번 회차에 같은 줄에서 틀린 수정안은 흐리게 + 고를 수 없음', () => {
    panel({
      value: { line: 'ln-x5pc', fix: '' },
      misses: [{ line: 'ln-x5pc', fix: 'fx-e4kr' }],
    });
    const fixes = screen.getAllByTestId('bughunt-fix');
    expect(fixes[0]).toHaveAttribute('data-mark', 'miss');
    expect(fixes[0]).toHaveTextContent('아니었어요');
    expect(fixes[0].querySelector('input')).toBeDisabled();
    expect(fixes[1].querySelector('input')).toBeEnabled();
  });

  it('오답: 제출한 줄·수정에 X + "고른 줄"·"고른 수정", 정답은 드러내지 않음', () => {
    panel({
      value: WRONG,
      submitted: WRONG,
      misses: [WRONG],
      result: reply({}),
    });
    expect(lines().map((l) => l.getAttribute('data-mark'))).toEqual([
      'none',
      'wrong',
    ]);
    expect(lines()[1]).toHaveTextContent('고른 줄');
    expect(lines()[1]).toHaveTextContent('고른 수정');
    expect(screen.queryByTestId('bughunt-fixes')).toBeNull();
    expect(screen.queryByText('for i in range(3):')).toBeNull();
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });

  it('정답: 줄과 수정에 "정답"', () => {
    panel({
      value: RIGHT,
      submitted: RIGHT,
      result: reply({ correct: true, stars: 3, best_stars: 3, xp_awarded: 30 }),
    });
    expect(lines()[0]).toHaveAttribute('data-mark', 'correct');
    expect(within(lines()[0]).getByTestId('bughunt-preview')).toHaveTextContent(
      '정답',
    );
  });

  it('공개: 정답 줄에 "버그 줄" + 정답 수정안, 제출한 줄은 "고른 줄"', () => {
    panel({
      submitted: WRONG,
      result: reply({
        attempt_no: 3,
        stars: 1,
        best_stars: 1,
        xp_awarded: 10,
        revealed: { answer: RIGHT, explanation: '콜론이 빠졌어요' },
      }),
    });
    expect(lines().map((l) => l.getAttribute('data-mark'))).toEqual([
      'answer',
      'wrong',
    ]);
    expect(lines()[0]).toHaveTextContent('버그 줄');
    expect(within(lines()[0]).getByTestId('bughunt-preview')).toHaveTextContent(
      'for i in range(3):정답',
    );
  });
});

describe('BugHunt 규칙', () => {
  it('isComplete: 줄과 수정안이 모두 이 퀴즈에 있어야', () => {
    const ok = bugHuntInput.isComplete;
    expect(ok(null, QUIZ)).toBe(false);
    expect(ok({ line: 'ln-x5pc', fix: '' }, QUIZ)).toBe(false);
    expect(ok({ line: 'ln-zzzz', fix: 'fx-b7nd' }, QUIZ)).toBe(false);
    expect(ok(RIGHT, QUIZ)).toBe(true);
  });
  it('공개에서 같은 줄을 골랐지만 수정이 틀리면 고른 수정 + 정답 수정 둘 다', () => {
    const result = {
      status: 'revealed' as const,
      submitted: { line: 'ln-x5pc', fix: 'fx-e4kr' },
      answer: RIGHT,
    };
    expect(lineMark('ln-x5pc', { value: null, result })).toBe('answer');
    expect(linePreviews('ln-x5pc', { value: null, result })).toEqual([
      { fix: 'fx-e4kr', mark: 'wrong' },
      { fix: 'fx-b7nd', mark: 'answer' },
    ]);
  });
});
