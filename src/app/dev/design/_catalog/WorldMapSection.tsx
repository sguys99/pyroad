'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QuestCelebrations } from '@/components/quest/QuestCelebrations';
import { StageChest } from '@/components/world/StageChest';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { Button } from '@/components/ui/button';
import { StageSheet } from '@/components/world/StageSheet';
import type { StageQuestItem } from '@/lib/world/mapData';
import { WorldMap } from '@/components/world/WorldMap';
import type { PetConfig } from '@/components/world/PetSlot';
import { StageNode } from '@/components/world/StageNode';
import { Landmark } from '@/components/world/map/MapArt';
import '@/components/world/map/worldMap.css';
import type { WorldId } from '@/lib/design/tokens';
import type { StageWithStatus } from '@/lib/types/database';
import { WORLDS } from '@/lib/world/worlds';
import { WorldBook } from '@/components/world/book/WorldBook';
import { WorldMapHead } from '@/components/world/book/WorldMapHead';
import type { BookSummary } from '@/lib/world/worldBook';
import { WorldHud, type WorldHudProps } from '@/components/world/WorldHud';
import { MissionHudButton, MissionHudPlaceholder, MissionList } from '@/components/world/DailyMissions';
import type { DailyMission, DailyMissionsState } from '@/lib/world/missions';
import { AttendanceCard, AttendanceMenuSection } from '@/components/world/AttendanceCard';
import { RetroWelcomeCard } from '@/components/world/RetroWelcomeCard';
import type { AttendanceStatus } from '@/lib/world/attendance';
import { ContinueButton } from '@/components/world/ContinueCta';
import { PhoneQuizSlip } from '@/components/world/PhoneQuizPick';
import { DailyQuizCard } from '@/components/world/DailyQuizCard';
import type { DailyQuizState } from '@/lib/quest/dailyQuiz';
import { PhoneQuizToast } from '@/components/quest/PhoneQuizNote';
import type { ContinueTarget } from '@/lib/world/mapData';

// 이어하기 CTA (P5-10): 하다 만 퀘스트 · 다음 차례 · 진행 0 · 긴 퀘스트 이름
const CTA = (
  kind: ContinueTarget['kind'],
  questTitle: string,
  stageOrder = 3,
): ContinueTarget => ({
  questId: 'sample',
  questTitle,
  stageOrder,
  stageTitle: '조건의 갈림길',
  kind,
});
const CTAS: [label: string, target: ContinueTarget][] = [
  ['하다 만 퀘스트 (recent)', CTA('recent', '따옴표의 비밀')],
  ['다음 차례 (next)', CTA('next', '만약에 비가 온다면')],
  ['진행 0 (start)', CTA('start', '파이뱀에게 인사하기', 1)],
  [
    '긴 퀘스트 이름 (줄임표)',
    CTA('recent', '반복문으로 별 모양 피라미드를 아주 높이 쌓아 보기', 4),
  ],
];

// 월드 책 표지 상태 4종 (P5-01): 모험 중 · 다 읽음 · 잠김 · 준비 중
const BOOK = (
  order: number,
  title: string,
  status: BookSummary['status'],
  done: number,
): BookSummary => ({
  slug: `sample-book-${order}-${status}`,
  title,
  order,
  status,
  completedStages: done,
  totalStages: 7,
  completedQuests: done * 6,
  totalQuests: 42,
});
const BOOKS: [
  book: BookSummary,
  unlock: string,
  current?: boolean,
  fresh?: boolean,
][] = [
  [BOOK(1, '파이썬 섬', 'open', 2), '', true],
  [BOOK(1, '파이썬 섬', 'cleared', 7), ''],
  [BOOK(2, '코드 바다', 'locked', 0), '파이썬 섬을 다 모험하면 열려요'],
  // 막 열린 월드 (P5-05): 첫 스테이지 해제 연출을 아직 못 봄
  [BOOK(2, '코드 바다', 'open', 0), '', false, true],
  [BOOK(3, '메이커 시티', 'coming_soon', 0), '코드 바다를 다 모험하면 열려요'],
];
import { CodeSample, Demo, Section } from './ui';

// 월드 1 스테이지 견본: 1·2 완료, 3 진행 중, 나머지 잠김 (시안 #world 와 같은 진행)
const STAGES: [title: string, theme: string][] = [
  ['파이썬 마을 입구', 'python_village'],
  ['변수의 숲', 'variable_forest'],
  ['조건의 갈림길', 'condition_crossroad'],
  ['반복의 동굴', 'loop_cave'],
  ['리스트 호수', 'list_lake'],
  ['함수의 탑', 'function_tower'],
  ['프로젝트 왕국', 'project_kingdom'],
];
const SAMPLE: StageWithStatus[] = STAGES.map(([title, theme], i) => ({
  id: `sample-${i + 1}`,
  world_id: 'sample',
  order: i + 1,
  title,
  theme_name: theme,
  description: '',
  is_final: i === STAGES.length - 1,
  created_at: '',
  status: i < 2 ? 'completed' : i === 2 ? 'in_progress' : 'locked',
  quests: [],
  completedQuestCount: i < 2 ? 6 : i === 2 ? 2 : 0,
  totalQuestCount: 6,
  firstIncompleteQuestId: null, // 견본이라 눌러도 퀘스트로 가지 않음
  stars: i < 2 ? 17 - i * 2 : i === 2 ? 5 : 0,
  maxStars: 18,
  // 보물상자 (P8-06, 목표 13): 1단계는 연 상자, 2단계는 열 수 있음(노드에 작은 상자), 3단계는 모으는 중
  chestOpened: i === 0,
}));

