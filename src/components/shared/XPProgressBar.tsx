'use client';

import { getXPProgress } from '@/lib/quest/xp';
import { ProgressBar } from '@/components/ui/progress-bar';

interface XPProgressBarProps {
  totalXP: number;
  size?: 'sm' | 'md';
}

/**
 * 레벨 안에서의 경험치 막대 (월드맵 요약·프로필). 공통 진행바(P2-11, `ProgressBar`)로 그리고,
 * 화면에 들어올 때 0에서 채워 올라간다(연출 단계·동작 줄이기는 진행바가 따른다)
 */
export function XPProgressBar({ totalXP, size = 'sm' }: XPProgressBarProps) {
  const { currentLevel, currentLevelXP, nextLevelXP, progressPercent } =
    getXPProgress(totalXP);
  const isMax = nextLevelXP === null;
  const inLevel = totalXP - currentLevelXP;
  const span = isMax ? 0 : nextLevelXP - currentLevelXP;

  return (
    <div className="flex flex-col gap-1">
      {size === 'md' && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lv.{currentLevel}</span>
          {isMax ? (
            <span className="font-bold text-primary-text">MAX</span>
          ) : (
            <span>
              {inLevel} / {span} XP
            </span>
          )}
        </div>
      )}
      <ProgressBar
        value={isMax ? 100 : progressPercent}
        max={100}
        size={size === 'sm' ? 'sm' : 'md'}
        label="다음 레벨까지 경험치"
        valueText={isMax ? '최고 레벨' : `${inLevel} / ${span} XP`}
        animateOnMount
        data-testid="xp-progress"
      />
    </div>
  );
}
