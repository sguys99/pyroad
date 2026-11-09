'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * "처음 코드로" 확인 창 (P6-03). 대화 상자 모듈(약 11KB gzip)이 퀘스트 첫 로드에 끼지 않게
 * `ResetCodeButton`이 처음 누를 때 `next/dynamic`으로 받는다
 */
export default function ResetCodeDialog({
  open,
  onOpenChange,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReset: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>처음 코드로 돌아갈까요?</AlertDialogTitle>
          <AlertDialogDescription>
            지금까지 고친 코드는 사라져요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>그대로 두기</AlertDialogCancel>
          <AlertDialogAction onClick={onReset} data-testid="reset-code-confirm">
            처음 코드로
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
