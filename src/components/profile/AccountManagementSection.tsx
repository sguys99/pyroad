'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBrowserClient } from '@/lib/supabase/loadClient';
import { useSocialLogin } from '@/lib/hooks/useSocialLogin';
import { toSocialProvider } from '@/lib/auth/loginProvider';
import {
  NAVER_WITHDRAW_NEXT,
  rememberWithdrawStart,
  takeNaverWithdrawResult,
  takeWithdrawStart,
  type NaverWithdrawOutcome,
} from '@/lib/auth/withdrawIntent';
import { SocialLoginButton } from '@/components/auth/SocialLoginButton';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import './profile.css';
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

/** 탈퇴 확인 창에 붙는 네이버 연결 안내 (P3-16) */
const NAVER_REMAINS =
  '네이버 연결은 남아 있을 수 있어요. 탈퇴한 뒤 네이버 → 내정보 → 이력관리 → 연결된 서비스 관리에서 pyRoad를 직접 끊을 수 있어요.';
const KAKAO_FAILED =
  '탈퇴했어요. 다만 카카오 연결 끊기는 실패했어요. 카카오톡 → 설정 → 카카오계정 → 연결된 서비스 관리에서 pyRoad를 직접 끊을 수 있어요.';
const WITHDRAW_MISMATCH =
  '탈퇴를 시작한 계정과 다른 계정으로 들어왔어요. 지금 계정이 맞는지 확인하고, 탈퇴하려면 처음부터 다시 해 주세요.';

function naverNote(outcome: NaverWithdrawOutcome | null): string {
  if (outcome === 'ok') return '네이버 연결을 끊었어요. ';
  if (outcome === null) return '';
  return `${NAVER_REMAINS} `;
}

