'use client';

import { useState, useEffect } from 'react';
import { Play, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CodeEditor } from './CodeEditor';
import { OutputPanel } from './OutputPanel';
import type { PyodideStatus, RunResult } from '@/lib/pyodide/usePyodide';
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
      <span className="shrink-0"><CharacterAvatar character="pybaem" expression="teaching" size="sm" /></span>
      <div className="min-h-[20px] flex-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            className="text-xs text-foreground"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {CODING_TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface CodePanelProps {
  initialCode: string;
  onCodeChange: (code: string) => void;
  pyodideStatus: PyodideStatus;
  isRunning: boolean;
  onRun: () => void;
  onRetry: () => void;
  runResult: RunResult | null;
  isCodeEmpty: boolean;
  validationResult?: { passed: boolean } | null;
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
  validationResult,
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
          <motion.div
            whileHover={canRun ? { scale: 1.03 } : undefined}
            whileTap={canRun ? { scale: 0.97 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
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

        {isError && (
          <span className="text-xs text-accent-foreground">
            앗, 실행기를 불러오지 못했어요. 다시 시도해 볼까요?
          </span>
        )}
      </div>

      {/* Pyodide 로딩 중 코딩 팁 */}
      {isLoading && <CodingTipRotator />}

      {/* 실행 결과 */}
      <OutputPanel
        result={runResult}
        isRunning={isRunning}
        validationResult={validationResult}
      />
    </div>
  );
}
