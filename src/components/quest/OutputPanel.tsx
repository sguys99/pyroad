'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CheckCircle, Hand, Terminal } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type {
  PybaemExpression,
  BugBugExpression,
} from '@/components/characters/expressions';

function TutorAvatar({
  expression = 'happy',
}: {
  expression?: PybaemExpression;
}) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <CharacterAvatar character="pybaem" expression={expression} size="sm" />
    </div>
  );
}

function BugBugHelper({ expression }: { expression: BugBugExpression }) {
  return (
    <AnimatePresence>
      <m.div
        data-testid="bugbug-helper"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex h-6 w-6 shrink-0 items-center justify-center"
      >
        <CharacterAvatar character="bugbug" expression={expression} size="sm" />
      </m.div>
    </AnimatePresence>
  );
}

const NO_LIVE_OUTPUT = { text: '', clipped: false };
const subscribeNothing = () => () => {};
const getNoLiveOutput = () => NO_LIVE_OUTPUT;

/** 실행 중 출력. 이 컴포넌트만 출력 조각마다 다시 그린다 (셸은 그대로) */
function LiveOutput({ store }: { store?: LiveOutputStore }) {
  const { text, clipped } = useSyncExternalStore(
    store?.subscribe ?? subscribeNothing,
    store?.getSnapshot ?? getNoLiveOutput,
    getNoLiveOutput,
  );
  const preRef = useRef<HTMLPreElement>(null);

  // 새 출력이 오면 맨 아래로 (긴 반복문 출력도 마지막 줄이 보이게)
  useEffect(() => {
    const pre = preRef.current;
    if (pre) pre.scrollTop = pre.scrollHeight;
  }, [text]);

  if (!text) return null;
  return (
    <>
      <pre
        ref={preRef}
        data-testid="live-output"
        className={cn(
          'mt-3 max-h-64 overflow-auto rounded-md bg-muted/50 p-3',
          'font-mono text-sm leading-relaxed text-foreground',
        )}
      >
        {text}
      </pre>
      {clipped && (
        <p className="mt-2 text-xs text-muted-foreground">
          출력이 너무 많아서 앞부분만 보여 줘요.
        </p>
      )}
    </>
  );
}

/** 실행이 멈추기 전까지 나온 출력 (시간 초과·멈추기·출력 상한) */
function PartialOutput({ stdout }: { stdout: string }) {
  if (!stdout) return null;
  return (
    <pre
      className={cn(
        'mt-2 max-h-64 overflow-auto rounded-md bg-muted/50 p-3',
        'font-mono text-xs leading-relaxed text-foreground',
      )}
    >
      {stdout}
    </pre>
  );
}

interface OutputPanelProps {
  result: RunResult | null;
  isRunning: boolean;
  validationResult?: { passed: boolean } | null;
  /** 실행 중 stdout (P1-09). 없으면 실행 중 표시만 */
  liveOutput?: LiveOutputStore;
}

