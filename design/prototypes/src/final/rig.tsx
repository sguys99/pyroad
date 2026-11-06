// 최종 시안 마스코트: 앱 리그(src/components/characters/rig, P2-13)를 상대 경로로 그대로 쓴다 (복사 금지)
// - 스타일 'B'. 앱 리그 파일은 고치지 않고, 리그가 받는 palette·tuning으로 가볍게 만든다:
//   외곽선 색 잉크 갈색 → 회갈색, 선 떨림(seed 바꾸기) 끔, 종이 결 변위 2.6 → 0.9
// - 외곽선 굵기(STYLE_RULES.B.outline 2.2)는 prop으로 못 바꿔 보고서에 제안값을 적었다 (P2-09)
// - 1차 프로토타입과 같은 이름·비슷한 props로 감싸 화면 코드는 import만 바꾼다
import { forwardRef, type CSSProperties } from 'react';
import { RigView, type RigHandle } from '../../../../src/components/characters/rig/LiveRig';
import { BUGBUG, BYEOLTTONGI, PYBAEM, RigStatic, type Costume, type RigTuning } from '../../../../src/components/characters/rig';
import type { PybaemState } from '../../../../src/components/characters/rig/pybaem/params';
import { useMotion } from '../shared/motion';
import type { Tier } from './timeline';

/** 최종 시안 잉크 (art.tsx·tokens.ts와 같은 계열). 눈·입(pal.ink)은 표정이 읽히게 짙게 둔다 */
const OUTLINE = '#6B5B4C';
export const RIG_TUNING: Partial<RigTuning> = { paper: 0.9, boilFps: 0 };

type AnyState = string;

export interface PyProps {
  state?: AnyState;
  talking?: boolean;
  size?: number;
  tier?: Tier;
  reducedMotion?: boolean;
  lookAt?: boolean;
  costume?: Costume;
  className?: string;
  style?: 'B';
}

export const PybaemRig = forwardRef<RigHandle, PyProps>(function PybaemRig(
  { state = 'idle', talking = false, size = 120, tier, reducedMotion, lookAt = true, costume, className },
  ref,
) {
  const g = useMotion();
  return (
    <RigView
      ref={ref as never}
      def={PYBAEM}
      state={state as PybaemState}
      talking={talking}
      size={size}
      style="B"
      palette={{ outline: OUTLINE, shadow: '#8C7C69' }}
      tier={tier ?? g.tier}
      reduced={reducedMotion ?? g.reduced}
      lookAt={lookAt}
      costume={costume}
      tuning={RIG_TUNING}
      className={className}
    />
  );
});

export function PybaemStatic({ state = 'idle', size = 96, costume, idPrefix }: { state?: AnyState; size?: number; costume?: Costume; framing?: string; idPrefix?: string; style?: 'B' }) {
  return (
    <RigStatic
      def={PYBAEM}
      state={state as PybaemState}
      style="B"
      size={size}
      costume={costume}
      palette={{ outline: OUTLINE, shadow: '#8C7C69' }}
      idPrefix={idPrefix}
      filters={false}
    />
  );
}

const BUG_STATE = { searching: 'search', found: 'found', fixed: 'makeup' } as const;
export function BugBug({ mood = 'searching', size = 96, label }: { mood?: keyof typeof BUG_STATE; size?: number; motion?: string; label?: string; style?: 'B' }) {
  const g = useMotion();
  return (
    <RigView
      def={BUGBUG}
      state={BUG_STATE[mood]}
      size={size}
      style="B"
      palette={{ outline: OUTLINE } as never}
      tier={g.tier}
      reduced={g.reduced}
      lookAt={false}
      tuning={RIG_TUNING}
      label={label}
    />
  );
}

const STAR_STATE = { sparkling: 'sparkle', flying: 'flyIn', landing: 'land' } as const;
export function Byeolttongi({ mood = 'sparkling', size = 96, label, tier }: { mood?: keyof typeof STAR_STATE; size?: number; motion?: string; label?: string; style?: 'B'; tier?: Tier }) {
  const g = useMotion();
  return (
    <RigView
      def={BYEOLTTONGI}
      state={STAR_STATE[mood]}
      size={size}
      style="B"
      palette={{ outline: OUTLINE } as never}
      tier={tier ?? g.tier}
      reduced={g.reduced}
      lookAt={false}
      tuning={RIG_TUNING}
      label={label}
    />
  );
}

export type { CSSProperties };