interface AccountManagementSectionProps {
  /** (월드 order, 스테이지 order) 순서로 정렬된 스테이지 (reset_progress 의 "그 뒤 스테이지"와 같은 순서, P1-08) */
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
  // 탈퇴 때 provider 연결 끊기 (P3-16): 네이버는 토큰을 저장하지 않으므로 탈퇴 직전에 네이버로 한 번 더 로그인해 끊는다
  const [me, setMe] = useState<{ id: string; hasNaver: boolean } | null>(null);
  const [naverStep, setNaverStep] = useState(false);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);
  const [naverStarting, setNaverStarting] = useState(false);
  const naverLogin = useSocialLogin('naver', { next: NAVER_WITHDRAW_NEXT });

  const handleDelete = async () => {
    setLoading('delete');
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '탈퇴 처리 중 오류가 발생했습니다.');
      }
      // 카카오 연결 끊기가 실패해도 탈퇴는 끝났다. 직접 끊는 방법을 알려 준다
      if (data.unlinked?.kakao === 'failed') alert(KAKAO_FAILED);
      const supabase = await loadBrowserClient();
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

  /** 마지막 탈퇴 확인 창 (네이버 결과 안내를 앞에 붙임) */
  const openDeleteConfirm = (outcome: NaverWithdrawOutcome | null) =>
    setConfirmAction({
      action: handleDelete,
      title: '정말로 탈퇴하시겠습니까?',
      description: `${naverNote(outcome)}계정이 영구적으로 삭제됩니다. 정말 진행하시겠습니까?`,
      actionLabel: '탈퇴하기',
    });

  // 내 계정의 연결 수단 + 네이버 재인증에서 돌아왔는지 (`/profile?withdraw=naver&naver=<결과>`)
  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = await loadBrowserClient();
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!alive || !u) return;
      setMe({
        id: u.id,
        hasNaver: (u.identities ?? []).some(
          (i) => toSocialProvider(i.provider) === 'naver',
        ),
      });
      const result = takeNaverWithdrawResult(window.location.href);
      if (!result) return;
      try {
        window.history.replaceState(window.history.state, '', result.cleaned);
      } catch {
        // 주소를 못 지워도 이어 간다
      }
      // 이 탭에서 시작한 같은 사용자일 때만 탈퇴 확인을 이어서 연다 (다른 계정으로 들어왔으면 멈춤)
      if (result.outcome === 'mismatch' || takeWithdrawStart() !== u.id) {
        setWithdrawNotice(WITHDRAW_MISMATCH);
        return;
      }
      openDeleteConfirm(result.outcome);
    })();
    return () => {
      alive = false;
    };
    // 처음 한 번만 (openDeleteConfirm은 handleDelete를 감싼 고정 동작)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startNaverConfirm = async () => {
    if (!me || naverStarting) return;
    setNaverStarting(true);
    rememberWithdrawStart(me.id);
    const result = await naverLogin.handleLogin();
    if (result !== 'redirecting') {
      setNaverStarting(false);
      setNaverStep(false);
      alert(
        '네이버 확인을 시작하지 못했어요. "건너뛰고 탈퇴"로 계속할 수도 있어요.',
      );
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

  // 특정 스테이지 리셋 시 함께 리셋되는 후속 스테이지 목록 (진행 기록이 있는 것만).
  // stages 는 (월드, 스테이지) 순서라 목록에서 뒤에 있는 스테이지가 후속 스테이지 (order 는 월드마다 1부터)
  const getAffectedStages = (stage: Stage) =>
    stages.slice(stages.indexOf(stage) + 1).filter((s) => s.hasProgress);

  const getResetDescription = (stage: Stage) => {
    const affected = getAffectedStages(stage);
    const baseMsg = `"${stage.title}" 스테이지의 퀘스트 진행이 초기화되고, 해당 경험치가 차감됩니다.`;
    if (affected.length === 0) return baseMsg;
    const affectedNames = affected
      .map((s) => `${s.order}. ${s.title}`)
      .join(', ');
    return `${baseMsg}\n\n⚠️ 후속 스테이지(${affectedNames})의 진행도 함께 리셋됩니다.`;
  };

  // 지울 범위: '' = 전체, 그 밖은 스테이지 id
  const [scope, setScope] = useState('');
  const picked = stages.find((s) => s.id === scope) ?? null;

  return (
    <details className="pf-acct" data-testid="account-management">
      <summary className="pf-acct-sum focus-ring">
        계정 관리
        <ChevronRight aria-hidden className="pf-acct-chev" />
      </summary>
      <div className="pf-acct-body" data-surface="raised">
        {/* 진행 기록 지우기: 범위를 고르고 한 버튼 (확인 2단계는 그대로) */}
        <label htmlFor="reset-scope" className="pf-acct-k">
          진행 기록 지우기
        </label>
        <div className="pf-acct-row">
          <select
            id="reset-scope"
            className="pf-acct-select focus-ring"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            disabled={isLoading}
            data-testid="reset-scope"
          >
            <option value="">전체</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.order}. {s.title}
              </option>
            ))}
          </select>
          <AlertDialog>
            <AlertDialogTrigger
              disabled={isLoading}
              render={
                <Button variant="secondary" size="sm" disabled={isLoading} />
              }
            >
              {loading?.startsWith('reset') ? '리셋 중...' : '리셋'}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {picked ? `스테이지 ${picked.order} 리셋` : '전체 리셋'}
                </AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-line">
                  {picked
                    ? getResetDescription(picked)
                    : '모든 퀘스트 진행, 경험치, 레벨이 초기화됩니다. 이 작업은 되돌릴 수 없습니다. 받은 업적과 코인은 그대로 남아요.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
                <AlertDialogAction
                  variant="danger"
                  onClick={() =>
                    setConfirmAction({
                      action: picked
                        ? () => handleResetStage(picked.id)
                        : handleResetAll,
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
        </div>
        <p className="pf-acct-note">받은 업적과 코인은 그대로 남아요.</p>

        {/* 회원 탈퇴: 위험 톤 글자 버튼 */}
        <AlertDialog>
          <AlertDialogTrigger
            disabled={isLoading}
            className="pf-acct-danger focus-ring"
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
                variant="danger"
                onClick={() =>
                  // 네이버로 들어온 계정이면 먼저 네이버 연결 끊기 단계 (P3-16)
                  me?.hasNaver ? setNaverStep(true) : openDeleteConfirm(null)
                }
                disabled={isLoading}
              >
                탈퇴하기
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {withdrawNotice && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-warning-soft px-3 py-2.5 text-small text-foreground"
          data-testid="withdraw-notice"
        >
          {withdrawNotice}
        </p>
      )}

      {/* 네이버 연결 끊기 단계 (P3-16): 네이버로 한 번 더 로그인 → 콜백이 연동 해제 → 돌아와 탈퇴 확인 */}
      <AlertDialog
        open={naverStep}
        onOpenChange={(open) => {
          if (!open) setNaverStep(false);
        }}
      >
        <AlertDialogContent data-testid="withdraw-naver-step">
          <AlertDialogHeader>
            <AlertDialogTitle>네이버 연결도 끊을까요?</AlertDialogTitle>
            <AlertDialogDescription>
              네이버로 들어온 계정은 탈퇴할 때 네이버에도 연결 끊기를 알려야
              해요. 네이버로 한 번 더 로그인하면 바로 끊고 탈퇴를 이어 갈게요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <SocialLoginButton
            provider="naver"
            loading={naverStarting}
            onClick={() => void startNaverConfirm()}
            data-testid="withdraw-naver-confirm"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="secondary"
              onClick={() => {
                setNaverStep(false);
                openDeleteConfirm('skipped');
              }}
              disabled={isLoading}
              data-testid="withdraw-naver-skip"
            >
              건너뛰고 탈퇴
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              variant="danger"
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
    </details>
  );
}
