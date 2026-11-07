import { describe, expect, it } from 'vitest';
import { onboardingVariant } from '../returning';

describe('기존 사용자 판별 (P3-12)', () => {
  it('학습 흔적이 없으면 새 사용자', () => {
    expect(
      onboardingVariant({ totalXp: 0, progressCount: 0, nickname: null }),
    ).toBe('new');
    expect(
      onboardingVariant({
        totalXp: null,
        progressCount: undefined,
        nickname: '  ',
      }),
    ).toBe('new');
  });
  it.each([
    ['경험치', { totalXp: 10, progressCount: 0, nickname: null }],
    [
      '진행 행 (황금키만 써서 XP 0)',
      { totalXp: 0, progressCount: 1, nickname: null },
    ],
    ['닉네임', { totalXp: 0, progressCount: 0, nickname: '코딩왕' }],
  ])('%s 이 있으면 기존 사용자', (_l, s) => {
    expect(onboardingVariant(s)).toBe('returning');
  });
});
