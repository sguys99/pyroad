import { beforeEach, describe, expect, it, vi } from 'vitest';

// CDN 사본 지우기 (P9-11): 바뀐 카드만 태그로, 실패해도 던지지 않음

const mocks = vi.hoisted(() => ({
  del: vi.fn(),
  report: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@vercel/functions', () => ({ dangerouslyDeleteByTag: mocks.del }));
vi.mock('@/lib/api/serverError', () => ({ reportServerError: mocks.report }));

import { purgeShareCards, withShareCardPurge } from '../purge';

function admin(rounds: { id: string; version: number }[][]) {
  let i = 0;
  return {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: rounds[i++] ?? [], error: null }),
      }),
    }),
  } as never;
}

beforeEach(() => {
  mocks.del.mockReset().mockResolvedValue(undefined);
  mocks.report.mockReset();
});

describe('purgeShareCards', () => {
  it('카드마다 share-card-{id} 태그', async () => {
    await purgeShareCards(['a', 'b']);
    expect(mocks.del).toHaveBeenCalledWith(['share-card-a', 'share-card-b']);
  });
  it('빈 목록은 부르지 않음', async () => {
    await purgeShareCards([]);
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it('실패는 기록만 하고 던지지 않음', async () => {
    mocks.del.mockRejectedValue(new Error('purge down'));
    await expect(purgeShareCards(['a'])).resolves.toBeUndefined();
    expect(mocks.report).toHaveBeenCalledWith(expect.any(Error), {
      area: 'share-card',
      op: 'share-card purge',
    });
  });
});

describe('withShareCardPurge', () => {
  it('version 이 바뀐 카드만 지우고 run 결과를 돌려줌', async () => {
    const out = await withShareCardPurge(
      admin([
        [
          { id: 'a', version: 1 },
          { id: 'b', version: 3 },
        ],
        [
          { id: 'a', version: 2 },
          { id: 'b', version: 3 },
        ],
      ]),
      'u1',
      async () => 'ok',
    );
    expect(out).toBe('ok');
    expect(mocks.del).toHaveBeenCalledWith(['share-card-a']);
  });
  it('펫처럼 공개 모습이 그대로면 지우지 않음', async () => {
    await withShareCardPurge(
      admin([[{ id: 'a', version: 1 }], [{ id: 'a', version: 1 }]]),
      'u1',
      async () => null,
    );
    expect(mocks.del).not.toHaveBeenCalled();
  });
  it('카드가 없으면 다시 읽지도 않음', async () => {
    const run = vi.fn(async () => 1);
    await withShareCardPurge(admin([[]]), 'u1', run);
    expect(run).toHaveBeenCalledOnce();
    expect(mocks.del).not.toHaveBeenCalled();
  });
});
