'use client';

import { Play, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CodeEditor } from './CodeEditor';
import { OutputPanel } from './OutputPanel';
import type { PyodideStatus, RunResult } from '@/lib/pyodide/usePyodide';

interface CodePanelProps {
  initialCode: string;
  onCodeChange: (code: string) => void;
  pyodideStatus: PyodideStatus;
  isRunning: boolean;
  onRun: () => void;
  onRetry: () => void;
  runResult: RunResult | null;
  isCodeEmpty: boolean;
}

export function CodePanel({
  initialCode,
  onCodeChange,
  pyodideStatus,
  isRunning,
  onRun,
  onRetry,
  runResult,
  isCodeEmpty,
}: CodePanelProps) {
  const isReady = pyodideStatus === 'ready';
  const isLoading = pyodideStatus === 'loading';
  const isError = pyodideStatus === 'error';
  const canRun = isReady && !isRunning && !isCodeEmpty;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 에디터 */}
      <CodeEditor initialCode={initialCode} onChange={onCodeChange} />

      {/* Pyodide 상태 + 실행 버튼 */}
      <div className="flex items-center gap-3">
        {isError ? (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            실행기 다시 불러오기
          </Button>
        ) : (
          <motion.div whileTap={canRun ? { scale: 0.95 } : undefined}>
            <Button
              onClick={onRun}
              disabled={!canRun}
              size="default"
              className="min-w-[140px]"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  실행 중...
                </>
              ) : isLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  준비 중...
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  코드 돌려보기!
                </>
              )}
            </Button>
          </motion.div>
        )}

        {isLoading && (
          <motion.span
            className="text-xs text-muted-foreground"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            파이썬 실행기를 준비하고 있어요...
          </motion.span>
        )}

        {isError && (
          <span className="text-xs text-destructive">
            실행기를 불러오지 못했어요.
          </span>
        )}
      </div>

      {/* 실행 결과 */}
      <OutputPanel result={runResult} isRunning={isRunning} />
    </div>
  );
}
