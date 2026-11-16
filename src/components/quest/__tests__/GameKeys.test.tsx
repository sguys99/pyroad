// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GameKeys } from '../GameKeys';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { InputChannel } from '@/lib/pyodide/types';

afterEach(cleanup);
// jsdom은 배치를 하지 않아 보이는 요소도 getClientRects가 비어 있다
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
    {},
  ] as unknown as DOMRectList);
});

function listen(channel: InputChannel = 'jspi') {
  const store = createLiveOutputStore();
  const press = vi.fn();
  const stop = vi.fn();
  render(<GameKeys store={store} running />);
  act(() => store.listenKeys({ channel, press, stop }));
  return { store, press, stop };
}

describe('GameKeys (P11-04)', () => {
  it('get_key()를 부르기 전엔 없고, 부르면 조종판이 나와 포커스를 가져옴', () => {
    const { press } = listen();
    const pad = screen.getByTestId('game-keys');
    expect(pad).toHaveFocus();
    expect(pad).toHaveAccessibleName('게임 조종판');
    expect(press).not.toHaveBeenCalled();
  });

  it('키보드: 화살표·스페이스는 Tk 이름으로 보내고 스크롤은 막음, 글자 칸 안의 키는 그대로', () => {
    const { press } = listen();
    const ev = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(press.mock.calls).toEqual([['Right'], ['space']]);

    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(press).toHaveBeenCalledTimes(2);
    input.remove();
  });

  it('방향 패드: 누르면 바로 한 번, 누르고 있으면 계속, 떼면 멈춤', () => {
    vi.useFakeTimers();
    try {
      const { press } = listen();
      const left = screen.getByRole('button', { name: '왼쪽' });
      fireEvent.pointerDown(left, { button: 0, pointerId: 1 });
      expect(press).toHaveBeenCalledWith('Left');
      act(() => {
        vi.advanceTimersByTime(260 + 90); // 처음 + 260ms + 90ms
      });
      expect(press).toHaveBeenCalledTimes(3);
      fireEvent.pointerUp(left, { pointerId: 1 });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(press).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('게임 멈추기 버튼은 이번 실행을 멈춤 (폰 결과 쪽에는 실행 줄이 없음)', () => {
    const { stop } = listen();
    fireEvent.click(screen.getByTestId('game-keys-stop'));
    expect(stop).toHaveBeenCalledOnce();
  });

  it('실행이 끝나면 사라지고 더는 키를 보내지 않음', () => {
    const store = createLiveOutputStore();
    const press = vi.fn();
    const { rerender } = render(<GameKeys store={store} running />);
    act(() => store.listenKeys({ channel: 'jspi', press, stop: vi.fn() }));
    rerender(<GameKeys store={store} running={false} />);
    expect(screen.queryByTestId('game-keys')).toBeNull();
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    expect(press).not.toHaveBeenCalled();
  });

  it('키를 받을 길이 없는 브라우저는 안내만', () => {
    listen('none');
    expect(screen.getByTestId('game-keys-none')).toHaveTextContent(
      '키를 받을 수 없어요',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
