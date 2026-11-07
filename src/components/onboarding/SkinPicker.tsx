'use client';

import { useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import { PYBAEM_SKINS, SKIN_IDS, type SkinId } from '@/lib/avatar/skins';
import { swatchPop } from '@/lib/celebration/onboardingFx';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { useSfx } from '@/components/providers/soundContext';
import { cn } from '@/lib/utils';
import { useRovingRadio } from './useRovingRadio';

export interface SkinPickerProps {
  value: SkinId | null;
  onChange: (skin: SkinId) => void;
  /** 묶음 이름 (보이는 제목의 id 또는 글자) */
  'aria-labelledby'?: string;
  className?: string;
}

/**
 * 파이뱀 색 고르기 (P3-11, §12-Q34): 6색 칸 = 그 색 파이뱀 정지 그림 + 이름. 3칸 × 2줄, 칸마다 누르는 자리 96px 이상.
 * 라디오 묶음(←→↑↓·Home·End로 옮기며 고름, 고른 칸만 Tab 순서). 고른 칸은 초록 고리 + 체크 + 옅은 초록 면 —
 * 색만이 아니라 모양(고리·체크)과 글자(이름)로도 구분된다. 고르면 칸이 톡(prop 스프링, minimal·동작 줄이기는 없음) + 탭 소리.
 */
export function SkinPicker({
  value,
  onChange,
  'aria-labelledby': labelledBy,
  className,
}: SkinPickerProps) {
  const { budget } = useMotionTier();
  const play = useSfx();
  const idBase = useId();
  const tiles = useRef<(HTMLElement | null)[]>([]);
  const pick = (skin: SkinId) => {
    if (skin === value) return;
    onChange(skin);
    play('tap');
    swatchPop(tiles.current[SKIN_IDS.indexOf(skin)], budget);
  };
  const { itemProps } = useRovingRadio(SKIN_IDS, value, pick);

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn('ob-swatches', className)}
      data-testid="skin-picker"
    >
      {PYBAEM_SKINS.map((skin, i) => {
        const selected = skin.id === value;
        const { ref, ...radio } = itemProps(i);
        return (
          <button
            key={skin.id}
            type="button"
            {...radio}
            ref={(el) => {
              ref(el);
              tiles.current[i] = el;
            }}
            id={`${idBase}-${skin.id}`}
            className="ob-swatch focus-ring"
            data-selected={selected || undefined}
            data-skin={skin.id}
            onClick={() => pick(skin.id)}
          >
            <span className="ob-swatch-art" aria-hidden>
              <PybaemStatic
                state={selected ? 'happy' : 'idle'}
                size={64}
                palette={skin.palette}
                framing="avatar"
                label=""
                filters={false}
              />
            </span>
            <span className="ob-swatch-name">{skin.name}</span>
            {selected && (
              <span className="ob-swatch-check" aria-hidden>
                <Check strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
