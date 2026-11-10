import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { COIN_SOURCES, getCoinBalance, grantCoinsRpc } from '../rewardRpc';

vi.mock('@/lib/api/serverError', () => ({ reportServerError: vi.fn() }));

describe('코인 RPC 래퍼 (P8-03)', () => {
  it('COIN_SOURCES 가 00030 coin_ledger_source_check 와 같다', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/00030_coin_ledger.sql'),
      'utf8',
    );
    const check = sql.match(
      /coin_ledger_source_check CHECK \(source IN \(([^)]*)\)/,
    );
    expect(check).not.toBeNull();
    const fromSql = [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(fromSql).toEqual([...COIN_SOURCES]);
  });

  it('잔액 부족은 400 "코인이 부족해요"', async () => {
    const admin = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'not_enough_coins', code: 'PT402' },
      }),
    };
    const r = await grantCoinsRpc(admin as never, 'u1', 'quest', 'q1', 10);
    expect(admin.rpc).toHaveBeenCalledWith('grant_coins', {
      p_user_id: 'u1',
      p_source: 'quest',
      p_ref: 'q1',
      p_amount: 10,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      expect(await r.response.json()).toMatchObject({
        code: 'not_enough_coins',
      });
    }
  });

  it('getCoinBalance 는 users.coins, 오류면 null', async () => {
    const chain = (result: unknown) => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => result }) }),
      }),
    });
    expect(
      await getCoinBalance(
        chain({ data: { coins: 35 }, error: null }) as never,
        'u1',
      ),
    ).toBe(35);
    expect(
      await getCoinBalance(
        chain({ data: null, error: { message: 'x' } }) as never,
        'u1',
      ),
    ).toBeNull();
  });
});
