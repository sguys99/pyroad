import {
  Award,
  BadgeCheck,
  Brain,
  BugOff,
  Bug,
  CalendarCheck,
  CalendarHeart,
  Castle,
  Code,
  Compass,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gem,
  Gift,
  GraduationCap,
  Hammer,
  HeartHandshake,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Medal,
  Mountain,
  MountainSnow,
  Orbit,
  Package,
  Repeat,
  Rocket,
  RotateCcw,
  Sparkle,
  Sparkles,
  Sprout,
  Star,
  Swords,
  Target,
  Telescope,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AchievementTier } from '@/lib/quest/achievements';
import { cn } from '@/lib/utils';
import './achievementMedal.css';

/** 업적 아이콘 (00036 achievements.icon 의 Lucide 이름 → 컴포넌트). 표에 새 이름을 쓰면 여기에도 (테스트가 대조) */
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  BadgeCheck,
  Brain,
  Bug,
  BugOff,
  CalendarCheck,
  CalendarHeart,
  Castle,
  Code,
  Compass,
  Crown,
  Flag,
  Flame,
  Footprints,
  Gem,
  Gift,
  GraduationCap,
  Hammer,
  HeartHandshake,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Medal,
  Mountain,
  MountainSnow,
  Orbit,
  Package,
  Repeat,
  Rocket,
  RotateCcw,
  Sparkle,
  Sparkles,
  Sprout,
  Star,
  Swords,
  Target,
  Telescope,
  Trophy,
  Zap,
};

/** 업적 아이콘 그림 (모르는 이름은 메달 모양) */
export function AchievementGlyph({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ACHIEVEMENT_ICONS[icon] ?? Award;
  return <Icon className={className} aria-hidden />;
}

const SIZE = {
  sm: 'size-8 [&>svg]:size-4',
  md: 'size-10 [&>svg]:size-5',
  lg: 'size-14 [&>svg]:size-7',
} as const;

/** 티어 색 메달 (P8-09, 프로필·도감). 얻지 않았으면 흐린 회색 */
export function AchievementMedal({
  icon,
  tier,
  earned = true,
  size = 'lg',
  className,
}: {
  icon: string;
  tier: AchievementTier;
  earned?: boolean;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn('ach-medal', SIZE[size], className)}
      data-tier={tier}
      data-earned={earned}
      aria-hidden
    >
      <AchievementGlyph icon={icon} />
    </span>
  );
}
