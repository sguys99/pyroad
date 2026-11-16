// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { RunControls } from '../RunControls';

const noop = () => {};

afterEach(cleanup);

describe('RunControls 재준비 (P11-03)', () => {
  it('다시 준비 중에는 버튼만 못 누르고, 끝나면 낭독기에 "다시 준비됐어요"를 알린 뒤 실행하면 지운다', () => {
    const props = { onRun: noop, onStop: noop, onRetry: noop };
    const { rerender } = render(
      <RunControls
        {...props}
        status="loading"
        restarting="timeout"
        isRunning={false}
      />,
    );
    expect(screen.getByTestId('run-button')).toBeDisabled();
    expect(screen.getByTestId('run-button')).toHaveTextContent(
      '다시 준비 중...',
    );
    // 안내 상자는 결과 쪽지 안이라 여기엔 없음
    expect(screen.queryByTestId('runner-waking')).toBeNull();
    const announce = screen.getByTestId('runner-announce');
    expect(announce).toHaveTextContent('');

    rerender(<RunControls {...props} status="ready" isRunning={false} />);
    expect(screen.getByTestId('run-button')).toBeEnabled();
    expect(announce).toHaveTextContent('실행기가 다시 준비됐어요');

    rerender(<RunControls {...props} status="ready" isRunning />);
    expect(announce).toHaveTextContent('');
  });

  it('처음 준비가 끝났을 때는 알리지 않음 (재준비만)', () => {
    const props = { onRun: noop, onStop: noop, onRetry: noop };
    const { rerender } = render(
      <RunControls {...props} status="idle" isRunning={false} />,
    );
    rerender(<RunControls {...props} status="ready" isRunning={false} />);
    expect(screen.getByTestId('runner-announce')).toHaveTextContent('');
  });
});
