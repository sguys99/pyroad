import type { UserBadge } from '@/lib/types/database';

export type BadgeType = UserBadge['badge_type'];

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: 'first_code',
    name: '첫 코드',
    description: '첫 번째 퀘스트를 완료했어요!',
    icon: 'Code',
  },
  {
    type: 'hint_master',
    name: '힌트 마스터',
    description: '힌트 없이 퀘스트를 클리어했어요!',
    icon: 'Lightbulb',
  },
  {
    type: 'stage_clear',
    name: '스테이지 클리어',
    description: '스테이지의 모든 퀘스트를 완료했어요!',
    icon: 'Map',
  },
  {
    type: 'streak_3',
    name: '3일 연속',
    description: '3일 연속 퀘스트를 완료했어요!',
    icon: 'Flame',
  },
  {
    type: 'project_builder',
    name: '프로젝트 빌더',
    description: '최종 프로젝트를 완료했어요!',
    icon: 'Trophy',
  },
];

export function getBadgeDefinition(type: BadgeType): BadgeDefinition {
  return BADGE_DEFINITIONS.find((b) => b.type === type) ?? BADGE_DEFINITIONS[0];
}
