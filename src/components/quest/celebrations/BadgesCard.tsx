'use client';

import { Code, Flame, Lightbulb, Map, Trophy } from 'lucide-react';
import { BADGE_FIRST_AT_S, BADGE_STAGGER_S } from '@/lib/celebration/plan';
import { getBadgeDefinition, type BadgeType } from '@/lib/quest/badges';
import { CelebrationCta, Kicker, delayStyle } from './parts';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Code,
  Lightbulb,
  Map,
  Flame,
  Trophy,
};

interface BadgesCardProps {
  badges: BadgeType[];
  onNext: () => void;
}

/**
 * 업적(뱃지) 묶음 (P6-13): 이번에 받은 뱃지를 한 카드에 금색 메달로 차례로 톡톡. 무엇을 받았는지 한눈에,
 * 컨페티는 묶음에 한 번만. 효과음은 메달이 튈 때마다 음을 올려(시퀀서 `sfxSchedule`)
 */
export function BadgesCard({ badges, onNext }: BadgesCardProps) {
  const single = badges.length === 1;
  const names = badges.map((b) => getBadgeDefinition(b).name);

  return (
    <>
      <div className="cel-head">
        <Kicker gold>
          {single ? '새 뱃지' : `새 뱃지 ${badges.length}개`}
        </Kicker>
        <h2 id="celebration-title" className="cel-t font-display">
          {single ? `${names[0]} 뱃지` : '뱃지를 모았어요'}
        </h2>
      </div>

      <ul
        className="cel-medals"
        data-many={single ? undefined : ''}
        style={{ '--n': Math.min(badges.length, 3) } as React.CSSProperties}
      >
        {badges.map((type, i) => {
          const badge = getBadgeDefinition(type);
          const Icon = ICON_MAP[badge.icon] ?? Code;
          const at = Math.round(
            (BADGE_FIRST_AT_S + i * BADGE_STAGGER_S) * 1000,
          );
          return (
            <li key={type} className="cel-medal-item">
              <span
                className="cel-medal cel-pop"
                data-size={single ? 'l' : undefined}
                style={delayStyle(at)}
                aria-hidden
              >
                <Icon />
              </span>
              {!single && <p className="cel-medal-name">{badge.name}</p>}
              <p className="cel-medal-desc">{badge.description}</p>
            </li>
          );
        })}
      </ul>

      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
      </div>
    </>
  );
}
