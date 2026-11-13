import { describe, expect, it } from 'vitest';
import type { QuizPrompt } from '@/lib/types/database';
import type { BossAnswerResponse } from '../boss';
import { bossHp } from '../boss';
import { bossReducer, initialBossState } from '../useBossSession';

const Q = (n: number): QuizPrompt => ({
  kind: 'multiple_choice',
  question: `문제 ${n}`,
  options: [
    { id: 'opt-a1bc', text: '가' },
    { id: 'opt-d2ef', text: '나' },
  ],
});
const ROUNDS = [Q(1), Q(2), Q(3)];

const res = (over: Partial<BossAnswerResponse>): BossAnswerResponse => ({
  correct: null,
  round: 0,
  hearts: 3,
  total: 3,
  mode: 'first',
  result: null,
  explanation: null,
  reward: null,
  rounds: null,
  ...over,
});

describe('bossReducer (P9-12)', () => {
  const started = bossReducer(initialBossState(ROUNDS, 'first'), {
    type: 'started',
    res: res({ rounds: [Q(9), Q(8), Q(7)] }),
  });

  it('시작: battle · 하트 3 · 서버가 새로 섞은 문제', () => {
    expect(started.phase).toBe('battle');
    expect(started.hearts).toBe(3);
    expect(started.rounds[0].question).toBe('문제 9');
    expect(bossHp({ round: started.cleared, total: 3 })).toBe(3);
  });

  it('오답: 하트 −1 · 같은 문제 · 고른 답은 misses 로, 값은 비움 · 피격 연출', () => {
    const picked = bossReducer(started, { type: 'pick', value: 'opt-d2ef' });
    const s = bossReducer(picked, {
      type: 'graded',
      res: res({ correct: false, hearts: 2, explanation: '아니에요' }),
      submitted: 'opt-d2ef',
    });
    expect(s).toMatchObject({
      round: 0,
      cleared: 0,
      hearts: 2,
      value: null,
      misses: ['opt-d2ef'],
      fx: { type: 'hurt', n: 1 },
    });
    expect(s.verdict).toMatchObject({
      correct: false,
      explanation: '아니에요',
    });
    // 다음 문제로 넘어가지 않음
    expect(bossReducer(s, { type: 'next' })).toBe(s);
  });

  it('정답: 보스 HP −1 · 맞힌 답 그대로 · 공격 연출 → 다음 문제에서 쪽지·misses 비움', () => {
    const s = bossReducer(
      { ...started, misses: ['opt-d2ef'] },
      {
        type: 'graded',
        res: res({ correct: true, round: 1 }),
        submitted: 'opt-a1bc',
      },
    );
    expect(s).toMatchObject({
      round: 0,
      cleared: 1,
      value: 'opt-a1bc',
      fx: { type: 'attack', n: 1 },
    });
    // 맞힌 뒤에는 값을 못 바꿈
    expect(bossReducer(s, { type: 'pick', value: 'opt-d2ef' })).toBe(s);
    const next = bossReducer(s, { type: 'next' });
    expect(next).toMatchObject({
      round: 1,
      verdict: null,
      misses: [],
      value: null,
    });
  });

  it('승리 응답은 reward 를 남기고 finish 로 결과 화면', () => {
    const reward = { stars: 2 } as BossAnswerResponse['reward'];
    const s = bossReducer(started, {
      type: 'graded',
      res: res({ correct: true, round: 3, result: 'win', reward }),
      submitted: 'opt-a1bc',
    });
    expect(s.reward).toBe(reward);
    expect(bossReducer(s, { type: 'finish', phase: 'won' }).phase).toBe('won');
  });

  it('다시 도전: 하트·문제·결과가 처음으로', () => {
    const lost = {
      ...started,
      phase: 'lost' as const,
      hearts: 0,
      cleared: 2,
      round: 2,
    };
    const again = bossReducer(lost, {
      type: 'started',
      res: res({ mode: 'review' }),
    });
    expect(again).toMatchObject({
      phase: 'battle',
      hearts: 3,
      cleared: 0,
      round: 0,
      mode: 'review',
      reward: null,
    });
  });
});
