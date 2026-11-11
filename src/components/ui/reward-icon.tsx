import { cn } from '@/lib/utils';

/**
 * 보상 아이콘 (P2-11, 최종 시안 `design/prototypes/src/final/reward.tsx`): 코인·별·황금키·보물상자(P8-06, 닫힘·열림)를 이모지 대신 자체 SVG로.
 * - 금색 하나(`accent`)만 쓰고 외곽선은 그 금색의 진한 톤(`accent-lip`) 1px 안팎, 밝은 쪽은 `accent-light`
 * - 빈 별은 중립 면(`line`) + 옅은 선
 * - 색은 Tailwind 토큰 클래스(`fill-accent` …)로만 칠한다 → 월드 테마·토큰 변경을 따라간다
 * - `label`을 주면 그림 하나로 읽히고(`role="img"`), 없으면 장식(`aria-hidden`)이다. 수치는 옆 글자로 함께 보여 준다
 */
export type RewardKind =
  | 'coin'
  | 'star'
  | 'starEmpty'
  | 'key'
  | 'chest'
  | 'chestOpen';

const STAR =
  'M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z';

interface RewardIconProps {
  kind: RewardKind;
  /** px (보기 상자 32 기준) */
  size?: number;
  /** 화면 낭독기 이름. 없으면 장식 */
  label?: string;
  className?: string;
}

export function RewardIcon({
  kind,
  size = 28,
  label,
  className,
}: RewardIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    focusable: false,
    className: cn('shrink-0', className),
    'data-reward': kind,
  } as const;

  switch (kind) {
    case 'starEmpty':
      return (
        <svg {...common}>
          <path
            d={STAR}
            className="fill-line stroke-line-strong"
            strokeOpacity={0.45}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path
            d={STAR}
            className="fill-accent stroke-accent-lip"
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          <path
            d="M12.6 11.6l1.6-3"
            className="stroke-accent-light"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </svg>
      );
    case 'coin':
      return (
        <svg {...common}>
          <circle cx="16" cy="17" r="12" className="fill-accent-lip" />
          <circle cx="16" cy="15.5" r="12" className="fill-accent" />
          <circle
            cx="16"
            cy="15.5"
            r="8.2"
            fill="none"
            className="stroke-accent-lip"
            strokeWidth={1.2}
            strokeOpacity={0.55}
          />
          <path
            d="M13.5 11.5h4a2 2 0 0 1 0 4h-4v4.5M13.5 15.5h4"
            fill="none"
            className="stroke-accent-lip"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'chest':
    case 'chestOpen':
      // 축하 카드 ChestCard 와 같은 칠: 몸통 accent-text · 띠 accent · 안쪽 accent-light. 열림은 뚜껑을 뒤로 젖힘
      return (
        <svg {...common}>
          {kind === 'chestOpen' && (
            <path d="M5 13h22v3H5z" className="fill-accent-light" />
          )}
          <g transform={kind === 'chestOpen' ? 'rotate(-30 4 15)' : undefined}>
            <path
              d="M3.5 15C3.5 9 9 5.5 16 5.5S28.5 9 28.5 15Z"
              className="fill-accent-text"
            />
            <path d="M14 8.5h4V15h-4z" className="fill-accent" />
          </g>
          <path d="M3.5 16h25v11.5h-25z" className="fill-accent-text" />
          <path
            d="M3.5 19.5h25V21h-25zM14 17.5h4v6.5h-4z"
            className="fill-accent"
          />
        </svg>
      );
    case 'key':
      return (
        <svg {...common}>
          <path
            d="M15.5 16.5l10 10M21 22l2.5-2.5M23.5 24.5l2-2"
            className="stroke-accent-lip"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle
            cx="11"
            cy="12"
            r="6.5"
            className="fill-accent stroke-accent-lip"
            strokeWidth={1.1}
          />
          <circle cx="11" cy="12" r="2.4" className="fill-surface" />
        </svg>
      );
  }
}

interface StarsProps {
  /** 받은 별 (0~max) */
  n: number;
  max?: number;
  size?: number;
  /** false면 장식 (옆에 같은 내용을 글자로 보여 줄 때) */
  label?: boolean;
  className?: string;
}

/** 별 0~3개 (퀘스트 평가). 화면 낭독기에는 "별 2개 / 3개" 한 번으로 읽힌다 */
export function Stars({
  n,
  max = 3,
  size = 22,
  label = true,
  className,
}: StarsProps) {
  const got = Math.max(0, Math.min(max, Math.round(n)));
  return (
    <span
      className={cn('inline-flex items-center gap-px align-middle', className)}
      role={label ? 'img' : undefined}
      aria-label={label ? `별 ${got}개 / ${max}개` : undefined}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: max }, (_, i) => (
        <RewardIcon key={i} kind={i < got ? 'star' : 'starEmpty'} size={size} />
      ))}
    </span>
  );
}
