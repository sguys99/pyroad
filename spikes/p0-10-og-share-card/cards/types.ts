import type { ReactElement } from 'react';
import type { Costume } from '../lib/characters';
import type { Family } from '../lib/fonts';
import type { LUCIDE } from '../lib/decor';

export type CardKind = 'levelup' | 'stage' | 'achievement' | 'weekly';
export type CardStyle = 'a' | 'b';

/**
 * 공유 카드에 들어가는 데이터. **공개 정보만** 담습니다 (§2.6):
 * 닉네임 + 캐릭터(아바타 설정) + 학습 성과 숫자. 실명·이메일·사진·학교·학년·시간대 정보는 넣지 않습니다.
 * 실제 구현에서는 share_cards.payload(jsonb)에 생성 시점 스냅샷으로 저장합니다.
 */
export interface CardData {
  kind: CardKind;
  style: CardStyle;
  nickname: string;
  avatar: { character: 'pybaem' | 'bugbug' | 'byeolttongi'; expression?: string; costumes?: Costume[] };
  level?: { value: number; title?: string };
  stage?: { no: number; name: string; stars: number; maxStars: number; world: string };
  achievement?: { name: string; desc: string; tier: 'bronze' | 'silver' | 'gold'; icon: keyof typeof LUCIDE };
  weekly?: { range: string; days: number[]; quests: number; stars: number; streak: number; learned: string[] };
}

export interface RenderedCard {
  element: ReactElement;
  families: Family[];
  /** google 전략에서 &text= 로 보낼 글자 */
  text: string;
}
