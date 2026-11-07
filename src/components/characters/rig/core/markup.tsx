/**
 * 마크업 공용 조각 (훅 없음). 세 캐릭터의 `<svg>` 틀·종이 결 필터·geometry 읽기 도우미.
 */
import type { ReactNode } from 'react';
import { STYLE_RULES } from '../style';
import type { Attrs, MarkupProps } from './types';

/** geometry 속성 이름 → React prop 이름 (`clip-path`처럼 대시가 있는 속성은 geometry에서 camelCase로 둔다) */
export function attrs(geo: MarkupProps<unknown>['geo'], key: string): Attrs {
  return geo[key] ?? {};
}

/** ref 등록 도우미: 정적 렌더면 undefined */
export function refOf(
  reg: MarkupProps<unknown>['reg'],
  key: string,
): ((el: Element | null) => void) | undefined {
  return reg ? reg(key) : undefined;
}

/** 외곽선 속성 (A는 없음) */
export function outlineOf(style: MarkupProps<unknown>['style'], ink: string) {
  const w = STYLE_RULES[style].outline;
  return w
    ? { stroke: ink, strokeWidth: w, strokeLinejoin: 'round' as const }
    : {};
}

/** 종이 결 필터를 쓰나: 스타일(B·A×B) × 연출 단계(full만, lite 이하·공유 카드는 외곽선만) */
export function usesPaper(props: MarkupProps<unknown>): boolean {
  return props.filters && STYLE_RULES[props.style].paper > 0;
}

/**
 * B·A×B 종이 결: 선 흔들림(`feDisplacementMap`, B는 seed를 8fps로 바꿔 "선 떨림") + 입자.
 * seed·scale은 geometry의 `boil`·`boilMap`이 정한다.
 */
export function PaperFilter(props: MarkupProps<unknown>) {
  const { idp, geo, reg } = props;
  return (
    <filter id={`${idp}boil`} x="-15%" y="-15%" width="130%" height="130%">
      <feTurbulence
        ref={refOf(reg, 'boil')}
        type="fractalNoise"
        baseFrequency="0.045"
        numOctaves={2}
        seed={1}
        result="n"
        {...attrs(geo, 'boil')}
      />
      <feDisplacementMap
        ref={refOf(reg, 'boilMap')}
        in="SourceGraphic"
        in2="n"
        xChannelSelector="R"
        yChannelSelector="G"
        result="d"
        {...attrs(geo, 'boilMap')}
      />
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.9"
        numOctaves={1}
        seed={3}
        result="grain"
      />
      <feColorMatrix
        in="grain"
        type="matrix"
        values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0.10 0"
        result="g2"
      />
      <feComposite in="g2" in2="d" operator="in" result="g3" />
      <feMerge>
        <feMergeNode in="d" />
        <feMergeNode in="g3" />
      </feMerge>
    </filter>
  );
}

/** `<svg>` 틀: 크기·viewBox·접근성 이름·포인터 */
export function RigFrame(
  props: MarkupProps<unknown> & { children: ReactNode; defs?: ReactNode },
) {
  const {
    size,
    framing,
    label,
    className,
    svgRef,
    interactive,
    onPointerDown,
    children,
    defs,
  } = props;
  const viewBox = framing === 'stage' ? '-20 -36 168 168' : '0 0 128 128';
  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={viewBox}
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={className}
      onPointerDown={onPointerDown}
      style={
        interactive
          ? {
              touchAction: 'manipulation',
              cursor: 'pointer',
              overflow: 'visible',
            }
          : { overflow: 'visible' }
      }
    >
      {defs ? <defs>{defs}</defs> : null}
      {children}
    </svg>
  );
}

/** geometry 속성 이름 → DOM 속성 이름 */
const DOM_ATTR: Record<string, string> = {
  clipPath: 'clip-path',
  fillOpacity: 'fill-opacity',
  strokeWidth: 'stroke-width',
  strokeOpacity: 'stroke-opacity',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
};

/** 이전 값과 달라진 속성만 DOM에 쓴다. 쓴 개수를 돌려준다 */
export function applyGeo(
  els: Record<string, Element | null | undefined>,
  next: MarkupProps<unknown>['geo'],
  prev: MarkupProps<unknown>['geo'] | null,
): number {
  let writes = 0;
  for (const key in next) {
    const el = els[key];
    if (!el) continue;
    const a = next[key];
    const b = prev?.[key];
    for (const attr in a) {
      if (!b || b[attr] !== a[attr]) {
        el.setAttribute(DOM_ATTR[attr] ?? attr, a[attr]);
        writes++;
      }
    }
  }
  return writes;
}
