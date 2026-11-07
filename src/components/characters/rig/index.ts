/**
 * 마스코트 SVG 리그 (P2-13, 설계 근거: P0-07). 구조·상태 표·캐릭터 추가 방법은 docs/design/rig.md.
 *
 * 이 파일은 서버에서도 import할 수 있는 것만 내보낸다 (정의·정지 그림·타입). 라이브 리그는
 * `./MascotRig`(앱, `useMotionTier()` 연동) 또는 `./LiveRig`(연출 단계를 직접 넘김)에서.
 */
export {
  DEFAULT_RIG_STYLE,
  RIG_STYLES,
  STYLE_LABEL,
  STYLE_RULES,
  type RigStyle,
} from './style';
export {
  DEFAULT_TUNING,
  type CharacterId,
  type Framing,
  type Geo,
  type Params,
  type RigDef,
  type RigTuning,
} from './core/types';
export { rigPolicy, type RigPolicy } from './core/policy';
export type { Costume, HatKind, GlassesKind, BackdropKind } from './costumes';
export {
  RigStatic,
  PybaemStatic,
  BugBugStatic,
  ByeolttongiStatic,
  staticGeo,
  type RigStaticProps,
} from './RigStatic';
export * from './pybaem';
export * from './bugbug';
export * from './byeolttongi';
