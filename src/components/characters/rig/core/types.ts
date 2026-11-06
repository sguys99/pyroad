/**
 * 리그 공용 타입. 캐릭터 = 파라미터 정의 + 포즈 표 + 레이어(behavior) + geometry + 마크업 (P0-07 §6.2).
 * 엔진(`engine.ts`)은 캐릭터를 모르고 이 정의만 읽는다.
 */
import type { ReactElement, Ref } from 'react';
import type { Costume } from '../costumes';
import type { RigStyle } from '../style';
import type { RigPolicy } from './policy';

export type CharacterId = 'pybaem' | 'bugbug' | 'byeolttongi';

/** 숫자 파라미터 한 점. 표정·자세는 모두 이 공간의 한 점이고, 전환은 스프링으로 이 공간을 이동한다 */
export type Params = Record<string, number>;
export type Attrs = Record<string, string>;
/** 요소 이름 → SVG 속성 (geometry의 결과) */
export type Geo = Record<string, Attrs>;

/** 스프링 묶음 (`src/lib/motion/tokens.ts` SPRINGS와 같은 값) */
export type SpringGroup = 'face' | 'body' | 'envelope' | 'prop';

export type Framing = 'stage' | 'avatar';

/**
 * 사용자 모션 느낌 리뷰(P0-07 §7 → P2-13)에서 고를 값. 모두 숫자 하나로 바뀐다.
 * 리뷰 페이지(`design/prototypes/src/rig-review`)의 슬라이더가 이 값을 바꾼다.
 */
export interface RigTuning {
  /** 점프 높이 배율 (파이뱀 기쁨 16 · 응원 10, 128 좌표 기준) */
  hop: number;
  /** 착지 젤리 감쇠비 ζ. null이면 스타일 기본 (A 0.22 · A×B 0.36 · B 0.55) */
  jellyZeta: number | null;
  /** 슬픔 "털썩" 세기 배율 (0 = 없음) */
  thud: number;
  /** 말하기 입 모양 속도 배율 (1 = 음절 0.09~0.21초) */
  talkSpeed: number;
  /** 따라보기 세기 배율 (1 = 눈 ±2.2 · 얼굴 ±1.6 · 머리 ±4°) */
  look: number;
  /** B안 선 떨림 변위. null이면 스타일 기본 (B 2.6 · A×B 1.5) */
  paper: number | null;
  /** B안 선 떨림 주기(fps). null이면 스타일 기본 (B 8) */
  boilFps: number | null;
  /** 후광(움직임을 줄였을 때의 색 단서) 불투명도 */
  haloOpacity: number;
  /** 상태별 후광 색 덮어쓰기 */
  haloColors: Record<string, string>;
}

export const DEFAULT_TUNING: RigTuning = {
  hop: 1,
  jellyZeta: null,
  thud: 1,
  talkSpeed: 1,
  look: 1,
  paper: null,
  boilFps: null,
  haloOpacity: 0.55,
  haloColors: {},
};

export interface GeoCtx {
  /** clipPath·filter id 접두사 (한 화면에 여러 개면 서로 달라야 함) */
  idp: string;
  style: RigStyle;
  haloColor: string;
  tuning: RigTuning;
}

/** 마크업 공통 props. 마크업은 훅이 없는 순수 함수라 서버·공유 카드 직렬화기(P0-10)에서도 그대로 호출된다 */
export interface MarkupProps<P> {
  geo: Geo;
  pal: P;
  style: RigStyle;
  idp: string;
  size: number;
  framing: Framing;
  /** 접근성 이름. 빈 문자열이면 장식(aria-hidden) */
  label: string;
  costume?: Costume;
  /** SVG 필터(종이 결)를 넣나 (연출 단계 lite 이하·공유 카드에서는 끔) */
  filters: boolean;
  className?: string;
  /** 라이브 리그가 요소를 잡는 콜백 (정적 렌더는 없음) */
  reg?: (key: string) => (el: Element | null) => void;
  svgRef?: Ref<SVGSVGElement>;
  interactive?: boolean;
  onPointerDown?: () => void;
}

