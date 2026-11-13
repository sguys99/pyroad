/**
 * 버그버그 리그 마크업 (훅 없음). 기존 `BugBugSvg`의 무당벌레 생김새(빨간 등딱지·검정 점·갈색 머리·주황 더듬이 끝)를
 * 부위로 나눴다: 다리 6 · 등딱지 좌우 반쪽(열고 닫기) · 날개 · 머리 · 더듬이 2 · 공유 얼굴 · 소품.
 */
import {
  PaperFilter,
  RigFrame,
  attrs,
  outlineOf,
  refOf,
  usesPaper,
} from '../core/markup';
import { Hat } from '../costumes';
import type { MarkupProps } from '../core/types';
import { STYLE_RULES, type RigStyle } from '../style';

export interface BugBugPalette {
  shell: string;
  shellDark: string;
  shellLight: string;
  spot: string;
  head: string;
  leg: string;
  antTip: string;
  eyeWhite: string;
  pupil: string;
  /** 어두운 머리 위의 눈썹·감은 눈·입선 (밝은 크림) */
  face: string;
  mouthIn: string;
  tongue: string;
  cheek: string;
  cheekAlpha: string;
  outline: string;
  shadow: string;
  under: string;
  wing: string;
}

export const BUGBUG_PALETTES: Record<RigStyle, BugBugPalette> = {
  A: {
    shell: '#EF5350',
    shellDark: '#C62828',
    shellLight: '#FF8A80',
    spot: '#4E342E',
    head: '#4E342E',
    leg: '#4E342E',
    antTip: '#FF8A65',
    eyeWhite: '#FFFFFF',
    pupil: '#2A1C16',
    face: '#FFF3E0',
    mouthIn: '#7A2E2A',
    tongue: '#FF8A9A',
    cheek: '#FF7A9A',
    cheekAlpha: '0.75',
    outline: 'none',
    shadow: '#3E2723',
    under: '#3E2723',
    wing: '#E1F5FE',
  },
  B: {
    shell: '#C8553D',
    shellDark: '#9E3D2B',
    shellLight: '#E07A60',
    spot: '#3B2F25',
    head: '#4A3A2E',
    leg: '#3B2F25',
    antTip: '#E8927C',
    eyeWhite: '#FFFBF0',
    pupil: '#2A1F17',
    face: '#FBEFD9',
    mouthIn: '#6E2A22',
    tongue: '#E8927C',
    cheek: '#F2879B',
    cheekAlpha: '0.75',
    /** 등딱지(#C8553D)의 진한 톤 (P2-07 2차). 다리·더듬이는 잉크 대신 제 색(leg·head) */
    outline: '#8C3B2B',
    shadow: '#8E877C',
    under: '#3B2F25',
    wing: '#EAF1F4',
  },
  AB: {
    shell: '#EF5350',
    shellDark: '#C62828',
    shellLight: '#FF8A80',
    spot: '#2B2233',
    head: '#4E342E',
    leg: '#24324A',
    antTip: '#FF8A65',
    eyeWhite: '#FFFFFF',
    pupil: '#1C2333',
    face: '#FFF3E0',
    mouthIn: '#7A2E2A',
    tongue: '#FF8A9A',
    cheek: '#FF7A9A',
    cheekAlpha: '0.75',
    outline: '#24324A',
    shadow: '#24324A',
    under: '#2B2233',
    wing: '#E1F5FE',
  },
};

const SPOTS_L = [
  [50, 70, 5],
  [47, 88, 4],
  [57, 99, 3],
];
const SPOTS_R = [
  [78, 70, 5],
  [81, 88, 4],
  [71, 99, 3],
];
const STAR = 'M0 -5 Q0.9 -0.9 5 0 Q0.9 0.9 0 5 Q-0.9 0.9 -5 0 Q-0.9 -0.9 0 -5Z';
const TOOTH = 'M-1.7 0 H1.7 V2.2 Q0 3.6 -1.7 2.2Z';

