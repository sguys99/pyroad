/**
 * 별똥이 리그 마크업 (훅 없음). 기존 `ByeolttongiSvg`의 노란 별·안쪽 밝은 별·주황 얼굴을 유지하면서
 * 끝을 둥글게 하고(팔·다리로 움직임) 꼬리 빛·코인·반짝이·착지 먼지를 소품으로 나눴다.
 */
import {
  PaperFilter,
  RigFrame,
  attrs,
  outlineOf,
  refOf,
  usesPaper,
} from '../core/markup';
import type { MarkupProps } from '../core/types';
import { STYLE_RULES, type RigStyle } from '../style';

export interface ByeolttongiPalette {
  body: string;
  bodyDark: string;
  bodyLight: string;
  inner: string;
  ink: string;
  cheek: string;
  cheekAlpha: string;
  tongue: string;
  outline: string;
  shadow: string;
  trail: string;
  trailCore: string;
  coin: string;
  coinDark: string;
}

export const BYEOLTTONGI_PALETTES: Record<RigStyle, ByeolttongiPalette> = {
  A: {
    body: '#FFD54F',
    bodyDark: '#F9A825',
    bodyLight: '#FFF59D',
    inner: '#FFF9C4',
    ink: '#8A4B08',
    cheek: '#FF7A9A',
    cheekAlpha: '0.62',
    tongue: '#FF8A80',
    outline: 'none',
    shadow: '#5D4037',
    trail: '#FFCA28',
    trailCore: '#FFFDE7',
    coin: '#FFCA28',
    coinDark: '#E08A00',
  },
  B: {
    body: '#F2C14E',
    bodyDark: '#D9A33A',
    bodyLight: '#F8DC8C',
    inner: '#FBEFC4',
    ink: '#3B2F25',
    cheek: '#F2879B',
    cheekAlpha: '0.6',
    tongue: '#E07A6C',
    /** 몸(#F2C14E)의 진한 톤 (P2-07 2차). 반짝이·코인도 같은 금색 톤 선 */
    outline: '#A97C24',
    shadow: '#8E877C',
    trail: '#E9B949',
    trailCore: '#FFF6D8',
    coin: '#F2C14E',
    coinDark: '#B7832B',
  },
  AB: {
    body: '#FFD54F',
    bodyDark: '#F9A825',
    bodyLight: '#FFF59D',
    inner: '#FFF9C4',
    ink: '#24324A',
    cheek: '#FF7A9A',
    cheekAlpha: '0.62',
    tongue: '#FF8A80',
    outline: '#24324A',
    shadow: '#24324A',
    trail: '#FFCA28',
    trailCore: '#FFFDE7',
    coin: '#FFCA28',
    coinDark: '#E08A00',
  },
};

const SPARK =
  'M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7Z';
const COIN_STAR =
  'M0 -5 L1.45 -1.55 5 -1.3 2.25 1.05 3.1 4.65 0 2.75 -3.1 4.65 -2.25 1.05 -5 -1.3 -1.45 -1.55Z';

export function ByeolttongiMarkup(props: MarkupProps<ByeolttongiPalette>) {
  const { geo, pal, style, idp, reg } = props;
  const a = (k: string) => attrs(geo, k);
  const r = (k: string) => refOf(reg, k);
  const rules = STYLE_RULES[style];
  const inked = rules.outline > 0;
  const ol = outlineOf(style, pal.outline);
  const paper = usesPaper(props);
  const propInk = inked ? pal.outline : undefined;

  const defs = (
    <>
      <clipPath id={`${idp}mouthClip`}>
        <path ref={r('mouthClip')} {...a('mouthClip')} />
      </clipPath>
      {paper && <PaperFilter {...props} />}
    </>
  );

  return (
    <RigFrame {...props} defs={defs}>
      <circle ref={r('halo')} cx="64" cy="62" r="58" {...a('halo')} />
      <ellipse
        ref={r('shadow')}
        cy="114"
        ry="4"
        fill={pal.shadow}
        {...a('shadow')}
      />
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          ref={r(`dust${i}`)}
          stroke={propInk ?? '#FFB300'}
          strokeWidth="2.2"
          strokeLinecap="round"
          {...a(`dust${i}`)}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} ref={r(`tw${i}`)} {...a(`tw${i}`)}>
          <path
            d={SPARK}
            fill={i % 2 ? '#FFE082' : '#FFD54F'}
            {...(propInk ? { stroke: propInk, strokeWidth: 1 } : {})}
          />
        </g>
      ))}
      <g filter={paper ? `url(#${idp}boil)` : undefined}>
        <g ref={r('move')} {...a('move')}>
          {/* 꼬리 빛 */}
          <path
            ref={r('trailOut')}
            stroke={pal.trail}
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
            {...a('trailOut')}
          />
          <path
            ref={r('trailIn')}
            stroke={pal.trailCore}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
            {...a('trailIn')}
          />
          {[0, 1, 2].map((i) => (
            <circle
              key={i}
              ref={r(`td${i}`)}
              r={2.4 - i * 0.5}
              fill={pal.body}
              {...a(`td${i}`)}
            />
          ))}
          {/* 몸 */}
          <g ref={r('body')} {...a('body')}>
            <path ref={r('star')} fill={pal.body} {...ol} {...a('star')} />
            <path
              ref={r('inner')}
              fill={pal.inner}
              opacity={inked ? 0.55 : 0.65}
              {...a('inner')}
            />
            {rules.gloss && (
              <ellipse
                cx="50"
                cy="49"
                rx="5"
                ry="2.6"
                fill="#fff"
                opacity="0.7"
                transform="rotate(-28 50 49)"
              />
            )}
            <ellipse
              ref={r('cheekL')}
              cx="48.5"
              cy="63.5"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekL')}
            />
            <ellipse
              ref={r('cheekR')}
              cx="79.5"
              cy="63.5"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekR')}
            />
            <g ref={r('face')} {...a('face')}>
              {(['L', 'R'] as const).map((s) => (
                <g key={s}>
                  <ellipse
                    ref={r(`eye${s}`)}
                    fill={pal.ink}
                    {...a(`eye${s}`)}
                  />
                  <circle ref={r(`hl${s}`)} fill="#fff" {...a(`hl${s}`)} />
                  <path
                    ref={r(`arc${s}`)}
                    stroke={pal.ink}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                    {...a(`arc${s}`)}
                  />
                  <path
                    ref={r(`brow${s}`)}
                    stroke={pal.ink}
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    {...a(`brow${s}`)}
                  />
                </g>
              ))}
              <path
                ref={r('mouth')}
                fill={pal.ink}
                stroke={pal.ink}
                strokeWidth="2"
                strokeLinejoin="round"
                {...a('mouth')}
              />
              <ellipse
                ref={r('tongue')}
                fill={pal.tongue}
                clipPath={`url(#${idp}mouthClip)`}
                {...a('tongue')}
              />
            </g>
          </g>
          {/* 코인 */}
          <g ref={r('coin')} {...a('coin')}>
            <circle
              r="8"
              fill={pal.coin}
              stroke={propInk ?? pal.coinDark}
              strokeWidth="1.6"
            />
            <circle
              r="5.4"
              fill="none"
              stroke={pal.coinDark}
              strokeWidth="1"
              opacity="0.7"
            />
            <path d={COIN_STAR} fill={pal.coinDark} opacity="0.85" />
          </g>
        </g>
      </g>
    </RigFrame>
  );
}
