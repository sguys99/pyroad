/**
 * 엔진 없는 정지 그림 (훅 없음, 'use client' 아님): 공유 카드(next/og, P0-10 직렬화기)·아바타·SSR 첫 화면·동작 줄이기.
 * 라이브 리그의 첫 렌더와 같은 geometry를 쓰므로, 첫 화면을 이것으로 그리고 하이드레이션 뒤 라이브 리그로 바꿔도 같은 모습이다.
 * `<text>`·`<foreignObject>`·래스터 `<image>`를 쓰지 않는다 (테스트가 확인).
 */
import type {
  BugBugExpression,
  ByeolttongiExpression,
  PybaemExpression,
} from '../expressions';
import type { Costume } from './costumes';
import {
  DEFAULT_TUNING,
  type Framing,
  type Geo,
  type RigDef,
} from './core/types';
import { DEFAULT_RIG_STYLE, type RigStyle } from './style';
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

export interface RigStaticProps<S extends string, P> {
  state?: S;
  style?: RigStyle;
  /** 팔레트 일부 덮어쓰기 (스킨, P9-04) */
  palette?: Partial<P>;
  costume?: Costume;
  size?: number;
  framing?: Framing;
  /** 동작 줄이기·minimal 모양: 상태별 후광 색을 함께 그린다 */
  halo?: boolean;
  /** B·A×B 종이 결 필터 (기본 켬 = 라이브 full과 같은 모습). 작은 아바타·공유 카드는 끄면 가볍다 */
  filters?: boolean;
  /** clipPath·filter id 접두사. 기본은 캐릭터·스타일·상태로 정해져 같은 그림끼리는 겹쳐도 같다 */
  idPrefix?: string;
  className?: string;
  /** 접근성 이름. 기본 "파이뱀 선생님 - 기쁨". 빈 문자열이면 장식 */
  label?: string;
}

/** 정적 geometry (테스트·직렬화용) */
export function staticGeo<S extends string, P>(
  def: RigDef<S, P>,
  state: S,
  opts: { style?: RigStyle; idp?: string; halo?: boolean } = {},
): Geo {
  const p = def.staticParams(state);
  if (opts.halo && state !== def.idleState) p.halo = 1;
  return def.geometry(p, {
    idp: opts.idp ?? `${def.id}-${opts.style ?? DEFAULT_RIG_STYLE}-${state}`,
    style: opts.style ?? DEFAULT_RIG_STYLE,
    haloColor: def.halo[state],
    tuning: DEFAULT_TUNING,
  });
}

export function RigStatic<S extends string, P>({
  def,
  state,
  style = DEFAULT_RIG_STYLE,
  palette,
  costume,
  size = 128,
  framing = 'avatar',
  halo = false,
  filters = true,
  idPrefix,
  className,
  label,
}: RigStaticProps<S, P> & { def: RigDef<S, P> }) {
  const s = state ?? def.idleState;
  const idp = idPrefix ?? `${def.id}-${style}-${s}-`;
  const pal = { ...def.palettes[style], ...palette } as P;
  const Markup = def.Markup;
  return (
    <Markup
      geo={staticGeo(def, s, { style, idp, halo })}
      pal={pal}
      style={style}
      costume={costume}
      idp={idp}
      size={size}
      framing={framing}
      label={label ?? `${def.name} - ${def.stateLabel[s]}`}
      filters={filters}
      className={className}
    />
  );
}

/** 정지 파이뱀. `expression`(기존 표정 10종)을 주면 포즈 표로 옮긴 상태를 그린다 */
export function PybaemStatic({
  expression,
  state,
  ...rest
}: RigStaticProps<PybaemState, PybaemPalette> & {
  expression?: PybaemExpression;
}) {
  const s =
    state ?? (expression ? PYBAEM_EXPRESSION_STATE[expression] : 'idle');
  return RigStatic({ def: PYBAEM, state: s, ...rest });
}

export function BugBugStatic({
  expression,
  state,
  ...rest
}: RigStaticProps<BugBugState, BugBugPalette> & {
  expression?: BugBugExpression;
}) {
  const s =
    state ?? (expression ? BUGBUG_EXPRESSION_STATE[expression] : 'idle');
  return RigStatic({ def: BUGBUG, state: s, ...rest });
}

export function ByeolttongiStatic({
  expression,
  state,
  ...rest
}: RigStaticProps<ByeolttongiState, ByeolttongiPalette> & {
  expression?: ByeolttongiExpression;
}) {
  const s =
    state ?? (expression ? BYEOLTTONGI_EXPRESSION_STATE[expression] : 'idle');
  return RigStatic({ def: BYEOLTTONGI, state: s, ...rest });
}
