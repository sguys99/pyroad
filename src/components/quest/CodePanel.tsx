'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Loader2, RefreshCw, Square } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { framerSpring, jelly, sec } from '@/lib/motion/tokens';
import { Button } from '@/components/ui/button';
import { CodeEditor } from './CodeEditor';
import { errorLineFromStderr } from '@/lib/editor/errorLine';
import { OutputPanel } from './OutputPanel';
import type {
  PyodideRestartReason,
  PyodideStatus,
  RunResult,
} from '@/lib/pyodide/usePyodide';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';

const CODING_TIPS = [
  'print()로 화면에 글자를 보여줄 수 있어요!',
  '변수는 상자와 같아요 — 값을 담아둘 수 있답니다!',
  '들여쓰기(스페이스 4칸)는 파이썬에서 아주 중요해요!',
  'if문으로 조건에 따라 다른 일을 할 수 있어요!',
  'for문으로 같은 일을 여러 번 반복할 수 있어요!',
  '# 뒤에 쓰는 글은 메모예요. 컴퓨터는 읽지 않아요!',
  'input()으로 사용자에게 질문을 할 수 있어요!',
];

function CodingTipRotator() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % CODING_TIPS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <span className="shrink-0">
        <CharacterAvatar character="pybaem" expression="teaching" size="sm" />
      </span>
      <div className="min-h-[20px] flex-1">
        <AnimatePresence mode="wait">
          <m.p
            key={tipIndex}
            className="text-xs text-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: sec('base') }}
          >
            {CODING_TIPS[tipIndex]}
          </m.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * 시간 초과·멈추기 뒤 Worker를 다시 띄우는 동안 (§2.9 재준비 연출, 2~5초).
 * 점 세 개는 CSS transform·opacity 반복이고 reduced-motion이면 멈춘 점 (§2.10)
 */
export function RunnerWakingNotice() {
  return (
    <div
      role="status"
      data-testid="runner-waking"
      className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
    >
      <span className="shrink-0">
        <CharacterAvatar character="pybaem" expression="sleeping" size="sm" />
      </span>
      <p className="flex items-center text-xs text-foreground">
        파이뱀이 실행기를 다시 깨우는 중
        <span aria-hidden className="ml-1 inline-flex items-end gap-0.5">
          <span className="waking-dot inline-block h-1 w-1 rounded-full bg-primary" />
          <span className="waking-dot inline-block h-1 w-1 rounded-full bg-primary" />
          <span className="waking-dot inline-block h-1 w-1 rounded-full bg-primary" />
        </span>
      </p>
    </div>
  );
}

interface CodePanelProps {
  /** 에디터 코드. 황금키 정답·다음 단계 코드처럼 바깥에서 바꾸면 에디터에도 반영됨 */
  code: string;
  onCodeChange: (code: string) => void;
  pyodideStatus: PyodideStatus;
  /** Worker를 다시 띄우는 중이면 그 이유 (재준비 연출) */
  restarting?: PyodideRestartReason;
  isRunning: boolean;
  /** 채점·완료 요청 중 (B06: 이 동안 실행 버튼을 다시 누를 수 없음) */
  isSubmitting?: boolean;
  onRun: () => void;
  /** 실행 멈추기 (실행 중에만 버튼이 보임) */
  onStop?: () => void;
  onRetry: () => void;
  runResult: RunResult | null;
  /** 실행 중 stdout */
  liveOutput?: LiveOutputStore;
  isCodeEmpty: boolean;
  validationResult?: { passed: boolean } | null;
  nextQuestId?: string | null;
}

export function CodePanel({
  code,
  onCodeChange,
  pyodideStatus,
  restarting = null,
  isRunning,
  isSubmitting = false,
  onRun,
  onStop,
  onRetry,
  runResult,
  liveOutput,
  isCodeEmpty,
  validationResult,
  nextQuestId,
}: CodePanelProps) {
  const isReady = pyodideStatus === 'ready';
  const isLoading = pyodideStatus === 'loading';
  const isError = pyodideStatus === 'error';
  // Worker 를 띄우기 전(idle)과 불러오는 중(loading) 모두 아직 누를 수 없으므로 "준비 중..."
  const isPreparing = !isReady && !isError;
  const isBusy = isRunning || isSubmitting;
  const canRun = isReady && !isBusy && !isCodeEmpty;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 에디터 (오류가 난 줄은 traceback에서 찾아 표시, P2-18) */}
      <CodeEditor
        value={code}
        onChange={onCodeChange}
        errorLine={
          runResult?.hadException ? errorLineFromStderr(runResult.stderr) : null
        }
      />

      {/* Pyodide 상태 + 실행 버튼 */}
      <div className="flex items-center gap-3">
        {isError ? (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            실행기 다시 불러오기
          </Button>
        ) : (
          <m.div
            whileHover={canRun ? { scale: 1.03 } : undefined}
            whileTap={canRun ? { scale: 0.97 } : undefined}
            transition={framerSpring(jelly())}
          >
            <Button
              onClick={onRun}
              disabled={!canRun}
              size="default"
              className="min-w-[140px]"
              aria-busy={isBusy || undefined}
              data-testid="run-button"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin reduced:animate-none" />
                  실행 중...
                </>
              ) : isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin reduced:animate-none" />
                  정답 확인 중...
                </>
              ) : isPreparing ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin reduced:animate-none" />
                  준비 중...
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  코드 돌려보기!
                </>
              )}
            </Button>
          </m.div>
        )}

        {isRunning && onStop && (
          <Button
            onClick={onStop}
            variant="outline"
            size="default"
            data-testid="stop-button"
          >
            <Square className="mr-1.5 h-4 w-4 fill-current" aria-hidden />
            멈추기
          </Button>
        )}

        {isError && (
          <span className="text-xs text-accent-foreground">
            앗, 실행기를 불러오지 못했어요. 다시 시도해 볼까요?
          </span>
        )}
      </div>

      {/* 다시 준비 중이면 깨우는 연출, 처음 불러오는 중이면 코딩 팁 */}
      {isLoading &&
        (restarting ? <RunnerWakingNotice /> : <CodingTipRotator />)}

      {/* 실행 결과 */}
      <OutputPanel
        result={runResult}
        isRunning={isRunning}
        validationResult={validationResult}
        liveOutput={liveOutput}
      />

      {/* 다음 퀘스트 버튼 */}
      {validationResult?.passed && nextQuestId && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={framerSpring('body', { delay: sec('slow') })}
          className="mt-2"
        >
          <Button
            render={<Link href={`/quest/${nextQuestId}`} />}
            className="w-full"
          >
            다음 퀘스트로 →
          </Button>
        </m.div>
      )}
    </div>
  );
}
