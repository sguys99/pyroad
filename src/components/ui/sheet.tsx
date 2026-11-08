'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/button';
import { useBackToClose } from '@/components/ui/use-back-to-close';

// 모양 (P4-12: 전역 game-ui.css에서 떼어 이 컴포넌트를 쓰는 화면에만 싣는다)
import './overlay.css';
/**
 * 바텀시트 · 모달 (P2-11, docs/design/components.md §4). 최종 시안 `Sheet`: 모바일은 아래에서 올라오는 시트(손잡이 표시),
 * 넓은 화면(768px 이상)은 가운데 대화 상자. `Modal`은 화면 크기와 상관없이 가운데 대화 상자.
 *
 * - Base UI Dialog: 포커스 가두기 · Esc · 덮개 누르면 닫기 · 바깥 스크롤 잠금 · 닫으면 연 버튼으로 포커스 복귀 · `role="dialog"` + `aria-modal`
 * - 덮개 `bg-scrim`, 흰 면 + `shadow-pop`, 반경 20(시트는 위 모서리만). 안의 흰 버튼은 보조 면 색(`data-surface="raised"`)
 * - 연출(`game-ui.css` `.g-sheet`·`.g-modal`): full = 시트는 아래에서 body 스프링으로 올라옴(P4-09, 넘침은 아래 치마 면이 가림) /
 *   대화 상자는 살짝 기울어 커지며 떠오름(body 스프링) · lite = 220ms · minimal = 페이드 · 동작 줄이기 = 즉시.
 *   끌어서 닫기는 없다(닫기 버튼·Esc·덮개, `closeOnBack`이면 기기 뒤로 가기도)
 * - `title`은 항상 있어야 한다(대화 상자 이름). 보이지 않게 하려면 `hideTitle`
 */
interface DialogShellProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 이 요소를 누르면 열림 (버튼 하나) */
  trigger?: ReactElement;
  title: ReactNode;
  hideTitle?: boolean;
  /** 제목 위 그림 (캐릭터 등) */
  media?: ReactNode;
  /** 머리글 정렬 (그림과 함께 가운데로) */
  align?: 'start' | 'center';
  description?: ReactNode;
  children?: ReactNode;
  /** 아래 버튼 줄 */
  footer?: ReactNode;
  /** 닫기 버튼 이름 (없애려면 `showClose={false}`) */
  closeLabel?: string;
  showClose?: boolean;
  className?: string;
  /** 처음 포커스를 줄 요소 (기본: 첫 번째 포커스 가능한 요소) */
  initialFocus?: DialogPrimitive.Popup.Props['initialFocus'];
  /**
   * 기기·브라우저 뒤로 가기로 닫기 (P4-09, `useBackToClose`). 열릴 때 같은 주소로 기록 항목을 하나 쌓고, 뒤로 가기면 닫는다.
   * 화면을 떠나지 않아야 하는 겹창(랜딩 로그인 시트)에 켠다
   */
  closeOnBack?: boolean;
  'data-testid'?: string;
}

function DialogShell({
  kind,
  wide,
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  hideTitle,
  media,
  align = 'start',
  description,
  children,
  footer,
  closeLabel = '닫기',
  showClose = true,
  className,
  initialFocus,
  closeOnBack = false,
  'data-testid': testId,
}: DialogShellProps & { kind: 'sheet' | 'modal'; wide?: boolean }) {
  // 열림 상태는 늘 여기서 안다(뒤로 가기 닫기가 지금 열렸는지 알아야 함). `open`을 주면 그 값, 아니면 내부 상태
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  useBackToClose(isOpen, () => setOpen(false), closeOnBack);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(next) => setOpen(next)}>
      {trigger && <DialogPrimitive.Trigger render={trigger} />}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="g-scrim" />
        <DialogPrimitive.Popup
          data-slot={kind}
          data-surface="raised"
          data-wide={wide || undefined}
          data-testid={testId}
          initialFocus={initialFocus}
          className={cn(
            kind === 'sheet' ? 'g-sheet' : 'g-modal p-6',
            'flex flex-col gap-4',
            className,
          )}
        >
          {kind === 'sheet' && <span className="g-sheet-grip" aria-hidden />}
          {showClose && (
            <DialogPrimitive.Close
              render={
                <IconButton
                  label={closeLabel}
                  className="absolute top-2.5 right-2.5 z-10"
                />
              }
            >
              <X aria-hidden strokeWidth={2.6} />
            </DialogPrimitive.Close>
          )}
          {media && <div className="flex justify-center">{media}</div>}
          <div
            className={cn(
              'grid gap-1.5',
              align === 'center' ? 'px-12 text-center' : showClose && 'pr-12',
            )}
          >
            {/* 글자색은 상자(`--text`)에서 물려받는다: cn(tailwind-merge)이 `text-h2`와 `text-foreground`를 같은 무리로 보고
                크기를 지워 버린다(제목이 17px로 나오던 문제, P4-09) */}
            <DialogPrimitive.Title
              className={cn('font-display text-h2', hideTitle && 'sr-only')}
            >
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-small text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {children}
          {footer && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 모바일 바텀시트 · 넓은 화면 가운데 대화 상자 */
function Sheet({ wide, ...props }: DialogShellProps & { wide?: boolean }) {
  return <DialogShell kind="sheet" wide={wide} {...props} />;
}

/** 늘 가운데 대화 상자 */
function Modal(props: DialogShellProps) {
  return <DialogShell kind="modal" {...props} />;
}

/** 시트·모달 안에서 누르면 닫히는 버튼: `<SheetClose render={<Button variant="secondary" />}>그만두기</SheetClose>` */
const SheetClose = DialogPrimitive.Close;

export { Modal, Sheet, SheetClose };
