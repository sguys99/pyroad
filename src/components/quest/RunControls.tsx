'use client';

import { useEffect, useState } from 'react';
import { Loader2, Play, RefreshCw, Square } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { sec } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type {
  PyodideRestartReason,
  PyodideStatus,
} from '@/lib/pyodide/usePyodide';
import type { PyodideLoadStage } from '@/lib/pyodide/types';
import './runControls.css';

/**
 * 실행 줄의 상태 (P6-05). 버튼 글자·아래 안내 상자·`data-runner-state`(e2e)가 이 값 하나를 따른다
 * - preparing: 처음 불러오는 중(idle 포함) · restarting: 무한 루프를 멈춘 뒤 Worker를 다시 띄우는 중(§2.9, 2~5초)
 * - running: 실행 중(멈추기) · checking: 채점·완료 요청 중 · ready · error: 실행기를 못 불러옴(다시 불러오기)
 * - stepping: 프로젝트 단계 통과 박자(P6-12) 동안. 잠금은 그대로라 못 누르지만 "정답 확인 중"이 아니라 쉬는 버튼 (P6-16)
 */
export type RunnerState =
  | 'preparing'
  | 'restarting'
  | 'ready'
  | 'running'
  | 'checking'
  | 'stepping'
  | 'error';

export function runnerState({
  status,
  restarting,
  isRunning,
  isSubmitting,
  stepping = false,
}: {
  status: PyodideStatus;
  restarting: PyodideRestartReason;
  isRunning: boolean;
  isSubmitting: boolean;
  stepping?: boolean;
}): RunnerState {
  if (status === 'error') return 'error';
  if (isRunning) return 'running';
  if (status !== 'ready') return restarting ? 'restarting' : 'preparing';
  if (stepping) return 'stepping';
  return isSubmitting ? 'checking' : 'ready';
}

const LABEL: Record<Exclude<RunnerState, 'error'>, string> = {
  preparing: '준비 중...',
  restarting: '다시 준비 중...',
  ready: '코드 돌려보기',
  running: '실행 중...',
  checking: '정답 확인 중...',
  stepping: '코드 돌려보기',
};

const CODING_TIPS = [
  'print()로 화면에 글자를 보여줄 수 있어요!',
  '변수는 상자와 같아요. 값을 담아 둘 수 있답니다!',
  '들여쓰기(스페이스 4칸)는 파이썬에서 아주 중요해요!',
  'if문으로 조건에 따라 다른 일을 할 수 있어요!',
  'for문으로 같은 일을 여러 번 반복할 수 있어요!',
  '# 뒤에 쓰는 글은 메모예요. 컴퓨터는 읽지 않아요!',
  'input()으로 사용자에게 질문을 할 수 있어요!',
];

/** 첫 방문(Pyodide 약 6MB)이 이만큼 넘게 걸리면 "처음 한 번만 오래 걸려요" (Slow 4G 실측 34초, §2.10) */
const SLOW_NOTICE_MS = 8000;

/** 준비 단계 3칸: 지난 칸은 채움, 지금 칸은 흐르는 띠(진행률을 지어내지 않음), 남은 칸은 빈 홈 */
const STEPS = [
  { key: 'download', label: '불러오기' },
  { key: 'setup', label: '점검' },
  { key: 'ready', label: '준비 끝' },
] as const;

function StageSteps({ stage }: { stage: PyodideLoadStage | null }) {
  const current = stage === 'setup' ? 1 : 0;
  return (
    <ol className="qr-steps" aria-hidden>
      {STEPS.map((step, i) => (
        <li
          key={step.key}
          className="qr-step"
          data-step={
            i < current ? 'done' : i === current ? 'current' : undefined
          }
        >
          <span className="qr-step-bar">
            <span className="qr-step-fill" />
          </span>
          <span className="qr-step-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function CodingTipRotator() {
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setTipIndex((prev) => (prev + 1) % CODING_TIPS.length),
      3500,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="qr-tip">
      <span className="qr-tip-k">알고 있나요?</span>
      <span className="qr-tip-body">
        <AnimatePresence mode="wait" initial={false}>
          <m.span
            key={tipIndex}
            className="block"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: sec('base') }}
          >
            {CODING_TIPS[tipIndex]}
          </m.span>
        </AnimatePresence>
      </span>
    </p>
  );
}

/**
 * 처음 불러오는 동안 (§2.10 "Slow 4G 첫 방문은 진행률 표시"). Worker가 알려 주는 단계만 보여 주고
 * 백분율은 지어내지 않는다(loadPyodide는 바이트 진행을 주지 않음). 미니 연출 = 파이뱀 숨쉬기(대기 루프, full·lite)
 * + 지금 칸의 흐르는 띠(바쁨 표시, 동작 줄이기만 멈춤)
 */
export function RunnerLoading({
  stage,
  slow: forceSlow = false,
}: {
  stage: PyodideLoadStage | null;
  /** 카탈로그 견본용: 처음부터 "오래 걸려요" 안내 */
  slow?: boolean;
}) {
  const [slowByTime, setSlow] = useState(false);
  const slow = forceSlow || slowByTime;
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="qr-panel" data-testid="runner-loading">
      <span className="qr-avatar">
        <CharacterAvatar
          character="pybaem"
          expression="teaching"
          size={44}
          animated
        />
      </span>
      <div className="qr-panel-body">
        <p role="status" className="qr-panel-t">
          {stage === 'setup'
            ? '거의 다 됐어요! 마지막 점검 중'
            : '파이뱀이 파이썬을 불러오는 중'}
        </p>
        <StageSteps stage={stage} />
        {slow ? (
          <p className="qr-note">
            처음 한 번은 조금 오래 걸려요. 다음부터는 금방 열려요!
          </p>
        ) : (
          <CodingTipRotator />
        )}
      </div>
    </div>
  );
}

