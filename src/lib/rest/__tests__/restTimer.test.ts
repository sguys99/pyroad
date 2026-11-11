import { describe, expect, it } from 'vitest';
import {
  BREAK_MS,
  REST_AFTER_MS,
  SNOOZE_MS,
  TICK_MS,
  freshRestState,
  markInput,
  parseRestState,
  snoozeRest,
  tickRest,
  type RestState,
} from '../restTimer';

const MIN = 60_000;

/** 화면이 보이고 아이가 계속 만지는 채로 ms만큼 (TICK_MS마다 틱) */
function play(s: RestState, from: number, ms: number) {
  let t = from;
  let due = false;
  while (t < from + ms) {
    t += TICK_MS;
    const r = tickRest(markInput(s, t), t);
    s = r.state;
    due = r.due;
  }
  return { s, t, due };
}

describe('휴식 타이머 (P8-12)', () => {
  it('보이는 시간을 쌓아 40분에 알린다', () => {
    const a = play(freshRestState(0), 0, REST_AFTER_MS - TICK_MS);
    expect(a.due).toBe(false);
    expect(a.s.played).toBe(REST_AFTER_MS - TICK_MS);
    const b = play(a.s, a.t, TICK_MS);
    expect(b.due).toBe(true);
  });

  it('잠깐 숨긴 틈은 세지 않지만 리셋도 하지 않는다', () => {
    const a = play(freshRestState(0), 0, 10 * MIN);
    // 5분 숨김 → 돌아온 첫 틱은 최대 2틱만 셈
    const t = a.t + 5 * MIN;
    const r = tickRest(markInput(a.s, t), t);
    expect(r.state.played).toBe(10 * MIN + 2 * TICK_MS);
  });

  it('숨김이 10분 넘으면 처음부터', () => {
    const a = play(freshRestState(0), 0, 30 * MIN);
    const t = a.t + BREAK_MS;
    const r = tickRest(markInput(a.s, t), t);
    expect(r.state.played).toBe(0);
    expect(r.state.nextAt).toBe(REST_AFTER_MS);
  });

  it('보이지만 10분 동안 입력이 없으면 자리 비움으로 처음부터', () => {
    let { s, t } = play(freshRestState(0), 0, 30 * MIN);
    for (let i = 0; i < BREAK_MS / TICK_MS; i += 1) {
      t += TICK_MS;
      s = tickRest(s, t).state; // 입력 없이 틱만
    }
    expect(s.played).toBe(0);
  });

  it('조금만 더 → 20분 더 논 뒤 다시 알린다', () => {
    const a = play(freshRestState(0), 0, REST_AFTER_MS);
    expect(a.due).toBe(true);
    const snoozed = snoozeRest(a.s);
    const b = play(snoozed, a.t, SNOOZE_MS - TICK_MS);
    expect(b.due).toBe(false);
    expect(play(b.s, b.t, TICK_MS).due).toBe(true);
  });

  it('sessionStorage 값은 모양이 맞을 때만 쓴다', () => {
    const s = freshRestState(5);
    expect(parseRestState(JSON.stringify(s))).toEqual(s);
    expect(parseRestState('{"played":"1"}')).toBeNull();
    expect(parseRestState('nope')).toBeNull();
    expect(parseRestState(null)).toBeNull();
  });
});
