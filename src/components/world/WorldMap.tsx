'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { m, type Variants } from 'framer-motion';
import { Lock, LockOpen } from 'lucide-react';
import type { StageWithStatus } from '@/lib/types/database';
import type { WorldId } from '@/lib/design/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { MotionBudget } from '@/lib/motion/tier';
import { EASE, sec } from '@/lib/motion/tokens';
import { CurrentMarker, StageNode } from './StageNode';
import { MapArt, type LayoutName } from './map/MapArt';
import { ToastViewport, useToastQueue } from '@/components/ui/toast';
import { useSfx } from '@/components/providers/soundContext';
import { SOFT_TAP } from '@/lib/sound/manifest';
import { StageSheet } from './StageSheet';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import type { StageQuestItem } from '@/lib/world/mapData';
import type { WorldMapConfig } from '@/lib/content/schema';
import {
  mapRoute,
  mapSegment,
  markerSide,
  nodePercent,
  petOffset,
} from '@/lib/world/worlds';
import { PetSlot, type PetConfig } from './PetSlot';
import { useMyLook } from '@/components/profile/MyLook';
import type { UnlockPlan } from '@/lib/world/unlockSeen';
import { useStageUnlock } from './unlock/useStageUnlock';
import {
  UnlockInk,
  UnlockMarks,
  UnlockRoad,
  UnlockSplats,
} from './unlock/UnlockLayer';
import './map/worldMap.css';

/**
 * i번째 노드 자리: 레이아웃마다 CSS 변수로 넘기고 .world-node(worldMap.css)가 지도 폭에 맞는 쪽을 씀.
 * --wdx·--tdx: 지금 위치 파이뱀이 노드의 어느 쪽에 설지(가로 지도는 왼쪽, 세로 지도는 지도 가운데 쪽, 잘리면 반대쪽)
 * --wpx·--tpx: 동행 펫 자리(노드에서 지도 단위, P5-08 petOffset)
 */
function nodeVars(map: WorldMapConfig, i: number): React.CSSProperties {
  const { wide, tall } = map.layouts;
  const w = nodePercent(wide, wide.nodes[i]);
  const t = nodePercent(tall, tall.nodes[i]);
  const wx = wide.nodes[i][0];
  const tx = tall.nodes[i][0];
  const wdx = markerSide(wide, wx, -1);
  const tdx = markerSide(tall, tx, tx < tall.width / 2 ? 1 : -1);
  return {
    '--wl': w.left,
    '--wt': w.top,
    '--tl': t.left,
    '--tt': t.top,
    '--wdx': wdx,
    '--tdx': tdx,
    '--wpx': petOffset(wide, wx, wdx),
    '--tpx': petOffset(tall, tx, tdx),
  } as React.CSSProperties;
}

/**
 * 노드를 눌렀을 때 (한 곳에 모음). 열린 스테이지는 차례 시트(P5-06), 잠긴 스테이지는 안내 쪽지.
 * 열린 시트는 주소 `?stage=<id>`에 남긴다: 기기 뒤로 가기로 닫히고, 시트에서 퀘스트로 갔다 돌아오면 시트가 다시 열려 있다.
 * 주소는 history.pushState로만 바꿔(Next가 useSearchParams에 맞춤) 서버 렌더를 다시 하지 않는다.
 * `questsByStage`가 없으면(카탈로그 틴트 견본) 열린 노드를 눌러도 아무것도 하지 않는다
 */
const STAGE_ENTRY = 'pyroadStageSheet';

// 보물상자 축하 (P8-06): 연 순간에만 받는 지연 chunk (퀘스트 화면과 같은 오버레이·시퀀서)
const QuestCelebrations = dynamic(
  () =>
    import('@/components/quest/QuestCelebrations').then(
      (m) => m.QuestCelebrations,
    ),
  { ssr: false },
);

