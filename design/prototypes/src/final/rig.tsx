// 최종 시안 마스코트: 앱 리그(src/components/characters/rig, P2-13)를 상대 경로로 그대로 쓴다 (복사 금지)
// - 스타일 'B'. 2차 수정에서 앱 리그 B 자체를 고쳤다(STYLE_RULES.B: 외곽선 2.2 → 1.1 몸색 진한 톤, 종이 결·선 떨림 없음)
//   → 1차처럼 palette·tuning으로 덮지 않고 앱 기본값 그대로 그린다
// - 1차 프로토타입과 같은 이름·비슷한 props로 감싸 화면 코드는 import만 바꾼다
import { forwardRef, type CSSProperties } from 'react';
import { RigView, type RigHandle } from '../../../../src/components/characters/rig/LiveRig';
import { BUGBUG, BYEOLTTONGI, PYBAEM, RigStatic, type Costume } from '../../../../src/components/characters/rig';
import type { PybaemState } from '../../../../src/components/characters/rig/pybaem/params';
import { useMotion } from '../shared/motion';
import type { Tier } from './timeline';


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
      tier={tier ?? g.tier}
      reduced={reducedMotion ?? g.reduced}
      lookAt={lookAt}
      costume={costume}
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
      tier={g.tier}
      reduced={g.reduced}
      lookAt={false}
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
      tier={tier ?? g.tier}
      reduced={g.reduced}
      lookAt={false}
      label={label}
    />
  );
}

export type { CSSProperties };
