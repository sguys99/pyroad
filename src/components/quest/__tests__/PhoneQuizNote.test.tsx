// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import type { StageQuestDot } from '@/lib/quest/stageProgress';

// 코드 퀘스트 폰 퀴즈 쪽지 (P7-11): 폰 + 이 스테이지에 퀴즈 → 기기당 한 번

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/analytics/track', () => ({ track }));

import {
  PHONE_QUIZ_NOTE_DELAY_MS,
  PHONE_QUIZ_NOTE_KEY,
  PhoneQuizNote,
} from '../PhoneQuizNote';

const dot = (
  id: string,
  order: number,
  quest_type = 'code',
  completed = false,
): StageQuestDot => ({ id, order, title: id, completed, quest_type });
const QUESTS = [
  dot('q1', 1),
  dot('z1', 2, 'quiz', true),
  dot('q3', 3),
  dot('z2', 4, 'quiz'),
];

function setPhone(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
const wait = () =>
  act(() => vi.advanceTimersByTime(PHONE_QUIZ_NOTE_DELAY_MS + 10));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  track.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PhoneQuizNote', () => {
  it('폰: 퀴즈 수 + 안 푼 첫 퀴즈 바로가기, 한 번 보이면 이 기기에선 다시 안 뜸', async () => {
    setPhone(true);
    const { unmount } = render(<PhoneQuizNote quests={QUESTS} />);
    await wait();
    const note = screen.getByTestId('phone-quiz-note');
    expect(note).toHaveTextContent('폰에선 퀴즈가 더 편해요');
    expect(screen.getByRole('link', { name: '퀴즈 2개 보기' })).toHaveAttribute(
      'href',
      '/quest/z2',
    );
    expect(localStorage.getItem(PHONE_QUIZ_NOTE_KEY)).toBe('1');
    expect(track).toHaveBeenCalledWith('phone_quiz_pick', {
      place: 'quest',
      action: 'show',
    });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
    unmount();

    render(<PhoneQuizNote quests={QUESTS} />);
    await wait();
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
  });

  it('넓은 화면·퀴즈 없는 스테이지·잠긴 스테이지 복습이면 안 뜸', async () => {
    setPhone(false);
    const { unmount } = render(<PhoneQuizNote quests={QUESTS} />);
    await wait();
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
    unmount();

    setPhone(true);
    const r2 = render(<PhoneQuizNote quests={[dot('q1', 1)]} />);
    await wait();
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
    r2.unmount();

    render(<PhoneQuizNote quests={QUESTS} unlocked={false} />);
    await wait();
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
    expect(localStorage.getItem(PHONE_QUIZ_NOTE_KEY)).toBeNull();
  });

  it('저장소를 못 쓰면 띄우지 않음 (매번 뜨지 않게)', async () => {
    setPhone(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<PhoneQuizNote quests={QUESTS} />);
    await wait();
    expect(screen.queryByTestId('phone-quiz-note')).toBeNull();
    vi.restoreAllMocks();
  });
});
