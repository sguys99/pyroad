// 축하 이벤트 목록 → 보여 줄 단계(step) 목록 (P1-10 축하 시퀀서).
//
// 규칙 (§3 F1·F3·F5·F11이 늘어나도 같은 자리에서 정함):
// 1. 우선순위: 퀘스트 결과(황금키 확인 → 프로젝트 완성·스테이지 클리어) → 레벨 업 → 뱃지 → 별·코인 → 보물상자(Phase 8).
//    같은 우선순위는 받은 순서 그대로 (안정 정렬).
//    단, 스테이지를 끝낸 카드(스테이지 클리어, 스테이지 마지막 프로젝트)는 맨 뒤로 (P6-13): 그 카드의 주 버튼이
//    "지도에서 새 길 보기"(월드맵 해제 연출로 이어짐)라 화면을 떠나므로, 레벨 업·뱃지를 먼저 다 보여 준다.
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
import { SHOW_CHEST } from '@/lib/world/flags';
import { getBadgeDefinition } from '@/lib/quest/badges';
import { withObjectParticle } from '@/lib/korean';
import type { MotionBudget } from '@/lib/motion/tier';
import { STAR_RATES } from '@/lib/sound/manifest';
import { rewardSfx, type SfxCue } from './rewardSfx';
import type { CelebrationSfx } from './sound';

export { rewardSfx, type SfxCue };

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
    }
  | { kind: 'chest'; id: string; event: EventOf<'chest'> };

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
  chest: 5,
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
  chest: { sfx: 'chest', confetti: 'badge' },
};

/** 뱃지가 하나씩 등장하는 시각 (초, 카드 등장 기준). 효과음도 같은 간격으로 */
export const BADGE_FIRST_AT_S = 0.15;
export const BADGE_STAGGER_S = 0.18;

/** 보상 카드 박자 (RewardsCard 연출과 효과음이 같은 값을 씀). 움직임이 없으면 모두 0 */
export function rewardsCardTiming(
  hasStars: boolean,
  budget: Pick<MotionBudget, 'springs' | 'effectDuration'>,
) {
  const k = budget.springs ? budget.effectDuration : 0;
  return {
    starsAtMs: 0,
    starGapMs: 150 * k,
    countAtMs: (hasStars ? 650 : 250) * k,
    countMs: 700 * k,
  };
}

/** 단계별 효과음 예약 (ms). 뱃지는 하나씩 등장할 때마다 음을 올려 가며 (1 → 1.26 → 1.5, P0-15), 보상은 `rewardSfx` */
export function sfxSchedule(
  step: CelebrationStep,
  budget: Pick<MotionBudget, 'springs' | 'effectDuration'> = {
    springs: true,
    effectDuration: 1,
  },
): SfxCue[] {
  const id = STEP_SPECS[step.kind].sfx;
  if (!id) return [];
  if (step.kind === 'badges') {
    return step.badges.map((_, i) => ({
      id,
      at: Math.round((BADGE_FIRST_AT_S + i * BADGE_STAGGER_S) * 1000),
      rate: STAR_RATES[i % STAR_RATES.length],
    }));
  }
  if (step.kind === 'rewards') {
    return rewardSfx({
      stars: step.stars?.stars ?? 0,
      coins: step.coins,
      ...rewardsCardTiming(!!step.stars, budget),
    });
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
    case 'chest':
      return 6000;
  }
}

/**
 * 카드 등장 연출 길이 (ms, full 기준 — lite는 `tierDuration`으로 70%, 동작 줄이기 0). 이 시간이 지나거나
 * 탭·Enter·Space·Esc를 누르면 카드가 끝 상태로 (§12-Q28: 짧게 + 누르면 건너뛰기, 레벨 업 최대 약 3.6초 안).
 * 끝 상태가 된 뒤의 Enter·Space·탭은 다음 카드, Esc는 모두 닫기
 */
export function introMs(step: CelebrationStep): number {
  switch (step.kind) {
    case 'golden_key':
      return 700;
    case 'stage_clear':
    case 'project_complete':
      return 1400;
    case 'level_up':
      // 숫자 카운트업(레벨 차이만큼, 최대 0.9초) + 도장 팝
      return (
        1000 + Math.min(300 * (step.event.level - step.event.fromLevel), 900)
      );
    case 'badges':
      return Math.round(
        (BADGE_FIRST_AT_S + step.badges.length * BADGE_STAGGER_S) * 1000 + 500,
      );
    case 'rewards':
      return 1500;
    case 'chest':
      return 1800;
  }
}

/** 화면 낭독기가 카드가 바뀔 때 읽는 한 줄 (aria-live). 글자로도 무엇을 받았는지 다 알 수 있게 */
export function stepSummary(step: CelebrationStep): string {
  switch (step.kind) {
    case 'golden_key':
      return '황금키로 문을 열었어요. XP와 뱃지 없이 완료돼요.';
    case 'stage_clear':
      return `스테이지 ${step.stage.order} ${step.stage.title} 클리어! 지도에서 새 길이 열려요.`;
    case 'project_complete':
      return [
        `${withObjectParticle(step.questTitle)} 완성했어요!`,
        step.xpGained > 0 && `경험치 ${step.xpGained} 받았어요.`,
        step.stage &&
          `스테이지 ${step.stage.order} ${step.stage.title} 클리어!`,
      ]
        .filter(Boolean)
        .join(' ');
    case 'level_up':
      return `레벨 업! 레벨 ${step.event.level} 달성, 새 칭호 ${step.event.title}.`;
    case 'badges':
      return `새 뱃지: ${step.badges.map((b) => getBadgeDefinition(b).name).join(', ')}.`;
    case 'rewards':
      return [
        step.stars && `별 ${step.stars.stars}개`,
        step.coins > 0 && `코인 ${step.coins}개`,
      ]
        .filter(Boolean)
        .join(', ')
        .concat(' 받았어요.');
    case 'chest':
      return `보물상자를 열었어요! 코인 ${step.event.contents.coins}개${
        step.event.contents.goldenKeys > 0
          ? `, 황금키 ${step.event.contents.goldenKeys}개`
          : ''
      }.`;
  }
}

/** 스테이지를 끝낸 카드인지 (맨 뒤에 두고, 주 버튼이 월드맵으로) */
export function closesStage(step: CelebrationStep): boolean {
  return (
    step.kind === 'stage_clear' ||
    (step.kind === 'project_complete' && step.stage !== null)
  );
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
  const chests: EventOf<'chest'>[] = [];

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
      case 'chest':
        // Phase 8 전에는 숨김 (§12-Q52와 같은 방식, `SHOW_CHEST`)
        if (SHOW_CHEST) chests.push(event);
        break;
    }
  }

  if (badges.length > 0)
    steps.push({ kind: 'badges', id: id('badges'), badges });
  if (stars || coins > 0) {
    steps.push({ kind: 'rewards', id: id('rewards'), stars, coins });
  }
  for (const event of chests)
    steps.push({ kind: 'chest', id: id('chest'), event });
  // 스테이지를 끝낸 카드는 맨 뒤로 (규칙 1의 단서). id는 그대로라 겹치지 않는다
  return [
    ...steps.filter((s) => !closesStage(s)),
    ...steps.filter(closesStage),
  ];
}
