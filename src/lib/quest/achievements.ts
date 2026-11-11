/**
 * 업적 (P8-09, §3 F5). 정의·판정·지급은 모두 서버(00036 `achievements` 표 · `evaluate_achievements` · `claim_achievement`)가 하고,
 * 여기는 그 반환 모양만 둔다 — 이름·설명·아이콘·티어는 표 한 곳(TS 사본 없음, 화면은 RPC 반환이나 표를 읽음).
 *
 * - 티어 브론즈·실버·골드 = 받기 코인 10·30·100 (`coinReward('achievement', 1·2·3)`)
 * - 달성은 보상 RPC 뒤 자동 기록, 코인은 "받기"로(§12-Q62 ③). 기존 뱃지 5종은 같은 id 업적으로 이관
 */
export type AchievementTier = 'bronze' | 'silver' | 'gold';

/** `evaluate_achievements` 반환 한 줄 = 이번에 새로 얻은 업적 */
export interface AchievementInfo {
  id: string;
  name: string;
  description: string;
  /** Lucide 아이콘 이름 (`AchievementGlyph`) */
  icon: string;
  tier: AchievementTier;
  /** 받기 코인 */
  coins: number;
}

/** `claim_achievement` 반환 (00036). 이미 받았으면 already_claimed, 코인 0 */
export interface ClaimAchievementResult {
  claimed: true;
  already_claimed: boolean;
  coins_earned: number;
  coins_balance: number;
}

export const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
};

/** 업적 id 형식 (00036 achievements_id_format) */
export const ACHIEVEMENT_ID = /^[a-z0-9_]{1,40}$/;
