'use client';

import { m, type Variants } from 'framer-motion';
import type { StageWithStatus } from '@/lib/types/database';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { MotionBudget } from '@/lib/motion/tier';
import { EASE, sec } from '@/lib/motion/tokens';
import { StageNode } from './StageNode';
import { WindingPath } from './WindingPath';
import { FloatingDecorations } from './FloatingDecorations';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { WorldMapConfig } from '@/lib/content/schema';
import { mapPath, nodePercent } from '@/lib/world/worlds';

/** i번째 노드 자리: 레이아웃마다 CSS 변수로 넘기고 .world-node(app.css)가 화면 너비에 맞는 쪽을 씀 */
function nodeVars(map: WorldMapConfig, i: number): React.CSSProperties {
  const { wide, tall } = map.layouts;
  const w = nodePercent(wide, wide.nodes[i]);
  const t = nodePercent(tall, tall.nodes[i]);
  return {
    '--wl': w.left,
    '--wt': w.top,
    '--tl': t.left,
    '--tt': t.top,
  } as React.CSSProperties;
}

/** 노드 차례 등장: full 크기+투명도, lite 70% 길이, minimal 페이드만, 동작 줄이기 즉시 (P2-15) */
function nodeVariants(budget: MotionBudget): {
  container: Variants;
  item: Variants;
} {
  const k = budget.effectDuration;
  return {
    container: {
      hidden: {},
      show: {
        transition: { staggerChildren: 0.1 * k, delayChildren: 0.3 * k },
      },
    },
    item: {
      hidden: budget.springs ? { opacity: 0, scale: 0.85 } : { opacity: 0 },
      show: {
        opacity: 1,
        scale: 1,
        transition: { duration: sec('slow') * k, ease: EASE.out },
      },
    },
  };
}

function computeProgressFraction(stages: StageWithStatus[]): number {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  let completed = 0;

  for (const stage of sorted) {
    if (stage.status === 'completed') {
      completed++;
    } else if (stage.status === 'in_progress') {
      const partial =
        stage.totalQuestCount > 0
          ? stage.completedQuestCount / stage.totalQuestCount
          : 0;
      completed += partial;
      break;
    } else {
      break;
    }
  }

  return Math.min(completed / Math.max(sorted.length - 1, 1), 1);
}

interface WorldMapProps {
  stages: StageWithStatus[];
  /** 월드 지도 설정 (content/worlds/<slug>/map.yaml, P5-03). 노드 수 = 스테이지 수는 빌드가 확인 */
  map: WorldMapConfig;
}

export function WorldMap({ stages, map }: WorldMapProps) {
  const { wide, tall } = map.layouts;
  const { budget } = useMotionTier();
  const { container, item } = nodeVariants(budget);
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const progressFraction = computeProgressFraction(stages);

  const inProgressStage = sorted.find((s) => s.status === 'in_progress');
  const inProgressIndex = inProgressStage
    ? sorted.findIndex((s) => s.id === inProgressStage.id)
    : -1;

  return (
    <div
      className="world-map relative w-full"
      style={
        {
          '--wide-ratio': `${wide.width} / ${wide.height}`,
          '--tall-ratio': `${tall.width} / ${tall.height}`,
        } as React.CSSProperties
      }
    >
      {/* 화면 읽기 프로그램용 목록 제목 (페이지 h1 "모험 지도" 아래 단계, B33) */}
      <h2 className="sr-only">모험 스테이지</h2>

      {/* 길: 레이아웃마다 하나씩, 화면 너비에 맞는 쪽만 보임 */}
      <WindingPath
        progressFraction={progressFraction}
        d={mapPath(tall.nodes, map.path)}
        width={tall.width}
        height={tall.height}
        className="lg:hidden"
      />
      <WindingPath
        progressFraction={progressFraction}
        d={mapPath(wide.nodes, map.path)}
        width={wide.width}
        height={wide.height}
        className="hidden lg:block"
      />

      {/* Floating decorations (clouds, leaves) */}
      <FloatingDecorations />

      {/* 진행 중 스테이지의 파이뱀. 통통은 CSS 대기 루프(.mascot-bob, full·lite, §2.10) */}
      {inProgressIndex >= 0 && (
        <div
          className="world-node absolute z-20 pointer-events-none"
          style={{
            ...nodeVars(map, inProgressIndex),
            // 노드 카드 위쪽 가장자리(카드 높이의 절반쯤) 위에 올라앉게
            transform: 'translate(-50%, calc(-100% - 2.25rem))',
          }}
        >
          <div className="mascot-bob">
            <CharacterAvatar character="pybaem" expression="happy" size="sm" />
          </div>
        </div>
      )}

      {/* Stage nodes */}
      <m.div
        className="absolute inset-0"
        variants={container}
        initial={budget.effectDuration === 0 ? false : 'hidden'}
        animate="show"
      >
        {sorted.map((stage, index) => (
          <m.div
            key={stage.id}
            className="world-node absolute z-10"
            // 노드 중심을 좌표에 맞춤. transform 문자열은 등장 variants 의 scale 이 덮어써서 x·y 로 줌
            style={{ ...nodeVars(map, index), x: '-50%', y: '-50%' }}
            variants={item}
          >
            <StageNode stage={stage} />
          </m.div>
        ))}
      </m.div>
    </div>
  );
}
