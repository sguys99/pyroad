'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { usePyodide } from '@/lib/pyodide/usePyodide';
import { useTutor } from '@/lib/tutor/useTutor';
import { createClient } from '@/lib/supabase/client';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
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
  userId: string;
}

export function QuestShell({ quest, progress, userId }: QuestShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('story');
  const [code, setCode] = useState(
    progress?.code_submitted || quest.prompt_skeleton.starter_code,
  );
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const { status: pyodideStatus, runCode, isRunning, retry } = usePyodide();

  // AI 튜터 상태
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hintsUsed, setHintsUsed] = useState(progress?.hints_used ?? 0);
  const { sendTutorRequest, isLoading: isAiLoading } = useTutor();

  const isCodeEmpty = !code.trim();

  // 퀘스트 진입 시 quest_intro 자동 호출
  useEffect(() => {
    let cancelled = false;

    async function fetchIntro() {
      try {
        const res = await sendTutorRequest({
          type: 'quest_intro',
          quest_id: quest.id,
        });
        if (!cancelled) {
          setMessages([
            {
              role: 'tutor',
              content: res.message,
              isFallback: res.is_fallback,
            },
          ]);
        }
      } catch {
        if (!cancelled) {
          setMessages([
            {
              role: 'tutor',
              content: quest.prompt_skeleton.fallback_text,
              isFallback: true,
            },
          ]);
        }
      }
    }

    fetchIntro();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest.id]);

  // 힌트 요청 핸들러
  const handleHintRequest = useCallback(async () => {
    if (hintsUsed >= 3 || isAiLoading) return;

    const nextLevel = (hintsUsed + 1) as 1 | 2 | 3;

    try {
      const res = await sendTutorRequest({
        type: 'hint_generator',
        quest_id: quest.id,
        student_code: code,
        hint_level: nextLevel,
      });
      setHintsUsed(nextLevel);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        { role: 'tutor', content: res.message, isFallback: res.is_fallback },
      ]);
    } catch {
      const hintKey =
        `level_${nextLevel}` as keyof typeof quest.prompt_skeleton.hints;
      setHintsUsed(nextLevel);
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `힌트 ${nextLevel}/3` },
        {
          role: 'tutor',
          content: quest.prompt_skeleton.hints[hintKey],
          isFallback: true,
        },
      ]);
    }

    // DB 저장 (fire-and-forget)
    const supabase = createClient();
    supabase
      .from('user_progress')
      .upsert(
        {
          user_id: userId,
          quest_id: quest.id,
          hints_used: nextLevel,
          status: 'in_progress' as const,
        },
        { onConflict: 'user_id,quest_id' },
      )
      .then();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintsUsed, isAiLoading, quest.id, code, userId]);

  const handleRun = useCallback(async () => {
    if (isCodeEmpty) return;
    const result = await runCode(code);
    setRunResult(result);
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
        {/* 대화 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto border-r border-border',
            activeTab !== 'story' && 'hidden md:block',
          )}
        >
          <ConversationPanel
            promptSkeleton={quest.prompt_skeleton}
            messages={messages}
            isAiLoading={isAiLoading}
            hintsUsed={hintsUsed}
            onHintRequest={handleHintRequest}
          />
        </div>

        {/* 코드+결과 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto',
            activeTab === 'story' && 'hidden md:block',
          )}
        >
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
          <div
            className={cn('p-4 md:hidden', activeTab !== 'result' && 'hidden')}
          >
            <OutputPanel result={runResult} isRunning={isRunning} />
          </div>
        </div>
      </div>
    </div>
  );
}
