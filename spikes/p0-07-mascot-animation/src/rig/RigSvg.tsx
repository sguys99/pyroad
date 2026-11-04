// 파이뱀 리그 순수 마크업 (훅 없음, 'use client' 아님)
// 서버 컴포넌트·공유 카드(next/og, P0-10 직렬화기)·아바타에서 엔진 없이 import
import { geometry, type Geo } from './geometry';
import { HALO_COLOR, STATE_LABEL, staticParams, type RigState, type RigStyle } from './params';
import { Cape, Glasses, Hat, Backdrop, type Costume } from './costumes';

export interface Palette {
  body: string;
  bodyDark: string;
  bodyLight: string;
  belly: string;
  ink: string;
  cheek: string;
  tongue: string;
  outline: string;
}
export const PALETTE_A: Palette = {
  body: '#66BB6A',
  bodyDark: '#43A047',
  bodyLight: '#A5E3A0',
  belly: '#C5E8B7',
  ink: '#2E7D32',
  cheek: '#FF8A80',
  tongue: '#FF7A8A',
  outline: 'none',
};
export const PALETTE_B: Palette = {
  body: '#9CCB80',
  bodyDark: '#77A862',
  bodyLight: '#C4E2AE',
  belly: '#EAF1CF',
  ink: '#3B2F25',
  cheek: '#E8927C',
  tongue: '#E07A6C',
  outline: '#3B2F25',
};

export const REF_KEYS = [
  'root', 'shadow', 'halo', 'tail', 'tailIn', 'tailTip', 'head', 'face', 'cheekL', 'cheekR',
  'eyeL', 'eyeR', 'hlL', 'hlR', 'arcL', 'arcR', 'clipL', 'clipR', 'browL', 'browR',
  'mouth', 'mouthClip', 'tongue', 'spark0', 'spark1', 'spark2', 'spark3',
  'bub0', 'bub1', 'cloud', 'dot0', 'dot1', 'dot2', 'note0', 'note1', 'tear', 'hat', 'cape', 'boil',
] as const;

const STAR = 'M0 -6.5 Q1.1 -1.1 6.5 0 Q1.1 1.1 0 6.5 Q-1.1 1.1 -6.5 0 Q-1.1 -1.1 0 -6.5Z';
const NOTE =
  'M-3 0 a3.4 2.6 -20 1 0 6.4 -1.2 V-13 q4 1.5 6 5 q-1 -2.8 -4.4 -4.4 V-14.6 h-1.6 V-1.6 A3.4 2.6 -20 0 0 -3 0Z';
const DROP = 'M0 -4.5 C1.8 -1.6 3.2 0.6 3.2 2.2 A3.2 3.2 0 1 1 -3.2 2.2 C-3.2 0.6 -1.8 -1.6 0 -4.5Z';
const CLOUD =
  'M-16 6 a7 7 0 0 1 1 -13.6 a9 9 0 0 1 16 -3.6 a8 8 0 0 1 13 4.2 a6.5 6.5 0 0 1 1 13 Z';

export interface RigSvgProps {
  geo: Geo;
  pal: Palette;
  style: RigStyle;
  costume: Costume;
  /** 그라디언트·clipPath id 접두사 (한 화면에 여러 개면 서로 달라야 함) */
  idp: string;
  size: number;
  framing: 'stage' | 'avatar';
  label: string;
  className?: string;
  reg?: (k: (typeof REF_KEYS)[number]) => (el: Element | null) => void;
  svgRef?: React.Ref<SVGSVGElement>;
  interactive?: boolean;
  onPointerDown?: () => void;
}

/**
 * 순수 마크업 (훅 없음). 같은 함수를 ① 라이브 리그 ② 정적 렌더 ③ P0-10 직렬화기(함수 컴포넌트를 직접 호출)에서 쓴다.
 */
