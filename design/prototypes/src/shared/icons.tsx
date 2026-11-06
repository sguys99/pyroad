// 공용 SVG 아이콘 (이모지 대신). 24×24 격자.
// - UI 아이콘(Icon): currentColor 선 2.2px, 둥근 끝. 시안이 색·굵기만 바꾼다
// - 보상 아이콘(RewardIcon): 코인·별·황금 열쇠·하트·보석. 시안 스타일(A 클레이 하이라이트 / B 잉크 선 / AB 둘 다)
import type { CSSProperties } from 'react';
import type { RigStyle } from './rig/params';

export const ICON_NAMES = [
  'play', 'stop', 'lock', 'unlock', 'check', 'close', 'home', 'map', 'book', 'settings', 'sound', 'soundOff',
  'arrowLeft', 'arrowRight', 'hint', 'flag', 'trophy', 'refresh', 'user', 'sparkle', 'code', 'chat', 'menu', 'pause',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

const PATHS: Record<IconName, string> = {
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  pause: 'M8 6v12M16 6v12',
  lock: 'M6.5 11h11v8.5h-11zM9 11V8a3 3 0 0 1 6 0v3',
  unlock: 'M6.5 11h11v8.5h-11zM9 11V8a3 3 0 0 1 5.6-1.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  home: 'M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5M10 19v-5h4v5',
  map: 'M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2zM9 4.5v13M15 6.5v13',
  book: 'M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5V20',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6',
  sound: 'M4.5 9.5h3.5L12.5 6v12L8 14.5H4.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  soundOff: 'M4.5 9.5h3.5L12.5 6v12L8 14.5H4.5zM16 9.5l5 5M21 9.5l-5 5',
  arrowLeft: 'M14.5 6l-6 6 6 6',
  arrowRight: 'M9.5 6l6 6-6 6',
  hint: 'M9 18h6M10 21h4M12 3.5a5.5 5.5 0 0 0-3.2 10c.7.5 1.2 1.3 1.2 2.2V16h4v-.3c0-.9.5-1.7 1.2-2.2A5.5 5.5 0 0 0 12 3.5z',
  flag: 'M6 21V4M6 4.5h11l-2.5 4 2.5 4H6',
  trophy: 'M8 4.5h8v4a4 4 0 0 1-8 0zM8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4M12 12.5V16M8.5 20h7M9.5 16h5v4h-5z',
  refresh: 'M19 12a7 7 0 1 1-2.1-5M19 4.5V8h-3.5',
  user: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20a7 7 0 0 1 14 0',
  sparkle: 'M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5zM18.5 15.5c.3 1.8.9 2.4 2.5 2.7-1.6.3-2.2.9-2.5 2.7-.3-1.8-.9-2.4-2.5-2.7 1.6-.3 2.2-.9 2.5-2.7z',
  code: 'M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14',
  chat: 'M4.5 6.5h15v9.5h-8l-4.5 3.5V16H4.5z',
  menu: 'M4.5 7h15M4.5 12h15M4.5 17h15',
};
const FILLED: Partial<Record<IconName, boolean>> = { play: true, stop: true };

export function Icon({
  name,
  size = 24,
  strokeWidth = 2.2,
  label,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** 있으면 role=img, 없으면 장식(aria-hidden) */
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const filled = FILLED[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export type RewardKind = 'coin' | 'star' | 'starEmpty' | 'key' | 'heart' | 'gem';

const REWARD_COLOR: Record<Exclude<RewardKind, 'starEmpty'>, { fill: string; dark: string; light: string }> = {
  coin: { fill: '#FFC93C', dark: '#E09A00', light: '#FFF1B8' },
  star: { fill: '#FFD84D', dark: '#F0A800', light: '#FFF6C4' },
  key: { fill: '#FFC93C', dark: '#D98E00', light: '#FFF1B8' },
  heart: { fill: '#FF6B6B', dark: '#D93F4C', light: '#FFC2C2' },
  gem: { fill: '#5EC8F2', dark: '#1F8FC4', light: '#D4F3FF' },
};
const REWARD_INK: Record<RigStyle, string> = { A: 'none', B: '#3B2F25', AB: '#24324A' };

export function RewardIcon({
  kind,
  size = 28,
  style: rs = 'A',
  label,
  className,
}: {
  kind: RewardKind;
  size?: number;
  style?: RigStyle;
  label?: string;
  className?: string;
}) {
  const ink = REWARD_INK[rs];
  const line = rs === 'A' ? undefined : ink;
  const sw = rs === 'B' ? 1.6 : 1.8;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    className,
  } as const;
  const gloss = rs !== 'B';
  if (kind === 'starEmpty') {
    return (
      <svg {...common}>
        <path
          d="M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z"
          fill={rs === 'A' ? '#D5E6F2' : rs === 'B' ? '#EADCC2' : '#F1E0BF'}
          stroke={rs === 'A' ? '#9DB8CC' : ink}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const c = REWARD_COLOR[kind];
  const base = rs === 'B' ? mute(c.fill) : c.fill;
  switch (kind) {
    case 'coin':
      return (
        <svg {...common}>
          <ellipse cx="16" cy="17.5" rx="12" ry="12" fill={c.dark} stroke={line} strokeWidth={sw} />
          <circle cx="16" cy="15.5" r="12" fill={base} stroke={line} strokeWidth={sw} />
          <circle cx="16" cy="15.5" r="8" fill="none" stroke={c.dark} strokeWidth="1.6" opacity="0.7" />
          <path d="M13.5 11.5h4a2 2 0 0 1 0 4h-4v4.5M13.5 15.5h4" stroke={c.dark} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {gloss && <ellipse cx="11" cy="9.5" rx="3.2" ry="1.6" fill="#fff" opacity="0.7" transform="rotate(-30 11 9.5)" />}
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path
            d="M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z"
            fill={base}
            stroke={line ?? c.dark}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {gloss && <path d="M12.5 11.5l2-3.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />}
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <circle cx="11" cy="12" r="6.5" fill={base} stroke={line ?? c.dark} strokeWidth={sw} />
          <circle cx="11" cy="12" r="2.6" fill={rs === 'A' ? '#fff' : '#FFF8E6'} stroke={line ?? c.dark} strokeWidth="1.2" />
          <path d="M15.5 16.5l10 10M21 22l2.5-2.5M23.5 24.5l2-2" stroke={line ?? c.dark} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M15.5 16.5l10 10" stroke={base} strokeWidth="1.6" strokeLinecap="round" />
          {gloss && <ellipse cx="8.5" cy="8.5" rx="2" ry="1" fill="#fff" opacity="0.75" transform="rotate(-40 8.5 8.5)" />}
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path
            d="M16 27s-11-6.6-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 27 13c0 7.4-11 14-11 14z"
            fill={base}
            stroke={line ?? c.dark}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          {gloss && <ellipse cx="10.5" cy="11" rx="2.4" ry="1.4" fill="#fff" opacity="0.7" transform="rotate(-35 10.5 11)" />}
        </svg>
      );
    case 'gem':
      return (
        <svg {...common}>
          <path d="M8 5h16l5 7-13 16L3 12z" fill={base} stroke={line ?? c.dark} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M3 12h26M12 5l-3 7 7 16 7-16-3-7" fill="none" stroke={line ?? c.dark} strokeWidth="1.2" opacity="0.6" />
          {gloss && <path d="M9.5 8l-2 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />}
        </svg>
      );
  }
}

/** B 그림책: 채도를 살짝 낮춘 수채 색 */
function mute(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const avg = (r + g + b) / 3;
  const m = (v: number) => Math.round(v * 0.8 + avg * 0.2);
  return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1);
}
