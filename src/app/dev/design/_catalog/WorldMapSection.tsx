'use client';

import { MotionProvider } from '@/components/providers/MotionProvider';
import { WorldMap } from '@/components/world/WorldMap';
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
  stars: 0,
  maxStars: 18,
}));

export function WorldMapSection() {
  const island = WORLDS.find((w) => w.map);
  if (!island?.map) return null;
  // 지도 노드·잉크 길은 Framer m.* 라 LazyMotion 이 필요하다 (앱은 LoggedInShell 이 감쌈)
  return (
    <MotionProvider>
    <Section
      id="world-map"
      kicker="월드 (P5-02)"
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
