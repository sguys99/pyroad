// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { OutputPanel } from '../OutputPanel';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';

afterEach(cleanup);

const lineTexts = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((li) => li.textContent);

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
    expect(lineTexts(pre())).toEqual(['1', '2']);
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
    expect(lineTexts(screen.getByRole('list'))).toEqual(['0', '1']);
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

  it('통과: 줄마다 카드 + "통과! 정답이에요!" 딱지, 견줘 보기는 없음', () => {
    render(
      <OutputPanel
        result={{ stdout: '10\n', stderr: '', success: true, outcome: 'ok' }}
        isRunning={false}
        validationResult={{ passed: true }}
        goal="10 이 출력되어야 해요"
      />,
    );
    const panel = screen.getByTestId('output-panel');
    expect(panel).toHaveAttribute('data-state', 'success');
    expect(panel).toHaveAttribute('data-verdict', 'pass');
    expect(screen.getByText('통과! 정답이에요!')).toBeInTheDocument();
    expect(lineTexts(screen.getByRole('list'))).toEqual(['10']);
    expect(screen.queryByTestId('output-compare')).toBeNull();
  });

  it('출력이 다름: 공개 안내(해 볼 일)와 규칙 유형별 살펴볼 거리로 견줘 본다', () => {
    render(
      <OutputPanel
        result={{ stdout: '안녕\n', stderr: '', success: true, outcome: 'ok' }}
        isRunning={false}
        validationResult={{ passed: false, type: 'output_match' }}
        goal="안녕하세요! 가 출력되어야 해요"
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-verdict',
      'diff',
    );
    expect(screen.getByText('조금 달라요')).toBeInTheDocument();
    const compare = screen.getByTestId('output-compare');
    expect(compare).toHaveTextContent('안녕하세요! 가 출력되어야 해요');
    expect(compare).toHaveTextContent('한 글자씩 견줘 봐요');
  });

  it('오류: 몇 번째 줄 · 마지막 한 줄 요약, 줄로 가기, 전체 메시지는 접어 둠', () => {
    const onShow = vi.fn();
    const stderr =
      'Traceback (most recent call last):\n  File "<exec>", line 2, in <module>\nNameError: name \'y\' is not defined\n';
    render(
      <OutputPanel
        result={{ stdout: '1\n', stderr, success: false, hadException: true }}
        isRunning={false}
        onShowErrorLine={onShow}
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-state',
      'error',
    );
    expect(screen.getByTestId('output-error')).toHaveTextContent(
      "2번째 줄NameError: name 'y' is not defined",
    );
    expect(screen.getByTestId('bugbug-helper')).toBeInTheDocument();
    expect(screen.getByText('오류 메시지 전체 보기')).toBeInTheDocument();
    // P6-07: 버그버그 한마디 + (lg 미만) 파이뱀 쉬운 설명
    expect(screen.getByTestId('bugbug-aside')).toHaveTextContent(
      '히히, 2번째 줄에 숨었지!',
    );
    expect(screen.getByTestId('error-explain')).toHaveTextContent(
      '2번째 줄을 봐요. y 라는 이름은 처음 봐요.',
    );
    fireEvent.click(screen.getByTestId('show-error-line'));
    expect(onShow).toHaveBeenCalledWith(2);
  });

  it('오류 다음 실행이 끝까지 돌면 버그버그 화해 인사가 잠깐 나왔다 사라진다 (P6-07)', () => {
    vi.useFakeTimers();
    const err = {
      stdout: '',
      stderr: 'NameError: x',
      success: false,
      hadException: true,
    };
    const ok = {
      stdout: 'a\n',
      stderr: '',
      success: true,
      outcome: 'ok' as const,
    };
    const { rerender } = render(<OutputPanel result={err} isRunning={false} />);
    expect(screen.queryByTestId('bugbug-makeup')).toBeNull();
    // 실행 중에는 이전 결과가 그대로 들어온다
    rerender(<OutputPanel result={err} isRunning />);
    rerender(<OutputPanel result={ok} isRunning={false} />);
    expect(screen.getByTestId('bugbug-makeup')).toHaveTextContent('화해하자');
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId('bugbug-makeup')).toBeNull();
    // 오류 없이 이어진 성공에는 나오지 않음
    rerender(<OutputPanel result={{ ...ok }} isRunning={false} />);
    expect(screen.queryByTestId('bugbug-makeup')).toBeNull();
    vi.useRealTimers();
  });

  it('실행이 끝나도 실시간으로 나온 줄은 그대로 (다시 튀지 않음)', () => {
    const store = createLiveOutputStore();
    const { rerender } = render(
      <OutputPanel result={null} isRunning liveOutput={store} />,
    );
    act(() => store.append('a\n'));
    const first = screen.getByRole('listitem');
    rerender(
      <OutputPanel
        result={{ stdout: 'a\nb\n', stderr: '', success: true, outcome: 'ok' }}
        isRunning={false}
        liveOutput={store}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toBe(first);
    expect(items.map((li) => li.textContent)).toEqual(['a', 'b']);
  });

  it('결과 쪽 재준비는 쪽지 안 한 줄로', () => {
    render(
      <OutputPanel
        result={{
          stdout: '',
          stderr: '',
          success: false,
          isStopped: true,
          outcome: 'stopped',
        }}
        isRunning={false}
        restarting
      />,
    );
    expect(screen.getByTestId('runner-waking-inline')).toHaveTextContent(
      '다시 펼치는 중',
    );
  });
});
