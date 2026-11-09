// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QuestHints, hintNotes } from '../QuestHints';

afterEach(cleanup);

const base = {
  kind: 'code' as const,
  hintsUsed: 0,
  notes: [],
  onHint: () => {},
  hintBusy: false,
  goldenKeys: 3,
  onGoldenKey: () => {},
  keyBlocked: false,
  xpReward: 50,
  totalHintsUsed: 0,
  usedGoldenKey: false,
  isCompleted: false,
  showStars: false,
};

describe('QuestHints (P6-09)', () => {
  it('남은 횟수와 힌트를 쓰면 줄어드는 XP를 미리 알려 준다 (서버 quest_xp 규칙)', () => {
    const { rerender } = render(<QuestHints {...base} />);
    expect(
      screen.getByRole('button', { name: '힌트 받기 (3번 남음)' }),
    ).toBeEnabled();
    expect(screen.getByTestId('quest-reward-preview')).toHaveTextContent(
      '받을 경험치 +75 XP힌트를 쓰면 +63 XP로 줄어요.',
    );
    rerender(<QuestHints {...base} hintsUsed={2} totalHintsUsed={2} />);
    expect(screen.getByTestId('quest-reward-preview')).toHaveTextContent(
      '+50 XP힌트를 더 써도 받을 경험치는 그대로예요.',
    );
    rerender(<QuestHints {...base} showStars />);
    expect(screen.getByTestId('quest-reward-preview')).toHaveTextContent(
      '힌트를 쓰면 받을 별이 3개 → 2개로 줄어요.',
    );
  });

  it('황금키는 확인 창에서 결과를 보여 주고, "황금키 쓰기"를 눌러야 쓴다', () => {
    const onGoldenKey = vi.fn();
    render(<QuestHints {...base} onGoldenKey={onGoldenKey} />);
    fireEvent.click(
      screen.getByRole('button', { name: '황금키 쓰기 (3개 남음)' }),
    );
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('경험치(XP)와 뱃지 없이 끝나요');
    expect(dialog).toHaveTextContent('+75 XP → 0');
    expect(dialog).toHaveTextContent('황금키 3개 → 2개');
    fireEvent.click(screen.getByRole('button', { name: '그만둘래요' }));
    expect(onGoldenKey).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: '황금키 쓰기 (3개 남음)' }),
    );
    fireEvent.click(screen.getByRole('button', { name: '황금키 쓰기' }));
    expect(onGoldenKey).toHaveBeenCalledTimes(1);
  });

  it('완료한 퀘스트는 힌트·황금키를 막고 보상은 처음 한 번뿐이라고 알려 준다', () => {
    render(<QuestHints {...base} isCompleted />);
    expect(screen.getByRole('button', { name: /힌트 받기/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /황금키 쓰기/ })).toBeDisabled();
    expect(screen.getByTestId('quest-reward-preview')).toHaveTextContent(
      '보상은 처음 한 번만',
    );
  });

  it('방금 통과·예전에 통과·복습 통과를 다르게 말한다 (Q57)', () => {
    const { rerender } = render(
      <QuestHints {...base} isCompleted completion="just" />,
    );
    const note = screen.getByTestId('quest-reward-preview');
    expect(note).toHaveTextContent('통과해서 보상을 받았어요');
    expect(note).not.toHaveTextContent('예전에');
    rerender(<QuestHints {...base} isCompleted completion="before" />);
    expect(note).toHaveTextContent('예전에 통과한 퀘스트예요');
    rerender(<QuestHints {...base} isCompleted completion="review" />);
    expect(note).toHaveTextContent('복습 완료');
  });

  it('hintNotes: 이번 단계 쪽지만, 받는 중이면 흘러 들어오는 글자', () => {
    const notes = hintNotes(
      [
        { role: 'system', content: '힌트 1/3', hint: { level: 1, step: 1 } },
        { role: 'tutor', content: '옛 단계', hint: { level: 1, step: 1 } },
        { role: 'system', content: '힌트 1/3', hint: { level: 1, step: 2 } },
        { role: 'tutor', content: '첫 힌트', hint: { level: 1, step: 2 } },
        { role: 'tutor', content: '그냥 대화' },
        { role: 'system', content: '힌트 2/3', hint: { level: 2, step: 2 } },
      ],
      2,
      'print',
    );
    expect(notes).toEqual([
      { level: 1, text: '첫 힌트' },
      { level: 2, text: 'print', pending: true },
    ]);
  });
});
