'use client';

import { useEffect, useRef } from 'react';
import { m, type Variants } from 'framer-motion';
import type { StageWithStatus } from '@/lib/types/database';
import type { WorldId } from '@/lib/design/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { MotionBudget } from '@/lib/motion/tier';
import { EASE, sec } from '@/lib/motion/tokens';
import { StageNode } from './StageNode';
import { FloatingDecorations } from './FloatingDecorations';
import { MapArt, type LayoutName } from './map/MapArt';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { WorldMapConfig } from '@/lib/content/schema';
import { mapRoute, nodePercent } from '@/lib/world/worlds';
import './map/worldMap.css';

/** i번째 노드 자리: 레이아웃마다 CSS 변수로 넘기고 .world-node(worldMap.css)가 지도 폭에 맞는 쪽을 씀 */
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

/**
 * 지도 레이어 패럴랙스 (full만, budget.parallax): 스크롤할 때만 rAF 한 번에 지도 가운데와 화면 가운데의 거리(--ms, px)를 쓴다.
 * 이동은 CSS transform(.wm-par). 멈추면 아무것도 돌지 않는다 (대기 CPU 0, §2.10)
 */
function useMapParallax(
  ref: React.RefObject<HTMLDivElement | null>,
  on: boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let id = 0;
    let last = NaN;
    const frame = () => {
      id = 0;
      const r = el.getBoundingClientRect();
      const v = Math.round(
        Math.max(
          -2000,
          Math.min(2000, window.innerHeight / 2 - (r.top + r.height / 2)),
        ),
      );
      if (v !== last) el.style.setProperty('--ms', String((last = v)));
    };
    const kick = () => {
      if (!id) id = requestAnimationFrame(frame);
    };
    kick();
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick, { passive: true });
    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      cancelAnimationFrame(id);
      el.style.removeProperty('--ms');
    };
  }, [ref, on]);
}

interface WorldMapProps {
  stages: StageWithStatus[];
  /** 월드 지도 설정 (content/worlds/<slug>/map.yaml, P5-03). 노드 수 = 스테이지 수는 빌드가 확인 */
  map: WorldMapConfig;
  /** world.yaml theme: 바탕 그림(해안선 등)을 고른다. 모르는 키면 종이 바탕 + 장식만 */
  theme?: string;
  /** 월드 번호 → data-world (지도 틴트) */
  world?: WorldId;
  /** 처음 열 때 지금 스테이지가 화면 밖이면 그쪽으로 스크롤 (세로로 긴 모바일 지도). 월드맵 페이지만 */
  scrollToCurrent?: boolean;
}

export function WorldMap({
  stages,
  map,
  theme = '',
  world,
  scrollToCurrent,
}: WorldMapProps) {
  const { wide, tall } = map.layouts;
  const { budget } = useMotionTier();
  const { container, item } = nodeVariants(budget);
  const box = useRef<HTMLDivElement>(null);
  const sorted = [...stages].sort((a, b) => a.order - b.order);

  const inProgressIndex = sorted.findIndex((s) => s.status === 'in_progress');
  // 잉크 길 끝: 진행 중 스테이지, 없으면 마지막으로 완료한 스테이지
  const cur =
    inProgressIndex >= 0
      ? inProgressIndex
      : sorted.findLastIndex((s) => s.status === 'completed');
  const landmarks = sorted.map((s) => ({
    theme: s.theme_name,
    locked: s.status === 'locked',
  }));

  useMapParallax(box, budget.parallax);

  useEffect(() => {
    if (!scrollToCurrent) return;
    const node = box.current?.querySelector('[data-current]');
    if (!node) return;
    const r = node.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight)
      node.scrollIntoView({ block: 'center' });
  }, [scrollToCurrent]);

  // 지난 길 그리기: minimal·동작 줄이기는 즉시, lite는 70% 길이 (P2-15)
  const instant = !budget.springs;
  const draw = sec('draw') * budget.effectDuration;
  const art = (name: LayoutName) => {
    const layout = map.layouts[name];
    const route = mapRoute(layout.nodes, map.path, cur);
    const w = name === 'wide' ? 4 : 3.5;
    return (
      <MapArt
        key={name}
        name={name}
        layout={layout}
        theme={theme}
        landmarks={landmarks}
        route={route}
      >
        {route.done && (
          <>
            <m.path
              className="wm-road-ink"
              d={route.done}
              strokeWidth={w}
              pathLength={1}
              strokeDasharray="1"
              initial={{ strokeDashoffset: instant ? 0 : 1 }}
              animate={{ strokeDashoffset: 0 }}
              transition={
                instant ? { duration: 0 } : { duration: draw, ease: EASE.ink }
              }
            />
            <m.path
              className="wm-road-stitch"
              d={route.done}
              initial={{ opacity: instant ? 0.9 : 0 }}
              animate={{ opacity: 0.9 }}
              transition={
                instant
                  ? { duration: 0 }
                  : { duration: sec('slow'), delay: draw, ease: EASE.out }
              }
            />
          </>
        )}
      </MapArt>
    );
  };

  return (
    <div className="wm" data-world={world}>
      <div
        ref={box}
        className="world-map"
        style={
          {
            '--wide-ratio': `${wide.width} / ${wide.height}`,
            '--tall-ratio': `${tall.width} / ${tall.height}`,
          } as React.CSSProperties
        }
      >
        {/* 화면 읽기 프로그램용 목록 제목 (페이지 h1 "모험 지도" 아래 단계, B33) */}
        <h2 className="sr-only">모험 스테이지</h2>

        {/* 지도 그림: 레이아웃마다 하나씩, 지도 폭에 맞는 쪽만 보임 */}
        {art('tall')}
        {art('wide')}

        {/* 앰비언트 구름·나뭇잎 (full만). 지도 그림의 반복 연출은 P5-09 */}
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
              <CharacterAvatar
                character="pybaem"
                expression="happy"
                size="sm"
              />
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
              data-current={index === inProgressIndex || undefined}
              // 노드 중심을 좌표에 맞춤. transform 문자열은 등장 variants 의 scale 이 덮어써서 x·y 로 줌
              style={{ ...nodeVars(map, index), x: '-50%', y: '-50%' }}
              variants={item}
            >
              <StageNode stage={stage} />
            </m.div>
          ))}
        </m.div>
      </div>
    </div>
  );
}
