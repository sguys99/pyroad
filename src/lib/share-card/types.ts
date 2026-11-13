/**
 * 공유 카드 데이터 (P2-19 템플릿, P9-07에서 `share_cards.payload` 스냅샷으로 저장).
 *
 * **공개 정보만** 담는다(§2.6): 닉네임 + 캐릭터(아바타 설정) + 학습 성과 숫자·이름. 실명·이메일·사진·학교·학년·
 * 학습 시각(몇 시에 했는지)·요일별 활동은 넣지 않는다(§12-Q67 ②: 공개 주간 카드는 합계만, 요일별은 보호자 리포트 P9-15).
 */
import type { WorldId } from '@/lib/design/tokens';
import type { Costume } from '@/components/characters/rig/costumes';

export type ShareCardKind = 'levelup' | 'stage' | 'achievement' | 'weekly';
export type Tier = 'bronze' | 'silver' | 'gold';

/** 업적 메달 안 그림 (자체 SVG, 이모지 대신) */
export type BadgeIcon =
  | 'code'
  | 'bug'
  | 'flame'
  | 'star'
  | 'book'
  | 'bulb'
  | 'crown';

export interface ShareCardAvatar {
  /** 꾸미기 (P9-04 `avatar_config`). 지금은 파이뱀만 */
  costume?: Costume;
  /** 파이뱀 스킨 id (`avatar_config.skin`, P3-13·§12-Q34). 없으면 기본 숲초록 */
  skin?: string | null;
}

interface Base {
  nickname: string;
  avatar?: ShareCardAvatar;
  /** 무대 틴트. 스테이지 카드는 그 스테이지의 월드, 나머지는 지금 월드 (기본 1) */
  world?: WorldId;
}

export interface LevelUpCardData extends Base {
  kind: 'levelup';
  level: number;
  /** 새 칭호 (선택) */
  title?: string;
}

export interface StageClearCardData extends Base {
  kind: 'stage';
  world: WorldId;
  /** 월드(권) 이름: "숲 마을" */
  worldName: string;
  stageNo: number;
  stageName: string;
  /** 0~maxStars (빈 별 상태 포함) */
  stars: number;
  maxStars?: number;
}

export interface AchievementCardData extends Base {
  kind: 'achievement';
  name: string;
  desc: string;
  tier: Tier;
  icon: BadgeIcon;
}

export interface WeeklyCardData extends Base {
  kind: 'weekly';
  /** "11월 첫째 주" 같은 주 이름 (날짜·요일·시각은 넣지 않음) */
  weekLabel: string;
  quests: number;
  /** 이번 주에 얻은 XP (합계만, §12-Q67 ②) */
  xp: number;
  stars: number;
}

export type ShareCardData =
  | LevelUpCardData
  | StageClearCardData
  | AchievementCardData
  | WeeklyCardData;