// 노드 상태 5종 (P5-04): 잠김 · 열림(아직 0개) · 진행 중(링) · 통과(도장) · 보스(큰 랜드마크 + 왕관)
const NODE_STATES: [label: string, stage: StageWithStatus][] = [
  ['잠김', { ...SAMPLE[3] }],
  [
    '열림',
    { ...SAMPLE[3], status: 'in_progress', completedQuestCount: 0, stars: 0 },
  ],
  ['진행 중 (링 2/6)', SAMPLE[2]],
  ['통과 · 보물상자 열 수 있음', SAMPLE[1]],
  ['별 100% 완벽 (§12-Q65)', { ...SAMPLE[0], stars: 18 }],
  [
    '보스',
    {
      ...SAMPLE[6],
      status: 'in_progress',
      completedQuestCount: 4,
      stars: 10,
    },
  ],
];

// 차례 시트 견본 퀘스트 (P5-06): 완료 2 · 하는 중 1 · 아직, 퀴즈·폰 추천 섞음. 보스 스테이지는 마지막 퀘스트가 보스
const QUEST_TITLES = [
  ['if로 길 고르기', 'if 조건문'],
  ['참과 거짓', 'True, False'],
  ['else 문 열기', 'if-else'],
  ['비교 퀴즈', '비교 연산자 ==, !=, <, >'],
  ['elif 여러 갈래', 'if-elif-else 여러 갈래로 나누기와 들여쓰기'],
  ['조건 합치기', 'and, or, not'],
];
const dailyPick = (questId: string, review = false) => ({
  questId,
  title: '퀴즈',
  kind: 'multiple_choice' as const,
  stageOrder: 1,
  review,
});
/** 오늘의 퀴즈 카드: 처음 · 진행 중(복습 포함) · 완료 · 열린 퀴즈 없음 */
const DAILY_CARD_SAMPLES: Pick<DailyQuizState, 'picks' | 'results'>[] = [
  { picks: [dailyPick('a', true), dailyPick('b'), dailyPick('c')], results: {} },
  {
    picks: [dailyPick('a', true), dailyPick('b', true), dailyPick('c')],
    results: { a: 'correct' as const },
  },
  {
    picks: [dailyPick('a'), dailyPick('b')],
    results: { a: 'correct' as const, b: 'revealed' as const },
  },
  { picks: [], results: {} },
];

const SAMPLE_QUESTS: Record<string, StageQuestItem[]> = Object.fromEntries(
  SAMPLE.map((stage, si) => [
    stage.id,
    QUEST_TITLES.map(([title, concept], i) => ({
      id: `${stage.id}-q${i + 1}`,
      order: i + 1,
      title,
      concept,
      quest_type: i === 3 ? 'quiz' : 'code',
      quiz_kind: i === 3 ? 'multiple_choice' : null,
      is_mobile_friendly: i === 3,
      status:
        si < 2 || i < 2 ? 'completed' : si === 2 && i === 2 ? 'in_progress' : null,
      best_stars: si < 2 || i < 2 ? 3 - (i % 2) : 0,
      // 지난 판정 퀴즈 → "복습 도전 가능" 딱지 (P8-05)
      stars_judged_on: i === 3 && si < 2 ? '2026-01-01' : null,
    })),
  ]),
);
const BOSS_STAGE: StageWithStatus = {
  ...SAMPLE[6],
  status: 'in_progress',
  completedQuestCount: 0,
  stars: 0,
  description: '배운 것을 모두 모아 숫자 맞히기 게임을 만들어요.',
};

// 잠금 해제 데모 (P5-05): 2단계까지 통과 → 3단계가 막 열림 (아직 퀘스트 0개)
const SAMPLE_UNLOCKED: StageWithStatus[] = SAMPLE.map((s, i) =>
  i === 2 ? { ...s, completedQuestCount: 0, stars: 0 } : s,
);

// 동행 펫 슬롯 견본 (P5-08, 그림 P9-01): 가장 싼 펫 삐약이
const SAMPLE_PET: PetConfig = { id: 'pet_chick' };

/** 지도 + "해제 보기" 버튼: 누를 때마다 지도를 새로 그려 연출을 처음부터 (기록은 보내지 않음) */
function UnlockDemo({
  map,
  theme,
  world,
  pet,
  playId = 'unlock-demo-play',
}: {
  map: NonNullable<(typeof WORLDS)[number]['map']>;
  theme: string;
  world: WorldId;
  pet?: PetConfig;
  playId?: string;
}) {
  const [run, setRun] = useState(0);
  return (
    <div className="grid gap-3">
      <div>
        <Button
          variant="secondary"
          sfx={false}
          onClick={() => setRun((n) => n + 1)}
          data-testid={playId}
        >
          해제 보기 (데모)
        </Button>
      </div>
      <WorldMap
        key={run}
        stages={SAMPLE_UNLOCKED}
        map={map}
        theme={theme}
        world={world}
        unlocks={run ? { silent: false, stageIds: ['sample-3'] } : null}
        unlockDemo
        pet={pet}
      />
    </div>
  );
}

