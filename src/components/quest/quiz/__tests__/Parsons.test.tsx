// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { Parsons, parsonsInput, moveItem, toPlaced, toValue } from '../Parsons';
import { QUIZ_INPUTS } from '../quizInputs';
import type { QuizInputProps, QuizOf } from '../types';

const QUIZ: QuizOf<'parsons'> = {
  kind: 'parsons',
  question: '구구단 2단을 순서대로 맞춰 보자',
  lines: [
    { id: 'ln-m2xa', code: 'print(2 * i)' },
    { id: 'ln-q8wd', code: 'for i in range(1, 10):' },
    { id: 'ln-a3ke', code: 'print("끝")' },
  ],
};
const INDENT: QuizOf<'parsons'> = { ...QUIZ, indent: true };

function show(over: Partial<QuizInputProps<'parsons'>> = {}) {
  const props: QuizInputProps<'parsons'> = {
    quiz: QUIZ,
    value: null,
    onChange: vi.fn(),
    disabled: false,
    result: null,
    misses: [],
    labelledBy: 'q',
    ...over,
  };
  render(<Parsons {...props} />);
  return props;
}

const rows = () => screen.queryAllByTestId('parsons-row');
const trayChips = () =>
  screen.queryAllByRole('button', { name: /^내 코드에 넣기/ });

afterEach(cleanup);

describe('값 변환', () => {
  it('줄 id 배열·{id, indent} 배열을 오가고, 옮기기는 새 배열', () => {
    expect(toPlaced(['a', 'b'])).toEqual([
      { id: 'a', indent: 0 },
      { id: 'b', indent: 0 },
    ]);
    expect(toPlaced(null)).toEqual([]);
    const p = [{ id: 'a', indent: 1 }];
    expect(toValue(p, true)).toEqual([{ id: 'a', indent: 1 }]);
    expect(toValue(p, false)).toEqual(['a']);
    const list = ['a', 'b', 'c'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b']);
    expect(list).toEqual(['a', 'b', 'c']);
  });

  it('isComplete: 모든 줄이 내 코드에 있어야', () => {
    expect(QUIZ_INPUTS.parsons).toBe(parsonsInput);
    const done = parsonsInput.isComplete;
    expect(done(null, QUIZ)).toBe(false);
    expect(done(['ln-q8wd', 'ln-m2xa'], QUIZ)).toBe(false);
    expect(done(['ln-q8wd', 'ln-m2xa', 'ln-a3ke'], QUIZ)).toBe(true);
    expect(done(['ln-q8wd', 'ln-q8wd', 'ln-a3ke'], QUIZ)).toBe(false);
    expect(
      done(
        [
          { id: 'ln-q8wd', indent: 0 },
          { id: 'ln-m2xa', indent: 1 },
          { id: 'ln-a3ke', indent: 0 },
        ],
        INDENT,
      ),
    ).toBe(true);
  });
});

describe('Parsons 탭 정렬', () => {
  it('처음엔 내 코드가 비고, 줄 조각은 서버 순서. 조각을 누르면 맨 아래에 붙음', () => {
    const p = show();
    expect(rows()).toHaveLength(0);
    expect(screen.getByText(/아래 줄 조각을 눌러/)).toBeInTheDocument();
    expect(trayChips().map((b) => b.textContent)).toEqual(
      QUIZ.lines.map((l) => l.code),
    );
    fireEvent.click(trayChips()[1]);
    expect(p.onChange).toHaveBeenCalledWith(['ln-q8wd']);
  });

  it('놓인 줄은 조각에서 빠지고, 누르면 조각으로 돌아감', () => {
    const p = show({ value: ['ln-q8wd', 'ln-m2xa'] });
    expect(rows().map((r) => r.textContent)).toEqual([
      'for i in range(1, 10):',
      'print(2 * i)',
    ]);
    expect(trayChips()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^1번째 줄: for/ }));
    expect(p.onChange).toHaveBeenCalledWith(['ln-m2xa']);
  });

  it('위/아래 버튼으로 순서 바꾸기 (첫 줄 위·끝 줄 아래는 꺼짐)', () => {
    const p = show({ value: ['ln-q8wd', 'ln-m2xa', 'ln-a3ke'] });
    expect(
      screen.getByRole('button', { name: '1번째 줄 위로' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '3번째 줄 아래로' }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '3번째 줄 위로' }));
    expect(p.onChange).toHaveBeenCalledWith(['ln-q8wd', 'ln-a3ke', 'ln-m2xa']);
    expect(trayChips()).toHaveLength(0);
  });

  it('손잡이를 끌어 순서 바꾸기 (포인터)', () => {
    const p = show({ value: ['ln-q8wd', 'ln-m2xa', 'ln-a3ke'] });
    rows().forEach((r, i) => {
      r.getBoundingClientRect = () =>
        ({ top: i * 50, height: 44, bottom: i * 50 + 44 }) as DOMRect;
    });
    const grip = rows()[0].querySelector('.qz-ps-grip')!;
    fireEvent.pointerDown(grip, { button: 0, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(grip, { clientY: 125, pointerId: 1 });
    expect(rows()[1]).toHaveStyle({ transform: 'translateY(-50px)' });
    fireEvent.pointerUp(grip, { clientY: 125, pointerId: 1 });
    expect(p.onChange).toHaveBeenCalledWith(['ln-m2xa', 'ln-a3ke', 'ln-q8wd']);
  });

  it('들여쓰기: 0~4 단계 버튼과 안내선, 값은 {id, indent}', () => {
    const p = show({
      quiz: INDENT,
      value: [
        { id: 'ln-q8wd', indent: 0 },
        { id: 'ln-m2xa', indent: 4 },
      ],
    });
    expect(
      screen.getByRole('button', { name: '1번째 줄 들여쓰기 줄이기' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: '2번째 줄 들여쓰기 늘리기' }),
    ).toBeDisabled();
    expect(rows()[1].querySelectorAll('.qz-ps-guide')).toHaveLength(4);
    fireEvent.click(
      screen.getByRole('button', { name: '1번째 줄 들여쓰기 늘리기' }),
    );
    expect(p.onChange).toHaveBeenCalledWith([
      { id: 'ln-q8wd', indent: 1 },
      { id: 'ln-m2xa', indent: 4 },
    ]);
    fireEvent.click(trayChips()[0]);
    expect(p.onChange).toHaveBeenLastCalledWith([
      { id: 'ln-q8wd', indent: 0 },
      { id: 'ln-m2xa', indent: 4 },
      { id: 'ln-a3ke', indent: 0 },
    ]);
  });
});

