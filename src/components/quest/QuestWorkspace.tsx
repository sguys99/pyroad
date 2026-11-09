'use client';

import { cn } from '@/lib/utils';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ArrowRight, Square } from 'lucide-react';
import { worldPath } from '@/lib/world/worldBook';
import { stageDots } from '@/lib/quest/stageProgress';
import { QuestHeader } from './QuestHeader';
import { ConversationPanel } from './ConversationPanel';
import { StoryPage } from './StoryPage';
import { CodePanel, RunnerWakingNotice } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import { QuestStatusBar } from './QuestStatusBar';
import { QuestCelebrations } from './QuestCelebrations';
import { ApiKeyBanner } from './ApiKeyBanner';
import './questWorkspace.css';

// 모바일 번호 탭 ①이야기 ②공책 ③결과 (시안 f-ribbons). 패널 id는 aria-controls
const tabs = (['story', 'code', 'result'] as const).map((value, i) => ({
  value,
  label: { story: '이야기', code: '공책', result: '결과' }[value],
  icon: (
    <span className="qw-tab-n" aria-hidden>
      {i + 1}
    </span>
  ),
  panelId: value === 'story' ? 'quest-page-story' : 'quest-page-notebook',
}));

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
 * 코드를 쓰는 퀘스트(코드·프로젝트)의 공통 화면 (P1-09 → P6-01 책 펼침, 최종 시안 Quest.tsx):
 * 헤더 · [왼쪽 쪽 이야기(StoryPage: 해 볼 일 체크리스트·파이뱀 대사창·튜터 대화) | 오른쪽 쪽 공책(에디터·실행·결과)] · 상태바 · 축하.
 * lg(1024px) 이상은 흰 책 한 장을 펼친 두 쪽(쪽마다 따로 스크롤), 그 아래는 ①이야기 ②공책 ③결과 번호 탭으로 한 쪽씩
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
    <div className="flex h-dvh flex-col bg-bg">
      <QuestHeader
        worldHref={worldPath(quest.stage.world?.slug)}
        bgm={quest.stage.world?.bgm ?? null}
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
        dots={stageDots(
          quest.stage.quests ?? [],
          quest.id,
          session.isCompleted,
          quest.stage.unlocked,
        )}
      />

      {belowHeader}

      {/* API 키 미설정 배너 */}
      {session.hasApiKey === false && <ApiKeyBanner />}

      {/* 완료 배너 */}
      {session.isCompleted && (
        <div className="bg-primary-soft px-4 py-2 text-center text-small font-medium text-primary-text">
          {completedBanner}
        </div>
      )}

      {/* 모바일·태블릿 번호 탭 (세그먼트 탭, P2-11). 스와이프는 P6-11 */}
      <div className="qw-tabs lg:hidden">
        <SegmentedTabs
          items={tabs}
          value={tab}
          onValueChange={setTab}
          aria-label="퀘스트 쪽 고르기"
        />
      </div>

      {/* 책 펼침: 왼쪽 이야기 | 오른쪽 공책 */}
      <div className="qw-book">
        <div
          id="quest-page-story"
          className={cn(
            'qw-page qw-page-l',
            tab !== 'story' && 'max-lg:hidden',
          )}
        >
          <StoryPage
            session={session}
            action={
              <Button
                onClick={() => setTab('code')}
                iconRight={<ArrowRight aria-hidden />}
                className="qs-next lg:hidden"
              >
                공책 펼치기
              </Button>
            }
          >
            <ConversationPanel
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
          </StoryPage>
        </div>

        <div
          id="quest-page-notebook"
          className={cn(
            'qw-page qw-page-r',
            tab === 'story' && 'max-lg:hidden',
          )}
        >
          <div className={cn(tab === 'result' && 'max-lg:hidden')}>
            <CodePanel
              code={session.code}
              onCodeChange={session.setCode}
              starterCode={session.starterCode}
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

          {/* 모바일 결과 쪽 */}
          <div
            className={cn(
              'flex flex-col gap-3 lg:hidden',
              tab !== 'result' && 'hidden',
            )}
          >
            {runner.isRunning && (
              <Button
                onClick={session.handleStop}
                variant="secondary"
                icon={<Square className="fill-current" aria-hidden />}
                className="self-start"
              >
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
              <Button href={`/quest/${nextQuestId}`} className="w-full">
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
