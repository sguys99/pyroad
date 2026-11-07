// 최종 시안 보상 아이콘 (P2-07 2차). shared/icons의 RewardIcon(B = 짙은 갈색 외곽선 1.6)을 대신한다
// - 금색 하나(강조색 accent)만: 코인·별·황금 열쇠 모두 같은 금색, 외곽선은 그 금색의 진한 톤 1px 안팎
// - 빈 별은 중립 면(surface2 계열) + 옅은 선
// - shared/ 는 고치지 않는다 (다른 시안이 씀). API는 같게: <RewardIcon kind style size label />
export type RewardKind = 'coin' | 'star' | 'starEmpty' | 'key';

export const GOLD = { fill: '#F0B43C', dark: '#C48A1A', light: '#FBE3A6', empty: '#E5E1D9', emptyLine: '#C9C2B6' };
const STAR = 'M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z';

export function RewardIcon({ kind, size = 28, label, className }: { kind: RewardKind; size?: number; style?: string; label?: string; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    className,
  } as const;
  switch (kind) {
    case 'starEmpty':
      return (
        <svg {...common}>
          <path d={STAR} fill={GOLD.empty} stroke={GOLD.emptyLine} strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path d={STAR} fill={GOLD.fill} stroke={GOLD.dark} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M12.6 11.6l1.6-3" stroke={GOLD.light} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'coin':
      return (
        <svg {...common}>
          <circle cx="16" cy="17" r="12" fill={GOLD.dark} />
          <circle cx="16" cy="15.5" r="12" fill={GOLD.fill} />
          <circle cx="16" cy="15.5" r="8.2" fill="none" stroke={GOLD.dark} strokeWidth="1.2" opacity="0.55" />
          <path d="M13.5 11.5h4a2 2 0 0 1 0 4h-4v4.5M13.5 15.5h4" stroke={GOLD.dark} strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <path d="M15.5 16.5l10 10M21 22l2.5-2.5M23.5 24.5l2-2" stroke={GOLD.dark} strokeWidth="3" strokeLinecap="round" />
          <circle cx="11" cy="12" r="6.5" fill={GOLD.fill} stroke={GOLD.dark} strokeWidth="1.1" />
          <circle cx="11" cy="12" r="2.4" fill="#FFFFFF" />
        </svg>
      );
  }
}