export function RigSvg({
  geo,
  pal,
  style,
  costume,
  idp,
  size,
  framing,
  label,
  className,
  reg,
  svgRef,
  interactive,
  onPointerDown,
}: RigSvgProps) {
  const id = (s: string) => `${idp}${s}`;
  const a = (k: string) => geo[k] ?? {};
  const r = (k: (typeof REF_KEYS)[number]) => (reg ? reg(k) : undefined);
  const isB = style === 'B';
  const outline = isB ? { stroke: pal.outline, strokeWidth: 2.2, strokeLinejoin: 'round' as const } : {};
  const viewBox = framing === 'stage' ? '-20 -36 168 168' : '0 0 128 128';

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={viewBox}
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      className={className}
      onPointerDown={onPointerDown}
      style={interactive ? { touchAction: 'manipulation', cursor: 'pointer', overflow: 'visible' } : { overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={id('bodyG')} cx="0.38" cy="0.28" r="0.75">
          <stop offset="0%" stopColor={pal.bodyLight} stopOpacity="0.95" />
          <stop offset="55%" stopColor={pal.body} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('shadeG')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="55%" stopColor={pal.bodyDark} stopOpacity="0" />
          <stop offset="100%" stopColor={pal.bodyDark} stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={id('headG')} cx="0.36" cy="0.26" r="0.8">
          <stop offset="0%" stopColor={pal.bodyLight} stopOpacity="1" />
          <stop offset="60%" stopColor={pal.body} stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('clipL')}>
          <polygon ref={r('clipL')} {...a('clipL')} />
        </clipPath>
        <clipPath id={id('clipR')}>
          <polygon ref={r('clipR')} {...a('clipR')} />
        </clipPath>
        <clipPath id={id('mouthClip')}>
          <path ref={r('mouthClip')} {...a('mouthClip')} />
        </clipPath>
        {isB && (
          <filter id={id('boil')} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence ref={r('boil')} type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={1} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={1} seed={3} result="grain" />
            <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0.10 0" result="g2" />
            <feComposite in="g2" in2="d" operator="in" result="g3" />
            <feMerge>
              <feMergeNode in="d" />
              <feMergeNode in="g3" />
            </feMerge>
          </filter>
        )}
      </defs>

      {costume.bg && <Backdrop kind={costume.bg} />}
      <circle ref={r('halo')} cx="64" cy="64" r="58" {...a('halo')} />
      <ellipse ref={r('shadow')} cy="111" ry="5" fill={isB ? '#6B5A45' : '#1B5E20'} {...a('shadow')} />

      <g filter={isB ? `url(#${id('boil')})` : undefined}>
        <g ref={r('root')} {...a('root')}>
          {costume.cape && <Cape refCb={r('cape')} d={a('cape').d} color={costume.cape} outline={isB ? pal.outline : undefined} />}
          {/* 꼬리 */}
          <path
            ref={r('tail')}
            {...a('tail')}
            stroke={isB ? pal.outline : pal.body}
            strokeWidth={isB ? 11.4 : 8}
            strokeLinecap="round"
            fill="none"
          />
          {isB && <path ref={r('tailIn')} {...a('tailIn')} fill="none" stroke={pal.body} strokeWidth={7.2} strokeLinecap="round" />}
          <circle ref={r('tailTip')} {...a('tailTip')} r="4.8" fill={pal.bodyDark} {...outline} />
          {/* 몸 (또아리) */}
          <ellipse cx="64" cy="80" rx="40" ry="28" fill={pal.body} {...outline} />
          {!isB && <ellipse cx="64" cy="80" rx="40" ry="28" fill={`url(#${id('shadeG')})`} />}
          {!isB && <ellipse cx="64" cy="80" rx="40" ry="28" fill={`url(#${id('bodyG')})`} />}
          <ellipse cx="64" cy="85" rx="28" ry="17" fill={pal.belly} {...(isB ? { stroke: pal.outline, strokeWidth: 1.4 } : {})} />
          {isB ? (
            <path d="M44 84 Q64 90 84 84 M47 92 Q64 97 81 92" stroke={pal.outline} strokeWidth="1" fill="none" opacity="0.45" />
          ) : (
            <ellipse cx="50" cy="66" rx="10" ry="4.5" fill="#fff" opacity="0.28" transform="rotate(-18 50 66)" />
          )}
          {/* 머리 */}
          <g ref={r('head')} {...a('head')}>
            <ellipse cx="64" cy="44" rx="28" ry="24" fill={pal.body} {...outline} />
            {!isB && <ellipse cx="64" cy="44" rx="28" ry="24" fill={`url(#${id('headG')})`} />}
            {!isB && <ellipse cx="52" cy="28" rx="8.5" ry="4.2" fill="#fff" opacity="0.4" transform="rotate(-22 52 28)" />}
            <ellipse ref={r('cheekL')} cx="44" fill={pal.cheek} {...a('cheekL')} />
            <ellipse ref={r('cheekR')} cx="84" fill={pal.cheek} {...a('cheekR')} />
            <g ref={r('face')} {...a('face')}>
              <g clipPath={`url(#${id('clipL')})`}>
                <ellipse ref={r('eyeL')} fill={pal.ink} {...a('eyeL')} />
                <circle ref={r('hlL')} fill="#fff" {...a('hlL')} />
              </g>
              <g clipPath={`url(#${id('clipR')})`}>
                <ellipse ref={r('eyeR')} fill={pal.ink} {...a('eyeR')} />
                <circle ref={r('hlR')} fill="#fff" {...a('hlR')} />
              </g>
              <path ref={r('arcL')} stroke={pal.ink} strokeWidth="2.7" strokeLinecap="round" fill="none" {...a('arcL')} />
              <path ref={r('arcR')} stroke={pal.ink} strokeWidth="2.7" strokeLinecap="round" fill="none" {...a('arcR')} />
              <path ref={r('browL')} stroke={pal.ink} strokeWidth="2.2" strokeLinecap="round" fill="none" {...a('browL')} />
              <path ref={r('browR')} stroke={pal.ink} strokeWidth="2.2" strokeLinecap="round" fill="none" {...a('browR')} />
              <path ref={r('mouth')} fill={pal.ink} stroke={pal.ink} strokeWidth="2.4" strokeLinejoin="round" {...a('mouth')} />
              <ellipse ref={r('tongue')} fill={pal.tongue} clipPath={`url(#${id('mouthClip')})`} {...a('tongue')} />
              <g ref={r('tear')} {...a('tear')}>
                <path d={DROP} fill="#81D4FA" stroke={isB ? pal.outline : '#4FC3F7'} strokeWidth="0.8" />
              </g>
              {costume.glasses && <Glasses kind={costume.glasses} />}
            </g>
            <g ref={r('hat')} {...a('hat')}>
              {costume.hat && <Hat kind={costume.hat} outline={isB ? pal.outline : undefined} />}
            </g>
          </g>
          {/* 소품 */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} ref={r(`spark${i}` as 'spark0')} {...a(`spark${i}`)}>
              <path d={STAR} fill={i % 2 ? '#FFD54F' : '#FFF176'} stroke={isB ? pal.outline : '#FFB300'} strokeWidth="0.8" />
            </g>
          ))}
          <g ref={r('bub0')} {...a('bub0')}>
            <circle r="2.6" fill="#fff" stroke="#B0BEC5" strokeWidth="1.2" />
          </g>
          <g ref={r('bub1')} {...a('bub1')}>
            <circle r="3.8" fill="#fff" stroke="#B0BEC5" strokeWidth="1.2" />
          </g>
          <g ref={r('cloud')} {...a('cloud')}>
            <path d={CLOUD} fill="#fff" stroke="#B0BEC5" strokeWidth="1.4" />
            {[0, 1, 2].map((i) => (
              <circle key={i} ref={r(`dot${i}` as 'dot0')} cx={-6 + i * 6} cy="0" r="2" fill="#7E57C2" {...a(`dot${i}`)} />
            ))}
          </g>
          {[0, 1].map((i) => (
            <g key={i} ref={r(`note${i}` as 'note0')} {...a(`note${i}`)}>
              <path d={NOTE} fill={i ? '#29B6F6' : '#AB47BC'} />
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

/** 엔진 없는 정적 파이뱀 (훅 없음): 공유 카드(next/og)·아바타·SSR·reduced-motion */
export function PybaemStatic({
  state = 'idle',
  style = 'A',
  palette,
  costume = {},
  size = 128,
  framing = 'avatar',
  reduced = false,
  idPrefix = 'pys',
}: {
  state?: RigState;
  style?: RigStyle;
  palette?: Partial<Palette>;
  costume?: Costume;
  size?: number;
  framing?: 'stage' | 'avatar';
  reduced?: boolean;
  idPrefix?: string;
}) {
  const pal: Palette = { ...(style === 'B' ? PALETTE_B : PALETTE_A), ...palette };
  const geo = geometry(staticParams(state), { haloColor: HALO_COLOR[state] });
  if (reduced) geo.halo = { ...geo.halo, opacity: state === 'idle' ? '0' : '0.55' };
  return (
    <RigSvg
      geo={geo}
      pal={pal}
      style={style}
      costume={costume}
      idp={idPrefix}
      size={size}
      framing={framing}
      label={`파이뱀 선생님 - ${STATE_LABEL[state]}`}
    />
  );
}
