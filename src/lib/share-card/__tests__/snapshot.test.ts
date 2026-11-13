import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

import { cardFromSnapshot, SHARE_CARD_KINDS } from '../snapshot';
import { shareCardCacheHeaders } from '../publicCard';

describe('스냅샷 → 카드 (P9-07)', () => {
  it('4종, DB CHECK 와 같은 키만 받음 (모르는 키·종류·모양이 틀리면 null)', () => {
    expect(SHARE_CARD_KINDS).toEqual([
      'levelup',
      'stage',
      'achievement',
      'weekly',
    ]);
    expect(cardFromSnapshot('levelup', { nickname: 'a1', level: 2 })).not.toBe(
      null,
    );
    expect(
      cardFromSnapshot('levelup', { nickname: 'a1', level: 2, email: 'x' }),
    ).toBe(null);
    expect(cardFromSnapshot('party', { nickname: 'a1' })).toBe(null);
    expect(cardFromSnapshot('stage', { nickname: 'a1', level: 2 })).toBe(null);
    // 공개 주간 카드는 합계만 (§12-Q67 ②): 요일별 키는 받지 않음
    expect(
      cardFromSnapshot('weekly', {
        nickname: 'a1',
        weekLabel: '11월 둘째 주',
        quests: 3,
        xp: 90,
        stars: 7,
        days: { mon: 1 },
      }),
    ).toBe(null);
  });

  it('공개 꾸민 모습 아이템 id → 코스튬·스킨 (펫·모르는 값은 그리지 않음)', () => {
    const d = cardFromSnapshot('levelup', {
      nickname: '하늘별',
      level: 5,
      world: 2,
      avatar: {
        skin: 'sky',
        hat: 'hat_wizard',
        glasses: 'hat_crown',
        cape: 'cape_night',
        bg: 'bg_island',
      },
    });
    expect(d).toMatchObject({
      kind: 'levelup',
      level: 5,
      world: 2,
      avatar: {
        skin: 'sky',
        costume: { hat: 'wizard', bg: 'island', cape: expect.any(String) },
      },
    });
    expect(d?.avatar?.costume?.glasses).toBeUndefined();
    expect(
      cardFromSnapshot('levelup', {
        nickname: 'a1',
        level: 2,
        avatar: { pet: 'pet_fox' },
      }),
    ).toBe(null);
  });
});

describe('이미지 캐시 헤더 (P9-07)', () => {
  const now = new Date('2026-11-13T00:00:00Z');
  it('CDN 1년·브라우저 1시간, 단 90일 만료 시각을 넘기지 않음', () => {
    const far = new Date(now.getTime() + 90 * 86_400_000);
    expect(shareCardCacheHeaders('abc', far, now)).toEqual({
      'cache-control': 'public, max-age=3600',
      'vercel-cdn-cache-control': 'public, max-age=7776000',
      'vercel-cache-tag': 'share-card-abc',
    });
    const soon = new Date(now.getTime() + 600_000);
    expect(shareCardCacheHeaders('abc', soon, now)).toMatchObject({
      'cache-control': 'public, max-age=600',
      'vercel-cdn-cache-control': 'public, max-age=600',
    });
    expect(
      shareCardCacheHeaders('abc', new Date(now.getTime() - 1), now)[
        'cache-control'
      ],
    ).toBe('public, max-age=0');
  });
});