function useOpenStage(
  stages: StageWithStatus[],
  questsByStage?: Record<string, StageQuestItem[]>,
  world?: WorldId,
) {
  const params = useSearchParams();
  const router = useRouter();
  const { toasts, show, dismiss } = useToastQueue(1);
  // 연 보물상자 축하 (P8-06). 시트는 닫고 지도 위에 띄운다 (시트 대화 상자 위에 또 대화 상자를 겹치지 않게)
  const [chest, setChest] = useState<CelebrationEvent[]>([]);
  const play = useSfx();
  const id = questsByStage ? params.get('stage') : null;
  const current =
    stages.find((s) => s.id === id && s.status !== 'locked') ?? null;
  // 닫히는 연출 동안 내용이 남게 마지막 스테이지를 들고 있는다
  const [shown, setShown] = useState(current);
  if (current && current !== shown) setShown(current);

  const open = (stage: StageWithStatus) => {
    if (stage.status === 'locked') {
      // 잠긴 노드: 경고음 대신 작고 낮은 탭 (안내는 쪽지 글자가 함, P5-11)
      play('tap', SOFT_TAP);
      show(`${stage.order - 1}단계를 통과하면 열려요`, {
        tone: 'warn',
        icon: <Lock className="size-4" />,
      });
      return;
    }
    if (!questsByStage) return;
    play('tap');
    const url = new URL(window.location.href);
    url.searchParams.set('stage', stage.id);
    // 표시는 기록 항목 state에 둔다: 퀘스트에서 뒤로 와 다시 그려져도 남아 있다 (Next는 사용자 state 키를 보존)
    window.history.pushState({ [STAGE_ENTRY]: true }, '', url);
  };
  /** `then`: 주소가 /world로 돌아온 뒤 부름 (뒤로 가기면 popstate 뒤 — 그 전에 부른 router.refresh()는 Next가 버림) */
  const close = (then?: () => void) => {
    // 이 화면이 쌓은 기록 항목이면 거둔다: 그 자리에 /world를 덮으면 앞 항목과 겹쳐 뒤로 가기를 한 번 더 눌러야 떠남 (P5-14)
    if (window.history.state?.[STAGE_ENTRY]) {
      if (then) window.addEventListener('popstate', then, { once: true });
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('stage');
    window.history.replaceState(null, '', url);
    then?.();
  };
  const sheet = (
    <StageSheet
      stage={shown}
      quests={(shown && questsByStage?.[shown.id]) || []}
      open={!!current}
      world={world}
      onOpenChange={(next) => !next && close()}
      onChestOpened={(events) => {
        // HUD 코인·상자 상태는 router.refresh() (`/api/world/chest`가 무효화). 시트를 닫는 뒤로 가기가 끝난 뒤 곧바로:
        // 축하 카드를 닫을 때(퇴장 연출 끝, 카드 언마운트와 같은 틱) 부르면 새로 고침 전환이 가끔 커밋되지 않고 멈춤 (B56)
        if (!events) return router.refresh();
        setChest(events);
        close(() => router.refresh());
      }}
      // 주소로 열린 시트(퀘스트에서 돌아옴)도 닫으면 그 노드로 포커스
      finalFocus={() =>
        document.querySelector<HTMLElement>(
          `[data-stage-id="${shown?.id}"] .wn-hit`,
        )
      }
    />
  );
  const celebration = chest.length > 0 && (
    <QuestCelebrations
      events={chest}
      questId=""
      worldHref=""
      onDismiss={() => setChest([])}
    />
  );
  return { open, sheet, celebration, toasts, show, dismiss };
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

/**
 * 앰비언트 쉬기 (P5-09): 지도가 화면 밖이거나 탭이 숨으면 `data-amb-off` → worldMap.css가 앰비언트를 paused.
 * 앰비언트가 꺼진 단계(lite 이하)에서는 아무것도 붙이지 않는다
 */
function useAmbientPause(
  ref: React.RefObject<HTMLDivElement | null>,
  on: boolean,
) {
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let visible = true;
    const apply = () =>
      el.toggleAttribute('data-amb-off', !visible || document.hidden);
    // 없는 환경(jsdom·아주 오래된 브라우저)은 탭 숨김만 본다
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            apply();
          })
        : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', apply);
      el.removeAttribute('data-amb-off');
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
  /** 스테이지 id → 퀘스트 목록 (loadWorldMapData). 있으면 열린 노드를 눌러 차례 시트를 연다 (P5-06) */
  questsByStage?: Record<string, StageQuestItem[]>;
  /** 처음 열 때 지금 스테이지가 화면 밖이면 그쪽으로 스크롤 (세로로 긴 모바일 지도). 월드맵 페이지만 */
  scrollToCurrent?: boolean;
  /** 잠금 해제 연출 (P5-05): 본 기록과 비교한 새로 열린 스테이지 (loadWorldMapData). 없으면 연출·기록 없음 */
  unlocks?: UnlockPlan | null;
  /** 카탈로그 데모: 기록을 보내지 않고 다시 틀 수 있음 */
  unlockDemo?: boolean;
  /** 동행 펫 (P5-08 슬롯). 주지 않으면 내가 데려간 펫(`avatar_config.pet`, P9-05 `useMyLook`), 카탈로그는 견본을 줌 */
  pet?: PetConfig | null;
}

