'use client';

/**
 * 라이브 리그 렌더러 (캐릭터 공용). 연출 단계는 props로 받는다 — 앱에서는 `MascotRig.tsx`의 래퍼가
 * `useMotionTier()`를 읽어 넘기고, 디자인 리뷰 페이지는 직접 넘긴다 (같은 코드, React 18·19 공용 API만 사용).
 *
 * - 첫 렌더(SSR 포함)는 정적 포즈 → 하이드레이션 안전. 마운트 뒤 엔진이 ref로 속성만 갱신 (React 리렌더 없음)
 * - 화면 밖(IntersectionObserver)·숨긴 탭이면 엔진이 멈춘다. 모든 인스턴스가 rAF 하나를 공유
 * - 포인터 따라보기(마우스는 계속, 터치는 탭한 곳을 잠깐) · 탭하면 콕 찌르기
 */
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ForwardedRef,
  type JSX,
  type Ref,
} from 'react';
import type { MotionTier } from '../../../lib/motion/tier';
import {
  isBackdropQuiet,
  subscribeBackdropQuiet,
} from '../../../lib/celebration/backdropQuiet';
import type { Costume } from './costumes';
import { RigEngine } from './core/engine';
import { applyGeo } from './core/markup';
import { rigPolicy } from './core/policy';
import type { Framing, Geo, RigDef, RigTuning } from './core/types';
import { staticGeo } from './RigStatic';
import { DEFAULT_RIG_STYLE, type RigStyle } from './style';

export interface RigViewProps<S extends string, P> {
  state?: S;
  /** 말하기 레이어 (어떤 상태 위에도 얹힘. 파이뱀) */
  talking?: boolean;
  size?: number;
  style?: RigStyle;
  palette?: Partial<P>;
  costume?: Costume;
  tier?: MotionTier;
  reduced?: boolean;
  /** 포인터 따라보기 (기본 켬) */
  lookAt?: boolean;
  /** 탭하면 콕 찌르기 (기본 켬) */
  pokeable?: boolean;
  /** 멈춤 (모달 뒤·접힌 패널처럼 화면에 있지만 보이지 않을 때). 화면 밖·숨긴 탭·visibility는 자동 */
  paused?: boolean;
  framing?: Framing;
  seed?: number;
  className?: string;
  /** 접근성 이름. 기본 "<이름> - <상태>". 빈 문자열이면 장식 */
  label?: string;
  /** 모션 느낌 리뷰 값 (리뷰 페이지) */
  tuning?: Partial<RigTuning>;
  onEngine?: (e: RigEngine<S>) => void;
  /** behavior 신호 (예: 별똥이 'reward' = 코인 팝 순간) */
  onCue?: (cue: string) => void;
  /** 일회성 상태가 끝나 넘어간 상태 (예: 등장 → 대기) */
  onAutoState?: (state: S) => void;
}

export interface RigHandle<S extends string = string> {
  poke(): void;
  /** 지금 상태를 처음부터 다시 */
  replay(): void;
  engine(): RigEngine<S> | null;
}

