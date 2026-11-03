import { LevelUpCardA } from './LevelUpCardA';
import { StageClearCardA } from './StageClearCardA';
import { StageClearCardB } from './StageClearCardB';
import { AchievementCardA } from './AchievementCardA';
import { WeeklyCardB } from './WeeklyCardB';
import type { CardData, RenderedCard } from './types';

export function renderCard(d: CardData, opts: { grain?: boolean } = {}): RenderedCard {
  switch (d.kind) {
    case 'levelup':
      return LevelUpCardA(d);
    case 'stage':
      return d.style === 'a' ? StageClearCardA(d) : StageClearCardB(d, opts);
    case 'achievement':
      return AchievementCardA(d);
    case 'weekly':
      return WeeklyCardB(d);
  }
}

export type { CardData, RenderedCard } from './types';
