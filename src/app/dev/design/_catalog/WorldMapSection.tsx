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
const BOOKS: [book: BookSummary, unlock: string, current?: boolean][] = [
  [BOOK(1, '파이썬 섬', 'open', 2), '', true],
  [BOOK(1, '파이썬 섬', 'cleared', 7), ''],
  [BOOK(2, '코드 바다', 'locked', 0), '파이썬 섬을 다 모험하면 열려요'],
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
        label="월드 책 표지 4종 · 지도 머리 (P5-01)"
        note="책장(/worlds)·지도 아래 다음 권 미리 보기가 같이 써요. 모험 중(책갈피 = 지금 읽는 책) · 다 읽었어요 · 잠김(자물쇠, 채도 낮춘 정지 그림) · 준비 중(모래시계). 열린 책은 카드 전체가 지도 링크: full은 표지가 지도 자리로 펼쳐지는 View Transition, lite는 짧은 페이드, minimal·동작 줄이기·미지원 브라우저는 그냥 이동. 360px 아래는 가로 카드, 640px부터 세로 표지"
        data-testid="world-books"
      >
        <WorldMapHead
          slug="sample"
          title="파이썬 섬"
          no={1}
          completedStages={2}
          totalStages={7}
        />
        <ol className="wb-shelf">
          {BOOKS.map(([book, unlock, current]) => (
            <li key={book.slug}>
              <WorldBook book={book} no={book.order} unlock={unlock} current={current} heading="h3" />
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
