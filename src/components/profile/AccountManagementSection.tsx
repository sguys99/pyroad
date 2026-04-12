'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Stage {
  id: string;
  order: number;
  title: string;
  hasProgress: boolean;
}

interface AccountManagementSectionProps {
  stages: Stage[];
}

export function AccountManagementSection({
  stages,
}: AccountManagementSectionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    action: () => Promise<void>;
    title: string;
    description: string;
    actionLabel: string;
  } | null>(null);

  const handleDelete = async () => {
    setLoading('delete');
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '탈퇴 처리 중 오류가 발생했습니다.');
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  const handleResetAll = async () => {
    setLoading('reset-all');
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '리셋 중 오류가 발생했습니다.');
      }
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '리셋 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  const handleResetStage = async (stageId: string) => {
    setLoading(`reset-stage-${stageId}`);
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '리셋 중 오류가 발생했습니다.');
      }
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '리셋 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      alert(message);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

  // 특정 스테이지 리셋 시 함께 리셋되는 후속 스테이지 목록 (진행 기록이 있는 것만)
  const getAffectedStages = (stageOrder: number) =>
    stages.filter((s) => s.order > stageOrder && s.hasProgress);

  const getResetDescription = (stage: Stage) => {
    const affected = getAffectedStages(stage.order);
    const baseMsg = `"${stage.title}" 스테이지의 퀘스트 진행이 초기화되고, 해당 경험치가 차감됩니다.`;
    if (affected.length === 0) return baseMsg;
    const affectedNames = affected
      .map((s) => `${s.order}. ${s.title}`)
      .join(', ');
    return `${baseMsg}\n\n⚠️ 후속 스테이지(${affectedNames})의 진행도 함께 리셋됩니다.`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-foreground">계정 관리</h2>

      {/* 진행 현황 리셋 */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
          진행 현황 리셋
        </h3>

        <AlertDialog>
          <AlertDialogTrigger
            disabled={isLoading}
            className="mb-3 w-full"
            render={
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isLoading}
              />
            }
          >
            {loading === 'reset-all' ? '리셋 중...' : '전체 리셋'}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>전체 리셋</AlertDialogTitle>
              <AlertDialogDescription>
                모든 퀘스트 진행, 뱃지, 경험치, 레벨이 초기화됩니다. 이 작업은
                되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  setConfirmAction({
                    action: handleResetAll,
                    title: '정말로 리셋하시겠습니까?',
                    description:
                      '이 작업은 되돌릴 수 없습니다. 정말 진행하시겠습니까?',
                    actionLabel: '리셋하기',
                  })
                }
                disabled={isLoading}
              >
                리셋하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid grid-cols-2 gap-2">
          {stages.map((stage) => (
            <AlertDialog key={stage.id}>
              <AlertDialogTrigger
                disabled={isLoading}
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={isLoading}
                  />
                }
              >
                {loading === `reset-stage-${stage.id}`
                  ? '리셋 중...'
                  : `${stage.order}. ${stage.title}`}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    스테이지 {stage.order} 리셋
                  </AlertDialogTitle>
                  <AlertDialogDescription className="whitespace-pre-line">
                    {getResetDescription(stage)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isLoading}>
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      setConfirmAction({
                        action: () => handleResetStage(stage.id),
                        title: '정말로 리셋하시겠습니까?',
                        description:
                          '이 작업은 되돌릴 수 없습니다. 정말 진행하시겠습니까?',
                        actionLabel: '리셋하기',
                      })
                    }
                    disabled={isLoading}
                  >
                    리셋하기
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="my-4 border-t border-border" />

      {/* 회원 탈퇴 */}
      <div>
        <h3 className="mb-2 text-xs font-semibold text-destructive">
          회원 탈퇴
        </h3>
        <AlertDialog>
          <AlertDialogTrigger
            disabled={isLoading}
            render={
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={isLoading}
              />
            }
          >
            {loading === 'delete' ? '탈퇴 처리 중...' : '탈퇴하기'}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
              <AlertDialogDescription>
                계정과 모든 학습 데이터(퀘스트 진행, 뱃지, 경험치)가 영구적으로
                삭제됩니다. 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  setConfirmAction({
                    action: handleDelete,
                    title: '정말로 탈퇴하시겠습니까?',
                    description:
                      '계정이 영구적으로 삭제됩니다. 정말 진행하시겠습니까?',
                    actionLabel: '탈퇴하기',
                  })
                }
                disabled={isLoading}
              >
                탈퇴하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 2차 확인 다이얼로그 */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                await confirmAction?.action();
                setConfirmAction(null);
              }}
              disabled={isLoading}
            >
              {confirmAction?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
