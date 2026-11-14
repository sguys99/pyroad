import { beforeEach, describe, expect, it, vi } from 'vitest';

// 내 자랑 카드 숨기기·다시 공개·지우기 API (P9-11)

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  gate: vi.fn(),
  purge: vi.fn(),
  track: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/consent/server', () => ({ guardianWriteGate: mocks.gate }));
vi.mock('@/lib/share-card/purge', () => ({ purgeShareCards: mocks.purge }));
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: mocks.track }));
vi.mock('@/lib/observability/server', () => ({ captureServerError: vi.fn() }));

import { DELETE, PATCH } from '../route';

// 처리방침 시행일 판정은 켜 둔다 (B79). 꺼진 경우는 따로 확인
const policy = vi.hoisted(() => ({ live: true }));
vi.mock('@/lib/legal/policyGate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legal/policyGate')>()),
  isPolicyLive: async () => policy.live,
}));

const ID = 'rG6TzuP93C8blCS4ZdyehQ';
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown, id = ID) =>
  PATCH(
    new Request(`http://x/api/share-cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
const del = () =>
  DELETE(
    new Request(`http://x/api/share-cards/${ID}`, { method: 'DELETE' }),
    ctx(),
  );

function rpcReturns(isPublic: boolean, deleted = false) {
  mocks.rpc.mockResolvedValue({
    data: {
      id: ID,
      kind: 'levelup',
      version: 3,
      is_public: isPublic,
      expires_at: '2027-02-11T00:00:00Z',
      deleted,
    },
    error: null,
  });
}

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.rpc.mockReset();
  mocks.gate.mockReset().mockResolvedValue(null);
  mocks.purge.mockReset().mockResolvedValue(undefined);
  mocks.track.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH·DELETE /api/share-cards/[id]', () => {
  it('로그인 안 함 401', async () => {
    mocks.user = null;
    expect((await patch({ action: 'hide' })).status).toBe(401);
  });

  it('잘못된 id·동작은 400, RPC 안 부름', async () => {
    expect((await patch({ action: 'hide' }, 'short')).status).toBe(400);
    expect((await patch({ action: 'delete' })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('숨기기: 확인한 id 로 RPC → CDN 지우기 → 분석(종류·동작만)', async () => {
    rpcReturns(false);
    const res = await patch({ action: 'hide' });
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('manage_share_card', {
      p_user_id: 'u1',
      p_card_id: ID,
      p_action: 'hide',
    });
    expect(mocks.purge).toHaveBeenCalledWith([ID]);
    expect(mocks.gate).not.toHaveBeenCalled();
    expect(mocks.track.mock.calls[0][0]).toMatchObject({
      name: 'share_manage',
      props: { kind: 'levelup', action: 'hide' },
    });
    expect(await res.json()).toMatchObject({
      isPublic: false,
      imageUrl: `/api/share-cards/${ID}/image?v=3`,
    });
  });

  it('다시 공개는 보호자 동의 게이트, CDN 지우기 없음', async () => {
    rpcReturns(true);
    const res = await patch({ action: 'show' });
    expect(res.status).toBe(200);
    expect(mocks.gate).toHaveBeenCalledOnce();
    expect(mocks.purge).not.toHaveBeenCalled();
  });

  it('게이트에 막히면 RPC 안 부름', async () => {
    mocks.gate.mockResolvedValue(new Response(null, { status: 403 }));
    expect((await patch({ action: 'show' })).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('지우기 → CDN 지우기', async () => {
    rpcReturns(false, true);
    const res = await del();
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    expect(mocks.purge).toHaveBeenCalledWith([ID]);
  });

  it('남의 카드는 404, 지우기 없음', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'share_card_not_found', code: 'PT404' },
    });
    expect((await del()).status).toBe(404);
    expect(mocks.purge).not.toHaveBeenCalled();
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
