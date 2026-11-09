'use client';

import { Check, Crown, Lock } from 'lucide-react';
import type { StageWithStatus } from '@/lib/types/database';
import { Stars } from '@/components/ui/reward-icon';
import dynamic from 'next/dynamic';
import { PybaemStatic, type PybaemState } from '@/components/characters/rig';
import { SHOW_STARS } from '@/lib/world/flags';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';

/**
 * 스테이지 노드 (P5-04, 시안 `design/prototypes/src/final/World.tsx` StageNode).
 * 랜드마크 그림은 지도(MapArt 길 레이어)가 한 번만 그리고, 노드는 그 위의 투명한 버튼 + 이름표 + 별 합계(별 전에는 완료 퀘스트 수, Q51) + 도장이다.
 * 크기는 지도 단위(`--u` = 지도 폭 1단위, `--ns` = 랜드마크 배율, worldMap.css)로 잡아 랜드마크와 같이 커지고 작아진다.
 *
 * - 노드 전체가 버튼 하나(랜드마크 + 이름표 + 별). 잠긴 노드도 포커스·탭이 되고(`aria-disabled`) 누르면 안내를 띄운다
 * - 진행률 링: 진행 중 스테이지의 번호 원 둘레 (완료 퀘스트 / 전체)
 * - 보스(`is_final`): 왕관 + 금색 번호 원. 지도 쪽 랜드마크도 크게 + 왕관(MapArt)
 */

type NodeState = 'locked' | 'open' | 'current' | 'clear';

function nodeState(stage: StageWithStatus): NodeState {
  if (stage.status === 'locked') return 'locked';
  if (stage.status === 'completed') return 'clear';
  return stage.completedQuestCount > 0 ? 'current' : 'open';
}

const STATE_TEXT: Record<NodeState, string> = {
  locked: '잠김',
  open: '열림, 지금 여기',
  current: '도전 중, 지금 여기',
  clear: '통과',
};

/** 화면 낭독기용 이름: 단계·이름·상태·(별)·진행. 별은 SHOW_STARS일 때만 (Q51) */
export function stageNodeLabel(stage: StageWithStatus): string {
  const parts = [
    `${stage.order}단계 ${stage.title}${stage.is_final ? ' (보스 스테이지)' : ''}`,
    STATE_TEXT[nodeState(stage)],
  ];
  if (stage.status !== 'locked') {
    if (SHOW_STARS) parts.push(`별 ${stage.stars}/${stage.maxStars}`);
    parts.push(
      `퀘스트 ${stage.completedQuestCount}/${stage.totalQuestCount} 완료`,
    );
  }
  return parts.join(', ');
}

/** 통과 도장 기울기 (손으로 찍은 느낌, 시안 값) */
const STAMP_ROT = [-14, 9, -6, 12, -10, 7, -12];

interface StageNodeProps {
  stage: StageWithStatus;
  /** 노드를 눌렀을 때 (잠긴 노드 포함). 동작은 WorldMap 한 곳에서 정한다 */
  onOpen: (stage: StageWithStatus) => void;
}

export function StageNode({ stage, onOpen }: StageNodeProps) {
  const state = nodeState(stage);
  const locked = state === 'locked';
  const pct =
    stage.totalQuestCount > 0
      ? stage.completedQuestCount / stage.totalQuestCount
      : 0;

  return (
    <div
      className="wn"
      data-stage-id={stage.id}
      data-state={state}
      data-boss={stage.is_final || undefined}
    >
      {stage.status === 'in_progress' && (
        <span aria-hidden className="wn-ring" />
      )}
      <button
        type="button"
        className="wn-hit"
        aria-label={stageNodeLabel(stage)}
        aria-disabled={locked || undefined}
        onClick={() => onOpen(stage)}
      >
        <span className="wn-plate">
          <span className="wn-no">
            {stage.status === 'in_progress' && (
              <svg className="wn-prog" viewBox="0 0 36 36" aria-hidden>
                <circle className="wn-prog-track" cx="18" cy="18" r="16" />
                <circle
                  className="wn-prog-bar"
                  cx="18"
                  cy="18"
                  r="16"
                  pathLength={1}
                  strokeDasharray={`${pct} 1`}
                />
              </svg>
            )}
            {stage.order}
          </span>
          {stage.is_final && <Crown className="wn-crown" aria-hidden />}
          <span className="wn-t">{stage.title}</span>
        </span>
        <span className="wn-meta" aria-hidden>
          {locked ? (
            <>
              <Lock className="size-3.5" strokeWidth={2.6} /> 잠김
            </>
          ) : SHOW_STARS ? (
            <>
              <Stars n={1} max={1} size={16} label={false} /> {stage.stars}/
              {stage.maxStars}
            </>
          ) : (
            // 별이 기록되기 전(Q51): 완료 체크 + 퀘스트 수
            <>
              {state === 'clear' && (
                <Check className="wn-check size-3.5" strokeWidth={3} />
              )}
              {stage.completedQuestCount}/{stage.totalQuestCount}
            </>
          )}
        </span>
      </button>
      {state === 'clear' && (
        <span
          aria-hidden
          className="wn-stamp font-display"
          style={
            {
              '--rot': `${STAMP_ROT[(stage.order - 1) % STAMP_ROT.length]}deg`,
            } as React.CSSProperties
          }
        >
          통과
        </span>
      )}
    </div>
  );
}

// 잠금 해제 연출(P5-05) 동안만 라이브 리그를 불러온다. 불러오는 동안은 같은 모습의 정지 그림
const PybaemRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),
  {
    ssr: false,
    loading: () => (
      <PybaemStatic state="happy" size={120} framing="stage" label="" />
    ),
  },
);

/**
 * 지금 위치: 큰 파이뱀 + "지금 여기!" 칩. 평소에는 정지 리그 그림(엔진 없음)에 CSS 대기 루프 `.mascot-bob`(full·lite)만.
 * 잠금 해제 연출(P5-05)은 `live`로 라이브 `PybaemRig`(상태 기쁨 → 응원)를 쓰고 칩 글자를 바꾼다
 */
export function CurrentMarker({
  live,
  state = 'happy',
  flag = '지금 여기!',
}: {
  live?: boolean;
  state?: PybaemState;
  flag?: string;
}) {
  // 리그의 선 떨림(SVG 변위 필터)은 비싸서 연출 동안 full 도 lite 로 (시안 rigTier: 도장·길이 주인공)
  const { tier } = useMotionTier();
  return (
    <div className="wn-here" aria-hidden data-testid="world-current-marker">
      <div className="mascot-bob">
        {live ? (
          <PybaemRig
            state={state}
            size={120}
            framing="stage"
            label=""
            tier={tier === 'full' ? 'lite' : tier}
            lookAt={false}
            pokeable={false}
          />
        ) : (
          <PybaemStatic state="happy" size={120} framing="stage" label="" />
        )}
      </div>
      <span className="wn-here-flag">{flag}</span>
    </div>
  );
}
