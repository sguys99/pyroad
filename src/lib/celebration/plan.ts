// 축하 이벤트 목록 → 보여 줄 단계(step) 목록 (P1-10 축하 시퀀서).
//
// 규칙 (§3 F1·F3·F5·F11이 늘어나도 같은 자리에서 정함):
// 1. 우선순위: 퀘스트 결과(황금키 확인 → 프로젝트 완성·스테이지 클리어) → 레벨 업 → 뱃지 → 별·코인(Phase 8).
//    같은 우선순위는 받은 순서 그대로 (안정 정렬).
// 2. 뱃지는 여러 개여도 단계 하나로 묶어 차례로 등장시킨다. 별·코인도 "보상" 단계 하나로.
// 3. 프로젝트 완성과 스테이지 클리어가 함께 오면 프로젝트 완성 하나에 담는다 (같은 순간을 두 번 축하하지 않게).
// 4. 한 번에 하나씩. 단계마다 자동 넘김 시간·효과음·컨페티 세기를 정한다
//    (컨페티: 스테이지 클리어·프로젝트 > 레벨 업 > 뱃지, 황금키 확인은 없음).

import type { BadgeType } from '@/lib/quest/badges';
import type {
  CelebrationEvent,
  CelebrationEventType,
} from '@/lib/quest/celebrationEvents';
import type { StageClearInfo } from '@/lib/quest/rewards';
import type { CelebrationSfx } from './sound';

type EventOf<T extends CelebrationEventType> = Extract<
  CelebrationEvent,
  { type: T }
>;

export type CelebrationStep =
  | { kind: 'golden_key'; id: string; event: EventOf<'golden_key'> }
  | { kind: 'stage_clear'; id: string; stage: StageClearInfo }
  | {
      kind: 'project_complete';
      id: string;
      questTitle: string;
      xpGained: number;
      stage: StageClearInfo | null;
    }
  | { kind: 'level_up'; id: string; event: EventOf<'level_up'> }
  | { kind: 'badges'; id: string; badges: BadgeType[] }
  | {
      kind: 'rewards';
      id: string;
      stars: EventOf<'star'> | null;
      coins: number;
    };

export type CelebrationStepKind = CelebrationStep['kind'];

/** 같은 순서 안에서는 받은 순서. 숫자가 작을수록 먼저 */
export const EVENT_PRIORITY: Record<CelebrationEventType, number> = {
  golden_key: 0,
  project_complete: 1,
  stage_clear: 1,
  level_up: 2,
  badge: 3,
  star: 4,
  coin: 4,
};

export type ConfettiPresetName = 'grand' | 'level' | 'badge' | 'none';

export interface StepSpec {
  sfx: CelebrationSfx | null;
  confetti: ConfettiPresetName;
}

export const STEP_SPECS: Record<CelebrationStepKind, StepSpec> = {
  golden_key: { sfx: 'unlock', confetti: 'none' },
  stage_clear: { sfx: 'celebrate', confetti: 'grand' },
  project_complete: { sfx: 'celebrate', confetti: 'grand' },
  level_up: { sfx: 'levelup', confetti: 'level' },
  badges: { sfx: 'star', confetti: 'badge' },
  rewards: { sfx: 'coin', confetti: 'none' },
};

/** 뱃지가 하나씩 등장하는 시각 (초, 카드 등장 기준). 효과음도 같은 간격으로 */
export const BADGE_FIRST_AT_S = 0.15;
export const BADGE_STAGGER_S = 0.18;

/** 단계별 효과음 예약 (ms). 뱃지는 하나씩 등장할 때마다 음을 올려 가며 (1 → 1.26 → 1.5, P0-15) */
const STAR_RATES = [1, 1.26, 1.5];
export function sfxSchedule(
  step: CelebrationStep,
): Array<{ id: CelebrationSfx; at: number; rate?: number }> {
  const id = STEP_SPECS[step.kind].sfx;
  if (!id) return [];
  if (step.kind === 'badges') {
    return step.badges.map((_, i) => ({
      id,
      at: Math.round((BADGE_FIRST_AT_S + i * BADGE_STAGGER_S) * 1000),
      rate: STAR_RATES[i % STAR_RATES.length],
    }));
  }
  return [{ id, at: 150 }];
}