/**
 * 보물상자 한 줄 3상태 (P8-06) + 열기 데모: 서버 대신 30코인을 돌려주는 가짜 요청 → 실제 축하 오버레이(body에).
 * 다시 누를 수 있게 열어도 견본은 "열 수 있음" 그대로
 */
function ChestDemo() {
  const [events, setEvents] = useState<CelebrationEvent[]>([]);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useEffect(() => setPortal(document.body), []);
  const rows: [label: string, stage: StageWithStatus][] = [
    ['모으는 중', SAMPLE[2]],
    ['열 수 있음', SAMPLE[1]],
    ['열었음', SAMPLE[0]],
    ['마지막 스테이지 (코인 50)', { ...SAMPLE[6], status: 'in_progress', stars: 4 }],
    [
      '별은 모았지만 코드 퀘스트를 아직 안 풂 (§12-Q65)',
      {
        ...SAMPLE[6],
        id: 'sample-7-quiz-only',
        status: 'in_progress',
        totalQuestCount: 1,
        completedQuestCount: 0,
        maxStars: 9,
        stars: 6,
      },
    ],
  ];
  return (
    <div className="grid max-w-xl gap-3">
      {rows.map(([label, stage]) => (
        <figure key={label} className="grid gap-1" data-testid={`chest-demo-${stage.id}`}>
          <figcaption className="text-caption text-text-muted">{label}</figcaption>
          <StageChest
            stage={stage}
            onOpened={(e) => e && setEvents(e)}
            request={async () => ({ already_opened: false, coins_earned: 30 })}
          />
        </figure>
      ))}
      {portal &&
        events.length > 0 &&
        createPortal(
          <QuestCelebrations
            events={events}
            questId=""
            worldHref=""
            onDismiss={() => setEvents([])}
          />,
          portal,
        )}
    </div>
  );
}

/** 시트만 따로 열어 보기 (주소를 바꾸지 않음) */
function SheetPreview({
  label,
  stage,
  quests,
}: {
  label: string;
  stage: StageWithStatus;
  quests: StageQuestItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" sfx={false} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <StageSheet
        stage={stage}
        quests={quests}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

/** 노드 하나 + 그 랜드마크 (지도 대신 작은 종이 한 장). 지도 1단위 = 1px */
function NodeTile({ stage }: { stage: StageWithStatus }) {
  const boss = stage.is_final;
  return (
    // .wm 은 inline-size 컨테이너라 폭을 직접 줘야 한다
    <div className="wm" style={{ width: 200 }}>
      <div
        className="world-map"
        style={
          {
            '--tall-ratio': '200 / 250',
            '--tu': 'calc(100cqi / 200)',
            '--tns': 1,
          } as React.CSSProperties
        }
      >
        <div className="wm-art">
          <svg className="wm-layer" viewBox="0 0 200 250" aria-hidden>
            <g transform="translate(100 186)">
              <Landmark
                theme={stage.theme_name}
                pencil={stage.status === 'locked'}
                boss={boss}
              />
            </g>
          </svg>
        </div>
        <div
          className="world-node absolute"
          style={{ '--tl': '50%', '--tt': '72%' } as React.CSSProperties}
        >
          <StageNode stage={stage} onOpen={() => {}} />
        </div>
      </div>
    </div>
  );
}

// 데일리 미션 (P8-07): 진행 중 · 달성(받기) · 받음 + 지난 보상, 할 수 있는 미션이 없는 날
const MISSION = (
  id: string,
  title: string,
  kind: DailyMission['kind'],
  difficulty: number,
  target: number,
  progress: number,
  claimed = false,
): DailyMission => ({
  id,
  title,
  kind,
  difficulty,
  target,
  progress,
  coins: [10, 15, 20][difficulty - 1],
  xp: 15,
  claimed,
});
const MISSION_SAMPLES: [string, DailyMissionsState][] = [
  [
    '진행 중 · 달성 · 받음 + 지난 보상',
    {
      day: '2026-11-11',
      missions: [
        MISSION('quest_2', '퀘스트 2개 클리어', 'quest_clear', 2, 2, 1),
        MISSION('daily_quiz', '오늘의 퀴즈 모두 풀기', 'daily_quiz', 2, 3, 3),
        MISSION('review_1', '복습 도전 1개 끝내기', 'review', 2, 1, 1, true),
      ],
      pending: [
        { ...MISSION('no_hint_1', '힌트 없이 퀘스트 1개 클리어', 'no_hint', 2, 1, 1), day: '2026-11-10' },
        { ...MISSION('quest_3', '퀘스트 3개 클리어', 'quest_clear', 3, 3, 3), day: '2026-11-08' },
      ],
    },
  ],
  [
    '다 받음',
    {
      day: '2026-11-11',
      missions: [
        MISSION('quest_1', '퀘스트 1개 클리어', 'quest_clear', 1, 1, 1, true),
        MISSION('quiz_correct_2', '퀴즈 2개 맞히기', 'quiz_correct', 1, 2, 2, true),
        MISSION('no_hint_1', '힌트 없이 퀘스트 1개 클리어', 'no_hint', 2, 1, 1, true),
      ],
      pending: [],
    },
  ],
  ['할 수 있는 미션이 없는 날', { day: '2026-11-11', missions: [], pending: [] }],
];

/** 미션 목록 (시트 안 모양). 받기는 서버 대신 15코인 + 15 XP 를 돌려주는 가짜 요청 — 위 HUD 견본 코인 칩·레벨 도장으로 날아감 */
function MissionDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {MISSION_SAMPLES.map(([label, state]) => (
        <figure key={label} className="grid content-start gap-1" data-testid="mission-demo">
          <figcaption className="text-caption text-text-muted">{label}</figcaption>
          <div className="rounded-2xl bg-surface p-4 shadow-pop">
            <MissionList
              state={state}
              request={async () => ({
                claimed: true,
                already_claimed: false,
                mission_coins: 15,
                xp_earned: 15,
                coins_earned: 15,
                coins_balance: 0,
                total_xp: 0,
                level_before: 1,
                level_after: 1,
                level_ups: [],
              })}
              onClaimed={() => {}}
            />
          </div>
        </figure>
      ))}
    </div>
  );
}

