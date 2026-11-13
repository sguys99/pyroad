import { describe, expect, it } from 'vitest';
import { myCardDetail, myCardState } from '../myCards';

// 내 자랑 카드 한 줄 (P9-11): 상태·남은 날·성과 글

const NOW = new Date('2026-11-13T00:00:00Z');
const at = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe('myCardState', () => {
  it('공개 중이면 남은 날(올림)', () => {
    expect(myCardState({ isPublic: true, expiresAt: at(89.2) }, NOW)).toEqual({
      state: 'public',
      daysLeft: 90,
    });
  });
  it('공개인데 기간이 지나면 기간 끝', () => {
    expect(myCardState({ isPublic: true, expiresAt: at(-1) }, NOW).state).toBe(
      'expired',
    );
  });
  it('숨긴 카드는 기간과 상관없이 숨김', () => {
    expect(myCardState({ isPublic: false, expiresAt: at(30) }, NOW).state).toBe(
      'hidden',
    );
  });
});

describe('myCardDetail', () => {
  it('종류별 성과 한 줄', () => {
    expect(myCardDetail('levelup', { nickname: '별', level: 7 })).toBe(
      '레벨 7',
    );
    expect(
      myCardDetail('weekly', {
        nickname: '별',
        weekLabel: '11월 둘째 주',
        quests: 5,
        xp: 100,
        stars: 9,
      }),
    ).toBe('11월 둘째 주 · 퀘스트 5개');
  });
  it('모양이 틀리면 빈 글', () => {
    expect(myCardDetail('levelup', { nickname: '별', email: 'a@b.c' })).toBe(
      '',
    );
    expect(myCardDetail('party', {})).toBe('');
  });
});
