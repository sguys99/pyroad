'use client';

/**
 * 앱용 라이브 리그: 연출 단계·동작 줄이기를 `useMotionTier()`(P2-15)에서 읽는다.
 * `tier`·`reduced`를 직접 주면 그 값을 쓴다 (화면 확인용).
 *
 * 지연 로드: 첫 화면은 `PybaemStatic`(서버에서 그림)으로 두고, 이 모듈을 `next/dynamic`으로 불러 바꿔도 같은 모습이다.
 *   const PybaemRig = dynamic(() => import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),
 *     { ssr: false, loading: () => <PybaemStatic state="idle" size={200} framing="stage" /> });
 */
import { forwardRef } from 'react';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type {
  BugBugExpression,
  ByeolttongiExpression,
  PybaemExpression,
} from '../expressions';
import { RigView, type RigHandle, type RigViewProps } from './LiveRig';
import {
  PYBAEM,
  PYBAEM_EXPRESSION_STATE,
  type PybaemPalette,
  type PybaemState,
} from './pybaem';
import {
  BUGBUG,
  BUGBUG_EXPRESSION_STATE,
  type BugBugPalette,
  type BugBugState,
} from './bugbug';
import {
  BYEOLTTONGI,
  BYEOLTTONGI_EXPRESSION_STATE,
  type ByeolttongiPalette,
  type ByeolttongiState,
} from './byeolttongi';

function useRigMotion(
  tier?: RigViewProps<string, unknown>['tier'],
  reduced?: boolean,
) {
  const m = useMotionTier();
  return { tier: tier ?? m.tier, reduced: reduced ?? m.reduced };
}

export type PybaemRigProps = RigViewProps<PybaemState, PybaemPalette> & {
  /** 기존 표정 10종 (state보다 뒤) */
  expression?: PybaemExpression;
};

export const PybaemRig = forwardRef<RigHandle<PybaemState>, PybaemRigProps>(
  function PybaemRig({ expression, state, tier, reduced, ...rest }, ref) {
    const motion = useRigMotion(tier, reduced);
    const s =
      state ?? (expression ? PYBAEM_EXPRESSION_STATE[expression] : undefined);
    return <RigView def={PYBAEM} ref={ref} state={s} {...motion} {...rest} />;
  },
);

export type BugBugRigProps = RigViewProps<BugBugState, BugBugPalette> & {
  expression?: BugBugExpression;
};

export const BugBugRig = forwardRef<RigHandle<BugBugState>, BugBugRigProps>(
  function BugBugRig({ expression, state, tier, reduced, ...rest }, ref) {
    const motion = useRigMotion(tier, reduced);
    const s =
      state ?? (expression ? BUGBUG_EXPRESSION_STATE[expression] : undefined);
    return <RigView def={BUGBUG} ref={ref} state={s} {...motion} {...rest} />;
  },
);

export type ByeolttongiRigProps = RigViewProps<
  ByeolttongiState,
  ByeolttongiPalette
> & {
  expression?: ByeolttongiExpression;
};

export const ByeolttongiRig = forwardRef<
  RigHandle<ByeolttongiState>,
  ByeolttongiRigProps
>(function ByeolttongiRig({ expression, state, tier, reduced, ...rest }, ref) {
  const motion = useRigMotion(tier, reduced);
  const s =
    state ??
    (expression ? BYEOLTTONGI_EXPRESSION_STATE[expression] : undefined);
  return (
    <RigView def={BYEOLTTONGI} ref={ref} state={s} {...motion} {...rest} />
  );
});