export function BugBugMarkup(props: MarkupProps<BugBugPalette>) {
  const { geo, pal, style, idp, reg, costume } = props;
  const a = (k: string) => attrs(geo, k);
  const r = (k: string) => refOf(reg, k);
  const rules = STYLE_RULES[style];
  const inked = rules.outline > 0;
  const ol = outlineOf(style, pal.outline);
  const thin = inked
    ? rules.tonal
      ? { stroke: pal.shellDark, strokeWidth: 0.8, strokeOpacity: 0.45 }
      : { stroke: pal.outline, strokeWidth: 1.2 }
    : {};
  const paper = usesPaper(props);
  // 다리·더듬이·소품을 잉크색으로 그리나 (몸색 톤 외곽선이면 제 색)
  const lineInk = inked && !rules.tonal ? pal.outline : undefined;
  // 소품 선: 잉크(A×B) / 몸색 톤(B)이면 차분한 금갈색 / 없음(A)이면 밝은 금색
  const propInk = lineInk ?? (rules.tonal ? '#B78A3E' : undefined);
  const legW = lineInk ? 3.4 : 3.2;

  const half = (side: 'L' | 'R') => (
    <g ref={r(`shell${side}`)} {...a(`shell${side}`)}>
      <path
        d={
          side === 'L'
            ? 'M64 52 A32 28 0 0 0 64 108 Z'
            : 'M64 52 A32 28 0 0 1 64 108 Z'
        }
        fill={pal.shell}
        {...ol}
      />
      {rules.gloss && side === 'L' && (
        <>
          <ellipse
            cx="49"
            cy="70"
            rx="12"
            ry="9"
            fill={pal.shellLight}
            opacity="0.45"
            transform="rotate(-25 49 70)"
          />
          <ellipse
            cx="47"
            cy="63"
            rx="8"
            ry="3.6"
            fill="#fff"
            opacity={inked ? 0.5 : 0.42}
            transform="rotate(-24 47 63)"
          />
        </>
      )}
      <g fill={pal.spot}>
        {(side === 'L' ? SPOTS_L : SPOTS_R).map(([x, y, rr]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={rr} />
        ))}
      </g>
      {!inked && (
        <path d="M64 54 V107" stroke={pal.shellDark} strokeWidth="2" />
      )}
    </g>
  );

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
      <circle ref={r('halo')} cx="64" cy="66" r="58" {...a('halo')} />
      <ellipse
        ref={r('shadow')}
        cy="112"
        ry="4.6"
        fill={pal.shadow}
        {...a('shadow')}
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          ref={r(`puff${i}`)}
          fill="#EFEBE9"
          stroke="#BCAAA4"
          strokeWidth="1"
          {...a(`puff${i}`)}
        />
      ))}
      <g filter={paper ? `url(#${idp}boil)` : undefined}>
        <g ref={r('root')} {...a('root')}>
          {/* 다리 */}
          <g
            stroke={lineInk ?? pal.leg}
            strokeWidth={legW}
            strokeLinecap="round"
            fill="none"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} ref={r(`leg${i}`)} {...a(`leg${i}`)} />
            ))}
          </g>
          {/* 배·날개 (등딱지가 열리면 보임) */}
          <ellipse cx="64" cy="82" rx="27" ry="25" fill={pal.under} />
          <ellipse
            ref={r('wingL')}
            cx="50"
            cy="76"
            rx="12"
            ry="25"
            fill={pal.wing}
            {...thin}
            {...a('wingL')}
          />
          <ellipse
            ref={r('wingR')}
            cx="78"
            cy="76"
            rx="12"
            ry="25"
            fill={pal.wing}
            {...thin}
            {...a('wingR')}
          />
          {half('L')}
          {half('R')}
          {/* 머리 */}
          <g ref={r('head')} {...a('head')}>
            {(['L', 'R'] as const).map((s) => (
              <g key={s} ref={r(`ant${s}`)} {...a(`ant${s}`)}>
                <path
                  d={s === 'L' ? 'M52 33 Q48 18 42 14' : 'M76 33 Q80 18 86 14'}
                  stroke={lineInk ?? pal.head}
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle
                  cx={s === 'L' ? 41 : 87}
                  cy="13"
                  r="4.2"
                  fill={pal.antTip}
                  {...ol}
                />
              </g>
            ))}
            <ellipse cx="64" cy="46" rx="22" ry="18" fill={pal.head} {...ol} />
            {rules.gloss && (
              <ellipse
                cx="55"
                cy="35"
                rx="6.5"
                ry="3"
                fill="#fff"
                opacity="0.28"
                transform="rotate(-20 55 35)"
              />
            )}
            <ellipse
              ref={r('cheekL')}
              cx="48.5"
              cy="51.5"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekL')}
            />
            <ellipse
              ref={r('cheekR')}
              cx="79.5"
              cy="51.5"
              fill={pal.cheek}
              fillOpacity={pal.cheekAlpha}
              {...a('cheekR')}
            />
            <g ref={r('face')} {...a('face')}>
              {(['L', 'R'] as const).map((s) => (
                <g key={s}>
                  <ellipse
                    ref={r(`eye${s}`)}
                    fill={pal.eyeWhite}
                    {...a(`eye${s}`)}
                  />
                  <ellipse
                    ref={r(`pup${s}`)}
                    fill={pal.pupil}
                    {...a(`pup${s}`)}
                  />
                  <circle ref={r(`hl${s}`)} fill="#fff" {...a(`hl${s}`)} />
                  <path
                    ref={r(`arc${s}`)}
                    stroke={pal.face}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    fill="none"
                    {...a(`arc${s}`)}
                  />
                  <path
                    ref={r(`sq${s}`)}
                    d={
                      s === 'L'
                        ? 'M51.5 39.5 L59 43 L51.5 46.5'
                        : 'M76.5 39.5 L69 43 L76.5 46.5'
                    }
                    stroke={pal.face}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    {...a(`sq${s}`)}
                  />
                  <path
                    ref={r(`brow${s}`)}
                    stroke={pal.face}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    fill="none"
                    {...a(`brow${s}`)}
                  />
                </g>
              ))}
              <path
                ref={r('mouth')}
                fill={pal.mouthIn}
                stroke={pal.face}
                strokeWidth="1.7"
                strokeLinejoin="round"
                {...a('mouth')}
              />
              <ellipse
                ref={r('tongue')}
                fill={pal.tongue}
                clipPath={`url(#${idp}mouthClip)`}
                {...a('tongue')}
              />
              <g ref={r('tooth')} {...a('tooth')}>
                <path d={TOOTH} fill="#fff" />
              </g>
            </g>
            {/* 보스 모자 (P9-13 스테이지 외형): 파이뱀 모자 조각을 버그버그 머리 높이로 내려 씀 */}
            {costume?.hat && (
              <g transform="translate(0 6)">
                <Hat kind={costume.hat} outline={propInk} tonal={rules.tonal} />
              </g>
            )}
          </g>
          {/* 소품 */}
          <g ref={r('mag')} {...a('mag')}>
            <path
              d="M-6 7 L-14 16"
              stroke="#8D6E63"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle
              r="9.5"
              fill="#FFF8E1"
              fillOpacity="0.5"
              stroke={propInk ?? '#FFB300'}
              strokeWidth="3"
            />
            <path
              d="M-4.5 -4.5 L-2 -7"
              stroke="#fff"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
          <g ref={r('badge')} {...a('badge')}>
            <circle r="11" fill="#2E8B3E" {...thin} />
            <path
              d="M-5.5 0 L-1.5 4.2 L6 -4.2"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        </g>
        {/* 머리 위 소품은 몸이 뒤집혀도 위에 (몸 그룹 밖) */}
        <g ref={r('exclaim')} {...a('exclaim')}>
          <rect
            x="-3"
            y="-16"
            width="6"
            height="15"
            rx="3"
            fill="#FF9800"
            {...thin}
          />
          <circle cy="5.5" r="3.3" fill="#FF9800" {...thin} />
        </g>
        {[0, 1, 2].map((i) => (
          <g key={i} ref={r(`dz${i}`)} {...a(`dz${i}`)}>
            <path
              d={STAR}
              fill="#FFE082"
              stroke={propInk ?? '#FFB300'}
              strokeWidth="0.9"
            />
          </g>
        ))}
      </g>
    </RigFrame>
  );
}
