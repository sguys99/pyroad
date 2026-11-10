// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StepStrip } from '../StepStrip';

const goals = ['비밀 숫자', '추측', '비교'];
const states = () =>
  Array.from(
    screen.getByTestId('step-strip').querySelectorAll('li'),
    (li) => li.dataset.state,
  );

describe('StepStrip (P6-12)', () => {
  afterEach(cleanup);

  it('지금 단계: "단계 2/3" + 칸 상태 + 지금 목표, 건너뛰기 없음', () => {
    render(<StepStrip goals={goals} current={2} onSkip={() => {}} />);
    expect(screen.getByText('단계 2/3')).toBeInTheDocument();
    expect(states()).toEqual(['done', 'current', 'todo']);
    expect(screen.getByText('추측')).toBeInTheDocument();
    expect(screen.queryByTestId('step-skip')).toBeNull();
  });

  it('"다음 단계" 박자: 통과 알림 + 다음 목표 + 바로 넘기기', () => {
    const onSkip = vi.fn();
    render(<StepStrip goals={goals} current={2} cleared={2} onSkip={onSkip} />);
    expect(screen.getByText('2단계 통과!')).toBeInTheDocument();
    expect(states()).toEqual(['done', 'done', 'current']);
    expect(screen.getByTestId('step-strip')).toHaveAttribute('data-step', '3');
    expect(screen.getByText('비교')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('step-skip'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('완성: 모든 칸 끝냄', () => {
    render(<StepStrip goals={goals} current={3} completed />);
    expect(screen.getByText('3단계 모두 완성!')).toBeInTheDocument();
    expect(states()).toEqual(['done', 'done', 'done']);
  });
});
