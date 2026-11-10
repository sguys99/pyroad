'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { Button } from '@/components/ui/button';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ArrowRight, Square } from 'lucide-react';
import { worldPath } from '@/lib/world/worldBook';
import { stageDots } from '@/lib/quest/stageProgress';
import { QuestHeader } from './QuestHeader';
import { AskPybaem } from './AskPybaem';
import { StoryPage } from './StoryPage';
import { QuestHints, hintNotes } from './QuestHints';
import { CodePanel } from './CodePanel';
import { OutputPanel } from './OutputPanel';
import type { QuestReward } from './QuestSuccess';
import { codeQuestStars } from '@/lib/quest/xp';
import { QuestStatusBar } from './QuestStatusBar';
import { usePageSwipe } from './usePageSwipe';
import './questWorkspace.css';

// 축하 오버레이 (P6-13): 받은 축하가 있을 때만 그린다. 첫 로드 JS에서 빼고, 실행을 처음 누를 때 미리 받아 둔다
const loadCelebrations = () =>
  import('./QuestCelebrations').then((m) => m.QuestCelebrations);
const QuestCelebrations = dynamic(loadCelebrations, { ssr: false });

/**
 * 축하 편지함만 구독하는 자리 (P6-13). 이벤트가 오고 비워질 때 이 컴포넌트만 다시 그려지고 퀘스트 셸은 그대로다.
 * 받은 축하가 없으면 아무것도 그리지 않는다(오버레이 chunk·DOM 없음)
 */
export function CelebrationLayer({
  session,
  worldHref,
}: {
  /** 퀴즈 세션(useQuizSession, P7-03)도 같은 편지함을 씀 */
  session: Pick<QuestSession, 'celebrationStore' | 'quest'>;
  worldHref: string;
}) {
  const store = session.celebrationStore;
  const events = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (events.length === 0) return null;
  return (
    <QuestCelebrations
      events={events}
      questId={session.quest.id}
      worldHref={worldHref}
      onDismiss={store.dismiss}
    />
  );
}

const TAB_ORDER = ['story', 'code', 'result'] as const;
const pageId = (tab: (typeof TAB_ORDER)[number]) =>
  tab === 'story' ? 'quest-page-story' : 'quest-page-notebook';

/**
 * 모바일 번호 탭 ①이야기 ②공책 ③결과 (시안 f-ribbons). 패널 id는 aria-controls.
 * ③결과에는 마지막 실행의 상태 점 (시안 f-ribbon-dot, P6-11): 통과 = 초록 · 오류·다름 = 금색. 낭독기는 탭 이름 뒤에 "통과"·"고칠 곳 있음"
 */
export function questTabs(verdict: 'good' | 'bad' | null) {
  return TAB_ORDER.map((value, i) => ({
    value,
    label: (
      <>
        {{ story: '이야기', code: '공책', result: '결과' }[value]}
        {value === 'result' && verdict && (
          <span className="qw-tab-dot" data-tone={verdict}>
            <span className="sr-only">
              {verdict === 'good' ? '통과' : '고칠 곳 있음'}
            </span>
          </span>
        )}
      </>
    ),
    icon: (
      <span className="qw-tab-n" aria-hidden>
        {i + 1}
      </span>
    ),
    panelId: pageId(value),
  }));
}

interface QuestWorkspaceProps {
  session: QuestSession;
  /** 공책 쪽 맨 위 (프로젝트 단계 띠 StepStrip, P6-12). 모바일은 공책·결과 쪽 모두에서 보임 */
  notebookTop?: React.ReactNode;
  /** 완료했을 때 위에 띄우는 배너 내용 */
  completedBanner: React.ReactNode;
}

