'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { DURATION } from '@/lib/motion/tokens';
import { IconButton } from '@/components/ui/button';

// 모양 (P4-12: 전역 game-ui.css에서 떼어 이 컴포넌트를 쓰는 화면에만 싣는다)
import './toast.css';
/**
 * 토스트 (P2-11, docs/design/components.md §5). 최종 시안의 담백한 쪽지: 흰 면(또는 의미색 틴트) + `shadow-pop` + 반경 14,
 * 화면 아래 가운데. 짧은 알림 한 줄 + (선택) 아이콘 · 닫기 버튼.
 *
 * - `ToastRegion`이 늘 떠 있는 `role="status"` `aria-live="polite"` 영역이다 → 토스트가 들어오면 낭독기가 읽는다.
 *   알림을 띄울 화면에 먼저 영역을 두고 그 안에 `Toast`를 넣는다
 * - 자동 닫힘: `duration`(ms) 뒤 `onClose`. 끝나기 직전 짧게 흐려진다(`DURATION.fast`). 닫기 버튼은 바로 닫는다
 * - 연출(`game-ui.css` `.g-toast`): full = body 스프링으로 살짝 기울어 올라옴 · lite = 짧게 · minimal = 페이드 · 동작 줄이기 = 즉시
 * - 여러 개를 쌓아 띄울 때는 `useToastQueue()` + `ToastViewport`
 * - `action`: 글 뒤에 작은 버튼 하나 (P4-11 홈 화면에 추가 쪽지). 저절로 닫히지 않게 `duration={0}`과 함께 쓴다
 */
export type ToastTone = 'info' | 'good' | 'warn' | 'error';

export const TOAST_DEFAULT_MS = 4_000;

function ToastRegion({
  className,
  label = '알림',
  ...props
}: ComponentProps<'div'> & { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('g-toast-region', className)}
      {...props}
    />
  );
}

interface ToastProps extends Omit<ComponentProps<'div'>, 'children'> {
  tone?: ToastTone;
  /** 앞 아이콘 (lucide 등, 장식) */
  icon?: ReactNode;
  children: ReactNode;
  /** 자동 닫힘까지 ms. 0이면 저절로 닫히지 않음 */
  duration?: number;
  /** 닫힘 (자동·닫기 버튼). 없으면 닫기 버튼도 없다 */
  onClose?: () => void;
  closeLabel?: string;
  /** 글 뒤 버튼 하나 (예: "추가하기", P4-11). 작은 버튼(`size="sm"`)을 넣는다 */
  action?: ReactNode;
}

function Toast({
  tone = 'info',
  icon,
  children,
  duration = TOAST_DEFAULT_MS,
  onClose,
  closeLabel = '닫기',
  action,
  className,
  ...props
}: ToastProps) {
  const [leaving, setLeaving] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!duration) return;
    const fade = setTimeout(
      () => setLeaving(true),
      Math.max(0, duration - DURATION.fast),
    );
    const done = setTimeout(() => onCloseRef.current?.(), duration);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [duration]);

  return (
    <div
      data-slot="toast"
      data-tone={tone}
      data-leaving={leaving || undefined}
      className={cn('g-toast', className)}
      {...props}
    >
      {icon && (
        <span className="g-toast-icon" aria-hidden>
          {icon}
        </span>
      )}
      <p className="min-w-0 flex-1 py-1.5 text-small font-medium">{children}</p>
      {action && <span className="flex flex-none items-center">{action}</span>}
      {onClose && (
        <IconButton label={closeLabel} size="sm" onClick={() => onClose()}>
          <X aria-hidden strokeWidth={2.4} />
        </IconButton>
      )}
    </div>
  );
}

export interface QueuedToast {
  id: number;
  text: ReactNode;
  tone?: ToastTone;
  icon?: ReactNode;
  duration?: number;
}

/** 쌓이는 토스트 목록 (화면 한 곳의 상태). `show()`는 id를 돌려준다 */
function useToastQueue(max = 3) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const next = useRef(1);
  const dismiss = useCallback(
    (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback(
    (text: ReactNode, opts: Omit<QueuedToast, 'id' | 'text'> = {}) => {
      const id = next.current++;
      setToasts((ts) => [...ts, { id, text, ...opts }].slice(-max));
      return id;
    },
    [max],
  );
  return { toasts, show, dismiss };
}

/** `useToastQueue()`의 목록을 그리는 영역 */
function ToastViewport({
  toasts,
  onDismiss,
  className,
}: {
  toasts: QueuedToast[];
  onDismiss: (id: number) => void;
  className?: string;
}) {
  return (
    <ToastRegion className={className}>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          tone={t.tone}
          icon={t.icon}
          duration={t.duration}
          onClose={() => onDismiss(t.id)}
        >
          {t.text}
        </Toast>
      ))}
    </ToastRegion>
  );
}

export { Toast, ToastRegion, ToastViewport, useToastQueue };