/** 이 시간 전에는 탭·키 입력으로 넘기지 않는다 (실행 버튼을 연달아 누르던 손가락이 바로 닫지 않게) */
export const MIN_DWELL_MS = 450;

/**
 * 자동 넘김 (ms). null: 아이가 누를 때까지 기다림.
 * 초등 저학년이 소리 내어 읽는 속도(초당 3~5자)에 맞춰, 카드 글자 수 + 등장 연출 시간보다 넉넉하게.
 * 카드 위에 포인터가 있거나 탭이 숨겨지면 멈춘다 (`useCelebrationSequence`).
 */
export function autoAdvanceMs(step: CelebrationStep): number | null {
  switch (step.kind) {
    case 'golden_key':
      return 4500;
    case 'stage_clear':
      // 파이뱀 선생님의 정리(AI)와 배운 개념을 읽는 카드
      return null;
    case 'project_complete':
      return step.stage ? 10000 : 8000;
    case 'level_up':
      return 6000;
    case 'badges':
      return Math.min(4500 + 1500 * (step.badges.length - 1), 9000);
    case 'rewards':
      return 4000;
  }
}

/**
 * @param batch 같은 화면에서 여러 번 계획할 때 단계 id가 겹치지 않게 하는 번호
 */
export function planCelebrations(
  events: readonly CelebrationEvent[],
  batch = 0,
): CelebrationStep[] {
  const sorted = events
    .map((event, i) => ({ event, i }))
    .sort(
      (a, b) =>
        EVENT_PRIORITY[a.event.type] - EVENT_PRIORITY[b.event.type] ||
        a.i - b.i,
    )
    .map(({ event }) => event);

  const steps: CelebrationStep[] = [];
  const id = (kind: CelebrationStepKind) => `${batch}-${steps.length}-${kind}`;

  const project = sorted.find(
    (e): e is EventOf<'project_complete'> => e.type === 'project_complete',
  );
  const stageEvent = sorted.find(
    (e): e is EventOf<'stage_clear'> => e.type === 'stage_clear',
  );
  const badges: BadgeType[] = [];
  let stars: EventOf<'star'> | null = null;
  let coins = 0;

  for (const event of sorted) {
    switch (event.type) {
      case 'golden_key':
        steps.push({ kind: 'golden_key', id: id('golden_key'), event });
        break;
      case 'project_complete':
        steps.push({
          kind: 'project_complete',
          id: id('project_complete'),
          questTitle: event.questTitle,
          xpGained: event.xpGained,
          // 따로 온 스테이지 클리어도 여기에 담는다 (규칙 3)
          stage: event.stage ?? stageEvent?.stage ?? null,
        });
        break;
      case 'stage_clear':
        if (project || event !== stageEvent) break;
        steps.push({
          kind: 'stage_clear',
          id: id('stage_clear'),
          stage: event.stage,
        });
        break;
      case 'level_up':
        steps.push({ kind: 'level_up', id: id('level_up'), event });
        break;
      case 'badge':
        if (!badges.includes(event.badge)) badges.push(event.badge);
        break;
      case 'star':
        // 여러 번 오면 가장 높은 별
        if (!stars || event.stars > stars.stars) stars = event;
        break;
      case 'coin':
        coins += event.amount;
        break;
    }
  }

  if (badges.length > 0)
    steps.push({ kind: 'badges', id: id('badges'), badges });
  if (stars || coins > 0) {
    steps.push({ kind: 'rewards', id: id('rewards'), stars, coins });
  }
  return steps;
}
