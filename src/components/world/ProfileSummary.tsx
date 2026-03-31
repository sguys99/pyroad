import type { UserProfile } from '@/lib/types/database';

const LEVEL_TITLES: Record<number, string> = {
  1: '코딩 새싹',
  2: '코딩 탐험가',
  3: '코딩 모험가',
  4: '코딩 용사',
  5: '코딩 마법사',
};

interface ProfileSummaryProps {
  profile: UserProfile;
}

export function ProfileSummary({ profile }: ProfileSummaryProps) {
  const title = LEVEL_TITLES[profile.current_level] ?? '코딩 새싹';

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
