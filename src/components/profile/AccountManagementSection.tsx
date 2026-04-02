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
}

interface AccountManagementSectionProps {
  stages: Stage[];
}

export function AccountManagementSection({
  stages,
}: AccountManagementSectionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading('delete');
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/');
    } catch {
      alert('탈퇴 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert('리셋 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert('리셋 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading !== null;

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
                onClick={handleResetAll}
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
                  <AlertDialogDescription>
                    &quot;{stage.title}&quot; 스테이지의 퀘스트 진행이
                    초기화되고, 해당 경험치가 차감됩니다. 뱃지는 유지됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isLoading}>
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => handleResetStage(stage.id)}
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
                onClick={handleDelete}
                disabled={isLoading}
              >
                탈퇴하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
