/** 별똥이 리그 정의 (보상 안내 요정) */
import type { RigDef } from '../core/types';
import { createByeolttongiBehavior } from './behavior';
import { byeolttongiGeometry } from './geometry';
import {
  BYEOLTTONGI_PALETTES,
  ByeolttongiMarkup,
  type ByeolttongiPalette,
} from './Markup';
import {
  BYEOLTTONGI_AUTO_NEXT,
  BYEOLTTONGI_HALO,
  BYEOLTTONGI_LOOP_KEYS,
  BYEOLTTONGI_NEUTRAL,
  BYEOLTTONGI_PINNED_KEYS,
  BYEOLTTONGI_POSE_KEYS,
  BYEOLTTONGI_POSES,
  BYEOLTTONGI_STATES,
  BYEOLTTONGI_STATE_LABEL,
  byeolttongiSpringOf,
  byeolttongiStaticParams,
  type ByeolttongiState,
} from './params';

export const BYEOLTTONGI: RigDef<ByeolttongiState, ByeolttongiPalette> = {
  id: 'byeolttongi',
  name: '별똥이',
  states: BYEOLTTONGI_STATES,
  stateLabel: BYEOLTTONGI_STATE_LABEL,
  idleState: 'idle',
  poseKeys: BYEOLTTONGI_POSE_KEYS,
  neutral: BYEOLTTONGI_NEUTRAL,
  poses: BYEOLTTONGI_POSES,
  springOf: byeolttongiSpringOf,
  loopKeys: BYEOLTTONGI_LOOP_KEYS,
  pinnedKeys: BYEOLTTONGI_PINNED_KEYS,
  halo: BYEOLTTONGI_HALO,
  autoNext: BYEOLTTONGI_AUTO_NEXT,
  pivot: { x: 64, y: 100 },
  lookHead: { rot: 0, x: 0 },
  createBehavior: createByeolttongiBehavior,
  staticParams: byeolttongiStaticParams,
  geometry: byeolttongiGeometry,
  palettes: BYEOLTTONGI_PALETTES,
  Markup: ByeolttongiMarkup,
};

export * from './params';
export { BYEOLTTONGI_PALETTES, type ByeolttongiPalette } from './Markup';
