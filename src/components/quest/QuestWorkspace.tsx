'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { QuestSession, QuestTab } from '@/lib/quest/useQuestSession';
import { Button } from '@/components/ui/button';
import { Square } from 'lucide-react';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { CodePanel, RunnerWakingNotice } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { QuestCelebrations } from './QuestCelebrations';
import { ApiKeyBanner } from './ApiKeyBanner';

const tabs: { key: QuestTab; label: string }[] = [
  { key: 'story', label: '이야기' },
  { key: 'code', label: '코드' },
  { key: 'result', label: '결과' },
];

interface QuestWorkspaceProps {
  session: QuestSession;
  /** 헤더 바로 아래 (프로젝트의 단계 막대 등) */
  belowHeader?: React.ReactNode;
  /** 완료했을 때 위에 띄우는 배너 내용 */
  completedBanner: React.ReactNode;
  /** 정답이면 보여 줄 "다음 퀘스트로" 대상 (코드 퀘스트) */
  nextQuestId?: string | null;
}

/**
 * 코드를 쓰는 퀘스트(코드·프로젝트)의 공통 화면: 헤더 · 대화 | 코드+결과 · 상태바 · 축하.
 * 모바일은 이야기/코드/결과 탭, md 이상은 두 칸 (P1-09: QuestShell·ProjectQuestShell의 같은 마크업)
 */
export function QuestWorkspace({
  session,
  belowHeader,
  completedBanner,
  nextQuestId = null,
}: QuestWorkspaceProps) {
  const { quest, tab, setTab, runner, runResult, validation, liveOutput } =
    session;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <QuestHeader
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
      />

      {belowHeader}

      {/* API 키 미설정 배너 */}
      {session.hasApiKey === false && <ApiKeyBanner />}

      {/* 완료 배너 */}
      {session.isCompleted && (
        <div className="bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary">
          {completedBanner}
        </div>
      )}

      {/* 모바일 탭 바 */}
      <div className="flex border-b border-border md:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 py-3 text-center text-sm font-medium transition-colors min-h-[44px]',
              tab === t.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 overflow-hidden md:grid md:grid-cols-2">
        {/* 대화 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto border-r border-border',
            tab !== 'story' && 'hidden md:block',
          )}
        >
          <ConversationPanel
            promptSkeleton={quest.prompt_skeleton}
            messages={session.messages}
            isAiLoading={session.isAiLoading}
            streamingContent={session.streamingContent}
            hintsUsed={session.hintsUsed}
            onHintRequest={session.handleHintRequest}
            goldenKeys={session.goldenKeys}
            onGoldenKeyUse={session.handleGoldenKeyUse}
            isGoldenKeyLoading={session.isGoldenKeyLoading}
            isGoldenKeyBlocked={session.isGoldenKeyBlocked}
          />
        </div>

        {/* 코드+결과 패널 */}
        <div
          className={cn(
            'h-full overflow-y-auto',
            tab === 'story' && 'hidden md:block',
          )}
        >
          <div className={cn(tab === 'result' && 'hidden md:block')}>
            <CodePanel
              code={session.code}
              onCodeChange={session.setCode}
              pyodideStatus={runner.status}
              restarting={runner.restarting}
              isRunning={runner.isRunning}
              isSubmitting={session.isSubmitting}
              onRun={session.handleRun}
              onStop={session.handleStop}
              onRetry={runner.retry}
              runResult={runResult}
              liveOutput={liveOutput}
              isCodeEmpty={session.isCodeEmpty}
              validationResult={validation}
              nextQuestId={nextQuestId}
            />
          </div>

          {/* 모바일 결과 전용 뷰 */}
          <div
            className={cn(
              'flex flex-col gap-3 p-4 md:hidden',
              tab !== 'result' && 'hidden',
            )}
          >
            {runner.isRunning && (
              <Button
                onClick={session.handleStop}
                variant="outline"
                className="self-start"
              >
                <Square className="mr-1.5 h-4 w-4 fill-current" aria-hidden />
                멈추기
              </Button>
            )}
            {runner.restarting && runner.status === 'loading' && (
              <RunnerWakingNotice />
            )}
            <OutputPanel
              result={runResult}
              isRunning={runner.isRunning}
              validationResult={validation}
              liveOutput={liveOutput}
            />
            {validation?.passed && nextQuestId && (
              <Button
                render={<Link href={`/quest/${nextQuestId}`} />}
                className="w-full"
              >
                다음 퀘스트로 →
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 하단 상태바 */}
      <QuestStatusBar
        xp={session.userXP}
        level={session.userLevel}
        hintsUsed={session.totalHintsUsed}
        earnedXP={session.earnedXP}
      />

      {/* 축하 오버레이 (셸 재렌더와 분리, §2.10) */}
      <QuestCelebrations
        events={session.celebrations}
        questId={quest.id}
        onDismiss={session.dismissCelebrations}
      />
    </div>
  );
}
