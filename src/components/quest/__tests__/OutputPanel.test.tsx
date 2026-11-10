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
        example={{ text: '10', compare: true }}
      />,
    );
    const panel = screen.getByTestId('output-panel');
    expect(panel).toHaveAttribute('data-state', 'success');
    expect(panel).toHaveAttribute('data-verdict', 'pass');
    expect(screen.getByText('통과! 정답이에요!')).toBeInTheDocument();
    expect(lineTexts(screen.getByRole('list'))).toEqual(['10']);
    expect(screen.queryByTestId('output-compare')).toBeNull();
  });

  it('출력이 다름: 공개 예시 출력과 줄마다 견주고 규칙 유형별 살펴볼 거리 (P7-17)', () => {
    render(
      <OutputPanel
        result={{
          stdout: '안녕\n반가워!\n',
          stderr: '',
          success: true,
          outcome: 'ok',
        }}
        isRunning={false}
        validationResult={{ passed: false, type: 'output_match' }}
        example={{ text: '안녕하세요!\n반가워!', compare: true }}
      />,
    );
    expect(screen.getByTestId('output-panel')).toHaveAttribute(
      'data-verdict',
      'diff',
    );
    expect(screen.getByText('조금 달라요')).toBeInTheDocument();
    const compare = screen.getByTestId('output-compare');
    expect(compare).toHaveTextContent('2줄 중 1줄 같아요');
    const rows = within(screen.getByTestId('output-example')).getAllByRole(
      'listitem',
    );
    expect(rows[0]).not.toHaveAttribute('data-same');
    expect(rows[0]).toHaveTextContent('안녕하세요! (달라요) 내 글자 안녕');
    expect(rows[1]).toHaveAttribute('data-same');
    expect(rows[1]).toHaveTextContent('반가워! (같아요)');
    expect(compare).toHaveTextContent('한 글자씩 견줘 봐요');
  });

  it('무작위 퀘스트는 줄 비교 없이 예시만', () => {
    render(
      <OutputPanel
        result={{ stdout: '4\n', stderr: '', success: true, outcome: 'ok' }}
        isRunning={false}
        validationResult={{ passed: false, type: 'contains' }}
        example={{ text: '7', compare: false }}
      />,
    );
    const ex = screen.getByTestId('output-example');
    expect(ex).not.toHaveAttribute('data-compare');
    expect(ex).toHaveTextContent('예시');
    expect(ex).not.toHaveTextContent('내 글자');
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

  describe('성공 장면 (P6-08)', () => {
    const ok = {
      stdout: '안녕하세요\n',
      stderr: '',
      success: true,
      outcome: 'ok' as const,
    };
    const reward = {
      title: '첫 번째 인사',
      xp: 30,
      stars: 2 as const,
      coins: 15,
      nextHref: '/quest/q2',
      mapHref: '/world',
    };

    it('퀘스트를 마치면 도장 + XP 보상 띠 + 다음 퀘스트. 별·코인은 플래그가 꺼져 있어 숨김 (Q52)', () => {
      render(
        <OutputPanel
          result={ok}
          isRunning={false}
          validationResult={{ passed: true }}
          reward={reward}
        />,
      );
      expect(document.querySelector('.qx-stamp')).toHaveTextContent('통과!');
      const strip = screen.getByTestId('quest-reward');
      expect(within(strip).getByTestId('reward-xp')).toHaveTextContent('30');
      expect(within(strip).queryByTestId('reward-stars')).toBeNull();
      expect(within(strip).queryByTestId('reward-coins')).toBeNull();
      expect(
        within(strip).getByRole('link', { name: '다음 퀘스트' }),
      ).toHaveAttribute('href', '/quest/q2');
      expect(within(strip).getByRole('link', { name: '지도로' })).toBeTruthy();
    });

    it('스테이지 끝(다음 퀘스트 없음)은 지도가 주 버튼, 별·코인은 켜면 보임', () => {
      render(
        <OutputPanel
          result={ok}
          isRunning={false}
          validationResult={{ passed: true }}
          reward={{ ...reward, nextHref: null, forceStarsCoins: true }}
        />,
      );
      expect(screen.getByTestId('back-to-map')).toHaveAttribute(
        'href',
        '/world',
      );
      expect(screen.queryByRole('link', { name: '다음 퀘스트' })).toBeNull();
      expect(screen.getByTestId('reward-stars')).toHaveAccessibleName(
        '별 2개 / 3개',
      );
      expect(screen.getByTestId('reward-coins')).toHaveTextContent('15');
    });

    it('누르거나 Enter·Esc·Space면 끝 상태로 건너뛰고, 아니면 1.6초 뒤 끝난다', () => {
      vi.useFakeTimers();
      const { rerender } = render(
        <OutputPanel
          result={ok}
          isRunning={false}
          validationResult={{ passed: true }}
          reward={reward}
        />,
      );
      const strip = screen.getByTestId('quest-reward');
      expect(strip).not.toHaveAttribute('data-done');
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(strip).toHaveAttribute('data-done');
      expect(screen.getByTestId('reward-xp-count')).toHaveTextContent('30');

      // 새 실행 결과면 새 장면 → 시간이 다 되면 끝
      rerender(
        <OutputPanel
          result={{ ...ok }}
          isRunning={false}
          validationResult={{ passed: true }}
          reward={reward}
        />,
      );
      expect(screen.getByTestId('quest-reward')).not.toHaveAttribute(
        'data-done',
      );
      act(() => vi.advanceTimersByTime(1600));
      expect(screen.getByTestId('quest-reward')).toHaveAttribute('data-done');
      vi.useRealTimers();
    });

    it('통과했어도 아직 완료 전(보상 없음)·단계 통과면 장면 없음', () => {
      render(
        <OutputPanel
          result={ok}
          isRunning={false}
          validationResult={{ passed: true }}
        />,
      );
      expect(screen.queryByTestId('quest-reward')).toBeNull();
      expect(document.querySelector('.qx-stamp')).toBeNull();
    });
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
