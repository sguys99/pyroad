import type {
  AchievementInfo,
  AchievementTier,
} from '@/lib/quest/achievements';

/** 테스트용 업적 한 줄 (00036 evaluate_achievements 반환 모양) */
export function achv(
  id: string,
  tier: AchievementTier = 'bronze',
): AchievementInfo {
  const coins = { bronze: 10, silver: 30, gold: 100 }[tier];
  return {
    id,
    name: `업적 ${id}`,
    description: `${id} 설명`,
    icon: 'Code',
    tier,
    coins,
  };
}
