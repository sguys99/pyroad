import type { AchievementInfo } from '@/lib/quest/achievements';

/** 카탈로그 견본 업적 (00036 표의 실제 행 — 브론즈·실버·골드 하나씩 + 실패 칭찬) */
export const SAMPLE_ACHIEVEMENTS: Record<string, AchievementInfo> = {
  first_code: {
    id: 'first_code',
    name: '첫 코드',
    description: '처음으로 퀘스트를 혼자 풀었어요!',
    icon: 'Code',
    tier: 'bronze',
    coins: 10,
  },
  stage_clear: {
    id: 'stage_clear',
    name: '스테이지 클리어',
    description: '스테이지 하나를 끝까지 깼어요!',
    icon: 'Flag',
    tier: 'bronze',
    coins: 10,
  },
  quests_10: {
    id: 'quests_10',
    name: '코드 탐험가',
    description: '퀘스트 10개를 혼자 풀었어요.',
    icon: 'Compass',
    tier: 'silver',
    coins: 30,
  },
  quests_30: {
    id: 'quests_30',
    name: '코드 모험왕',
    description: '퀘스트 30개를 혼자 풀었어요.',
    icon: 'Mountain',
    tier: 'gold',
    coins: 100,
  },
  error_1: {
    id: 'error_1',
    name: '첫 에러 친구',
    description: '에러를 만났지만 포기하지 않고 끝까지 풀었어요!',
    icon: 'Bug',
    tier: 'bronze',
    coins: 10,
  },
};
