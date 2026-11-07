/** 파이뱀 리그 정의 (튜터). 엔진·렌더러는 이 정의만 읽는다 */
import type { RigDef } from '../core/types';
import { createPybaemBehavior } from './behavior';
import { pybaemGeometry } from './geometry';
import { PYBAEM_PALETTES, PybaemMarkup, type PybaemPalette } from './Markup';
import {
  PYBAEM_HALO,
  PYBAEM_LOOP_KEYS,
  PYBAEM_NEUTRAL,
  PYBAEM_PINNED_KEYS,
  PYBAEM_POSE_KEYS,
  PYBAEM_POSES,
  PYBAEM_STATES,
  PYBAEM_STATE_LABEL,
  pybaemSpringOf,
  pybaemStaticParams,
  type PybaemState,
} from './params';

export const PYBAEM: RigDef<PybaemState, PybaemPalette> = {
  id: 'pybaem',
  name: '파이뱀 선생님',
  states: PYBAEM_STATES,
  stateLabel: PYBAEM_STATE_LABEL,
  idleState: 'idle',
  poseKeys: PYBAEM_POSE_KEYS,
  neutral: PYBAEM_NEUTRAL,
  poses: PYBAEM_POSES,
  springOf: pybaemSpringOf,
  loopKeys: PYBAEM_LOOP_KEYS,
  pinnedKeys: PYBAEM_PINNED_KEYS,
  halo: PYBAEM_HALO,
  pivot: { x: 64, y: 108 },
  lookHead: { rot: 4, x: 1.2 },
  createBehavior: createPybaemBehavior,
  staticParams: pybaemStaticParams,
  geometry: pybaemGeometry,
  palettes: PYBAEM_PALETTES,
  Markup: PybaemMarkup,
};

export * from './params';
export { PYBAEM_PALETTES, type PybaemPalette } from './Markup';