export function OutputPanel({
  result,
  isRunning,
  validationResult,
  liveOutput,
}: OutputPanelProps) {
  if (isRunning) {
    return (
      <div
        data-testid="output-panel"
        data-state="running"
        className="rounded-lg border border-border bg-muted/30 p-4"
      >
        <div className="flex items-center gap-2">
          <TutorAvatar expression="thinking" />
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
          <span className="text-sm text-muted-foreground">실행 중...</span>
        </div>
        <LiveOutput store={liveOutput} />
      </div>
    );
  }

  if (!result) {
    return (
      <div
        data-testid="output-panel"
        data-state="empty"
        className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-4"
      >
        <TutorAvatar expression="happy" />
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          코드를 실행하면 결과가 여기에 표시돼요!
        </span>
      </div>
    );
  }

  // 타임아웃
  if (result.isTimeout) {
    return (
      <div
        data-testid="output-panel"
        data-state="timeout"
        className="rounded-lg border border-accent/30 bg-accent/10 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <TutorAvatar expression="confused" />
          <BugBugHelper expression="searching" />
          <span className="font-bold text-foreground">
            앗, 시간이 너무 오래 걸려요!
          </span>
        </div>
        <p className="text-sm text-foreground">
          혹시 무한 반복이 있는지 한번 살펴볼까요? 반복문의 조건을 확인해
          보세요!
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          while 반복문이라면 조건이 언젠가 거짓(False)이 되는지 확인해 봐요.
        </p>
        <PartialOutput stdout={result.stdout} />
      </div>
    );
  }

  // 멈추기 버튼으로 멈춤
  if (result.isStopped) {
    return (
      <div
        data-testid="output-panel"
        data-state="stopped"
        className="rounded-lg border border-border bg-muted/30 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <TutorAvatar expression="encouraging" />
          <Hand className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="font-bold text-foreground">실행을 멈췄어요</span>
        </div>
        <p className="text-sm text-foreground">
          코드를 살펴보고 준비되면 다시 돌려 봐요!
        </p>
        <PartialOutput stdout={result.stdout} />
      </div>
    );
  }

  // 출력 상한을 넘어 Worker가 멈춤 (B15)
  if (result.outcome === 'output-limit') {
    return (
      <div
        data-testid="output-panel"
        data-state="output-limit"
        className="rounded-lg border border-accent/30 bg-accent/10 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <TutorAvatar expression="confused" />
          <BugBugHelper expression="searching" />
          <span className="font-bold text-foreground">
            앗, 출력이 너무 많아요!
          </span>
        </div>
        <p className="text-sm text-foreground">
          그래서 중간에 멈췄어요. 끝없이 반복되는 print가 있는지 살펴볼까요?
        </p>
        <PartialOutput stdout={result.stdout} />
      </div>
    );
  }

  // 에러
  if (!result.success) {
    return (
      <div
        data-testid="output-panel"
        data-state="error"
        className="rounded-lg border border-accent/30 bg-accent/10 p-4"
      >
        <div className="mb-2 flex items-center gap-2">
          <TutorAvatar expression="encouraging" />
          <BugBugHelper expression="found" />
          <span className="font-bold text-foreground">
            앗, 여기를 한번 살펴볼까요?
          </span>
        </div>
        <p className="mb-2 text-sm text-foreground">
          괜찮아요! 에러 메시지를 잘 읽어보면 어디를 고쳐야 할지 알 수 있어요.
        </p>
        {result.stderr && (
          <pre
            className={cn(
              'overflow-x-auto rounded-md bg-muted/50 p-3',
              'font-mono text-xs leading-relaxed text-foreground',
            )}
          >
            {result.stderr}
          </pre>
        )}
      </div>
    );
  }

  // 성공 (검증 결과 포함)
  const borderColor = validationResult?.passed
    ? 'border-primary/30'
    : validationResult
      ? 'border-accent/50'
      : 'border-primary/30';
  const bgColor = validationResult?.passed
    ? 'bg-primary/5'
    : validationResult
      ? 'bg-accent/10'
      : 'bg-primary/5';

  return (
    <div
      data-testid="output-panel"
      data-state="success"
      className={cn('rounded-lg border p-4', borderColor, bgColor)}
    >
      <div className="mb-2 flex items-center gap-2">
        <TutorAvatar
          expression={
            validationResult?.passed
              ? 'celebrating'
              : validationResult
                ? 'teaching'
                : 'happy'
          }
        />
        <CheckCircle className="h-5 w-5 text-primary" />
        <span className="font-bold text-foreground">실행 결과</span>
        {validationResult?.passed && (
          <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
            정답이에요!
          </span>
        )}
        {validationResult && !validationResult.passed && (
          <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
            조금 더 고쳐볼까요?
          </span>
        )}
      </div>
      <pre
        className={cn(
          'overflow-x-auto rounded-md bg-muted/50 p-3',
          'font-mono text-sm leading-relaxed text-foreground',
        )}
      >
        {result.stdout || '(출력 없음)'}
      </pre>
    </div>
  );
}
