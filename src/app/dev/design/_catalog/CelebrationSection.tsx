'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play, RotateCcw } from 'lucide-react';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { Button } from '@/components/ui/button';
import { QuestCelebrations } from '@/components/quest/QuestCelebrations';
import { StageClearCard } from '@/components/quest/celebrations/StageClearCard';
import { LevelUpCard } from '@/components/quest/celebrations/LevelUpCard';
import { BadgesCard } from '@/components/quest/celebrations/BadgesCard';
import { SAMPLE_ACHIEVEMENTS } from './achievementSamples';
import { GoldenKeyCard } from '@/components/quest/celebrations/GoldenKeyCard';
import { ProjectCompleteCard } from '@/components/quest/celebrations/ProjectCompleteCard';
import { RewardsCard } from '@/components/quest/celebrations/RewardsCard';
import { ChestCard } from '@/components/quest/celebrations/ChestCard';
import { CtaAutoFocus } from '@/components/quest/celebrations/parts';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  introMs,
  planCelebrations,
  type CelebrationStep,
} from '@/lib/celebration/plan';
import { tierDuration } from '@/lib/motion/tokens';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import { getLevelTitle, levelUpCoins } from '@/lib/quest/xp';
import { CodeSample, Section } from './ui';

const noop = () => {};
/** 카탈로그 받기: 서버 없이 바로 받음 */
const claimDemo = async () => ({
  claimed: true as const,
  already_claimed: false,
  coins_earned: 10,
  coins_balance: 110,
});
const HERE = '/dev/design#celebrations';
const STAGE = {
  stage_id: 'cat-s1',
  order: 1,
  title: '시작의 숲',
  concepts: ['print', '문자열', '변수'],
};
const SUMMARY =
  '**print**로 화면에 글자를 보여 주고, **변수**라는 상자에 값을 넣어 다시 꺼내 쓰는 법을 배웠어요. 다음 숲에서도 쓸 거예요!';

/** 실제 오버레이로 띄우는 묶음 */
const SEQUENCES: { id: string; label: string; events: CelebrationEvent[] }[] = [
  {
    id: 'stage',
    label: '스테이지 마지막 퀘스트',
    events: [
      { type: 'stage_clear', stage: STAGE },
      {
        type: 'level_up',
        level: 3,
        fromLevel: 2,
        title: getLevelTitle(3),
        coins: levelUpCoins(3),
      },
      { type: 'badge', badge: SAMPLE_ACHIEVEMENTS.first_code },
      { type: 'badge', badge: SAMPLE_ACHIEVEMENTS.stage_clear },
    ],
  },
  {
    id: 'golden',
    label: '황금키로 연 퀘스트',
    events: [{ type: 'golden_key', kind: 'code', questTitle: '변수 상자' }],
  },
  {
    id: 'chest',
    label: '보물상자 열기 (P8-06)',
    events: [
      {
        type: 'chest',
        stageTitle: '파이썬 마을',
        goal: 15,
        contents: { coins: 30, goldenKeys: 0 },
      },
    ],
  },
  {
    id: 'attendance-chest',
    label: '출석 7일째 상자 (P8-08, 방패 포함)',
    events: [
      {
        type: 'chest',
        stageTitle: '',
        goal: 0,
        contents: { coins: 30, goldenKeys: 0, shields: 1 },
        note: '7일 출석을 다 채웠어요!',
      },
    ],
  },
  {
    id: 'mission-level',
    label: '미션 받기로 레벨 업 (P8-08 공용)',
    events: [
      {
        type: 'level_up',
        level: 5,
        fromLevel: 4,
        title: getLevelTitle(5),
        coins: levelUpCoins(5),
      },
    ],
  },
  {
    id: 'phase8',
    label: '별·코인 (Phase 8)',
    events: [
      { type: 'star', stars: 3, gained: 3 },
      { type: 'coin', amount: 25 },
    ],
  },
];

/** 오버레이 견본: 카드 한 장을 연출 단계대로 그린다. "다시 보기"로 처음부터, introMs 뒤 끝 상태 */
function CardSample({
  kind,
  variant,
  label,
  round,
  children,
}: {
  kind: string;
  /** 같은 카드의 다른 견본 (data-testid 구분) */
  variant?: string;
  label: string;
  round: number;
  children: (settled: boolean) => React.ReactNode;
}) {
  return (
    <figure className="m-0 grid min-w-0 content-start gap-2">
      <figcaption className="text-caption font-semibold text-muted-foreground">
        {label}
      </figcaption>
      <div
        className="rounded-2xl bg-scrim px-3 py-6"
        data-testid={`catalog-cel-${kind}${variant ? `-${variant}` : ''}`}
      >
        {/* 견본은 늘 깔려 있어 버튼이 포커스를 가져가지 않음 (휴식 알림 등 다른 대화 상자의 첫 초점을 뺏던 문제, B61) */}
        <CtaAutoFocus.Provider value={false}>
          <SettledCard key={round} kind={kind}>
            {children}
          </SettledCard>
        </CtaAutoFocus.Provider>
      </div>
    </figure>
  );
}