/**
 * 코드를 쓰는 퀘스트(코드·프로젝트)의 공통 화면 (P1-09 → P6-01 책 펼침, 최종 시안 Quest.tsx):
 * 헤더 · [왼쪽 쪽 이야기(StoryPage: 해 볼 일 체크리스트·파이뱀 대사창·물어보기(튜터 대화, P6-10)·힌트) | 오른쪽 쪽 공책(에디터·실행·결과)] · 상태바 · 축하.
 * lg(1024px) 이상은 흰 책 한 장을 펼친 두 쪽(쪽마다 따로 스크롤), 그 아래는 ①이야기 ②공책 ③결과 번호 탭으로 한 쪽씩
 */
export function QuestWorkspace({
  session,
  notebookTop,
  completedBanner,
}: QuestWorkspaceProps) {
  const { quest, tab, setTab, runner, runResult, validation, liveOutput } =
    session;
  // 결과 쪽지에서 견줘 볼 공개 안내 (P6-06): 프로젝트는 지금 단계 목표, 코드 퀘스트는 expected_output_hint
  const goal = session.steps?.length
    ? session.steps[session.currentStep - 1]?.step_goal
    : quest.prompt_skeleton.expected_output_hint;
  // 오류 줄로: 모바일은 공책 쪽으로 넘기고, 에디터에 표시된 오류 줄(P2-18)을 화면 가운데로
  const showErrorLine = () => {
    setTab('code');
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(
        '#quest-page-notebook [data-error-line]',
      );
      row?.scrollIntoView({ block: 'center' });
      row
        ?.closest('.cm-editor')
        ?.querySelector<HTMLElement>('.cm-content')
        ?.focus({ preventScroll: true });
    });
  };
  // 퀘스트를 마친 그 실행이면 결과 쪽지 아래 성공 장면 (P6-08). 다음 퀘스트가 없으면(스테이지 끝) 지도가 주 버튼
  const worldHref = worldPath(quest.stage.world?.slug);
  const dots = stageDots(
    quest.stage.quests ?? [],
    quest.id,
    session.isCompleted,
    quest.stage.unlocked,
  );
  // 복습(Q57)은 완료 API를 부르지 않아 서버의 다음 퀘스트가 없으면 스테이지 차례의 바로 다음 (열린 것만)
  const nextQuestId =
    session.nextQuestId ??
    dots
      .slice(dots.findIndex((d) => d.current) + 1)
      .find((d) => d.state !== 'locked')?.id ??
    null;
  const review = session.completion === 'review';
  const reward: QuestReward | null =
    validation?.passed && session.isCompleted
      ? {
          title: quest.title,
          xp: review ? 0 : (session.earnedXP ?? 0),
          review,
          stars: codeQuestStars(session.totalHintsUsed, session.usedGoldenKey),
          note: review
            ? '보상은 처음 통과할 때 한 번만 받아요. 복습으로 주문이 더 단단해졌어요!'
            : session.usedGoldenKey
              ? '황금 열쇠로 연 퀘스트는 XP 없이 통과로 기록돼요.'
              : undefined,
          nextHref: nextQuestId ? `/quest/${nextQuestId}` : null,
          mapHref: worldHref,
        }
      : null;
  // 결과가 지금 코드의 것일 때만 "파이뱀에게 더 물어보기" (고친 코드로는 그 결과를 물을 수 없음)
  const askTutor = session.canAskWhy ? session.askAboutRun : undefined;
  // 실행기가 준비되면 쉬는 틈에 오버레이 chunk를 미리 받아 둔다 (정답 순간에 내려받기·해석이 겹치지 않게)
  useEffect(() => {
    if (runner.status !== 'ready') return;
    const ric = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1));
    const id = ric(() => void loadCelebrations());
    return () => (window.cancelIdleCallback ?? clearTimeout)(id);
  }, [runner.status]);
  // 쪽 넘기기 (P6-11): 번호 탭 + 좌우 스와이프, 바뀔 때 쪽 넘김 연출
  const book = useRef<HTMLDivElement>(null);
  usePageSwipe({
    host: book,
    order: TAB_ORDER,
    tab,
    setTab,
    pageOf: (t) => document.getElementById(pageId(t)),
  });
  const verdict =
    runner.isRunning || !runResult || runResult.isStopped
      ? null
      : validation?.passed
        ? 'good'
        : !runResult.success || validation
          ? 'bad'
          : null;
  const notes = hintNotes(
    session.messages,
    session.currentStep,
    session.streamingContent,
  );

  return (
    <div className="qw-root flex h-dvh flex-col bg-bg">
      <QuestHeader
        worldHref={worldHref}
        bgm={quest.stage.world?.bgm ?? null}
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
        dots={dots}
      />

      {/* API 키 미설정 안내는 파이뱀 대화 안으로 옮김 (P6-10, AskPybaem → ApiKeyBanner) */}

      {/* 완료 배너 (방금 마친 퀘스트는 결과 쪽 보상 띠가 대신 안내) */}
      {session.isCompleted && !reward && (
        <div className="bg-primary-soft px-4 py-2 text-center text-small font-medium text-primary-text">
          {completedBanner}
        </div>
      )}

      {/* 모바일·태블릿 번호 탭 (세그먼트 탭, P2-11) + 책 위 좌우 스와이프 (P6-11) */}
      <div className="qw-tabs lg:hidden">
        <SegmentedTabs
          items={questTabs(verdict)}
          value={tab}
          onValueChange={setTab}
          aria-label="퀘스트 쪽 고르기"
        />
      </div>

      {/* 책 펼침: 왼쪽 이야기 | 오른쪽 공책 */}
      <div className="qw-book" ref={book}>
        <div
          id="quest-page-story"
          className={cn(
            'qw-page qw-page-l',
            tab !== 'story' && 'max-lg:hidden',
          )}
        >
          <StoryPage
            session={session}
            ask={
              <AskPybaem
                session={session}
                hintPending={notes.some((n) => n.pending)}
              />
            }
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
            <QuestHints
              kind={session.kind}
              hintsUsed={session.hintsUsed}
              notes={notes}
              onHint={session.handleHintRequest}
              hintBusy={session.isAiLoading}
              goldenKeys={session.goldenKeys}
              onGoldenKey={session.handleGoldenKeyUse}
              keyBlocked={session.isAiLoading || session.isGoldenKeyBlocked}
              keyLoading={session.isGoldenKeyLoading}
              xpReward={quest.xp_reward}
              totalHintsUsed={session.totalHintsUsed}
              usedGoldenKey={session.usedGoldenKey}
              isCompleted={session.isCompleted}
              completion={session.completion}
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
          {notebookTop}
          <div className={cn(tab === 'result' && 'max-lg:hidden')}>
            <CodePanel
              code={session.code}
              onCodeChange={session.setCode}
              starterCode={session.starterCode}
              pyodideStatus={runner.status}
              restarting={runner.restarting}
              loadStage={runner.loadStage}
              isRunning={runner.isRunning}
              isSubmitting={session.isSubmitting}
              stepping={session.stepCleared != null}
              onRun={session.handleRun}
              onStop={session.handleStop}
              onRetry={runner.retry}
              runResult={runResult}
              liveOutput={liveOutput}
              isCodeEmpty={session.isCodeEmpty}
              validationResult={validation}
              reward={reward}
              goal={goal}
              onShowErrorLine={showErrorLine}
              onAskTutor={askTutor}
              stage={quest.stage.order}
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
            <OutputPanel
              result={runResult}
              isRunning={runner.isRunning}
              validationResult={validation}
              liveOutput={liveOutput}
              goal={goal}
              onShowErrorLine={showErrorLine}
              restarting={!!runner.restarting && runner.status === 'loading'}
              reward={reward}
              onAskTutor={askTutor}
            />
          </div>
        </div>
      </div>

      {/* 하단 상태바 */}
      <QuestStatusBar
        xp={session.userXP}
        level={session.userLevel}
        earnedXP={session.earnedXP}
      />

      {/* 축하 오버레이 (셸 재렌더와 분리·memo, 평소엔 chunk도 DOM도 없음, §2.10) */}
      <CelebrationLayer session={session} worldHref={worldHref} />
    </div>
  );
}