function RigViewInner<S extends string, P>(
  {
    def,
    state: stateProp,
    talking = false,
    size = 200,
    style = DEFAULT_RIG_STYLE,
    palette,
    costume,
    tier = 'full',
    reduced = false,
    lookAt = true,
    pokeable = true,
    paused = false,
    framing = 'stage',
    seed,
    className,
    label,
    tuning,
    onEngine,
    onCue,
    onAutoState,
  }: RigViewProps<S, P> & { def: RigDef<S, P> },
  ref: ForwardedRef<RigHandle<S>>,
) {
  const state = stateProp ?? def.idleState;
  const idp = `${def.id}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const policy = rigPolicy(tier, reduced);
  const pal = { ...def.palettes[style], ...palette } as P;

  const els = useRef<Record<string, Element | null>>({});
  const svgRef = useRef<SVGSVGElement | null>(null);
  const engineRef = useRef<RigEngine<S> | null>(null);
  const prevGeo = useRef<Geo | null>(null);
  // 엔진 생성 때 읽을 최신 값 (생성 effect를 다시 돌리지 않으려고)
  const latest = useRef({ state, talking, tier, reduced, style, tuning, seed });
  latest.current = { state, talking, tier, reduced, style, tuning, seed };
  const callbacks = useRef({ onEngine, onCue, onAutoState });
  callbacks.current = { onEngine, onCue, onAutoState };

  // 첫 렌더 = 정적 포즈 (SSR과 클라이언트가 같은 결과). 이후에는 엔진이 DOM을 직접 고친다
  const [initial] = useState(() =>
    staticGeo(def, state, { style, idp, halo: policy.halo }),
  );
  const [reg] = useState(() => (k: string) => (el: Element | null) => {
    els.current[k] = el;
  });

  useImperativeHandle(
    ref,
    () => ({
      poke: () => engineRef.current?.poke(),
      replay: () => engineRef.current?.replay(),
      engine: () => engineRef.current,
    }),
    [],
  );

  // 엔진 생성: 첫 프레임은 정적 geometry로 그려 두고, 엔진은 다음 프레임에 만든다
  // (축하 카드처럼 큰 화면이 뜨는 첫 프레임의 긴 작업에 리그 생성이 끼지 않게, P2-05 측정)
  const [mountState] = useState(state);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const updateRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let e: RigEngine<S> | null = null;
    let io: IntersectionObserver | null = null;
    let poll = 0;
    let onScreen = true;
    const update = () => {
      if (!e) return;
      const svg = svgRef.current;
      // 가려진 인스턴스(visibility:hidden·opacity 0인 조상)도 멈춘다. checkVisibility가 없으면 화면 안으로 본다
      const shown =
        !svg ||
        typeof svg.checkVisibility !== 'function' ||
        svg.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
        });
      // 축하 오버레이 뒤(덮개 아래)는 멈춤, 오버레이 안의 리그는 그대로 (P6-13)
      const behindOverlay =
        isBackdropQuiet() && !svg?.closest('[data-celebration-root]');
      e.setVisible(
        onScreen &&
          shown &&
          !document.hidden &&
          !pausedRef.current &&
          !behindOverlay,
      );
    };
    const start = requestAnimationFrame(() => {
      const l = latest.current;
      e = new RigEngine<S>(def as RigDef<S, unknown>, {
        tier: l.tier,
        reduced: l.reduced,
        style: l.style,
        seed: l.seed,
        tuning: l.tuning,
        idp,
        initial: mountState,
        onRender: (geo) => {
          applyGeo(els.current, geo, prevGeo.current);
          prevGeo.current = geo;
        },
        onCue: (cue) => callbacks.current.onCue?.(cue),
        onAutoState: (s) => callbacks.current.onAutoState?.(s),
      });
      prevGeo.current = initial;
      e.setTalking(l.talking);
      e.setState(l.state);
      engineRef.current = e;
      callbacks.current.onEngine?.(e);
      // 화면 밖·숨긴 탭·가려짐이면 멈춤
      if (svgRef.current && typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1].isIntersecting;
          update();
        });
        io.observe(svgRef.current);
      }
      // visibility·opacity 변화는 IntersectionObserver가 알려 주지 않아 2초마다 한 번 확인
      poll = window.setInterval(update, 2000);
      update();
    });
    updateRef.current = update;
    const unquiet = subscribeBackdropQuiet(update);
    document.addEventListener('visibilitychange', update);
    return () => {
      cancelAnimationFrame(start);
      window.clearInterval(poll);
      io?.disconnect();
      unquiet();
      document.removeEventListener('visibilitychange', update);
      e?.destroy();
      engineRef.current = null;
      updateRef.current = null;
    };
  }, [def, idp, initial, mountState]);

  // 부모가 멈추라고 할 때 (모달 뒤·접힌 패널 등)
  useEffect(() => updateRef.current?.(), [paused]);
  useEffect(() => engineRef.current?.setState(state), [state]);
  useEffect(() => engineRef.current?.setTalking(talking), [talking]);
  useEffect(() => engineRef.current?.setMotion(tier, reduced), [tier, reduced]);
  // 스타일·코스튬·필터가 바뀌면 새로 생긴 요소가 있으니 다음 렌더는 모든 속성을 다시 쓴다
  const costumeKey = costume ? JSON.stringify(costume) : '';
  useEffect(() => {
    prevGeo.current = null;
    engineRef.current?.setStyle(style);
    engineRef.current?.refresh();
  }, [style, costumeKey, policy.filters]);
  const tuningKey = tuning ? JSON.stringify(tuning) : '';
  useEffect(() => {
    if (tuningKey) engineRef.current?.setTuning(JSON.parse(tuningKey));
  }, [tuningKey]);

  // 포인터 따라보기 (이벤트는 rAF로 묶어 프레임당 한 번만 getBoundingClientRect)
  const follow = lookAt && policy.mode === 'live';
  useEffect(() => {
    if (!follow) {
      engineRef.current?.clearPointer();
      return;
    }
    let pending: PointerEvent | null = null;
    let raf = 0;
    const flush = () => {
      raf = 0;
      const ev = pending;
      const svg = svgRef.current;
      if (!ev || !svg || !engineRef.current) return;
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.42;
      const span = Math.max(160, r.width * 1.4);
      engineRef.current.setPointer(
        (ev.clientX - cx) / span,
        (ev.clientY - cy) / span,
        ev.pointerType !== 'mouse',
      );
    };
    const onMove = (ev: PointerEvent) => {
      pending = ev;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onLeave = () => engineRef.current?.clearPointer();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [follow]);

  const Markup = def.Markup;
  return (
    <Markup
      geo={initial}
      pal={pal}
      style={style}
      costume={costume}
      idp={idp}
      size={size}
      framing={framing}
      label={label ?? `${def.name} - ${def.stateLabel[state]}`}
      filters={policy.filters}
      className={className}
      reg={reg}
      svgRef={svgRef}
      interactive={pokeable}
      onPointerDown={pokeable ? () => engineRef.current?.poke() : undefined}
    />
  );
}

/** 캐릭터 정의(`PYBAEM`·`BUGBUG`·`BYEOLTTONGI`)를 받아 그리는 라이브 리그 */
export const RigView = forwardRef(RigViewInner) as <S extends string, P>(
  props: RigViewProps<S, P> & { def: RigDef<S, P> } & {
    ref?: Ref<RigHandle<S>>;
  },
) => JSX.Element;