function SettledCard({
  kind,
  children,
}: {
  kind: string;
  children: (settled: boolean) => React.ReactNode;
}) {
  const { budget } = useMotionTier();
  const ms = budget.springs
    ? tierDuration(introMs(CATALOG_STEPS[kind]), budget)
    : 0;
  const [settled, setSettled] = useState(ms === 0);
  useEffect(() => {
    if (ms === 0) return;
    const t = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return (
    // 견본도 실제 오버레이처럼 누르면 끝 모습 (키보드 건너뛰기는 실제 오버레이 버튼으로)
    <div
      className="cel-card"
      data-kind={kind}
      data-settled={settled || ms === 0 || undefined}
      onClick={() => setSettled(true)}
    >
      {children(settled || ms === 0)}
    </div>
  );
}

const first = (events: CelebrationEvent[]) => planCelebrations(events)[0];
/** 견본마다 등장 연출 길이를 실제 시퀀서와 같게 (introMs) */
const CATALOG_STEPS: Record<string, CelebrationStep> = {
  stage_clear: first([{ type: 'stage_clear', stage: STAGE }]),
  level_up: first([
    {
      type: 'level_up',
      level: 3,
      fromLevel: 2,
      title: getLevelTitle(3),
      coins: levelUpCoins(3),
    },
  ]),
  badges: first([
    { type: 'badge', badge: SAMPLE_ACHIEVEMENTS.error_1 },
    { type: 'badge', badge: SAMPLE_ACHIEVEMENTS.quests_10 },
    { type: 'badge', badge: SAMPLE_ACHIEVEMENTS.quests_30 },
  ]),
  golden_key: first([
    { type: 'golden_key', kind: 'code', questTitle: '변수 상자' },
  ]),
  project_complete: first([
    {
      type: 'project_complete',
      questTitle: '나만의 소개 카드',
      xpGained: 120,
      stage: { ...STAGE, order: 7, title: '마을 축제' },
    },
  ]),
  rewards: first([
    { type: 'star', stars: 2, gained: 2 },
    { type: 'coin', amount: 25 },
  ]),
  chest: {
    kind: 'chest',
    id: 'catalog-chest',
    event: {
      type: 'chest',
      stageTitle: '파이썬 마을',
      goal: 15,
      contents: { coins: 30, goldenKeys: 0 },
    },
  },
};

/** 축하 오버레이 (P6-13): 카드 7종 견본 + 실제 오버레이 */
export function CelebrationSection() {
  const [round, setRound] = useState(0);
  const [events, setEvents] = useState<CelebrationEvent[]>([]);
  const { budget } = useMotionTier();
  return (
    <MotionProvider>
      <Section
        id="celebrations"
        kicker="퀘스트 (P6-13)"
        title="축하 오버레이"
        description="스테이지 클리어 · 레벨 업 · 업적(브론즈·실버·골드 메달 + 받기) · 황금키 · 프로젝트 완성 · 별·코인 · 보물상자. 같은 카드 껍데기(흰 면, 테두리 없음, 그림자 한 종류)에 제목만 Jua, 금색은 보상에만. 카드 안 연출은 1회성 CSS(transform만)라 등장 중 아무 데나 누르거나 Enter·Space·Esc면 끝 모습으로 건너뛰고, 그다음 Enter·Space는 다음 카드, Esc는 모두 닫기. 스테이지를 끝낸 카드는 맨 뒤에 와서 “지도에서 새 길 보기”가 월드맵 해제 연출로 이어져요. 레벨 업 카드는 칭호 도장 뒤에 받은 레벨 업 코인(레벨마다 20, 5레벨마다 100, 여러 레벨을 넘으면 합)이 보상 알약으로 톡 튀어 0부터 올라가요(P8-04). 보물상자(P8-06)는 스테이지 시트의 “열기”로 열면 월드맵 위에 떠요 — 안에 든 것(코인 30, 마지막 스테이지 50)을 미리 보여 준 그대로 받아요(내용 공개형)."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setRound((r) => r + 1)}
            variant="secondary"
            size="sm"
            sfx={false}
            icon={<RotateCcw aria-hidden />}
            data-testid="celebration-replay"
          >
            다시 보기
          </Button>
          {SEQUENCES.map((s) => (
            <Button
              key={s.id}
              onClick={() => setEvents(s.events)}
              size="sm"
              sfx={false}
              icon={<Play aria-hidden />}
              data-testid={`celebration-open-${s.id}`}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <CardSample kind="level_up" label="레벨 업" round={round}>
            {(settled) => (
              <LevelUpCard
                level={3}
                fromLevel={2}
                title={getLevelTitle(3)}
                coins={levelUpCoins(3)}
                budget={budget}
                settled={settled}
                onNext={noop}
              />
            )}
          </CardSample>
          <CardSample
            kind="level_up"
            variant="big"
            label="레벨 업 · 5레벨마다 큰 칭호 (금색 도장) · 두 레벨을 한 번에 넘어 코인 120"
            round={round}
          >
            {(settled) => (
              <LevelUpCard
                level={10}
                fromLevel={8}
                title={getLevelTitle(10)}
                coins={levelUpCoins(9) + levelUpCoins(10)}
                budget={budget}
                settled={settled}
                onNext={noop}
              />
            )}
          </CardSample>
          <CardSample
            kind="badges"
            label="업적 3개 (브론즈·실버·골드, P8-09) — 받기"
            round={round}
          >
            {() => (
              <BadgesCard
                badges={[
                  SAMPLE_ACHIEVEMENTS.error_1,
                  SAMPLE_ACHIEVEMENTS.quests_10,
                  SAMPLE_ACHIEVEMENTS.quests_30,
                ]}
                onNext={noop}
                request={claimDemo}
              />
            )}
          </CardSample>
          <CardSample
            kind="badges"
            variant="one"
            label="업적 1개 (첫 에러 친구)"
            round={round}
          >
            {() => (
              <BadgesCard
                badges={[SAMPLE_ACHIEVEMENTS.error_1]}
                onNext={noop}
                request={claimDemo}
              />
            )}
          </CardSample>
          <CardSample kind="stage_clear" label="스테이지 클리어" round={round}>
            {(settled) => (
              <StageClearCard
                stage={STAGE}
                questId="catalog"
                budget={budget}
                settled={settled}
                worldHref={HERE}
                onNext={noop}
                summary={SUMMARY}
              />
            )}
          </CardSample>
          <CardSample kind="golden_key" label="황금키 확인" round={round}>
            {() => (
              <GoldenKeyCard kind="code" questTitle="변수 상자" onNext={noop} />
            )}
          </CardSample>
          <CardSample
            kind="project_complete"
            label="프로젝트 완성 + 스테이지 끝"
            round={round}
          >
            {(settled) => (
              <ProjectCompleteCard
                questTitle="나만의 소개 카드"
                xpGained={120}
                stage={{ ...STAGE, order: 7, title: '마을 축제' }}
                budget={budget}
                settled={settled}
                worldHref={HERE}
                onNext={noop}
              />
            )}
          </CardSample>
          <CardSample kind="rewards" label="별·코인 (Phase 8, Q52)" round={round}>
            {(settled) => (
              <RewardsCard
                stars={{ stars: 2, gained: 2 }}
                coins={25}
                budget={budget}
                settled={settled}
                onNext={noop}
              />
            )}
          </CardSample>
          <CardSample
            kind="chest"
            label="보물상자 (P8-06, 스테이지 시트의 “열기”)"
            round={round}
          >
            {(settled) => (
              <ChestCard
                stageTitle="파이썬 마을"
                goal={15}
                contents={{ coins: 30, goldenKeys: 0 }}
                budget={budget}
                settled={settled}
                onNext={noop}
              />
            )}
          </CardSample>
        </div>

        <CodeSample
          code={`// QuestWorkspace: 받은 축하가 있을 때만 지연 로드 + memo\n{session.celebrations.length > 0 && (\n  <QuestCelebrations events={session.celebrations} questId={quest.id}\n    worldHref={worldHref} onDismiss={session.dismissCelebrations} />\n)}\n// 순서: 황금키 → 레벨 업 → 뱃지 → 별·코인 → 보물상자 → 스테이지를 끝낸 카드(지도로)`}
        />

        {/* 카탈로그 절은 쌓임 맥락 안이라 실제 화면처럼 body에 띄운다 (위 고정 막대보다 위) */}
        {events.length > 0 &&
          createPortal(
            <QuestCelebrations
              events={events}
              questId="catalog"
              worldHref={HERE}
              onDismiss={() => setEvents([])}
            />,
            document.body,
          )}
      </Section>
    </MotionProvider>
  );
}
