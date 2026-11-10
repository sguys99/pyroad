// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { QuizAnswerResponse } from '@/lib/quest/quizAnswer';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';

vi.mock('@/components/providers/SoundProvider', () => ({
  useSfx: () => vi.fn(),
}));
vi.mock('@/lib/pyodide/PyodideProvider', () => ({
  usePyodideRuntime: () => ({}),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/confetti', async (orig) => ({
  ...(await orig<typeof import('@/lib/confetti')>()),
  fireConfetti: vi.fn(),
  resetConfetti: vi.fn(),
}));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/track', () => ({ track }));

import { DailyQuiz, type DailyItem } from '../DailyQuiz';

// 오늘의 퀴즈 화면 (P7-10): 끝난 문제 건너뛰기 · 다음 문제 넘김 · 요약 · 분석

const TODAY = '2026-11-10';

const item = (
  id: string,
  progress: Partial<UserProgress> | null = null,
): DailyItem => ({
  quest: {
    id,
    title: `퀴즈 ${id}`,
    quest_type: 'quiz',
    prompt_skeleton: {
      quiz: {
        kind: 'multiple_choice',
        question: `${id} 문제`,
        options: [
          { id: 'opt-a', text: '가' },
          { id: 'opt-b', text: '나' },
        ],
      },
    },
    stage: { id: 's1', title: '스테이지', order: 1, theme_name: 't' },
  } as unknown as QuestWithStage,
  progress: progress as UserProgress | null,
  review: false,
});

const reply = (over: Partial<QuizAnswerResponse> = {}): QuizAnswerResponse => ({
  correct: true,
  attempt_no: 1,
  mode: 'first',
  stars: 3,
  best_stars: 3,
  xp_awarded: 30,
  total_xp: 130,
  level_before: 1,
  level_after: 1,
  explanation: null,
  revealed: null,
  next_review_on: null,
  next_quiz: null,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  track.mockClear();
});

function show(
  items: DailyItem[],
  results: Record<string, 'correct' | 'revealed'> = {},
) {
  render(
    <DailyQuiz
      items={items}
      results={results}
      today={TODAY}
      userId="u1"
      initialXP={100}
      initialLevel={1}
    />,
  );
}

describe('DailyQuiz', () => {
  it('오늘 끝난 문제는 건너뛰고, 마지막 문제를 맞히면 "오늘 결과 보기" → 요약 + finish 이벤트', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(reply()), { status: 200 })),
    );
    show(
      [
        item('q1', { stars_judged_on: TODAY, stars: 2, best_stars: 2 }),
        item('q2'),
      ],
      { q1: 'correct' },
    );
    expect(track).toHaveBeenCalledWith('daily_quiz_open', {
      total: 2,
      done: 1,
    });
    expect(screen.getByText('q2 문제')).toBeInTheDocument();
    const dots = screen.getAllByTestId('daily-dot');
    expect(dots[0]).toHaveAttribute('data-state', 'correct');
    expect(dots[1]).toHaveAttribute('data-state', 'current');

    fireEvent.click(screen.getByText('나'));
    fireEvent.click(screen.getByTestId('quiz-submit'));
    const next = await screen.findByTestId('next-quest');
    expect(next).toHaveTextContent('오늘 결과 보기');
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith('daily_quiz_finish', {
        correct: 2,
        stars: 5,
      }),
    );

    fireEvent.click(next);
    const sum = screen.getByTestId('daily-summary');
    expect(sum).toHaveTextContent('2문제 중 2문제 맞혔어요');
    expect(screen.getByTestId('daily-sum-stars')).toHaveTextContent('5');
    // 첫 문제 XP 는 이 화면에서 모름 → XP 칸 숨김
    expect(screen.queryByTestId('daily-sum-xp')).toBeNull();
    expect(sum).toHaveTextContent('내일 또 만나요');
    expect(sum).toHaveTextContent('1개는 내일 복습 도전');
  });

  it('오늘 다 풀었으면 요약으로 시작하고 finish 는 다시 보내지 않음', () => {
    show([item('q1', { best_stars: 3 })], { q1: 'revealed' });
    expect(screen.getByTestId('daily-summary')).toHaveTextContent(
      '1문제 중 0문제',
    );
    expect(track).not.toHaveBeenCalledWith(
      'daily_quiz_finish',
      expect.anything(),
    );
  });

  it('문제가 없으면 안내만', () => {
    show([]);
    expect(screen.getByTestId('daily-empty')).toHaveTextContent(
      '첫 스테이지를 지나면',
    );
    expect(screen.queryByTestId('daily-dot')).toBeNull();
  });
});
