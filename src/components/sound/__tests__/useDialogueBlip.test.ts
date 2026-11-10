import { describe, expect, it } from 'vitest';
import {
  BLIP_MAX_PER_LINE,
  BLIP_MIN_GAP_MS,
  blipStep,
  initialBlipState,
} from '../useDialogueBlip';

/** gap ms마다 한 글자씩 (useTyping 34ms) 늘어날 때 블립이 난 글자 수 */
function typeLine(chars: number, random = () => 0.3, gap = 34) {
  const s = initialBlipState();
  const at: number[] = [];
  for (let n = 1; n <= chars; n++)
    if (blipStep(s, n, n * gap, random)) at.push(n);
  return { s, at };
}

describe('blipStep (P6-14 대사 블립)', () => {
  it('첫 글자에 한 번, 그 뒤 2~3글자마다', () => {
    expect(typeLine(9, () => 0.1).at).toEqual([1, 3, 5, 7, 9]);
    expect(typeLine(10, () => 0.9).at).toEqual([1, 4, 7, 10]);
  });

  it('간격이 BLIP_MIN_GAP_MS보다 짧으면 건너뛴다', () => {
    const { at } = typeLine(12, () => 0.1, 10);
    const gaps = at.slice(1).map((n, i) => (n - at[i]) * 10);
    expect(at.length).toBeGreaterThan(1);
    expect(gaps.every((g) => g >= BLIP_MIN_GAP_MS)).toBe(true);
  });

  it('대사 하나에 상한까지만, 새 대사(글자가 비면)는 다시 센다', () => {
    const { s, at } = typeLine(200);
    expect(at).toHaveLength(BLIP_MAX_PER_LINE);
    expect(blipStep(s, 0, 100_000)).toBe(false);
    expect(blipStep(s, 1, 100_100)).toBe(true);
  });

  it('넘기기로 한 번에 늘어나도 한 번만', () => {
    const s = initialBlipState();
    blipStep(s, 1, 0);
    expect(blipStep(s, 80, 500)).toBe(true);
    expect(blipStep(s, 80, 600)).toBe(false);
  });
});
