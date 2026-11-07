import type { UserProfile, UserBadge } from '@/lib/types/database';
import { getLevelTitle } from '@/lib/quest/xp';
import { BADGE_DEFINITIONS } from '@/lib/quest/badges';
import { XPProgressBar } from '@/components/shared/XPProgressBar';
import { BadgeIcon } from '@/components/shared/BadgeIcon';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { Card } from '@/components/ui/card';

interface ProfileSummaryProps {
  profile: UserProfile;
  badges: Pick<UserBadge, 'badge_type' | 'earned_at'>[];
}

export function ProfileSummary({ profile, badges }: ProfileSummaryProps) {
  const title = getLevelTitle(profile.current_level);
  const earnedTypes = new Set(badges.map((b) => b.badge_type));

  return (
    <Card className="flex flex-col gap-3">
      {/* 상단: 아바타 + 이름 + XP */}
      <div className="flex items-center gap-4">
        <UserAvatar skin={profile.skin} size={48} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate">{profile.name}</p>
          <p className="text-sm text-muted-foreground">
            Lv.{profile.current_level} {title}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary-text">
            {profile.total_xp}
          </p>
          <p className="text-xs text-muted-foreground">XP</p>
        </div>
      </div>

      {/* XP 프로그레스 바 */}
      <XPProgressBar totalXP={profile.total_xp} size="sm" />

      {/* 뱃지 컬렉션 */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {BADGE_DEFINITIONS.map((badge) => (
          <BadgeIcon
            key={badge.type}
            type={badge.type}
            earned={earnedTypes.has(badge.type)}
            size="sm"
          />
        ))}
      </div>
    </Card>
  );
}
