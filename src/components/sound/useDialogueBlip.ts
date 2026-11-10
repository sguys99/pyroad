'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useSfx } from '@/components/providers/soundContext';
import { isShown } from './isShown';

/** 블립 사이 최소 간격 (ms). 글자 간격(34ms)이 흔들려도 이보다 자주 내지 않는다 */
export const BLIP_MIN_GAP_MS = 60;
/** 대사 하나에서 내는 블립 상한. 긴 대사 내내 울리지 않고 "말을 시작했다"는 느낌만 (약 40~50글자) */
export const BLIP_MAX_PER_LINE = 16;

export interface BlipState {
  length: number;
  /** 이 글자 수에 닿으면 다음 블립 */
  next: number;
  lastAt: number;
  count: number;
}

export const initialBlipState = (): BlipState => ({
  length: 0,
  next: 1,
  lastAt: -Infinity,
  count: 0,
});

/**
 * 글자 수가 `length`가 된 지금 블립을 낼지 (상태를 고친다). 첫 글자에 한 번, 그 뒤 2~3글자마다,
 * 간격 `BLIP_MIN_GAP_MS` 이상·대사당 `BLIP_MAX_PER_LINE`번까지. 글자가 줄거나 비면 새 대사로 보고 다시 센다
 */
export function blipStep(
  s: BlipState,
  length: number,
  now: number,
  random: () => number = Math.random,
): boolean {
  if (length < s.length || length === 0) Object.assign(s, initialBlipState());
  s.length = length;
  if (length < s.next) return false;
  s.next = length + (random() < 0.5 ? 2 : 3);
  if (s.count >= BLIP_MAX_PER_LINE || now - s.lastAt < BLIP_MIN_GAP_MS)
    return false;
  s.lastAt = now;
  s.count += 1;
  return true;
}

/**
 * 대사 블립 (P2-14 → P6-14): 대사창(`DialogueBox`) 글자가 한 글자씩 나올 때 2~3글자마다 작은 "톡".
 * 낮은 볼륨(매니페스트 gain 0.35, 동시 2개) + 음높이를 조금씩 흔들어 기계음 느낌을 줄인다.
 * `typing`이 false(넘기기·minimal·동작 줄이기로 한 번에 다 보임)면 울리지 않고, 대사창이 화면에 안 보이면(모바일 다른 쪽) 울리지 않는다.
 * 출력 지연이 큰 기기(블루투스)·소리 설정은 엔진이 따른다 (`latencySensitive`)
 */
export function useDialogueBlip(
  text: string,
  typing: boolean,
  host?: RefObject<HTMLElement | null>,
): void {
  const play = useSfx();
  const state = useRef(initialBlipState());

  useEffect(() => {
    const blip = blipStep(state.current, text.length, performance.now());
    if (!blip || !typing) return;
    if (host && !isShown(host.current)) return;
    play('blip', { rate: 0.94 + Math.random() * 0.14 });
  }, [text, typing, host, play]);
}
