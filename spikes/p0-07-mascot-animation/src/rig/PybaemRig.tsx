'use client';
// 파이뱀 SVG 리그 (라이브)
// - 첫 렌더(SSR 포함)는 정적 포즈 → 하이드레이션 안전
// - 마운트 후 엔진이 ref로 속성만 갱신 (React 리렌더 없음)
// - 마크업은 RigSvg(훅 없음)와 공유
import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef } from 'react';
import { RigEngine } from './engine';
import { applyGeo, geometry, type Geo } from './geometry';
import { HALO_COLOR, STATE_LABEL, staticParams, type MotionTier, type RigState, type RigStyle } from './params';
import type { Costume } from './costumes';
import { PALETTE_A, PALETTE_B, REF_KEYS, RigSvg, type Palette } from './RigSvg';

export { PALETTE_A, PALETTE_B, RigSvg, PybaemStatic, type Palette, type RigSvgProps } from './RigSvg';

export interface PybaemRigProps {
  state?: RigState;
  talking?: boolean;
  size?: number;
  style?: RigStyle;
  palette?: Partial<Palette>;
  costume?: Costume;
  tier?: MotionTier;
  /** 미지정 시 prefers-reduced-motion을 따른다 */
  reducedMotion?: boolean;
  /** 엔진 없이 정적 포즈만 (공유 카드·아바타·SSR 전용) */
  static?: boolean;
  lookAt?: boolean;
  props?: boolean;
  framing?: 'stage' | 'avatar';
  seed?: number;
  className?: string;
  onEngine?: (e: RigEngine) => void;
}
export interface PybaemRigHandle {
  poke(): void;
  engine(): RigEngine | null;
}

function usePrefersReducedMotion() {
  const ref = useRef(false);
  if (typeof window !== 'undefined' && window.matchMedia) {
    ref.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return ref.current;
}

export const PybaemRig = forwardRef<PybaemRigHandle, PybaemRigProps>(function PybaemRig(
  {
    state = 'idle',
    talking = false,
    size = 200,
    style = 'A',
    palette,
    costume = {},
    tier = 'full',
    reducedMotion,
    static: isStatic = false,
    lookAt = true,
    props = true,
    framing = 'stage',
    seed,
    className,
    onEngine,
  },
  ref,
) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const pal: Palette = { ...(style === 'B' ? PALETTE_B : PALETTE_A), ...palette };
  const prefersReduced = usePrefersReducedMotion();
  const reduced = reducedMotion ?? prefersReduced;

  const els = useRef<Record<string, Element | null>>({});
  const reg = (k: (typeof REF_KEYS)[number]) => (el: Element | null) => {
    els.current[k] = el;
  };
  const svgRef = useRef<SVGSVGElement | null>(null);
  const engineRef = useRef<RigEngine | null>(null);
  const prevGeo = useRef<Geo | null>(null);

  // 첫 렌더 = 정적 포즈 (SSR과 클라이언트가 같은 결과)
  const initial = useMemo(
    () => geometry(staticParams(state), { haloColor: HALO_COLOR[state] }),
    // 정적 모드에서는 state가 바뀌면 다시 계산, 엔진 모드에서는 첫 값만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
    isStatic ? [state] : [],
  );
  if (isStatic && reduced) initial.halo = { ...initial.halo, opacity: state === 'idle' ? '0' : '0.55' };
  const a = (k: string) => initial[k] ?? {};

  useImperativeHandle(ref, () => ({
    poke: () => engineRef.current?.poke(),
    engine: () => engineRef.current,
  }));

  // 엔진 생성
  useEffect(() => {
    if (isStatic) return;
    const e = new RigEngine({
      tier,
      reduced,
      style,
      seed,
      props,
      onRender: (geo) => {
        applyGeo(els.current, geo, prevGeo.current);
        prevGeo.current = geo;
      },
    });
    prevGeo.current = initial;
    e.setState(state);
    engineRef.current = e;
    onEngine?.(e);
    // 화면 밖이면 멈춤
    let io: IntersectionObserver | null = null;
    if (svgRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => e.setVisible(entries[0].isIntersecting && !document.hidden));
      io.observe(svgRef.current);
    }
    const onVis = () => e.setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      e.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatic]);

  useEffect(() => engineRef.current?.setState(state), [state]);
  useEffect(() => engineRef.current?.setTalking(talking), [talking]);
  useEffect(() => engineRef.current?.setTier(tier), [tier]);
  useEffect(() => engineRef.current?.setReduced(reduced), [reduced]);
  useEffect(() => engineRef.current?.setStyle(style), [style]);

  // 포인터 따라보기 (마우스는 계속, 터치는 탭한 곳을 잠깐 봄)
  useEffect(() => {
    if (isStatic || !lookAt) return;
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
      engineRef.current.setPointer((ev.clientX - cx) / span, (ev.clientY - cy) / span, ev.pointerType !== 'mouse');
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
  }, [isStatic, lookAt]);

  return (
    <RigSvg
      geo={initial}
      pal={pal}
      style={style}
      costume={costume}
      idp={`py${uid}`}
      size={size}
      framing={framing}
      label={`파이뱀 선생님 - ${STATE_LABEL[state]}`}
      className={className}
      reg={isStatic ? undefined : reg}
      svgRef={svgRef}
      interactive={!isStatic}
      onPointerDown={isStatic ? undefined : () => engineRef.current?.poke()}
    />
  );
});
