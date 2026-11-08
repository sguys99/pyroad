// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { OVERLAY_HISTORY_KEY, useBackToClose } from '../use-back-to-close';
import { Sheet } from '../sheet';
import { Button } from '../button';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 뒤로 가기로 겹창 닫기 (P4-09): 열면 같은 주소로 기록 항목 하나, 뒤로 가기면 닫힘, 다른 방법으로 닫으면 항목을 거둠

const overlayKey = () =>
  (window.history.state as Record<string, unknown> | null)?.[
    OVERLAY_HISTORY_KEY
  ] ?? null;

/** 쌓기는 다음 틱 (StrictMode 이중 마운트 대비) */
const flushPush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

/** jsdom의 history.back()은 popstate를 비동기로 보낸다 */
const back = async () => {
  await act(async () => {
    window.history.back();
    await new Promise((r) => setTimeout(r, 20));
  });
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('useBackToClose', () => {
  it('열리면 같은 주소로 항목을 쌓고(지금 state는 복사), 뒤로 가기면 close', async () => {
    window.history.replaceState({ __NA: true, tree: 't' }, '', '/?x=1');
    const close = vi.fn();
    renderHook(() => useBackToClose(true, close));
    await flushPush();
    expect(overlayKey()).toEqual(expect.any(String));
    expect(window.history.state).toMatchObject({ __NA: true, tree: 't' });
    expect(window.location.search).toBe('?x=1');

    await back();
    expect(close).toHaveBeenCalledTimes(1);
    expect(overlayKey()).toBeNull();
    expect(window.location.search).toBe('?x=1');
  });

  it('다른 방법으로 닫히면(open=false) 쌓은 항목을 거두고 close는 부르지 않는다', async () => {
    const close = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackToClose(open, close), {
      initialProps: { open: true },
    });
    await flushPush();
    const len = window.history.length;
    expect(overlayKey()).not.toBeNull();
    rerender({ open: false });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(overlayKey()).toBeNull();
    expect(close).not.toHaveBeenCalled();
    // 거둔 뒤에도 기록 길이는 그대로(앞으로 가기 항목으로 남음) — 새로 쌓지 않았는지만 본다
    expect(window.history.length).toBe(len);
  });

  it('곧바로 닫히면(같은 틱 안의 마운트·정리) 아무것도 쌓지 않는다', async () => {
    const before = window.history.length;
    const { unmount } = renderHook(() => useBackToClose(true, vi.fn()));
    unmount();
    await flushPush();
    expect(window.history.length).toBe(before);
    expect(overlayKey()).toBeNull();
  });

  it('enabled=false · 닫혀 있으면 쌓지 않는다', async () => {
    const before = window.history.length;
    renderHook(() => useBackToClose(true, vi.fn(), false));
    renderHook(() => useBackToClose(false, vi.fn()));
    await flushPush();
    expect(window.history.length).toBe(before);
  });
});

describe('Sheet closeOnBack', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>열기</Button>
        <Sheet open={open} onOpenChange={setOpen} title="시트" closeOnBack>
          <p>내용</p>
        </Sheet>
      </>
    );
  }

  it('뒤로 가기로 닫힌다 (제어 모드)', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(
      await screen.findByRole('dialog', { name: '시트' }),
    ).toBeInTheDocument();
    await flushPush();
    await back();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('트리거만 쓰는 비제어 모드도 뒤로 가기로 닫힌다', async () => {
    render(
      <Sheet
        title="비제어"
        closeOnBack
        trigger={<Button variant="secondary">열기</Button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    expect(
      await screen.findByRole('dialog', { name: '비제어' }),
    ).toBeInTheDocument();
    await flushPush();
    await back();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('제목은 text-h2 크기를 잃지 않는다 (cn 병합으로 지워지던 문제)', async () => {
    render(
      <Sheet open title="크기" onOpenChange={() => {}}>
        <p />
      </Sheet>,
    );
    const dialog = await screen.findByRole('dialog', { name: '크기' });
    expect(dialog.querySelector('h2')).toHaveClass('text-h2');
  });
});
