/**
 * 파이뱀 리그 마크업 (훅 없음, 'use client' 아님). 라이브 리그·정적 렌더·공유 카드 직렬화기가 함께 쓴다.
 * A안 렌더 비용 최적화 (P0-07 §4.3 → P2-13): 그라디언트 3개를 단색 + 그늘·하이라이트 도형으로 바꿨고,
 * 눈꺼풀 clipPath는 슬플 때만 건다. `<text>`·`<foreignObject>`·래스터 `<image>` 없음 (P0-10).
 */
import { Backdrop, Cape, Glasses, Hat } from '../costumes';
import {
  PaperFilter,
  RigFrame,
  attrs,
  outlineOf,
  refOf,
  usesPaper,
} from '../core/markup';
import type { MarkupProps } from '../core/types';
import type { RigStyle } from '../style';
import { STYLE_RULES } from '../style';
import { STAR_EYE } from './geometry';

export interface PybaemPalette {
  body: string;
  bodyDark: string;
  bodyLight: string;
  belly: string;
  ink: string;
  /** 볼: 초록 몸 위에서 반투명 분홍이 갈색으로 섞이지 않게 차가운 분홍 + 높은 불투명도 (무드보드 P2-01 §8) */
  cheek: string;
  /** 볼 불투명도 (평소 = 이 값 × 0.88, 볼 빨개짐이면 이 값). 0.7 아래면 초록과 섞여 다시 갈색이 된다 */
  cheekAlpha: string;
  tongue: string;
  outline: string;
  shadow: string;
}

export const PYBAEM_PALETTES: Record<RigStyle, PybaemPalette> = {
  /** A 클레이: 외곽선 없음, 광택 */
  A: {
    body: '#66BB6A',
    bodyDark: '#43A047',
    bodyLight: '#A5E3A0',
    belly: '#C5E8B7',
    ink: '#2E7D32',
    cheek: '#FF7A9A',
    cheekAlpha: '0.85',
    tongue: '#FF7A8A',
    outline: 'none',
    shadow: '#1B5E20',
  },
  /** B 그림책: 세이지·크림. 외곽선은 몸색(#9CCB80)의 진한 톤, 눈·입(ink)은 짙은 갈색 그대로 (P2-07 2차) */
  B: {
    body: '#9CCB80',
    bodyDark: '#77A862',
    bodyLight: '#C4E2AE',
    belly: '#EAF1CF',
    ink: '#3B2F25',
    cheek: '#F2879B',
    cheekAlpha: '0.84',
    tongue: '#E07A6C',
    outline: '#5F804E',
    shadow: '#8E877C',
  },
  /** A×B: A의 선명한 초록 + 남색 잉크 외곽선 */
  AB: {
    body: '#5CC46F',
    bodyDark: '#3E9E54',
    bodyLight: '#A8E6A6',
    belly: '#DDF3C4',
    ink: '#24324A',
    cheek: '#FF7A9A',
    cheekAlpha: '0.85',
    tongue: '#FF7A8A',
    outline: '#24324A',
    shadow: '#24324A',
  },
};

const STAR =
  'M0 -6.5 Q1.1 -1.1 6.5 0 Q1.1 1.1 0 6.5 Q-1.1 1.1 -6.5 0 Q-1.1 -1.1 0 -6.5Z';
const NOTE =
  'M-3 0 a3.4 2.6 -20 1 0 6.4 -1.2 V-13 q4 1.5 6 5 q-1 -2.8 -4.4 -4.4 V-14.6 h-1.6 V-1.6 A3.4 2.6 -20 0 0 -3 0Z';
const DROP =
  'M0 -4.5 C1.8 -1.6 3.2 0.6 3.2 2.2 A3.2 3.2 0 1 1 -3.2 2.2 C-3.2 0.6 -1.8 -1.6 0 -4.5Z';
const CLOUD =
  'M-16 6 a7 7 0 0 1 1 -13.6 a9 9 0 0 1 16 -3.6 a8 8 0 0 1 13 4.2 a6.5 6.5 0 0 1 1 13 Z';
/** Z 한 글자 (가운데 기준, 9×10) */
const ZED = 'M-4.5 -5 H4.5 L-4.5 5 H4.5';
/** 물음표 (가운데 기준) */
const QMARK =
  'M-4.6 -6.6 C-4.6 -11.6 4.8 -12 4.8 -6.4 C4.8 -3 0.4 -2.4 0.4 1.6';

