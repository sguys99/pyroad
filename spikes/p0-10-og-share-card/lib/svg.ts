/**
 * React SVG 엘리먼트 → SVG 문자열 직렬화기 (react-dom/server 없이).
 *
 * 왜 필요한가
 * - App Router의 Route Handler / opengraph-image는 react-server 조건으로 번들되어
 *   `react-dom/server`(renderToStaticMarkup)를 import하면 빌드 에러가 납니다.
 * - satori의 인라인 <svg> 지원은 memo 컴포넌트·<animate>·<text> 처리에 제약이 있어,
 *   기존 캐릭터 컴포넌트(PybaemSvg 등)를 그대로 넣기보다 문자열로 만들어
 *   `<img src="data:image/svg+xml;base64,...">`로 넣는 편이 안전합니다 (resvg가 직접 렌더).
 *
 * 기능: memo/함수 컴포넌트/Fragment 펼치기, camelCase → kebab-case 속성 변환,
 *       id 접두사(여러 SVG를 합칠 때 gradient id 충돌 방지), <animate> 제거 옵션.
 */
import { Fragment, isValidElement, type ReactNode } from 'react';

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

// SVG에서 camelCase를 그대로 써야 하는 속성
const KEEP_CAMEL = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientUnits', 'gradientTransform', 'patternUnits',
  'patternContentUnits', 'patternTransform', 'clipPathUnits', 'maskUnits', 'maskContentUnits',
  'filterUnits', 'primitiveUnits', 'stdDeviation', 'baseFrequency', 'numOctaves', 'attributeName',
  'repeatCount', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'pathLength',
  'spreadMethod', 'startOffset', 'textLength', 'lengthAdjust', 'tableValues', 'kernelMatrix',
  'diffuseConstant', 'specularExponent', 'surfaceScale', 'xChannelSelector', 'yChannelSelector',
  'stitchTiles', 'keyTimes', 'keySplines', 'calcMode',
]);
const DROP_PROPS = new Set(['children', 'key', 'ref', 'role', 'aria-label', 'className', 'dangerouslySetInnerHTML']);

export interface SvgSerializeOptions {
  /** id와 url(#id) 참조에 붙일 접두사 */
  idPrefix?: string;
  /** <animate>, <animateTransform>, <set> 제거 (정지 이미지에서는 의미 없음) */
  stripAnimation?: boolean;
}

function attrName(k: string): string {
  if (k === 'xlinkHref') return 'xlink:href';
  if (k.startsWith('aria') || k.startsWith('data')) return k;
  if (KEEP_CAMEL.has(k)) return k;
  return k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function withPrefix(v: string, prefix?: string): string {
  if (!prefix) return v;
  return v.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
}

export function serializeSvg(node: ReactNode, opts: SvgSerializeOptions = {}): string {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(String(node));
  if (Array.isArray(node)) return node.map((n) => serializeSvg(n, opts)).join('');
  if (!isValidElement(node)) return '';

  const el = node as { type: unknown; props: Record<string, unknown> };
  const type = el.type as
    | string
    | ((p: unknown) => ReactNode)
    | { $$typeof: symbol; type?: unknown; render?: (p: unknown, r: unknown) => ReactNode };

  if (type === Fragment) return serializeSvg(el.props.children as ReactNode, opts);
  if (typeof type === 'function') return serializeSvg(type(el.props), opts);
  if (typeof type === 'object' && type !== null) {
    if (type.$$typeof === MEMO) {
      return serializeSvg({ ...(node as object), type: type.type } as unknown as ReactNode, opts);
    }
    if (type.$$typeof === FORWARD_REF && type.render) return serializeSvg(type.render(el.props, null), opts);
    return '';
  }
  if (typeof type !== 'string') return '';
  if (opts.stripAnimation && (type === 'animate' || type === 'animateTransform' || type === 'set')) return '';

  let attrs = '';
  for (const [k, v] of Object.entries(el.props)) {
    if (DROP_PROPS.has(k) || v === undefined || v === null || v === false) continue;
    if (typeof v === 'function') continue;
    let val = String(v);
    if (k === 'id' && opts.idPrefix) val = opts.idPrefix + val;
    val = withPrefix(val, opts.idPrefix);
    if (k === 'style' && typeof v === 'object') {
      val = Object.entries(v as Record<string, string>)
        .map(([sk, sv]) => `${attrName(sk)}:${sv}`)
        .join(';');
    }
    attrs += ` ${attrName(k)}="${esc(val)}"`;
  }
  if (type === 'svg' && !('xmlns' in el.props)) attrs += ' xmlns="http://www.w3.org/2000/svg"';
  const inner = serializeSvg(el.props.children as ReactNode, opts);
  return inner ? `<${type}${attrs}>${inner}</${type}>` : `<${type}${attrs}/>`;
}

/** SVG 문자열 → satori <img src>에 넣을 data URI */
export function svgDataUri(svg: string): string {
  // Node·Edge 공통 (Buffer 없이)
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

/** 여러 SVG 레이어(같은 viewBox)를 하나의 SVG로 합칩니다. Phase 9 꾸미기 레이어 합성용. */
export function composeLayers(viewBox: string, layers: string[], size: number): string {
  const inner = layers
    .map((l) => l.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''))
    .map((l, i) => `<g data-layer="${i}">${l}</g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>`;
}
