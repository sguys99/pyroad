'use client';

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Gamepad2,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import { keepsKey, tkKeyName } from '@/lib/pyodide/keyNames';
import type { InputChannel } from '@/lib/pyodide/types';
import './gameKeys.css';

const subscribeNothing = () => () => {};

/** 손가락을 대고 있으면 처음 한 번 + 잠시 뒤부터 이 간격으로 계속 (키보드 자동 반복과 비슷하게) */
const REPEAT_DELAY_MS = 260;
const REPEAT_MS = 90;

const PAD = [
  { key: 'Up', label: '위', Icon: ArrowUp },
  { key: 'Left', label: '왼쪽', Icon: ArrowLeft },
  { key: 'Down', label: '아래', Icon: ArrowDown },
  { key: 'Right', label: '오른쪽', Icon: ArrowRight },
] as const;

export interface GameKeysProps {
  store?: LiveOutputStore;
  running: boolean;
  /** 화면 방향 패드: auto = 터치 화면에서만(CSS `any-pointer: coarse`), always = 늘 (카탈로그) */
  pad?: 'auto' | 'always';
  /** 실행 없이 보여 주기 (카탈로그 견본). 키는 onKey로 */
  preview?: { channel: InputChannel; onKey?: (key: string) => void };
}

/** 이번 실행이 키를 듣는 길 (get_key()를 부르면 켜짐) */
function useListening(store?: LiveOutputStore): InputChannel | null {
  return useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    () => store?.getSnapshot().keys ?? null,
    () => null,
  );
}

/**
 * 게임 조종판 (P11-04, world3 제안 K): 실행이 `get_key()`를 부르면 그림판 아래에 나온다.
 * - 키보드: 조종판이 나오면 포커스를 가져오고(에디터에서 Ctrl+Enter로 돌려도 화살표가 커서를 옮기지 않게),
 *   그 뒤엔 글자 칸·에디터 밖 어디에 포커스가 있든 화살표·스페이스·글자 키를 게임으로 보낸다(화면 스크롤은 막음)
 * - 터치(폰·태블릿): ← ↑ → ↓ 방향 패드(64px). 누르고 있으면 계속 보냄
 * - 게임 멈추기: 폰 결과 쪽에는 실행 줄(멈추기)이 없어서 조종판에도 둔다
 * 데스크톱·모바일 결과 자리가 둘 다 붙어 있어 보이는 쪽만 키를 받는다
 */
export function GameKeys({
  store,
  running,
  pad = 'auto',
  preview,
}: GameKeysProps) {
  const listening = useListening(store);
  const channel = preview?.channel ?? (running ? listening : null);
  const ref = useRef<HTMLElement>(null);
  const hintId = useId();
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = (key: string) => {
    if (preview) preview.onKey?.(key);
    else store?.pressKey(key);
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  const stopRepeat = () => {
    if (repeat.current) clearTimeout(repeat.current);
    repeat.current = null;
  };

  const active = channel !== null && channel !== 'none';
  useEffect(() => {
    const el = ref.current;
    if (!active || !el || preview) return;
    const visible = () => el.getClientRects().length > 0;
    if (visible()) {
      el.focus({ preventScroll: true });
      // 넓은 화면은 결과가 에디터 아래라 게임판이 화면 밖일 수 있음 → 조종판 아랫변까지 보이게 (그림판은 바로 위)
      el.scrollIntoView?.({ block: 'end' });
    }
    // 폰은 실행하면 결과 쪽으로 넘어가는 중(P6-11)이라 첫 스크롤이 어긋남 → 넘김이 끝난 뒤 한 번 더
    const again = window.setTimeout(() => {
      if (visible()) el.scrollIntoView?.({ block: 'end' });
    }, 450);
    const onKey = (e: KeyboardEvent) => {
      const name = tkKeyName(e);
      if (!name || !visible() || keepsKey(e.target, name)) return;
      e.preventDefault();
      sendRef.current(name);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(again);
      document.removeEventListener('keydown', onKey);
    };
  }, [active, preview]);

  useEffect(() => stopRepeat, []);
  useEffect(() => {
    if (!active) stopRepeat();
  }, [active]);

  if (channel === null) return null;

  if (channel === 'none') {
    return (
      <section className="gk" aria-label="게임 조종판" data-testid="game-keys">
        <p className="gk-hint" data-testid="game-keys-none">
          <Gamepad2 aria-hidden />이 브라우저에서는 키를 받을 수 없어요.
          새로고침하거나 Safari·Chrome으로 열어 주세요.
        </p>
      </section>
    );
  }

  const hold = (key: string) => {
    stopRepeat();
    send(key);
    const again = (wait: number) => {
      repeat.current = setTimeout(() => {
        send(key);
        again(REPEAT_MS);
      }, wait);
    };
    again(REPEAT_DELAY_MS);
  };

  return (
    <section
      ref={ref}
      className="gk"
      aria-label="게임 조종판"
      aria-describedby={hintId}
      tabIndex={-1}
      data-pad={pad}
      data-testid="game-keys"
    >
      <p className="gk-hint" id={hintId}>
        <Gamepad2 aria-hidden />
        <span className="gk-hint-keys">
          키보드 <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd>·스페이스로
          움직여요
        </span>
        <span className="gk-hint-touch">아래 버튼을 눌러 움직여요</span>
      </p>
      <div className="gk-pad" role="group" aria-label="방향 버튼">
        {PAD.map(({ key, label, Icon }) => (
          <Button
            key={key}
            variant="secondary"
            size="lg"
            className={`gk-btn gk-${key.toLowerCase()}`}
            icon={<Icon aria-hidden />}
            aria-label={label}
            data-testid={`game-key-${key}`}
            onPointerDown={(e) => {
              // 포커스·글자 선택·길게 누르기 메뉴 없이 바로 보냄
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              hold(key);
            }}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onLostPointerCapture={stopRepeat}
            onContextMenu={(e) => e.preventDefault()}
            // 키보드로 버튼을 누른 경우(detail 0)만. 포인터는 위에서 이미 보냄
            onClick={(e) => {
              if (e.detail === 0) send(key);
            }}
          />
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        sfx={false}
        icon={<Square aria-hidden />}
        className="gk-stop"
        onClick={() => !preview && store?.stopRun()}
        data-testid="game-keys-stop"
      >
        게임 멈추기
      </Button>
    </section>
  );
}

export default GameKeys;
