'use client';

import type { ReactElement, ReactNode } from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/button';

/**
 * 바텀시트 · 모달 (P2-11, docs/design/components.md §4). 최종 시안 `Sheet`: 모바일은 아래에서 올라오는 시트(손잡이 표시),
 * 넓은 화면(768px 이상)은 가운데 대화 상자. `Modal`은 화면 크기와 상관없이 가운데 대화 상자.
 *
 * - Base UI Dialog: 포커스 가두기 · Esc · 덮개 누르면 닫기 · 바깥 스크롤 잠금 · 닫으면 연 버튼으로 포커스 복귀 · `role="dialog"` + `aria-modal`
 * - 덮개 `bg-scrim`, 흰 면 + `shadow-pop`, 반경 20(시트는 위 모서리만). 안의 흰 버튼은 보조 면 색(`data-surface="raised"`)
 * - 연출(`game-ui.css` `.g-sheet`·`.g-modal`): full = 시트는 아래에서 미끄러져 올라옴(360ms out) / 대화 상자는 살짝 기울어 떠오름
 *   (body 스프링) · lite = 220ms · minimal = 페이드 · 동작 줄이기 = 즉시. 끌어서 닫기는 없다(닫기 버튼·Esc·덮개)
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
  'data-testid': testId,
}: DialogShellProps & { kind: 'sheet' | 'modal'; wide?: boolean }) {
  return (
    <DialogPrimitive.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={(next) => onOpenChange?.(next)}
    >
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
            <DialogPrimitive.Title
              className={cn(
                'font-display text-h2 text-foreground',
                hideTitle && 'sr-only',
              )}
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
