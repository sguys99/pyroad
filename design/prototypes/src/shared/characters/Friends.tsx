// 버그버그·별똥이 (P2-01 프로토타입용)
// src/components/characters의 BugBugSvg·ByeolttongiSvg 좌표를 가져와 SMIL(<animate>)을 빼고,
// 시안 스타일(A 클레이 / B 그림책 / AB 혼합)과 CSS transform 모션(등장·통통·반짝)만 붙였다.
// 정식 리그(등장·탐색·발견·공격·피격·패배·화해 / 날아오기·착지·반짝·보상 건네기)는 P2-13.
import { useId, type CSSProperties } from 'react';
import type { RigStyle } from '../rig/params';
import './friends.css';

export type FriendMotion = 'none' | 'appear' | 'bob' | 'appear-bob';
export type BugBugMood = 'searching' | 'found' | 'fixed';
export type StarMood = 'flying' | 'landing' | 'sparkling';

interface Common {
  style?: RigStyle;
  size?: number;
  motion?: FriendMotion;
  className?: string;
  /** 접근성 이름. 장식이면 빈 문자열 → aria-hidden */
  label?: string;
}

const MOOD_LABEL: Record<BugBugMood | StarMood, string> = {
  searching: '버그를 찾는 중',
  found: '버그 발견',
  fixed: '고쳤다',
  flying: '날아오는 중',
  landing: '도착',
  sparkling: '반짝',
};

function motionClass(m: FriendMotion) {
  return m === 'none' ? '' : m === 'appear' ? 'fr-appear' : m === 'bob' ? 'fr-bob' : 'fr-appear fr-bob';
}

/** B·AB 공용 종이 결 필터 (선 살짝 흔들림 + 입자). 정적 seed라 매 프레임 바뀌지 않는다 */
function PaperFilter({ id, strong }: { id: string; strong: boolean }) {
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={2} seed={4} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={strong ? 2.4 : 1.4} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}

const INK: Record<RigStyle, string> = { A: 'none', B: '#3B2F25', AB: '#24324A' };

