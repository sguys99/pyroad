'use client';

import { MotionProvider } from '@/components/providers/MotionProvider';
import { WorldMap } from '@/components/world/WorldMap';
import { StageNode } from '@/components/world/StageNode';
import { Landmark } from '@/components/world/map/MapArt';
import '@/components/world/map/worldMap.css';
import type { WorldId } from '@/lib/design/tokens';
import type { StageWithStatus } from '@/lib/types/database';
import { WORLDS } from '@/lib/world/worlds';
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
        />
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
      <CodeSample
        code={`<WorldMap stages={stages} map={world.map} theme={world.theme} world={world.order} scrollToCurrent />`}
      />
    </Section>
    </MotionProvider>
  );
}
