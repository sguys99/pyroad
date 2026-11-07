/**
 * React SVG 엘리먼트 → SVG 문자열 (P0-10 `lib/svg.ts` 이식, P2-19). `react-dom/server` 없이 직렬화한다.
 *
 * - App Router의 Route Handler·opengraph-image는 react-server 조건으로 번들되어 `react-dom/server`를 import하면 빌드 에러
 * - satori는 `<svg>` 안의 함수 컴포넌트를 펼치지 않아 리그를 그대로 넣으면 빈칸 → 문자열로 만들어 `<img src="data:…">`로 넣는다
 *   (resvg가 직접 그림)
 * - memo·forwardRef·함수 컴포넌트·Fragment를 펼치고, camelCase 속성을 kebab-case로, id·url(#id)에 접두사를 붙인다
 * - 정지 그림이라 `<animate>` 류는 버린다. 공유 카드 SVG에 `<text>`·`<foreignObject>`·래스터 `<image>`가 있으면
 *   resvg가 그리지 못하므로 `findForbiddenSvg`로 막는다(테스트)
 */
import { Fragment, isValidElement, type ReactNode } from 'react';

const MEMO = Symbol.for('react.memo');
const FORWARD_REF = Symbol.for('react.forward_ref');

/** SVG에서 camelCase 그대로 쓰는 속성 */
const KEEP_CAMEL = new Set([
  'viewBox',
  'preserveAspectRatio',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'filterUnits',
  'primitiveUnits',
  'stdDeviation',
  'baseFrequency',
  'numOctaves',
  'pathLength',
  'spreadMethod',
  'tableValues',
  'xChannelSelector',
  'yChannelSelector',
  'stitchTiles',
]);
const DROP_PROPS = new Set([
  'children',
  'key',
  'ref',
  'role',
  'className',
  'dangerouslySetInnerHTML',
  'focusable',
]);
const ANIMATION = new Set([
  'animate',
  'animateTransform',
  'animateMotion',
  'set',
]);

/** 공유 카드 SVG에서 resvg가 못 그리는 요소 (P0-10 §4.5) */
export const FORBIDDEN_SVG = /<(text|tspan|foreignObject|image)\b/i;

export function findForbiddenSvg(svg: string): string | null {
  return FORBIDDEN_SVG.exec(svg)?.[1] ?? null;
}

function attrName(k: string): string {
  if (k === 'xlinkHref') return 'xlink:href';
  if (k.startsWith('aria-') || k.startsWith('data-')) return k;
  if (KEEP_CAMEL.has(k)) return k;
  return k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface SerializeOptions {
  /** id와 url(#id)·href="#id"에 붙일 접두사 (한 카드에 같은 그림을 여러 번 넣을 때 충돌 방지) */
  idPrefix?: string;
}

type ElementType =
  | string
  | ((p: unknown) => ReactNode)
  | {
      $$typeof: symbol;
      type?: unknown;
      render?: (p: unknown, r: unknown) => ReactNode;
    };

export function serializeSvg(
  node: ReactNode,
  opts: SerializeOptions = {},
): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return esc(String(node));
  }
  if (Array.isArray(node))
    return node.map((n) => serializeSvg(n, opts)).join('');
  if (!isValidElement(node)) return '';

  const el = node as unknown as {
    type: ElementType;
    props: Record<string, unknown>;
  };
  const type = el.type;
  if (type === Fragment) {
    return serializeSvg(el.props.children as ReactNode, opts);
  }
  if (typeof type === 'function') return serializeSvg(type(el.props), opts);
  if (typeof type === 'object' && type !== null) {
    if (type.$$typeof === MEMO && typeof type.type === 'function') {
      return serializeSvg(
        (type.type as (p: unknown) => ReactNode)(el.props),
        opts,
      );
    }
    if (type.$$typeof === FORWARD_REF && type.render) {
      return serializeSvg(type.render(el.props, null), opts);
    }
    return '';
  }
  if (typeof type !== 'string' || ANIMATION.has(type)) return '';

  const prefix = opts.idPrefix;
  let attrs = '';
  for (const [k, v] of Object.entries(el.props)) {
    if (DROP_PROPS.has(k) || v === undefined || v === null || v === false) {
      continue;
    }
    if (typeof v === 'function') continue;
    let val: string;
    if (k === 'style' && typeof v === 'object') {
      val = Object.entries(v as Record<string, string | number>)
        .map(([sk, sv]) => `${attrName(sk)}:${sv}`)
        .join(';');
    } else {
      val = String(v);
    }
    if (prefix) {
      if (k === 'id') val = prefix + val;
      val = val.replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`);
      if ((k === 'href' || k === 'xlinkHref') && val.startsWith('#')) {
        val = `#${prefix}${val.slice(1)}`;
      }
    }
    attrs += ` ${attrName(k)}="${esc(val)}"`;
  }
  if (type === 'svg' && !('xmlns' in el.props)) {
    attrs += ' xmlns="http://www.w3.org/2000/svg"';
  }
  const inner = serializeSvg(el.props.children as ReactNode, opts);
  return inner ? `<${type}${attrs}>${inner}</${type}>` : `<${type}${attrs}/>`;
}

/** SVG 문자열 → satori `<img src>`용 data URI (Node·Edge 공통, Buffer 없이) */
export function svgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}