/** 레이어 합성 때 캐릭터 behavior가 받는 문맥 */
export interface ComposeCtx<S extends string = string> {
  dt: number;
  /** 엔진 시간(초) */
  t: number;
  /** 지금 상태에 들어온 뒤 시간(초) */
  ts: number;
  state: S;
  /** 연속 레이어(숨쉬기·점프·말하기…)를 돌리나 (live 모드이고 동작 줄이기가 아님) */
  live: boolean;
  policy: RigPolicy;
  tuning: RigTuning;
  style: RigStyle;
  /** 스프링 값 (읽기 전용) */
  cur: Readonly<Params>;
  target: Readonly<Params>;
  /** 이번 프레임 출력 (behavior가 더한다) */
  out: Params;
  /** 찌그러짐 목표 (behavior가 곱한다. 엔진이 젤리 스프링을 거쳐 sqX·sqY로 낸다) */
  sq: { x: number; y: number };
  rng: () => number;
  talking: boolean;
  /** 포인터를 따라볼 때 가중치가 곱해진 시선 (-1..1, 엔진이 lookX·lookY에 이미 섞음) */
  look: { x: number; y: number; w: number };
  /** 젤리에 속도를 더한다 (털썩·콕 찌르기) */
  kickJelly(vx: number, vy: number): void;
  /** 화면 쪽에 알릴 신호 (예: 별똥이 "보상 건네기"의 코인 팝 순간 = 'reward') */
  emit(cue: string): void;
}

export interface Behavior<S extends string = string> {
  /** 상태에 들어올 때 (replay = 같은 상태를 다시 재생) */
  enter(ctx: ComposeCtx<S>, prev: S, replay: boolean): void;
  /** 매 프레임: 레이어를 out·sq에 더한다. live가 아니면 소품 위상만 고정값으로 */
  compose(ctx: ComposeCtx<S>): void;
  /** 대기 루프가 없는 단계(minimal)에서도 끝까지 그려야 할 일회성 동작이 남았나 */
  busy?(ctx: ComposeCtx<S>): boolean;
}

export interface RigDef<S extends string = string, P = Record<string, string>> {
  id: CharacterId;
  /** 접근성 이름 앞부분 (예: '파이뱀 선생님') */
  name: string;
  states: readonly S[];
  stateLabel: Record<S, string>;
  idleState: S;
  /** 스프링으로 움직이는 파라미터 */
  poseKeys: readonly string[];
  /** 모든 파라미터 기본값 (파생 값 포함) */
  neutral: Params;
  poses: Record<S, Params>;
  springOf(key: string): SpringGroup;
  /** 연속 레이어 세기: live가 아니면 0으로 */
  loopKeys: readonly string[];
  /** 동작 줄이기에서 중립에 고정 (위치·크기·회전: §12-Q26 "위치·크기 변화 0") */
  pinnedKeys: readonly string[];
  /** 상태별 후광 색 (P0-07 HALO_COLOR) */
  halo: Record<S, string>;
  /** 일회성 상태가 끝나면 넘어갈 상태 (예: 등장 → 대기) */
  autoNext?: Partial<Record<S, { after: number; to: S }>>;
  /** 젤리 찌그러짐 피벗 (보통 발밑) */
  pivot: { x: number; y: number };
  /** 따라보기 때 머리를 돌리는 세기 (도, px) */
  lookHead: { rot: number; x: number };
  createBehavior(): Behavior<S>;
  /** 정적 포즈 (SSR 첫 렌더·공유 카드·아바타·동작 줄이기) */
  staticParams(state: S): Params;
  geometry(p: Params, ctx: GeoCtx): Geo;
  palettes: Record<RigStyle, P>;
  /** 메서드 표기 = 매개변수 이변성: 엔진·테스트가 팔레트 타입을 몰라도(`RigDef<S, unknown>`) 받을 수 있게 */
  Markup(props: MarkupProps<P>): ReactElement;
}
