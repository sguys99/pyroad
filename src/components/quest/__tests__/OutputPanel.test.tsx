// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OutputPanel } from '../OutputPanel';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';

afterEach(cleanup);

describe('OutputPanel', () => {
  it('실행 중: 출력 조각을 바로 보여 주고 맨 아래로 스크롤한다', () => {
    const store = createLiveOutputStore();
    render(<OutputPanel result={null} isRunning liveOutput={store} />);
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-state',
      'running',
    );
    expect(screen.queryByTestId('live-output')).toBeNull();

    const pre = () => screen.getByTestId('live-output');
    act(() => store.append('1\n'));
    Object.defineProperty(pre(), 'scrollHeight', {
      value: 480,
      configurable: true,
    });
    act(() => store.append('2\n'));
    expect(pre()).toHaveTextContent('1 2');
    expect(pre().scrollTop).toBe(480);
  });

  it('실행 중 출력이 화면 상한을 넘으면 안내한다', () => {
    const store = createLiveOutputStore(4);
    render(<OutputPanel result={null} isRunning liveOutput={store} />);
    act(() => store.append('123456'));
    expect(
      screen.getByText('출력이 너무 많아서 앞부분만 보여 줘요.'),
    ).toBeInTheDocument();
  });

  it('시간 초과: 무한 반복 안내 + 멈추기 전까지의 출력', () => {
    render(
      <OutputPanel
        result={{
          stdout: '0\n1\n',
          stderr: '',
          success: false,
          isTimeout: true,
          outcome: 'timeout',
        }}
        isRunning={false}
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-state',
      'timeout',
    );
    expect(screen.getByText(/무한 반복이 있는지/)).toBeInTheDocument();
    expect(screen.getByText(/0\s+1/)).toBeInTheDocument();
  });

  it('출력 상한(B15)으로 멈춤: 끝없는 print 안내', () => {
    render(
      <OutputPanel
        result={{
          stdout: 'a\n'.repeat(3),
          stderr: '[출력이 너무 많아서 여기서 멈췄어요]',
          success: false,
          outcome: 'output-limit',
          truncated: true,
        }}
        isRunning={false}
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-state',
      'output-limit',
    );
    expect(screen.getByText('앗, 출력이 너무 많아요!')).toBeInTheDocument();
  });

  it('성공·정답은 그대로', () => {
    render(
      <OutputPanel
        result={{ stdout: '10\n', stderr: '', success: true, outcome: 'ok' }}
        isRunning={false}
        validationResult={{ passed: true }}
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-state',
      'success',
    );
    expect(screen.getByText('정답이에요!')).toBeInTheDocument();
  });
});
