/** 버그버그 리그 정의 (에러·보스, 장난꾸러기 라이벌 겸 친구) */
import type { RigDef } from '../core/types';
import { createBugBugBehavior } from './behavior';
import { bugbugGeometry } from './geometry';
import { BUGBUG_PALETTES, BugBugMarkup, type BugBugPalette } from './Markup';
import {
  BUGBUG_AUTO_NEXT,
  BUGBUG_HALO,
  BUGBUG_LOOP_KEYS,
  BUGBUG_NEUTRAL,
  BUGBUG_PINNED_KEYS,
  BUGBUG_POSE_KEYS,
  BUGBUG_POSES,
  BUGBUG_STATES,
  BUGBUG_STATE_LABEL,
  bugbugSpringOf,
  bugbugStaticParams,
  type BugBugState,
} from './params';

export const BUGBUG: RigDef<BugBugState, BugBugPalette> = {
  id: 'bugbug',
  name: '버그버그',
  states: BUGBUG_STATES,
  stateLabel: BUGBUG_STATE_LABEL,
  idleState: 'idle',
  poseKeys: BUGBUG_POSE_KEYS,
  neutral: BUGBUG_NEUTRAL,
  poses: BUGBUG_POSES,
  springOf: bugbugSpringOf,
  loopKeys: BUGBUG_LOOP_KEYS,
  pinnedKeys: BUGBUG_PINNED_KEYS,
  halo: BUGBUG_HALO,
  autoNext: BUGBUG_AUTO_NEXT,
  pivot: { x: 64, y: 108 },
  lookHead: { rot: 5, x: 1 },
  createBehavior: createBugBugBehavior,
  staticParams: bugbugStaticParams,
  geometry: bugbugGeometry,
  palettes: BUGBUG_PALETTES,
  Markup: BugBugMarkup,
};

export * from './params';
export { BUGBUG_PALETTES, type BugBugPalette } from './Markup';
