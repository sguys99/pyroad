'use client';

import { useEffect, useRef } from 'react';
import { useSfx } from '@/components/providers/SoundProvider';

/** 블립 사이 최소 간격 (ms). 글자가 한 번에 여러 개 들어와도 이보다 자주 내지 않는다 */
export const BLIP_MIN_GAP_MS = 150;
/** 대사 하나에서 내는 블립 상한. 긴 설명 내내 울리지 않고 "말을 시작했다"는 느낌만 (약 2.4초) */
export const BLIP_MAX_PER_LINE = 16;

/**
 * 대사 블립 (P2-14): 파이뱀이 말하는 글자가 늘어날 때 작은 "톡" 소리를 띄엄띄엄 낸다.
 * 빈도 제한(간격·대사당 상한) + 낮은 볼륨(매니페스트 gain 0.35, 동시 2개) + 음높이를 조금씩 흔들어 기계음 느낌을 줄인다.
 * 출력 지연이 큰 기기(블루투스)에서는 엔진이 알아서 끈다 (`latencySensitive`). 글자가 비면(새 대사) 상한을 다시 센다.
 */
export function useDialogueBlip(text: string): void {
  const play = useSfx();
  const prevLength = useRef(0);
  const lastAt = useRef(-Infinity);
  const count = useRef(0);

  useEffect(() => {
    const length = text.length;
    if (length < prevLength.current || length === 0) count.current = 0;
    const grew = length > prevLength.current;
    prevLength.current = length;
    if (!grew || count.current >= BLIP_MAX_PER_LINE) return;
    const t = performance.now();
    if (t - lastAt.current < BLIP_MIN_GAP_MS) return;
    lastAt.current = t;
    count.current += 1;
    play('blip', { rate: 0.94 + Math.random() * 0.14 });
  }, [text, play]);
}
