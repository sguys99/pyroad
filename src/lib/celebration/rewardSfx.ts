import { STAR_RATES } from '@/lib/sound/manifest';
import type { CelebrationSfx } from './sound';

// 퀘스트 첫 화면(보상 띠)이 축하 시퀀서(plan.ts: 뱃지 정의 등)를 끌고 오지 않게 따로 둔다

export interface SfxCue {
  id: CelebrationSfx;
  /** 시작 기준 ms */
  at: number;
  rate?: number;
}

/** 코인 카운트업 동안 'coin'을 이 간격(ms)보다 촘촘하지 않게, 한 번에 최대 COIN_TICKS_MAX번 (엔진 동시 상한 6과 같게) */
export const COIN_TICK_MS = 80;
export const COIN_TICKS_MAX = 6;

/**
 * 보상 효과음 (P6-14): 별이 하나씩 톡 튈 때마다 'star'(rate 1 → 1.26 → 1.5), 코인 숫자가 오르는 동안 'coin'을 짧게 여러 번.
 * 움직임이 없으면(gap·countMs 0) 별은 한꺼번에(화음), 코인은 한 번. 퀘스트 보상 띠(`RewardStrip`)와 보상 카드가 같이 쓴다
 */
export function rewardSfx({
  stars,
  coins,
  starsAtMs = 0,
  starGapMs = 0,
  countAtMs = 0,
  countMs = 0,
}: {
  stars: number;
  coins: number;
  starsAtMs?: number;
  starGapMs?: number;
  countAtMs?: number;
  countMs?: number;
}): SfxCue[] {
  const cues: SfxCue[] = [];
  for (let i = 0; i < Math.min(stars, STAR_RATES.length); i++)
    cues.push({
      id: 'star',
      at: Math.round(starsAtMs + i * starGapMs),
      rate: STAR_RATES[i],
    });
  if (coins > 0) {
    const n = Math.max(
      1,
      Math.min(COIN_TICKS_MAX, coins, Math.floor(countMs / COIN_TICK_MS)),
    );
    for (let i = 0; i < n; i++)
      cues.push({
        id: 'coin',
        at: Math.round(countAtMs + (n > 1 ? (i * countMs) / (n - 1) : 0)),
      });
  }
  return cues;
}
