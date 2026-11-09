'use client';

import { useState } from 'react';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { Button } from '@/components/ui/button';
import { StageSheet } from '@/components/world/StageSheet';
import type { StageQuestItem } from '@/lib/world/mapData';
import { WorldMap } from '@/components/world/WorldMap';
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
import { ContinueButton } from '@/components/world/ContinueCta';
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
}));

// 노드 상태 5종 (P5-04): 잠김 · 열림(아직 0개) · 진행 중(링) · 통과(도장) · 보스(큰 랜드마크 + 왕관)
const NODE_STATES: [label: string, stage: StageWithStatus][] = [
  ['잠김', { ...SAMPLE[3] }],
  [
    '열림',
    { ...SAMPLE[3], status: 'in_progress', completedQuestCount: 0, stars: 0 },
  ],
  ['진행 중 (링 2/6)', SAMPLE[2]],
  ['통과', SAMPLE[1]],
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

// 차례 시트 견본 퀘스트 (P5-06): 완료 2 · 하는 중 1 · 아직, 퀴즈·휴대폰 추천 섞음. 보스 스테이지는 마지막 퀘스트가 보스
const QUEST_TITLES = [
  'if로 길 고르기',
  '참과 거짓',
  'else 문 열기',
  '비교 퀴즈',
  'elif 여러 갈래',
  '조건 합치기',
];
const SAMPLE_QUESTS: Record<string, StageQuestItem[]> = Object.fromEntries(
  SAMPLE.map((stage, si) => [
    stage.id,
    QUEST_TITLES.map((title, i) => ({
      id: `${stage.id}-q${i + 1}`,
      order: i + 1,
      title,
      quest_type: i === 3 ? 'quiz' : 'code',
      is_mobile_friendly: i === 3,
      status:
        si < 2 || i < 2 ? 'completed' : si === 2 && i === 2 ? 'in_progress' : null,
      best_stars: si < 2 || i < 2 ? 3 - (i % 2) : 0,
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

/** 지도 + "해제 보기" 버튼: 누를 때마다 지도를 새로 그려 연출을 처음부터 (기록은 보내지 않음) */
function UnlockDemo({
  map,
  theme,
  world,
}: {
  map: NonNullable<(typeof WORLDS)[number]['map']>;
  theme: string;
  world: WorldId;
}) {
  const [run, setRun] = useState(0);
  return (
    <div className="grid gap-3">
      <div>
        <Button
          variant="secondary"
          sfx={false}
          onClick={() => setRun((n) => n + 1)}
          data-testid="unlock-demo-play"
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
      />
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

// 월드맵 HUD (P5-07): 스트릭 0 · 1(오늘) · 7(오늘 아직) · 긴 닉네임 · 최고 레벨
const HUDS: [string, WorldHudProps][] = [
  ['스트릭 0일 (꺼진 불꽃) · Lv 1', { name: '파이', skin: 'green', totalXp: 40, level: 1, streak: { days: 0, today: false } }],
  ['스트릭 1일 (오늘 함) · Lv 2', { name: '코딩왕', skin: 'sky', totalXp: 180, level: 2, streak: { days: 1, today: true } }],
  ['스트릭 7일 (오늘 아직) · 긴 닉네임', { name: '아주아주긴닉네임을가진모험가', skin: 'berry', totalXp: 720, level: 4, streak: { days: 7, today: false } }],
  ['최고 레벨', { name: '모험가0427', skin: 'violet', totalXp: 1500, level: 5, streak: { days: 12, today: true } }],
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
        label="스테이지 차례 시트 (P5-06)"
        note="열린 노드를 누르면 떠요(위 지도에서도, 주소에 ?stage= 가 남아 뒤로 가기로 닫힘). 768px 미만 바텀시트, 이상 책 한 쪽. 완료 = 다시 하기, 첫 미완료 = 강조 줄 + 아래 주 버튼, 유형 태그 코드·퀴즈·보스, 휴대폰 추천(휴대폰 화면에서 진하게). 별은 Q51로 숨기고 퀘스트 수만(SHOW_STARS). 줄은 차례로 등장: full 스프링 · lite 짧게 · minimal 페이드 · 동작 줄이기 즉시"
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
            label="보스 스테이지"
            stage={BOSS_STAGE}
            quests={[
              {
                id: 'boss-q1',
                order: 1,
                title: '숫자 맞히기 게임',
                quest_type: 'project',
                is_mobile_friendly: false,
                status: null,
                best_stars: 0,
              },
            ]}
          />
        </div>
      </Demo>
      <Demo
        label="스테이지 노드 상태 5종 (P5-04)"
        note="랜드마크는 지도가 한 번만 그리고(잠김 = 연필 스케치), 노드는 버튼 + 알약 이름표 + 별 합계. 진행 중은 초록 이름표 + 번호 원 둘레 진행률 링 + 점선 고리(대기 루프 full·lite), 통과는 도장, 보스(is_final)는 큰 랜드마크 + 왕관 + 금색 번호. 잠긴 노드를 누르면 안내 쪽지"
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
        note="월드맵·책장 위에 붙어 따라오는 바(여기서는 고정 안 함). 아바타+닉네임 → 내 프로필 · 레벨 도장 + XP 바 · 스트릭 불꽃(0일이면 꺼짐, 누르면 쪽지) · 곧 열려요(코인·오늘의 미션·상점, 누르면 쪽지) · 소리 · 메뉴(공지·게시판·로그아웃 시트). 640px 미만: XP 바는 아래 가는 띠, 곧 열려요는 버튼 하나, 닉네임 줄임표. 등장 한 번(full 내려옴 · lite 페이드 · minimal·동작 줄이기 없음)"
        data-testid="world-hud-demo"
      >
        <div data-hud-demo className="grid gap-3">
          {HUDS.map(([label, props]) => (
            <div key={label} className="grid gap-1">
              <span className="text-caption text-muted-foreground">{label}</span>
              <WorldHud {...props} />
            </div>
          ))}
        </div>
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