describe('Parsons 키보드·낭독기 (P7-13)', () => {
  function Live() {
    const [value, setValue] =
      useState<QuizInputProps<'parsons'>['value']>(null);
    return (
      <Parsons
        quiz={QUIZ}
        value={value}
        onChange={setValue}
        disabled={false}
        result={null}
        misses={[]}
        labelledBy="q"
      />
    );
  }

  it('조각을 넣으면 다음 조각, 마지막 조각이면 방금 넣은 줄로 초점. 놓은 수를 글로 읽음', () => {
    render(<Live />);
    expect(screen.getByRole('region', { name: '줄 조각' })).toBeInTheDocument();
    fireEvent.click(trayChips()[0]);
    expect(trayChips()[0]).toHaveFocus();
    expect(screen.getByText(/3줄 중 1줄 놓음/)).toBeInTheDocument();
    fireEvent.click(trayChips()[0]);
    fireEvent.click(trayChips()[0]);
    expect(trayChips()).toHaveLength(0);
    expect(
      screen.getByRole('button', { name: /^3번째 줄: print\("끝"\)/ }),
    ).toHaveFocus();
    // 위로 옮겨도 같은 버튼에 초점
    fireEvent.click(screen.getByRole('button', { name: '3번째 줄 위로' }));
    expect(screen.getByRole('button', { name: '2번째 줄 위로' })).toHaveFocus();
  });
});

describe('Parsons 결과', () => {
  const sent = ['ln-m2xa', 'ln-q8wd', 'ln-a3ke'];
  const answer = ['ln-q8wd', 'ln-m2xa', 'ln-a3ke'];

  it('틀림: 제출한 순서 그대로 + "어딘가 순서가 달라요", 어느 줄인지는 없음, 조작 꺼짐', () => {
    show({
      value: sent,
      disabled: true,
      result: { status: 'wrong', submitted: sent, answer: null },
    });
    expect(rows().map((r) => r.textContent)).toEqual(
      sent.map((id) => QUIZ.lines.find((l) => l.id === id)!.code),
    );
    expect(screen.getByTestId('parsons-wrong')).toHaveTextContent(
      '어딘가 순서가 달라요',
    );
    expect(screen.queryByRole('button', { name: /위로/ })).toBeNull();
    expect(document.querySelector('.qz-ps-grip')).toBeNull();
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });

  it('공개: 정답 순서로 보여 줌', () => {
    show({
      value: sent,
      disabled: true,
      result: { status: 'revealed', submitted: sent, answer },
    });
    expect(screen.getByText('정답 순서')).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent('for i in range(1, 10):');
    expect(screen.queryByTestId('parsons-wrong')).toBeNull();
  });

  it('정답: 체크 + "정답"', () => {
    show({
      value: answer,
      disabled: true,
      result: { status: 'correct', submitted: answer, answer: null },
    });
    expect(screen.getByText('정답')).toBeInTheDocument();
  });
});
