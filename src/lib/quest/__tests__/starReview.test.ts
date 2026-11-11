import { describe, expect, it } from 'vitest';
import { starReviewOpen } from '../starReview';
import { kstToday } from '@/lib/time/kst';

describe('starReviewOpen (§2.3, §12-Q64 복습 도전은 별 판정 다음 날 KST부터)', () => {
  it('별 3개 미만 + 판정일이 오늘 전이면 열림, 오늘·별 3개면 닫힘, 판정 기록 없는 예전 완료는 열림', () => {
    const today = '2026-11-11';
    expect(
      starReviewOpen({ best_stars: 2, stars_judged_on: '2026-11-10' }, today),
    ).toBe(true);
    expect(
      starReviewOpen({ best_stars: 2, stars_judged_on: today }, today),
    ).toBe(false);
    expect(
      starReviewOpen({ best_stars: 3, stars_judged_on: '2026-11-01' }, today),
    ).toBe(false);
    expect(
      starReviewOpen({ best_stars: 0, stars_judged_on: null }, today),
    ).toBe(true);
  });

  it('KST 자정 경계: 판정일 11일은 UTC 14:59:59(KST 23:59:59)까지 연습, 15:00(KST 12일 0시)부터 복습 도전', () => {
    const q = { best_stars: 1, stars_judged_on: '2026-11-11' };
    expect(starReviewOpen(q, kstToday(new Date('2026-11-11T14:59:59Z')))).toBe(
      false,
    );
    expect(starReviewOpen(q, kstToday(new Date('2026-11-11T15:00:00Z')))).toBe(
      true,
    );
  });
});