export function WorldMap({
  stages,
  map,
  theme = '',
  world,
  questsByStage,
  scrollToCurrent,
  unlocks,
  unlockDemo,
  pet,
}: WorldMapProps) {
  const { wide, tall } = map.layouts;
  const myPet = useMyLook().pet;
  const shownPet = pet !== undefined ? pet : myPet && { id: myPet };
  const { budget } = useMotionTier();
  const { container, item } = nodeVariants(budget);
  const box = useRef<HTMLDivElement>(null);
  const { open, sheet, celebration, toasts, show, dismiss } = useOpenStage(
    stages,
    questsByStage,
    world,
  );
  // 안내 쪽지는 fixed라 transform이 걸린 페이지 틀(PageTransition) 밖, body에 둔다
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useEffect(() => setPortal(document.body), []);
  const real = [...stages].sort((a, b) => a.order - b.order);

  // 잠금 해제 연출 (P5-05): 연출이 끝나기 전에는 새 스테이지를 잠긴 모습으로, 파이뱀은 이전 노드에 둔다
  const unlock = useStageUnlock({
    sorted: real,
    map,
    plan: unlocks,
    demo: unlockDemo,
    box,
    onOpened: (stage) =>
      show(`새 스테이지가 열렸어요! ${stage.order}단계 ${stage.title}`, {
        tone: 'good',
        icon: <LockOpen className="size-4" />,
      }),
  });
  const hold = unlock.active && !unlock.open;
  const sorted = hold
    ? real.map((s, i) =>
        i === unlock.target ? { ...s, status: 'locked' as const } : s,
      )
    : real;

  // 맨 뒤 진행 중 스테이지 = 지금 위치 (보스가 새로 생긴 앞 스테이지도 진행 중일 수 있음, 00046)
  const inProgressIndex = sorted.findLastIndex(
    (s) => s.status === 'in_progress',
  );
  // 잉크 길 끝: 진행 중 스테이지, 없으면 마지막으로 완료한 스테이지
  const cur =
    inProgressIndex >= 0
      ? inProgressIndex
      : sorted.findLastIndex((s) => s.status === 'completed');
  const landmarks = sorted.map((s) => ({
    theme: s.theme_name,
    locked: s.status === 'locked',
    boss: s.is_final,
  }));

  // 지금 위치 파이뱀: 연출 중에는 이전 노드(첫 스테이지면 새 노드)에서 출발
  const markerIndex = unlock.active
    ? unlock.from >= 0
      ? unlock.from
      : unlock.target
    : inProgressIndex;

  useMapParallax(box, budget.parallax);
  useAmbientPause(box, budget.ambient);

  const unlocking = unlock.target >= 0;
  useEffect(() => {
    if (!scrollToCurrent || unlocking) return;
    const node = box.current?.querySelector('[data-current]');
    if (!node) return;
    const r = node.getBoundingClientRect();
    // 들어올 때 자리 잡기라 바로 (html의 scroll-behavior: smooth면 첫 화면이 미끄러지고, 그동안 누른 곳이 빗나감, B51)
    if (r.top < 0 || r.bottom > window.innerHeight)
      node.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [scrollToCurrent, unlocking]);

  // 지난 길 그리기: minimal·동작 줄이기는 즉시, lite는 70% 길이 (P2-15)
  const instant = !budget.springs;
  const draw = sec('draw') * budget.effectDuration;
  const art = (name: LayoutName) => {
    const layout = map.layouts[name];
    // 연출 중에는 지난 길이 이전 노드에서 멈추고, 새 조각은 연출이 긋는다
    const route = mapRoute(
      layout.nodes,
      map.path,
      unlock.active && unlock.from >= 0 ? unlock.from : cur,
    );
    const w = name === 'wide' ? 4 : 3.5;
    return (
      <MapArt
        key={name}
        name={name}
        layout={layout}
        theme={theme}
        landmarks={landmarks}
        route={route}
        curve={map.path}
        ambient={map.ambient}
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
        {unlock.active && unlock.from >= 0 && (
          <UnlockRoad
            d={mapSegment(layout.nodes, map.path, unlock.from)}
            width={w}
          />
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
            // 지도 1단위(px) · 랜드마크 배율: 노드·도장·파이뱀 크기를 랜드마크와 같이 맞춘다 (worldMap.css)
            '--wu': `calc(100cqi / ${wide.width})`,
            '--tu': `calc(100cqi / ${tall.width})`,
            '--wns': wide.node_scale,
            '--tns': tall.node_scale,
          } as React.CSSProperties
        }
      >
        {/* 화면 읽기 프로그램용 목록 제목 (페이지 h1 "모험 지도" 아래 단계, B33) */}
        <h2 className="sr-only">모험 스테이지</h2>

        {/* 지도 그림: 레이아웃마다 하나씩, 지도 폭에 맞는 쪽만 보임 */}
        {art('tall')}
        {art('wide')}
        {unlock.active && (
          <UnlockInk
            map={map}
            index={unlock.target}
            theme={real[unlock.target].theme_name}
            boss={real[unlock.target].is_final}
          />
        )}

        {/* 스테이지 노드 + 지금 위치 (차례로 등장, 파이뱀은 마지막) */}
        <m.div
          className="absolute inset-0"
          variants={container}
          initial={budget.effectDuration === 0 || unlocking ? false : 'hidden'}
          animate="show"
        >
          {sorted.map((stage, index) => (
            <m.div
              key={stage.id}
              className="world-node absolute z-10"
              data-current={index === inProgressIndex || undefined}
              data-unlock={
                unlock.active
                  ? index === unlock.from
                    ? 'from'
                    : index === unlock.target
                      ? 'to'
                      : undefined
                  : undefined
              }
              // 크기 0인 점(랜드마크 바닥 가운데). 등장 scale 도 이 점을 중심으로
              style={nodeVars(map, index)}
              variants={item}
            >
              <StageNode stage={stage} onOpen={open} />
            </m.div>
          ))}
          {markerIndex >= 0 && (
            <m.div
              className="world-node absolute z-20 pointer-events-none"
              style={nodeVars(map, markerIndex)}
              variants={item}
            >
              {/* 펫이 먼저(파이뱀 뒤에 그려짐) */}
              <PetSlot pet={shownPet} />
              <div className="wu-walker">
                <CurrentMarker
                  live={unlocking && budget.mascot !== 'still'}
                  state={unlock.rig}
                  flag={unlocking && unlock.open ? '새 곳 도착!' : undefined}
                />
              </div>
            </m.div>
          )}
        </m.div>
        {unlock.active && unlock.from >= 0 && (
          <UnlockSplats style={nodeVars(map, unlock.from)} />
        )}
        {unlocking && (unlock.active || budget.springs) && (
          <UnlockMarks
            style={nodeVars(map, unlock.target)}
            done={!unlock.active}
          />
        )}
      </div>
      {sheet}
      {portal &&
        createPortal(
          <>
            <ToastViewport toasts={toasts} onDismiss={dismiss} />
            {celebration}
          </>,
          portal,
        )}
    </div>
  );
}
