// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { playSfx, NOOP_ENGINE, type AppEngine } from '../soundContext';

describe('playSfx (useSfx 본체)', () => {
  it('rate·gain 옵션을 엔진에 그대로 넘기고 확인용 이벤트에 rate 를 싣는다 (P7-09 콤보 피치·작은 오답 소리)', () => {
    const play = vi.fn();
    const engine = { ...NOOP_ENGINE, play } as AppEngine;
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('pyroad:sfx', on);
    playSfx(engine, 'correct', { rate: 1.12 });
    playSfx(engine, 'wrong', { gain: 0.55 });
    window.removeEventListener('pyroad:sfx', on);
    expect(play.mock.calls).toEqual([
      ['correct', { rate: 1.12 }],
      ['wrong', { gain: 0.55 }],
    ]);
    expect(seen).toEqual([
      { id: 'correct', rate: 1.12 },
      { id: 'wrong', rate: undefined },
    ]);
  });
});