// 출석 카드 (P8-08): 오늘 찍을 칸 · 6일 찍고 오늘 7일째(상자) · 방패가 어제를 지킴 · 메뉴 달력(가득 · 7일째 찍어 열린 상자)
const ATT = (over: Partial<AttendanceStatus>): AttendanceStatus => ({
  today: '2026-11-11',
  total: 2,
  stamped_today: false,
  day_n: 3,
  cycle: ['2026-11-07', '2026-11-09'],
  ...over,
});
const ATT_SEVEN = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08', '2026-11-10'];
const ATT_SAMPLES: [string, AttendanceStatus, number, boolean][] = [
  ['3일째 (하루 빠져도 이어짐)', ATT({}), 0, false],
  ['7일째 = 상자 (코인 30 + 방패)', ATT({ total: 6, day_n: 7, cycle: ATT_SEVEN }), 1, false],
  ['방패가 어제를 지킴', ATT({ total: 3, day_n: 4, cycle: ['2026-11-01', '2026-11-02', '2026-11-08'] }), 1, true],
];

/** 출석 카드. 도장은 서버 대신 그 칸 코인을 돌려주는 가짜 요청 — 도장 쾅·코인이 위 HUD 견본으로 날아감, 7일째는 상자 카드 */
function AttendanceDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {ATT_SAMPLES.map(([label, status, shields, saved]) => (
        <figure key={label} className="grid content-start gap-1" data-testid="attendance-demo">
          <figcaption className="text-caption text-text-muted">{label}</figcaption>
          <AttendanceCard
            status={status}
            shields={shields}
            shieldSaved={saved}
            request={async () => ({
              stamped: true,
              already_stamped: false,
              day_n: status.day_n,
              coins_earned: [5, 5, 10, 10, 15, 20, 30][status.day_n - 1],
              coins_balance: 0,
              shield_granted: status.day_n === 7 ? 1 : 0,
              shields: shields + (status.day_n === 7 ? 1 : 0),
            })}
            onStamped={() => {}}
          />
        </figure>
      ))}
      <figure className="grid content-start gap-1">
        <figcaption className="text-caption text-text-muted">메뉴 시트 달력 (찍은 뒤 · 방패 가득)</figcaption>
        <div className="rounded-2xl bg-surface p-4 shadow-pop">
          <AttendanceMenuSection status={ATT({ stamped_today: true, total: 3, day_n: 3, cycle: ['2026-11-07', '2026-11-09', '2026-11-11'] })} shields={2} />
        </div>
      </figure>
      <figure className="grid content-start gap-1" data-testid="attendance-menu-seventh">
        <figcaption className="text-caption text-text-muted">메뉴 시트 달력 (7일째 찍음 · 열린 상자 표시)</figcaption>
        <div className="rounded-2xl bg-surface p-4 shadow-pop">
          <AttendanceMenuSection status={ATT({ stamped_today: true, total: 7, day_n: 7, cycle: [...ATT_SEVEN, '2026-11-11'] })} shields={1} />
        </div>
      </figure>
    </div>
  );
}

// 그동안의 모험 보상 (P8-11): 별·코인 + 받을 업적 · 레벨 업 코인만(별 없음). 닫기는 서버 대신 아무것도 안 함(다시 보려면 새로 고침)
const RETRO_SAMPLES: [string, { stars: number; coins: number }, number][] = [
  ['별·코인 + 받을 업적 3개', { stars: 42, coins: 1385 }, 3],
  ['레벨 업 코인만 (별 보상 없음)', { stars: 0, coins: 140 }, 0],
];

function RetroDemo() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {RETRO_SAMPLES.map(([label, retro, ready]) => (
        <figure key={label} className="grid content-start gap-1" data-testid="retro-demo">
          <figcaption className="text-caption text-text-muted">{label}</figcaption>
          <RetroWelcomeCard retro={retro} achievementsReady={ready} onDismiss={() => {}} />
        </figure>
      ))}
    </div>
  );
}