/**
 * 시간 초과·멈추기 뒤 Worker를 다시 띄우는 동안 (§2.9 재준비 연출, 2~5초).
 * 점 세 개·흐르는 띠는 CSS transform·opacity 반복이고 동작 줄이기면 멈춘 그림 (§2.10)
 */
export function RunnerWakingNotice({
  reason = null,
}: {
  reason?: PyodideRestartReason;
}) {
  return (
    <div className="qr-panel" data-testid="runner-waking">
      <span className="qr-avatar">
        <CharacterAvatar
          character="pybaem"
          expression="sleeping"
          size={44}
          animated
        />
      </span>
      <div className="qr-panel-body">
        <p role="status" className="qr-panel-t">
          파이뱀이 주문 공책을 다시 펼치는 중
          <span aria-hidden className="qr-dots">
            <span className="waking-dot" />
            <span className="waking-dot" />
            <span className="waking-dot" />
          </span>
        </p>
        <span className="qr-busy" aria-hidden>
          <span className="qr-step-fill" />
        </span>
        <p className="qr-note">
          {reason === 'timeout'
            ? '주문이 너무 오래 걸려서 멈췄어요. 몇 초면 다시 돌릴 수 있어요.'
            : '끝나지 않는 주문을 멈췄어요. 몇 초면 다시 돌릴 수 있어요.'}
        </p>
      </div>
    </div>
  );
}

interface RunControlsProps {
  status: PyodideStatus;
  restarting?: PyodideRestartReason;
  loadStage?: PyodideLoadStage | null;
  isRunning: boolean;
  /** 채점·완료 요청 중 (B06: 이 동안 다시 누를 수 없음) */
  isSubmitting?: boolean;
  /** 에디터가 비었으면 준비돼도 누를 수 없음 */
  isCodeEmpty?: boolean;
  /** 프로젝트 단계 통과 박자 중 (누를 수 없음, 바쁨 표시 없음) */
  stepping?: boolean;
  onRun: () => void;
  onStop?: () => void;
  onRetry: () => void;
}

/**
 * 공책 쪽 실행 줄 (P6-05, 최종 시안 `f-run-row`): 큰 초록 게임 버튼 "코드 돌려보기"(아랫면 3px·재생 아이콘) +
 * 실행 중 멈추기 + 상태별 안내 상자(처음 준비 단계·팁 / 재준비 / 실행기 오류).
 * 실행 중에는 버튼 면에 빛 띠가 흐른다(full·lite, minimal은 스피너만, 동작 줄이기는 글자만)
 */
export function RunControls({
  status,
  restarting = null,
  loadStage = null,
  isRunning,
  isSubmitting = false,
  isCodeEmpty = false,
  stepping = false,
  onRun,
  onStop,
  onRetry,
}: RunControlsProps) {
  const state = runnerState({
    status,
    restarting,
    isRunning,
    isSubmitting,
    stepping,
  });
  // 준비 중은 아직 못 누르는 납작한 회색 면 + 스피너, 실행·채점 중은 초록 면 그대로 바쁨 (게임 버튼 loading)
  const waiting = state === 'preparing' || state === 'restarting';
  const working = state === 'running' || state === 'checking';

  return (
    <div
      className="qr"
      data-runner-state={state}
      data-load-stage={loadStage ?? undefined}
    >
      <div className="qr-row">
        {state === 'error' ? (
          <Button
            onClick={onRetry}
            variant="secondary"
            size="lg"
            icon={<RefreshCw aria-hidden />}
            className="qr-run"
            data-testid="runner-retry"
          >
            실행기 다시 불러오기
          </Button>
        ) : (
          // 눌림 피드백은 게임 버튼 자체(아랫면 3px → jellyB 복귀, P2-11). 실행 소리는 세션이 낸다(run)
          <Button
            onClick={onRun}
            disabled={waiting || isCodeEmpty || state === 'stepping'}
            loading={working}
            size="lg"
            sfx={false}
            icon={
              waiting ? (
                <Loader2
                  aria-hidden
                  className="animate-spin reduced:animate-none"
                />
              ) : (
                <Play className="fill-current" aria-hidden />
              )
            }
            className={cn('qr-run', state === 'running' && 'qr-run-live')}
            data-testid="run-button"
          >
            {LABEL[state]}
          </Button>
        )}
        {state === 'running' && onStop && (
          <Button
            onClick={onStop}
            variant="secondary"
            size="lg"
            icon={<Square className="fill-current" aria-hidden />}
            className="qr-stop"
            data-testid="stop-button"
          >
            멈추기
          </Button>
        )}
      </div>

      {state === 'preparing' && <RunnerLoading stage={loadStage} />}
      {state === 'restarting' && <RunnerWakingNotice reason={restarting} />}
      {state === 'error' && (
        <p role="alert" className="qr-panel qr-panel-error">
          앗, 실행기를 불러오지 못했어요. 인터넷이 연결됐는지 보고 다시 불러와
          볼까요?
        </p>
      )}
    </div>
  );
}
