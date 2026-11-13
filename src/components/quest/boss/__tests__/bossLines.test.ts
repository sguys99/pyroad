import { describe, expect, it } from 'vitest';
import { bossAnnounce, bossLine } from '../BossQuest';
import { arenaPoses } from '../BossArena';

const boss = {
  name: '버그 대장',
  intro: '등장!',
  on_defeat: '졌다!',
  on_victory: '이겼다!',
  rounds: [],
  review_quests: [],
};
const v = (correct: boolean) => ({
  correct,
  explanation: null,
  round: 0,
  submitted: 'opt-a1bc',
});

describe('보스 대사·낭독 (P9-12)', () => {
  it('단계별 보스 한마디', () => {
    expect(bossLine({ phase: 'intro', verdict: null, hearts: 3, boss })).toBe(
      '등장!',
    );
    expect(bossLine({ phase: 'won', verdict: v(true), hearts: 2, boss })).toBe(
      '졌다!',
    );
    expect(
      bossLine({ phase: 'lost', verdict: v(false), hearts: 0, boss }),
    ).toBe('이겼다!');
    expect(
      bossLine({ phase: 'battle', verdict: v(false), hearts: 1, boss }),
    ).toContain('하나 남았네');
  });

  it('소리만으로 알리지 않음: 채점마다 HP·하트를 글자로', () => {
    const base = { total: 5, cleared: 2, hearts: 3, phase: 'battle' as const };
    expect(bossAnnounce({ ...base, verdict: null })).toBe('');
    expect(bossAnnounce({ ...base, verdict: v(true) })).toBe(
      '정답! 공격 성공. 보스 HP 3/5, 하트 3개 남음.',
    );
    expect(bossAnnounce({ ...base, hearts: 2, verdict: v(false) })).toBe(
      '아쉬워요. 하트 2개 남음, 보스 HP 3/5.',
    );
    expect(
      bossAnnounce({ ...base, phase: 'won', cleared: 5, verdict: v(true) }),
    ).toBe('보스를 물리쳤어요! 하트 3개 남음.');
  });

  it('리그 자세', () => {
    expect(arenaPoses('battle', 'attack')).toEqual({
      hero: 'happy',
      boss: 'hit',
    });
    expect(arenaPoses('battle', 'hurt')).toEqual({
      hero: 'surprised',
      boss: 'attack',
    });
    expect(arenaPoses('won', null).boss).toBe('defeat');
  });
});