export function BugBug({ style = 'A', mood = 'searching', size = 96, motion = 'none', className, label }: Common & { mood?: BugBugMood }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ink = INK[style];
  const ol = style === 'A' ? {} : { stroke: ink, strokeWidth: style === 'B' ? 2.2 : 2.6, strokeLinejoin: 'round' as const };
  const shell = style === 'B' ? '#C8553D' : '#EF5350';
  const head = style === 'B' ? '#4A3A2E' : '#4E342E';
  const legs = style === 'A' ? '#4E342E' : ink;
  const name = label ?? `버그버그 - ${MOOD_LABEL[mood]}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={`fr fr-bug ${motionClass(motion)} ${className ?? ''}`}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      overflow="visible"
    >
      <defs>
        <radialGradient id={`${uid}g`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#FFCDD2" stopOpacity="0.55" />
          <stop offset="100%" stopColor={shell} stopOpacity="0" />
        </radialGradient>
        {style !== 'A' && <PaperFilter id={`${uid}p`} strong={style === 'B'} />}
      </defs>
      <ellipse className="fr-shadow" cx="64" cy="114" rx="30" ry="4.5" fill={style === 'A' ? '#1B2F45' : ink} opacity="0.16" />
      <g className="fr-body" filter={style !== 'A' ? `url(#${uid}p)` : undefined}>
        <g stroke={legs} strokeWidth="3" strokeLinecap="round">
          <line x1="38" y1="68" x2="24" y2="60" />
          <line x1="36" y1="80" x2="20" y2="80" />
          <line x1="38" y1="92" x2="24" y2="100" />
          <line x1="90" y1="68" x2="104" y2="60" />
          <line x1="92" y1="80" x2="108" y2="80" />
          <line x1="90" y1="92" x2="104" y2="100" />
        </g>
        <ellipse cx="64" cy="80" rx="32" ry="28" fill={shell} {...ol} />
        {style !== 'B' && <ellipse cx="64" cy="80" rx="32" ry="28" fill={`url(#${uid}g)`} />}
        {style !== 'B' && <ellipse cx="50" cy="64" rx="9" ry="4" fill="#fff" opacity="0.45" transform="rotate(-20 50 64)" />}
        <line x1="64" y1="56" x2="64" y2="108" stroke={style === 'A' ? '#C62828' : ink} strokeWidth="2" />
        <g fill={head}>
          <circle cx="50" cy="72" r="5" />
          <circle cx="78" cy="72" r="5" />
          <circle cx="48" cy="90" r="4" />
          <circle cx="80" cy="90" r="4" />
          <circle cx="64" cy="98" r="3.5" />
        </g>
        <g className="fr-head">
          <g className="fr-antenna-l">
            <path d="M52 32 Q48 18 42 14" stroke={head} strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="41" cy="13" r="4" fill="#FF8A65" {...ol} />
          </g>
          <g className="fr-antenna-r">
            <path d="M76 32 Q80 18 86 14" stroke={head} strokeWidth="3" strokeLinecap="round" fill="none" />
            <circle cx="87" cy="13" r="4" fill="#FF8A65" {...ol} />
          </g>
          <ellipse cx="64" cy="46" rx="22" ry="18" fill={head} {...ol} />
          <ellipse cx="50" cy="51" rx="5" ry="3" fill="#FF8A80" opacity="0.55" />
          <ellipse cx="78" cy="51" rx="5" ry="3" fill="#FF8A80" opacity="0.55" />
          {mood === 'searching' && (
            <>
              <path d="M53 42 Q57 38 61 42" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <g className="fr-blink">
                <ellipse cx="74" cy="42" rx="5" ry="5.5" fill="#fff" />
                <circle cx="75" cy="41" r="2" fill={head} />
              </g>
              <ellipse cx="64" cy="53" rx="3" ry="2.5" fill="#2A1C16" />
            </>
          )}
          {mood === 'found' && (
            <>
              <ellipse cx="56" cy="42" rx="6" ry="6.5" fill="#fff" />
              <circle cx="57" cy="41" r="2.5" fill={head} />
              <ellipse cx="74" cy="42" rx="6" ry="6.5" fill="#fff" />
              <circle cx="75" cy="41" r="2.5" fill={head} />
              <ellipse cx="64" cy="54" rx="5" ry="4" fill="#2A1C16" />
            </>
          )}
          {mood === 'fixed' && (
            <>
              <path d="M51 42 Q56 37 61 42 M69 42 Q74 37 79 42" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              <path d="M56 50 Q64 58 72 50" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          )}
        </g>
        <g className="fr-prop">
          {mood === 'searching' && (
            <g>
              <line x1="99" y1="45" x2="90" y2="54" stroke="#795548" strokeWidth="4" strokeLinecap="round" />
              <circle cx="106" cy="38" r="10" fill="#FFF8E1" fillOpacity="0.5" stroke={style === 'A' ? '#FFB300' : ink} strokeWidth="3" />
              <path d="M102 32 L104 30" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
          {mood === 'found' && (
            <g fill="#FF9800" {...ol}>
              <rect x="96" y="14" width="6" height="17" rx="3" />
              <circle cx="99" cy="38" r="3.4" />
            </g>
          )}
          {mood === 'fixed' && (
            <g>
              <circle cx="100" cy="28" r="12" fill={style === 'B' ? '#4A7330' : '#1B7F37'} {...ol} />
              <path d="M93 28 L98 33 L107 23" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

const STAR_PTS = '64,16 72,48 104,48 78,66 88,98 64,80 40,98 50,66 24,48 56,48';
const STAR_IN = '64,30 69,48 86,48 72,58 77,76 64,66 51,76 56,58 42,48 59,48';

export function Byeolttongi({ style = 'A', mood = 'sparkling', size = 96, motion = 'none', className, label }: Common & { mood?: StarMood }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ink = INK[style];
  const ol = style === 'A' ? {} : { stroke: ink, strokeWidth: style === 'B' ? 2.2 : 2.6, strokeLinejoin: 'round' as const };
  const body = style === 'B' ? '#F2C14E' : '#FFD54F';
  const face = style === 'A' ? '#E65100' : ink;
  const name = label ?? `별똥이 - ${MOOD_LABEL[mood]}`;
  const mini = [
    [18, 30, 1],
    [110, 24, 0.8],
    [16, 76, 0.7],
    [114, 70, 0.9],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      className={`fr fr-star ${motionClass(motion)} ${className ?? ''}`}
      role={name ? 'img' : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      overflow="visible"
    >
      <defs>
        <radialGradient id={`${uid}g`} cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#FFF59D" stopOpacity="0.9" />
          <stop offset="100%" stopColor={body} stopOpacity="0" />
        </radialGradient>
        {style !== 'A' && <PaperFilter id={`${uid}p`} strong={style === 'B'} />}
      </defs>
      {mood === 'flying' && (
        <g className="fr-trail" stroke={body} strokeLinecap="round" fill="none">
          <path d="M40 98 Q20 110 10 118" strokeWidth="4" opacity="0.6" />
          <path d="M36 96 Q14 112 6 122" strokeWidth="2" opacity="0.4" />
        </g>
      )}
      <ellipse className="fr-shadow" cx="64" cy="114" rx="22" ry="4" fill={style === 'A' ? '#1B2F45' : ink} opacity="0.14" />
      <g className="fr-body" filter={style !== 'A' ? `url(#${uid}p)` : undefined}>
        <polygon points={STAR_PTS} fill={body} {...ol} />
        {style !== 'B' && <polygon points={STAR_PTS} fill={`url(#${uid}g)`} />}
        <polygon points={STAR_IN} fill="#FFF9C4" opacity={style === 'B' ? 0.45 : 0.6} />
        {style !== 'B' && <ellipse cx="56" cy="38" rx="5" ry="2.6" fill="#fff" opacity="0.6" transform="rotate(-30 56 38)" />}
        <ellipse cx="50" cy="60" rx="4.5" ry="2.6" fill="#FF8A80" opacity="0.5" />
        <ellipse cx="78" cy="60" rx="4.5" ry="2.6" fill="#FF8A80" opacity="0.5" />
        {mood === 'sparkling' ? (
          <path d="M51 52 Q56 47 61 52 M67 52 Q72 47 77 52" stroke={face} strokeWidth="2.6" strokeLinecap="round" fill="none" />
        ) : (
          <g className="fr-blink" fill={face}>
            <ellipse cx="56" cy="52" rx={mood === 'flying' ? 4 : 5} ry={mood === 'flying' ? 3.5 : 5.5} />
            <ellipse cx="72" cy="52" rx={mood === 'flying' ? 4 : 5} ry={mood === 'flying' ? 3.5 : 5.5} />
            <circle cx="57.5" cy="50.5" r="1.8" fill="#fff" />
            <circle cx="73.5" cy="50.5" r="1.8" fill="#fff" />
          </g>
        )}
        <path d={mood === 'flying' ? 'M59 60 Q64 63 69 60' : 'M57 59 Q64 66 71 59'} stroke={face} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
      {mood === 'sparkling' &&
        mini.map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <path
              className="fr-twinkle"
              style={{ animationDelay: `${i * 0.37}s` } as CSSProperties}
              d="M0 -7 Q1.2 -1.2 7 0 Q1.2 1.2 0 7 Q-1.2 1.2 -7 0 Q-1.2 -1.2 0 -7Z"
              fill={i % 2 ? '#FFE082' : '#FFD54F'}
              {...(style === 'A' ? {} : { stroke: ink, strokeWidth: 1 })}
            />
          </g>
        ))}
      {mood === 'landing' && (
        <g stroke={style === 'A' ? '#FFB300' : ink} strokeWidth="2.2" strokeLinecap="round" opacity="0.7">
          <line x1="42" y1="104" x2="34" y2="110" />
          <line x1="64" y1="106" x2="64" y2="114" />
          <line x1="86" y1="104" x2="94" y2="110" />
        </g>
      )}
    </svg>
  );
}
