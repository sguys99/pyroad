'use client';

import { CheckCircle, AlertTriangle, Clock, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RunResult } from '@/lib/pyodide/usePyodide';

interface OutputPanelProps {
  result: RunResult | null;
  isRunning: boolean;
  validationResult?: { passed: boolean } | null;
}

export function OutputPanel({
  result,
  isRunning,
  validationResult,
}: OutputPanelProps) {
  if (isRunning) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">실행 중...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-4">
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
      <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent-foreground" />
          <span className="font-bold text-foreground">시간 초과!</span>
        </div>
        <p className="text-sm text-foreground">
          코드가 너무 오래 걸려요! 혹시 무한 반복이 있는지 확인해 보세요.
        </p>
      </div>
    );
  }

  // 에러
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="font-bold text-foreground">앗, 오류가 있어요!</span>
        </div>
        {result.stderr && (
          <pre
            className={cn(
              'mt-2 overflow-x-auto rounded-md bg-muted/50 p-3',
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
    <div className={cn('rounded-lg border p-4', borderColor, bgColor)}>
      <div className="mb-2 flex items-center gap-2">
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
