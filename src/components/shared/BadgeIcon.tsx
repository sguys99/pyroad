import { Code, Lightbulb, Map, Flame, Trophy, type LucideIcon } from 'lucide-react';
import { getBadgeDefinition, type BadgeType } from '@/lib/quest/badges';

const ICON_MAP: Record<string, LucideIcon> = {
  Code,
  Lightbulb,
  Map,
  Flame,
  Trophy,
};

const SIZE_MAP = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
} as const;

const ICON_SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
} as const;

interface BadgeIconProps {
  type: BadgeType;
  earned: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function BadgeIcon({ type, earned, size = 'sm' }: BadgeIconProps) {
  const badge = getBadgeDefinition(type);
  const Icon = ICON_MAP[badge.icon] ?? Code;

  return (
    <div
      className={`flex items-center justify-center rounded-full ${SIZE_MAP[size]} ${
        earned
          ? 'border-2 border-accent bg-accent/20'
          : 'border border-border bg-muted opacity-30 grayscale'
      }`}
      title={earned ? badge.name : `${badge.name} (미획득)`}
    >
      <Icon className={`${ICON_SIZE_MAP[size]} ${earned ? 'text-accent' : 'text-muted-foreground'}`} />
    </div>
  );
}
