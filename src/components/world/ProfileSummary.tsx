import type { UserProfile } from '@/lib/types/database';
import { getLevelTitle } from '@/lib/quest/xp';

interface ProfileSummaryProps {
  profile: UserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  const title = getLevelTitle(profile.current_level);

  return (
    <div className="flex items-center gap-4 rounded-xl bg-card border border-border p-4 shadow-sm">
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt="아바타"
          className="h-12 w-12 rounded-full"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-xl">
          🐍
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground truncate">
          {profile.display_name}
        </p>
        <p className="text-sm text-muted-foreground">
          Lv.{profile.current_level} {title}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold text-primary">{profile.total_xp}</p>
        <p className="text-xs text-muted-foreground">XP</p>
      </div>
    </div>
  );
}
