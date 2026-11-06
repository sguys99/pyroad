'use client';

import { forwardRef } from 'react';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import type { RigHandle } from '@/components/characters/rig/LiveRig';
import type { PybaemState } from '@/components/characters/rig';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { skinPalette, type SkinId } from '@/lib/avatar/skins';
import { cn } from '@/lib/utils';

export interface GuideMascotProps {
  /** 파이뱀 대사 (바뀌면 타자 효과로 다시) */
  line: string;
  state: PybaemState;
  /** 파이뱀 색 = 아이가 고른 색 (온보딩에서 고르는 대로 바로 바뀜) */
  skin: SkinId;
  /** 말하는 중 입 움직임 */
  talking?: boolean;
  size?: 'md' | 'lg';
  paused?: boolean;
  className?: string;
}

/**
 * 온보딩·튜토리얼 안내: 라이브 파이뱀 + 말풍선 (P3-11). 파이뱀은 아이가 고른 색으로 그린다(리그 `palette` 덮어쓰기) —
 * "내 파이뱀"이 길잡이가 되는 구성. 색이 바뀌면 몸 색이 부드럽게 바뀐다(`.ob-guide` CSS fill 전환, 동작 줄이기는 즉시).
 * 연출 단계·동작 줄이기는 리그가 `useMotionTier()`로 따른다(동작 줄이기: 위치·크기 0, 표정·색만).
 * 대사는 `aria-live="polite"`로 낭독기에 한 번 읽힌다(타자 효과 중에도 전체 문장, components.md §9).
 */
export const GuideMascot = forwardRef<RigHandle<PybaemState>, GuideMascotProps>(
  function GuideMascot(
    { line, state, skin, talking = false, size = 'md', paused, className },
    ref,
  ) {
    return (
      <div className={cn('ob-guide', className)} data-size={size}>
        <div className="ob-guide-rig">
          <PybaemRig
            ref={ref}
            state={state}
            palette={skinPalette(skin)}
            talking={talking}
            size={size === 'lg' ? 132 : 96}
            framing="avatar"
            label=""
            paused={paused}
          />
        </div>
        <div aria-live="polite" className="min-w-0 flex-1">
          <SpeechBubble
            key={line}
            speaker="파이뱀"
            text={line}
            typing
            className="ob-guide-bubble"
            data-testid="onboarding-bubble"
          />
        </div>
      </div>
    );
  },
);