export function PybaemMarkup(props: MarkupProps<PybaemPalette>) {
  const { geo, pal, style, costume = {}, idp, reg } = props;
  const a = (k: string) => attrs(geo, k);
  const r = (k: string) => refOf(reg, k);
  const rules = STYLE_RULES[style];
  const inked = rules.outline > 0;
  const ol = outlineOf(style, pal.outline);
  const paper = usesPaper(props);
  // 소품(반짝이·모자·망토·물음표)에 잉크를 두르나: 몸색 톤 외곽선(B)이면 소품은 제 색
  const propInk = inked && !rules.tonal ? pal.outline : undefined;

  const defs = (
    <>
      <clipPath id={`${idp}clipL`}>
        <polygon ref={r('clipL')} {...a('clipL')} />
      </clipPath>
      <clipPath id={`${idp}clipR`}>
        <polygon ref={r('clipR')} {...a('clipR')} />
      </clipPath>
      <clipPath id={`${idp}mouthClip`}>
        <path ref={r('mouthClip')} {...a('mouthClip')} />
      </clipPath>
      {paper && <PaperFilter {...props} />}
    </>
  );

  return (
    <RigFrame {...props} defs={defs}>
      {costume.bg && <Backdrop kind={costume.bg} idp={idp} />}
      <circle ref={r('halo')} cx="64" cy="64" r="58" {...a('halo')} />
      <ellipse
        ref={r('shadow')}
        cy="111"
        ry="5"
        fill={pal.shadow}
        {...a('shadow')}
      />

      <g filter={paper ? `url(#${idp}boil)` : undefined}>
        <g ref={r('root')} {...a('root')}>
          {costume.cape && (
            <Cape
              refCb={r('cape')}
              d={a('cape').d}
              color={costume.cape}
              outline={propInk}
            />
          )}
          {/* 꼬리 */}
          <path
            ref={r('tail')}
            {...a('tail')}
            stroke={inked ? pal.outline : pal.body}
            strokeWidth={inked ? 7.2 + 2 * rules.outline : 8}
            strokeLinecap="round"
            fill="none"
          />
          {inked && (
            <path
              ref={r('tailIn')}
              {...a('tailIn')}
              fill="none"
              stroke={pal.body}
              strokeWidth={7.2}
              strokeLinecap="round"
            />
          )}
          <circle
            ref={r('tailTip')}
            {...a('tailTip')}
            r="4.8"
            fill={pal.bodyDark}
            {...ol}
          />
          {/* 몸 (또아리): 단색 + 아래 그늘 + 왼쪽 위 빛 (그라디언트 없음) */}
          <ellipse cx="64" cy="80" rx="40" ry="28" fill={pal.body} {...ol} />
          {rules.gloss && (
            <>
              <path
                d="M24.6 82 A40 28 0 0 0 103.4 82 A40 19 0 0 1 24.6 82Z"
                fill={pal.bodyDark}
                opacity="0.42"
              />
              <ellipse
                cx="50"
                cy="69"
                rx="21"
                ry="11"
                fill={pal.bodyLight}
                opacity="0.55"
                transform="rotate(-16 50 69)"
              />
            </>
          )}
          <ellipse
            cx="64"
            cy="85"
            rx="28"
            ry="17"
            fill={pal.belly}
            {...(inked
              ? {
                  stroke: pal.outline,
                  strokeWidth: Math.min(1.4, rules.outline),
                }
              : {})}
          />
          {inked && !rules.gloss && (
            <path
              d="M44 84 Q64 90 84 84 M47 92 Q64 97 81 92"
              stroke={pal.outline}
              strokeWidth="1"
              fill="none"
              opacity={rules.tonal ? 0.3 : 0.45}
            />
          )}
          {rules.gloss && (
            <ellipse
              cx="50"
              cy="66"
              rx="10"
              ry="4.5"
              fill="#fff"
              opacity={inked ? 0.4 : 0.3}
              transform="rotate(-18 50 66)"
            />
          )}
          {/* 머리 */}
          <g ref={r('head')} {...a('head')}>
            <ellipse cx="64" cy="44" rx="28" ry="24" fill={pal.body} {...ol} />
            {rules.gloss && (
              <>
                <path
                  d="M36.6 47 A28 24 0 0 0 91.4 47 A28 15 0 0 1 36.6 47Z"
                  fill={pal.bodyDark}
                  opacity="0.25"
                />
                <ellipse
                  cx="56"
                  cy="33"
                  rx="17"
                  ry="10"
                  fill={pal.bodyLight}
                  opacity="0.6"
                  transform="rotate(-20 56 33)"
                />
                <ellipse
                  cx="52"
                  cy="28"
                  rx="8.5"
                  ry="4.2"
                  fill="#fff"
                  opacity={inked ? 0.55 : 0.42}
                  transform="rotate(-22 52 28)"
                />
              </>
            )}
            <ellipse
              ref={r('cheekL')}
              cx="44"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekL')}
            />
            <ellipse
              ref={r('cheekR')}
              cx="84"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekR')}
            />
            <g ref={r('face')} {...a('face')}>
              {(['L', 'R'] as const).map((s) => (
                <g key={s} ref={r(`eyeG${s}`)} {...a(`eyeG${s}`)}>
                  <ellipse
                    ref={r(`eye${s}`)}
                    fill={pal.ink}
                    {...a(`eye${s}`)}
                  />
                  <circle ref={r(`hl${s}`)} fill="#fff" {...a(`hl${s}`)} />
                </g>
              ))}
              {(['L', 'R'] as const).map((s) => (
                <path
                  key={s}
                  ref={r(`star${s}`)}
                  d={STAR_EYE}
                  fill="#FFD54F"
                  stroke={propInk ?? '#E0A021'}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  {...a(`star${s}`)}
                />
              ))}
              {(['arcL', 'arcR', 'browL', 'browR'] as const).map((k) => (
                <path
                  key={k}
                  ref={r(k)}
                  stroke={pal.ink}
                  strokeWidth={k.startsWith('arc') ? 2.7 : 2.2}
                  strokeLinecap="round"
                  fill="none"
                  {...a(k)}
                />
              ))}
              <path
                ref={r('mouth')}
                fill={pal.ink}
                stroke={pal.ink}
                strokeWidth="2.4"
                strokeLinejoin="round"
                {...a('mouth')}
              />
              <ellipse
                ref={r('tongue')}
                fill={pal.tongue}
                clipPath={`url(#${idp}mouthClip)`}
                {...a('tongue')}
              />
              <g ref={r('tear')} {...a('tear')}>
                <path
                  d={DROP}
                  fill="#81D4FA"
                  stroke={propInk ?? '#4FC3F7'}
                  strokeWidth="0.8"
                />
              </g>
              {costume.glasses && <Glasses kind={costume.glasses} />}
            </g>
            <g ref={r('hat')} {...a('hat')}>
              {costume.hat && <Hat kind={costume.hat} outline={propInk} />}
            </g>
          </g>
          {/* 소품 */}
          {[0, 1, 2, 3].map((i) => (
            <g key={i} ref={r(`spark${i}`)} {...a(`spark${i}`)}>
              <path
                d={STAR}
                fill={i % 2 ? '#FFD54F' : '#FFF176'}
                stroke={propInk ?? '#FFB300'}
                strokeWidth="0.8"
              />
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
              <circle
                key={i}
                ref={r(`dot${i}`)}
                cx={-6 + i * 6}
                cy="0"
                r="2"
                fill="#7E57C2"
                {...a(`dot${i}`)}
              />
            ))}
          </g>
          {[0, 1].map((i) => (
            <g key={i} ref={r(`note${i}`)} {...a(`note${i}`)}>
              <path d={NOTE} fill={i ? '#29B6F6' : '#AB47BC'} />
            </g>
          ))}
          {[0, 1, 2].map((i) => (
            <g key={i} ref={r(`zzz${i}`)} {...a(`zzz${i}`)}>
              <path
                d={ZED}
                fill="none"
                stroke="#5C6BC0"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
          <g ref={r('qmark')} {...a('qmark')}>
            {propInk && (
              <path
                d={QMARK}
                fill="none"
                stroke={pal.outline}
                strokeWidth="5.4"
                strokeLinecap="round"
              />
            )}
            <path
              d={QMARK}
              fill="none"
              stroke="#FB8C00"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <circle
              cx="0.4"
              cy="6.4"
              r="2.1"
              fill="#FB8C00"
              {...(propInk ? { stroke: propInk, strokeWidth: 1.1 } : {})}
            />
          </g>
        </g>
      </g>
    </RigFrame>
  );
}