// 월드맵 HUD (P5-07): 스트릭 0 · 1(오늘) · 7(오늘 아직) · 긴 닉네임 · 최고 레벨. 코인 0 · 45 · 1,280 · 12.3만(640px 미만 줄여 씀, P8-04)
const HUDS: [string, WorldHudProps][] = [
  ['스트릭 0일 (꺼진 불꽃) · Lv 1', { name: '파이', totalXp: 40, level: 1, coins: 0, streak: { days: 0, today: false } }],
  ['스트릭 1일 (오늘 함) · Lv 2', { name: '코딩왕', totalXp: 280, level: 2, coins: 45, streak: { days: 1, today: true } }],
  ['스트릭 7일 (오늘 아직) · 긴 닉네임', { name: '아주아주긴닉네임을가진모험가', totalXp: 1000, level: 4, coins: 1280, streak: { days: 7, today: false } }],
  ['최고 레벨', { name: '모험가0427', totalXp: 31500, level: 50, coins: 123456, streak: { days: 12, today: true } }],
  ['오늘의 미션 1/3 (P8-07)', { name: '파이', totalXp: 280, level: 2, coins: 45, streak: { days: 1, today: true }, missions: <MissionHudButton state={{ day: '2026-11-11', missions: [MISSION('quest_2', '퀘스트 2개 클리어', 'quest_clear', 2, 2, 1), MISSION('review_1', '복습 도전 1개 끝내기', 'review', 2, 1, 1, true), MISSION('no_hint_1', '힌트 없이 퀘스트 1개 클리어', 'no_hint', 2, 1, 0)], pending: [] }} /> }],
  ['받을 보상 있음 (금색 점)', { name: '코딩왕', totalXp: 1000, level: 4, coins: 1280, streak: { days: 7, today: false }, missions: <MissionHudButton state={MISSION_SAMPLES[0][1]} /> }],
  ['스트릭 방패 2개 · 어제를 방패가 지킴 (P8-08, 불꽃을 누르면 쪽지)', { name: '파이', totalXp: 280, level: 2, coins: 45, streak: { days: 5, today: false }, shields: 2, shieldSaved: true }],
  ['미션 읽는 중 (자리만)', { name: '파이', totalXp: 40, level: 1, coins: 0, streak: { days: 0, today: false }, missions: <MissionHudPlaceholder /> }],
];

