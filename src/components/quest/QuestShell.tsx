'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePyodide } from '@/lib/pyodide/usePyodide';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';

type Tab = 'story' | 'code' | 'result';

const tabs: { key: Tab; label: string }[] = [
  { key: 'story', label: '이야기' },
  { key: 'code', label: '코드' },
  { key: 'result', label: '결과' },
];

interface QuestShellProps {
  quest: QuestWithStage;
  progress: UserProgress | null;
}

export function QuestShell({ quest, progress }: QuestShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [code, setCode] = useState(
    progress?.code_submitted || quest.prompt_skeleton.starter_code,
  );
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const { status: pyodideStatus, runCode, isRunning, retry } = usePyodide();

  const isCodeEmpty = !code.trim();

  const handleRun = useCallback(async () => {
    if (isCodeEmpty) return;
    const result = await runCode(code);
    setRunResult(result);
    // 모바일에서 자동으로 결과 탭 전환
    setActiveTab('result');
  }, [code, isCodeEmpty, runCode]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <QuestHeader
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
      />

      {/* 모바일 탭 바 */}
      <div className="flex border-b border-border md:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-2.5 text-center text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden md:grid md:grid-cols-2">
        {/* 대화 패널 (데스크톱: 항상 표시, 모바일: story 탭일 때만) */}
        <div
          className={cn(
            'h-full overflow-y-auto border-r border-border',
            activeTab !== 'story' && 'hidden md:block',
          )}
        >
          <ConversationPanel promptSkeleton={quest.prompt_skeleton} />
        </div>

        {/* 코드+결과 패널 (데스크톱: 항상 표시, 모바일: code/result 탭일 때) */}
        <div
          className={cn(
            'h-full overflow-y-auto',
            activeTab === 'story' && 'hidden md:block',
          )}
        >
          {/* 모바일: code 탭이면 코드만, result 탭이면 결과만 */}
          {/* 데스크톱: 코드 + 결과 모두 표시 */}
          <div className={cn(activeTab === 'result' && 'hidden md:block')}>
            <CodePanel
              initialCode={
                progress?.code_submitted ||
                quest.prompt_skeleton.starter_code
              }
              onCodeChange={setCode}
              pyodideStatus={pyodideStatus}
              isRunning={isRunning}
              onRun={handleRun}
              onRetry={retry}
              runResult={runResult}
              isCodeEmpty={isCodeEmpty}
            />
          </div>

          {/* 모바일 결과 전용 뷰 */}
          <div className={cn('p-4 md:hidden', activeTab !== 'result' && 'hidden')}>
            <OutputPanel result={runResult} isRunning={isRunning} />
          </div>
        </div>
      </div>
    </div>
  );
}
