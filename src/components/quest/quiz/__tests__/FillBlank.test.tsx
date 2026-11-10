// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import type { QuizInputProps } from '../types';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

import {
  FillBlank,
  clearBlank,
  fillBlank,
  fillBlankInput,
  targetBlank,
} from '../FillBlank';
import { QUIZ_INPUTS } from '../quizInputs';

const QUIZ: QuizInputProps<'fill_blank'>['quiz'] = {
  kind: 'fill_blank',
  question: '빈칸을 채워요',
  code: 'for i in {{bk-r2fa}}(3):\n    {{bk-m8ce}}(i)',
  tokens: [
    { id: 'tok-z6nh', text: 'input' },
    { id: 'tok-c3pd', text: 'print' },
    { id: 'tok-m4xe', text: 'range' },
  ],
};
const B = ['bk-r2fa', 'bk-m8ce'];

afterEach(cleanup);

describe('빈칸 값 계산', () => {
  it('지금 채울 빈칸: 고른 빈 빈칸 → 없으면 첫 빈 빈칸 → 다 찼으면 null', () => {
    expect(targetBlank(B, null, null)).toBe('bk-r2fa');
    expect(targetBlank(B, null, 'bk-m8ce')).toBe('bk-m8ce');
    expect(targetBlank(B, { 'bk-m8ce': 'x' }, 'bk-m8ce')).toBe('bk-r2fa');
    expect(targetBlank(B, { 'bk-r2fa': 'a', 'bk-m8ce': 'b' }, null)).toBe(null);
  });
  it('채우면 뒤쪽 빈 빈칸, 없으면 앞쪽으로 넘어감', () => {
    expect(fillBlank(B, null, 'bk-r2fa', 't')).toEqual({
      value: { 'bk-r2fa': 't' },
      next: 'bk-m8ce',
    });
    expect(fillBlank(B, null, 'bk-m8ce', 't').next).toBe('bk-r2fa');
    expect(fillBlank(B, { 'bk-r2fa': 'a' }, 'bk-m8ce', 't').next).toBe(null);
  });
  it('되돌리기는 그 빈칸만 비움', () => {
    expect(clearBlank({ 'bk-r2fa': 'a', 'bk-m8ce': 'b' }, 'bk-r2fa')).toEqual({
      'bk-m8ce': 'b',
    });
  });
  it('isComplete: 모든 빈칸이 있는 토큰으로 차야 함 · 등록됨', () => {
    const { isComplete } = fillBlankInput;
    expect(isComplete(null, QUIZ)).toBe(false);
    expect(isComplete({ 'bk-r2fa': 'tok-m4xe' }, QUIZ)).toBe(false);
    expect(isComplete({ 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'nope' }, QUIZ)).toBe(
      false,
    );
    expect(
      isComplete({ 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'tok-m4xe' }, QUIZ),
    ).toBe(true);
    expect(QUIZ_INPUTS.fill_blank).toBe(fillBlankInput);
  });
});

function Live(p: Partial<QuizInputProps<'fill_blank'>>) {
  const [value, setValue] = useState<Record<string, string> | null>(null);
  return (
    <FillBlank
      quiz={QUIZ}
      value={value}
      onChange={setValue}
      disabled={false}
      result={null}
      misses={[]}
      labelledBy="q"
      {...p}
    />
  );
}

const blank = (n: number) =>
  screen.getByRole('button', { name: new RegExp(`^빈칸 ${n},`) });
const chip = (t: string) =>
  screen.getByRole('button', { name: new RegExp(`^${t}`) });

describe('FillBlank 화면', () => {
  it('칩 탭 → 빈칸에 들어가고 다음 빈칸으로, 찬 빈칸 탭 → 되돌리기, 모두 지우기', () => {
    render(<Live />);
    expect(blank(1)).toHaveAttribute('aria-current', 'true');
    expect(blank(2)).toHaveAccessibleName('빈칸 2, 지금 비어 있어요');
    fireEvent.click(chip('range'));
    expect(blank(1)).toHaveTextContent('range');
    expect(blank(2)).toHaveAttribute('aria-current', 'true');
    // 같은 낱말을 또 쓸 수 있음 (칩이 소모되지 않음)
    expect(chip('range')).toHaveAccessibleName('range, 쓰는 중');
    fireEvent.click(chip('range'));
    expect(blank(2)).toHaveTextContent('range');
    // 다 차면 칩은 누를 곳이 없음 — disabled 가 아니라 aria-disabled (방금 누른 칩에서 초점이 빠지지 않게, P7-13)
    expect(chip('print')).toHaveAttribute('aria-disabled', 'true');
    expect(chip('print')).toBeEnabled();
    fireEvent.click(chip('print'));
    expect(blank(2)).toHaveTextContent('range');
    fireEvent.click(blank(1));
    expect(blank(1)).not.toHaveTextContent('range');
    expect(blank(1)).toHaveAttribute('aria-current', 'true');
    fireEvent.click(chip('print'));
    expect(blank(1)).toHaveTextContent('print');
    fireEvent.click(screen.getByRole('button', { name: '모두 지우기' }));
    expect(blank(1)).toHaveAttribute('aria-current', 'true');
    expect(blank(2)).not.toHaveTextContent('range');
  });

  it('키보드: 마지막 빈칸을 채운 칩에 초점이 남고, 낱말 칩 묶음에 이름이 있음 (P7-13)', () => {
    render(<Live />);
    expect(
      screen.getByRole('group', { name: '넣을 낱말' }),
    ).toBeInTheDocument();
    chip('range').focus();
    fireEvent.click(chip('range'));
    fireEvent.click(chip('range'));
    expect(chip('range')).toHaveFocus();
    expect(chip('range')).toHaveAccessibleName('range, 쓰는 중');
  });

  it('빈 빈칸을 누르면 그 빈칸을 고름', () => {
    render(<Live />);
    fireEvent.click(blank(2));
    fireEvent.click(chip('print'));
    expect(blank(2)).toHaveTextContent('print');
    expect(blank(1)).toHaveAttribute('aria-current', 'true');
  });

  it('wrong 이면 낸 칩, revealed 면 정답 칩으로 채워 보여 줌', () => {
    const submitted = { 'bk-r2fa': 'tok-z6nh', 'bk-m8ce': 'tok-c3pd' };
    const answer = { 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'tok-c3pd' };
    const { rerender } = render(
      <Live
        disabled
        value={submitted}
        result={{ status: 'wrong', submitted, answer: null }}
      />,
    );
    expect(blank(1)).toHaveTextContent('input');
    expect(blank(1)).toHaveAttribute('data-mark', 'wrong');
    expect(blank(1)).toBeDisabled();
    expect(screen.queryByRole('button', { name: '모두 지우기' })).toBeNull();
    rerender(
      <Live
        disabled
        value={submitted}
        result={{ status: 'revealed', submitted, answer }}
      />,
    );
    expect(blank(1)).toHaveTextContent('range');
    expect(blank(1)).toHaveAccessibleName('빈칸 1, range 정답');
  });
});
