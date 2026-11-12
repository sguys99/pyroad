import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  track: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: mocks.track }));

import { GET } from '../route';
import { POST as purchase } from '../purchase/route';
import { POST as equip } from '../equip/route';

const req = (body: unknown) =>
  new Request('http://x/api/shop', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const BOUGHT = {
  item_id: 'hat_party',
  kind: 'costume',
  price: 150,
  coins_balance: 50,
  golden_keys: 3,
  shields: 0,
  bought_this_week: 0,
};

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset().mockResolvedValue({ data: BOUGHT, error: null });
  mocks.revalidatePath.mockReset();
  mocks.track.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/shop (P9-03)', () => {
  it('로그인하지 않으면 401, RPC 를 부르지 않음', async () => {
    mocks.user = null;
    expect((await GET()).status).toBe(401);
    expect((await purchase(req({ itemId: 'hat_party' }))).status).toBe(401);
    expect((await equip(req({ slot: 'hat', itemId: null }))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('GET: 확인한 id 로 shop_status', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('shop_status', { p_user_id: 'u1' });
  });

  it('구매: 확인한 id·아이템 id 만 넘기고(가격은 서버) 분석 이벤트·무효화', async () => {
    const res = await purchase(
      req({ itemId: 'hat_party', price: 1, userId: 'u2' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BOUGHT);
    expect(mocks.rpc).toHaveBeenCalledWith('purchase_item', {
      p_user_id: 'u1',
      p_item_id: 'hat_party',
    });
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'shop_purchase',
        props: { item_id: 'hat_party', kind: 'costume', price: 150 },
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/world', 'layout');
  });

  it.each([
    [{}, 'invalid_arguments'],
    [{ itemId: 'Hat!' }, 'invalid_arguments'],
    [{ itemId: 42 }, 'invalid_arguments'],
  ])('구매: 잘못된 본문 %j → 400', async (body, code) => {
    const res = await purchase(req(body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(code);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['not_enough_coins', 400],
    ['already_owned', 409],
    ['weekly_limit_reached', 409],
    ['shields_full', 409],
    ['item_inactive', 410],
    ['item_not_found', 404],
  ])(
    '구매 실패 %s → %i + 아이용 문구, 이벤트 없음',
    async (message, status) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { message } });
      const res = await purchase(req({ itemId: 'golden_key' }));
      expect(res.status).toBe(status);
      const json = await res.json();
      expect(json.code).toBe(message);
      expect(json.error).not.toMatch(/[a-z_]{6,}/);
      expect(mocks.track).not.toHaveBeenCalled();
    },
  );

  it('DB 오류 문구는 응답에 넣지 않음', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "x" does not exist' },
    });
    const res = await purchase(req({ itemId: 'hat_party' }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('relation');
  });

  it('장착·벗기: slot·itemId 를 RPC 로, null 이면 p_item_id 생략', async () => {
    await equip(req({ slot: 'hat', itemId: 'hat_party' }));
    expect(mocks.rpc).toHaveBeenLastCalledWith('equip_item', {
      p_user_id: 'u1',
      p_slot: 'hat',
      p_item_id: 'hat_party',
    });
    await equip(req({ slot: 'editor_theme', itemId: null }));
    expect(mocks.rpc).toHaveBeenLastCalledWith('equip_item', {
      p_user_id: 'u1',
      p_slot: 'editor_theme',
    });
  });

  it.each([
    [{ slot: 'shoes', itemId: 'hat_party' }],
    [{ itemId: 'hat_party' }],
    [{ slot: 'hat', itemId: 'HAT' }],
  ])('장착: 잘못된 본문 %j → 400', async (body) => {
    expect((await equip(req(body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['not_owned', 403],
    ['wrong_slot', 400],
  ])('장착 실패 %s → %i', async (message, status) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    const res = await equip(req({ slot: 'hat', itemId: 'hat_crown' }));
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(message);
  });
});