export function WorldMapSection() {
  const island = WORLDS.find((w) => w.map);
  if (!island?.map) return null;
  // 지도 노드·잉크 길은 Framer m.* 라 LazyMotion 이 필요하다 (앱은 LoggedInShell 이 감쌈)
  return (
    <MotionProvider>
    <Section
      id="world-map"
      kicker="월드 (P5-02·P5-04)"
      title="월드 지도"
      description="두루마리 보물지도: 종이 결 바탕 + 깊이별 SVG 레이어(먼 곳·중간·길). 바탕 그림은 world.yaml theme, 장식은 map.yaml decorations, 랜드마크는 스테이지 theme_name으로 그려요. 지도 폭 900px부터 가로 지도, 그 아래는 세로로 긴 지도. 패럴랙스(스크롤)는 full만, lite·minimal·동작 줄이기는 정지 배경. 잠긴 곳은 연필 스케치."
    >
      <Demo
        label={`월드 ${island.order} · ${island.title} (${island.map.layouts.wide.width}×${island.map.layouts.wide.height} / ${island.map.layouts.tall.width}×${island.map.layouts.tall.height})`}
        note="견본 진행: 1·2 완료, 3 진행 중. 지난 길은 잉크, 남은 길은 연필 점선"
        data-testid="world-map-1"
      >
        <WorldMap
          stages={SAMPLE}
          map={island.map}
          theme={island.theme}
          world={island.order as WorldId}
          questsByStage={SAMPLE_QUESTS}
        />
      </Demo>
      <Demo
        label="잠금 해제 연출 (P5-05)"
        note="새로 열린 스테이지에서 한 번만: 이전 노드 통과 도장 쾅 → 잉크 길 → 자물쇠가 흔들리다 깨짐 → 잉크 방울이 떨어져 스케치가 컬러로 → 파이뱀이 길을 따라 깡충 2번 → 이름표 팝 + '열렸어요!' 도장 + 문구 토스트. 화면 밖이면 먼저 스크롤, 누르거나 Enter·Space·Esc면 끝 상태로. full 약 3.5초 · lite 약 2.2초(흔들림·방울·조각 없음, 둥근 번짐, 미끄러져 이동) · minimal·동작 줄이기는 바로 끝 상태 + 문구만. 본 기록은 서버(user_seen_unlocks, 데모는 저장 안 함)"
        data-testid="world-unlock-demo"
      >
        <UnlockDemo
          map={island.map}
          theme={island.theme}
          world={island.order as WorldId}
        />
      </Demo>
      <Demo
        label="동행 펫 슬롯 (P5-08 · 그림 P9-01)"
        note="운영 지도는 데려간 펫(avatar_config.pet, P9-05 useMyLook) — pet 을 주지 않으면 그것을 씀. 견본 펫 삐약이가 파이뱀 발치 바깥쪽 뒤에 서고, 지도 밖이면 노드 쪽으로. 해제 연출에서 full은 0.16초 늦게 같은 길을 작게 깡충, lite는 같이 미끄러짐, minimal·동작 줄이기는 바로 새 자리"
        data-testid="world-pet-demo"
      >
        <UnlockDemo
          map={island.map}
          theme={island.theme}
          world={island.order as WorldId}
          pet={SAMPLE_PET}
          playId="pet-demo-play"
        />
      </Demo>
      <Demo
        label="스테이지 차례 시트 (P5-06)"
        note="열린 노드를 누르면 떠요(위 지도에서도, 주소에 ?stage= 가 남아 뒤로 가기로 닫힘). 768px 미만 바텀시트, 이상 책 한 쪽. 완료 = 다시 하기, 첫 미완료 = 강조 줄 + 아래 주 버튼, 유형 태그 코드·퀴즈(종류 이름·아이콘, P7-11)·보스, 휴대폰·태블릿 폭에서 폰에서 하기 좋아요 태그(휴대폰은 진하게). 퀴즈가 있으면 목록 아래 보너스 안내 한 줄. 별(SHOW_STARS, P8-05): 요약에 별 합계, 완료 줄에 최고 별(기존 완료라 아직 0이면 그리지 않음, P8-11 소급). 별 3개 미만 퀘스트·퀴즈는 판정 다음 날(KST)부터 금색 테두리 “복습 도전 가능” 딱지(§12-Q64, 통과한 스테이지 견본). 복습 도전은 처음 뼈대 코드에서 시작. 줄은 차례로 등장: full 스프링 · lite 짧게 · minimal 페이드 · 동작 줄이기 즉시"
        data-testid="stage-sheet-demo"
      >
        <div className="flex flex-wrap gap-3">
          <SheetPreview
            label="진행 중 스테이지"
            stage={{ ...SAMPLE[2], description: '갈림길에서 조건으로 길을 골라요.' }}
            quests={SAMPLE_QUESTS[SAMPLE[2].id]}
          />
          <SheetPreview
            label="통과한 스테이지"
            stage={SAMPLE[1]}
            quests={SAMPLE_QUESTS[SAMPLE[1].id]}
          />
          <SheetPreview
            label="별 100% 스테이지"
            stage={{ ...SAMPLE[0], stars: 18 }}
            quests={SAMPLE_QUESTS[SAMPLE[0].id] ?? []}
          />
          <SheetPreview
            label="보스 스테이지"
            stage={BOSS_STAGE}
            quests={[
              {
                id: 'boss-q1',
                order: 1,
                title: '숫자 맞히기 게임',
                concept: '종합 프로젝트',
                quest_type: 'project',
                quiz_kind: null,
                is_mobile_friendly: false,
                status: null,
                best_stars: 0,
              },
            ]}
          />
        </div>
      </Demo>
      <Demo
        label="스테이지 보물상자 (P8-06)"
        note="스테이지 시트 진행 요약 아래 한 줄. 별 합계(보너스 퀴즈 별 포함)/목표 = 코드 퀘스트 수 × 3의 70% 올림(코드 퀘스트만으로 닿음, 7개면 15⭐). 내용 공개형(§2.6): 안에 든 것(코인 30, 마지막 스테이지 50)을 열기 전부터 보여 줘요. 목표를 채우면 금색 테두리 + 상자가 가끔 들썩·반짝(full·lite, minimal·동작 줄이기는 멈춘 반짝 점) + 금색 “열기”(받기 버튼, §12-Q62 ③). 별을 채웠어도 그 스테이지 코드 퀘스트를 하나도 안 풀었으면 잠긴 채 “코드 퀘스트를 하나 풀면 열려요”(§12-Q65 (c) — 퀴즈 별만으로 마지막 스테이지 상자를 여는 길을 막음). 열면 서버(open_stage_chest)가 별을 다시 세어 원장에 한 번만 지급 → 시트를 닫고 지도 위에 보물상자 축하 카드(뚜껑 들썩 → 열림 → 코인 톡, 효과음 chest, 컨페티). 지도 노드에는 별 합계 옆 작은 상자만. 여기 “열기”는 가짜 요청으로 실제 오버레이를 띄워요"
        data-testid="stage-chest-demo"
      >
        <ChestDemo />
      </Demo>
      <Demo
        label="스테이지 노드 상태 5종 (P5-04)"
        note="랜드마크는 지도가 한 번만 그리고(잠김 = 연필 스케치), 노드는 버튼 + 알약 이름표 + 별 합계. 진행 중은 초록 이름표 + 번호 원 둘레 진행률 링 + 점선 고리(대기 루프 full·lite), 통과는 도장, 보스(is_final)는 큰 랜드마크 + 왕관 + 금색 번호. 별 100%(퀴즈 포함 모든 별 3개, §12-Q65 (d))는 별 알약 금색 테두리 + 작은 왕관(움직임 없음, 코인 없이 업적 “완벽한 스테이지”), 시트 요약 아래 “완벽해요!” 알약. 잠긴 노드를 누르면 안내 쪽지"
        data-testid="world-node-states"
      >
        <div className="flex flex-wrap gap-4">
          {NODE_STATES.map(([label, stage]) => (
            <figure key={label} className="grid justify-items-center gap-1">
              <NodeTile stage={stage} />
              <figcaption className="text-caption text-text-muted">
                {label}
              </figcaption>
            </figure>
          ))}
        </div>
      </Demo>
      <div className="grid gap-4 md:grid-cols-2">
        {WORLDS.filter((w) => !w.map).map((w) => (
          <Demo
            key={w.slug}
            label={`월드 ${w.order} · ${w.title} 틴트 (theme: ${w.theme})`}
            note="지도는 아직 없어 월드 1 배치에 이 월드의 틴트만 입혀 봐요. 바탕 그림은 MapArt THEME_BASE에 테마 키로 더해요"
            data-testid={`world-map-${w.order}`}
          >
            <WorldMap
              stages={SAMPLE}
              map={island.map!}
              theme={w.theme}
              world={w.order as WorldId}
            />
          </Demo>
        ))}
      </div>
      <Demo
        label="월드맵 HUD (P5-07)"
        note="월드맵·책장 위에 붙어 따라오는 바(여기서는 고정 안 함). 아바타+닉네임 → 내 프로필 · 레벨 도장 + XP 바 · 스트릭 불꽃(0일이면 꺼짐, 누르면 쪽지) · 코인 잔액(P8-04: 퀘스트에서 받고 지도로 돌아오면 이 탭에서 마지막으로 본 값부터 카운트업 + 칩 팝, minimal·동작 줄이기는 바로 바꾸고 금색 틴트) · 오늘의 미션 칸(P8-07, 달성 수 · 받을 보상 금색 점 → 미션 시트) · 스트릭 방패(P8-08, 불꽃 칩 오른쪽 위 작은 방패 1~2개, 칩 폭 그대로) · 불꽃 반짝임(P8-08: 오늘 풀어 처음 켜진 날·3일이 된 날 한 번 — full 톡 커지며 금색 둘레 2번 · lite 둘레 1번 · minimal·동작 줄이기 없음, 이 기기에서 본 값은 localStorage) · 곧 열려요(상점, 누르면 쪽지) · 소리 · 메뉴(공지·게시판·로그아웃 시트). 1024px 미만: 곧 열려요는 버튼 하나. 640px 미만: XP 바는 아래 가는 띠, 코인 1만 이상은 “12.3만”, 곧 열려요는 빠지고(코인 칩 자리) 닉네임 줄임표, 400px 미만은 아바타만. 등장 한 번(full 내려옴 · lite 페이드 · minimal·동작 줄이기 없음)"
        data-testid="world-hud-demo"
      >
        {/* HUD 는 화면 폭 기준(미디어 쿼리)이라 카드 안(360px 화면에서 약 296px)보다 넓을 수 있음 → 견본 안에서만 가로로 밀어 봄 (B73) */}
        <div data-hud-demo className="grid gap-3 overflow-x-auto">
          {HUDS.map(([label, props]) => (
            <div key={label} className="grid gap-1">
              <span className="text-caption text-muted-foreground">{label}</span>
              <WorldHud {...props} />
            </div>
          ))}
        </div>
      </Demo>
      <Demo
        label="데일리 미션 (P8-07)"
        note="HUD 미션 칸(달성 수, 받을 보상이 있으면 금색 테두리·점, 640px 미만은 아이콘만) → 시트. 미션마다 종류 아이콘 · 이름 · 난이도 점 · 진행 막대 · 보상(코인 10·15·20 + XP 15). 달성하면 금색 면 + 받기(서버가 다시 세어 지급), 받으면 코인 소리 + 코인·XP 가 HUD 로 날아감(full 3개·lite 1개, minimal·동작 줄이기는 없음 — HUD 칩 색 반짝임) + 카운트업. 지난 6일 달성·안 받은 보상은 '지난 보상'으로 남음. 아래는 자정까지 남은 시간"
        data-testid="mission-list-demo"
      >
        <MissionDemo />
      </Demo>
      <Demo
        label="출석 도장 (P8-08)"
        note="월드맵 맨 위(오늘의 퀴즈 위), 오늘 출석 전일 때만. 7칸 달력은 누적 출석으로 채워 하루 빠져도 이어짐(칸 코인 5·5·10·10·15·20·30), 오늘 칸은 금색 점선, 7일째 상자에 든 것(코인 30 + 스트릭 방패 1개, 방패는 최대 2개)을 미리 글자로. '출석 도장 꾹!' → 오늘 칸에 금색 '출석' 도장 쾅(온보딩·통과 도장과 같은 stampSlam: full 내려찍기+종이 떨림+방울 · lite 짧게 · minimal 페이드 · 동작 줄이기 제자리) + 코인 소리 + 코인이 HUD 로(full 3개·lite 1개) → HUD 카운트업. 7일째는 도장 뒤 상자 카드(보물상자와 같은 ChestCard, 방패 포함). 찍은 뒤엔 이 방문 동안 완료 모습(닫기), 다음부터는 메뉴 시트 달력에서 봄. 어제를 방패가 메웠으면 '방패가 불꽃을 지켜 줬어요'. XP 없음"
        data-testid="attendance-demo-section"
      >
        <AttendanceDemo />
      </Demo>
      <Demo
        label="그동안의 모험 보상 (P8-11)"
        note="새 보상 규칙 전에 모험한 사용자에게 한 번(00037 소급이 코인을 준 사람만), 출석 카드 위. 소급 코인은 이미 잔액에 들어가 있어 받기 대신 '좋아요!'로 닫음(서버 본 기록, 다음 방문부터 없음). 별 보상 = 코인을 받은 별 수(황금키 별 제외), 코인 = 퀘스트 첫 완료·별·레벨 업 합. 소급 판정한 업적은 축하 카드 없이 도감 '받기 가능'이라 그 수와 '업적 보러 가기'. 출석 카드와 같은 쪽지 모양"
        data-testid="retro-demo-section"
      >
        <RetroDemo />
      </Demo>
      <Demo
        label="이어하기 CTA (P5-10)"
        note="지도 머리 오른쪽 주 버튼(1024px 이상은 이것만) + 1024px 미만은 머리 버튼이 HUD 밑으로 지나가면 아래 가운데 떠 있는 버튼(파이뱀 얼굴). 대상: 열린 스테이지에서 가장 늦게 시작한 미완료 퀘스트 → 없으면 다음 차례 → 진행 0이면 '모험 시작하기'. 다 깼으면 없음. 아래 가운데 쪽지가 뜨면 떠 있는 버튼은 비켜 줌. full 미끄러져 올라옴 · minimal 페이드 · 동작 줄이기 즉시"
        data-testid="continue-cta-demo"
      >
        <div className="grid gap-4">
          {CTAS.map(([label, target]) => (
            <div key={label} className="flex flex-wrap items-center gap-3">
              <span className="w-44 text-caption text-muted-foreground">
                {label}
              </span>
              <ContinueButton target={target} place="head" />
              <ContinueButton target={target} place="float" />
            </div>
          ))}
        </div>
      </Demo>
      <Demo
        label="오늘의 퀴즈 카드 (P7-10)"
        note="월드맵 맨 위(지도 머리보다 위, 모바일·데스크톱 같음). 남은 수 · 진행 칸 · 복습 n개 포함 → /daily. 다 풀면 초록 도장 '오늘 퀴즈 완료', 열린 퀴즈가 없으면 회색 안내만. 왼쪽 금색 띠라 폰 퀴즈 추천(점선, 지도 머리 아래)과 모양·자리가 다름"
        data-testid="daily-card-demo"
      >
        <div className="grid max-w-md gap-1">
          {DAILY_CARD_SAMPLES.map((d, i) => (
            <DailyQuizCard key={i} daily={d} />
          ))}
        </div>
      </Demo>
      <Demo
        label="폰 퀴즈 추천 (P7-11)"
        note="휴대폰·태블릿(1024px 미만 또는 터치, 코드 키보드와 같은 판정)에서만. 이어하기가 코드 퀘스트이고 열린 스테이지에 풀 만한 퀴즈가 있으면 지도 머리(이어하기) 아래 보조 쪽지 한 장 — 이어하기 스테이지의 안 푼 퀴즈 → 그 스테이지 별 3개 미만 복습 → 가까운 다른 스테이지. 코드 퀘스트는 그대로 주 버튼. 코드 퀘스트 첫 진입에는 아래 가운데 쪽지 한 번(이 기기에선 다시 안 뜸). 쪽지 등장: full 스프링 · lite 짧게 · minimal 페이드 · 동작 줄이기 즉시"
        data-testid="phone-quiz-demo"
      >
        <div className="grid max-w-md gap-4">
          <span className="text-caption text-muted-foreground">
            월드맵: 이어하기 아래 (안 푼 퀴즈 · 복습)
          </span>
          <div>
            <ContinueButton target={CTAS[0][1]} place="head" />
            <PhoneQuizSlip
              pick={{
                questId: 'sample',
                title: '비교 퀴즈',
                kind: 'multiple_choice',
                stageOrder: 3,
                review: false,
              }}
            />
            <PhoneQuizSlip
              pick={{
                questId: 'sample',
                title: '반복문 버그를 잡아라 — 끝나지 않는 while',
                kind: 'bug_hunt',
                stageOrder: 4,
                review: true,
              }}
            />
          </div>
          <span className="text-caption text-muted-foreground">
            코드 퀘스트 첫 진입 쪽지
          </span>
          <PhoneQuizToast count={3} href="#" onClose={() => {}} />
        </div>
      </Demo>
      <Demo
        label="월드 책 표지 5종 · 지도 머리 (P5-01·P5-05)"
        note="책장(/worlds)·지도 아래 다음 권 미리 보기가 같이 써요. 모험 중(책갈피 = 지금 읽는 책) · 새로 열렸어요(첫 스테이지 해제 연출을 아직 못 본 월드, P5-05) · 다 읽었어요 · 잠김(자물쇠, 채도 낮춘 정지 그림) · 준비 중(모래시계). 열린 책은 카드 전체가 지도 링크: full은 표지가 지도 자리로 펼쳐지는 View Transition, lite는 짧은 페이드, minimal·동작 줄이기·미지원 브라우저는 그냥 이동. 360px 아래는 가로 카드, 640px부터 세로 표지"
        data-testid="world-books"
      >
        <WorldMapHead
          slug="sample"
          title="파이썬 섬"
          no={1}
          completedStages={2}
          totalStages={7}
          continueTarget={CTAS[0][1]}
        />
        <ol className="wb-shelf">
          {BOOKS.map(([book, unlock, current, fresh]) => (
            <li key={book.slug}>
              <WorldBook book={book} no={book.order} unlock={unlock} current={current} fresh={fresh} heading="h3" />
            </li>
          ))}
        </ol>
      </Demo>
      <CodeSample
        code={`<WorldMap stages={stages} map={world.map} theme={world.theme} world={world.order} scrollToCurrent />`}
      />
    </Section>
    </MotionProvider>
  );
}
