import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  gate: vi.fn(),
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

import { POST } from '../route';
import { GET } from '../[id]/image/route';

const ID = 'rG6TzuP93C8blCS4ZdyehQ';
const STAGE = '11111111-2222-4333-8444-555555555555';
const req = (body: unknown) =>
  new Request('http://x/api/share-cards', {
    method: 'POST',
    body: JSON.stringify(body),
  });
const image = (id: string) =>
  GET(new Request(`http://x/api/share-cards/${id}/image?v=9&nickname=해커`), {
    params: Promise.resolve({ id }),
  });

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.gate.mockReset().mockResolvedValue(null);
  mocks.rpc.mockReset().mockResolvedValue({
    data: {
      id: ID,
      kind: 'stage',
      version: 2,
      expires_at: '2027-02-11T00:00:00Z',
      snapshot: {},
    },
    error: null,
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/share-cards (P9-07)', () => {
  it('로그인하지 않으면 401, 모르는 종류·잘못된 ref 는 400 — RPC 를 부르지 않음', async () => {
    mocks.user = null;
    expect((await POST(req({ kind: 'levelup' }))).status).toBe(401);
    mocks.user = { id: 'u1' };
    expect((await POST(req({ kind: 'party' }))).status).toBe(400);
    expect((await POST(req({ kind: 'stage', ref: 'x' }))).status).toBe(400);
    expect(
      (await POST(req({ kind: 'achievement', ref: "a'; drop" }))).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('보호자 동의 전이면 게이트 응답(403) 그대로, 카드를 만들지 않음', async () => {
    mocks.gate.mockResolvedValue(
      Response.json({ code: 'guardian_consent' }, { status: 403 }),
    );
    expect((await POST(req({ kind: 'levelup' }))).status).toBe(403);
    expect(mocks.gate).toHaveBeenCalledWith('u1', expect.anything());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('확인한 id·종류·ref 만 넘기고(성과 숫자는 서버가 계산) 이미지 주소에 version', async () => {
    const res = await POST(
      req({ kind: 'stage', ref: STAGE, stars: 3, nickname: '가짜' }),
    );
    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('create_share_card', {
      p_user_id: 'u1',
      p_kind: 'stage',
      p_ref: STAGE,
    });
    expect(await res.json()).toEqual({
      id: ID,
      kind: 'stage',
      version: 2,
      expiresAt: '2027-02-11T00:00:00Z',
      imageUrl: `/api/share-cards/${ID}/image?v=2`,
    });
    await POST(req({ kind: 'weekly', ref: STAGE }));
    expect(mocks.rpc).toHaveBeenLastCalledWith('create_share_card', {
      p_user_id: 'u1',
      p_kind: 'weekly',
    });
  });

  it('RPC 거절은 아이용 문구 (안 깬 스테이지 409)', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'stage_not_cleared', code: 'PT409' },
    });
    const res = await POST(req({ kind: 'stage', ref: STAGE }));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('stage_not_cleared');
  });
});

describe('GET /api/share-cards/{id}/image (P9-07)', () => {
  const publicRow = (row: unknown) =>
    mocks.rpc.mockReturnValue({
      maybeSingle: async () => ({ data: row, error: null }),
    });

  it('잘못된 id 는 DB 를 부르지 않고 404, 없음·만료는 404 (캐시 안 함)', async () => {
    const bad = await image('../../etc');
    expect(bad.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
    publicRow(null);
    const gone = await image(ID);
    expect(gone.status).toBe(404);
    expect(gone.headers.get('cache-control')).toBe('no-store');
    expect(mocks.rpc).toHaveBeenCalledWith('share_card_public', { p_id: ID });
  });

  it('스냅샷 모양이 틀리면(모르는 키) 그리지 않음', async () => {
    publicRow({
      id: ID,
      kind: 'levelup',
      version: 1,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      snapshot: { nickname: '하늘별', level: 3, email: 'a@b.c' },
    });
    expect((await image(ID)).status).toBe(404);
  });

  it('PNG 1200×630 + 캐시 헤더(만료까지만) + 파일 이름', async () => {
    publicRow({
      id: ID,
      kind: 'levelup',
      version: 3,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      snapshot: { nickname: '하늘별', level: 3, avatar: { hat: 'hat_crown' } },
    });
    const res = await image(ID);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
    const cdn = Number(
      res.headers.get('vercel-cdn-cache-control')?.match(/max-age=(\d+)/)?.[1],
    );
    expect(cdn).toBeGreaterThan(86_000);
    expect(cdn).toBeLessThanOrEqual(86_400);
    expect(res.headers.get('vercel-cache-tag')).toBe(`share-card-${ID}`);
    expect(res.headers.get('content-disposition')).toContain(
      'pyroad-levelup.png',
    );
    const png = Buffer.from(await res.arrayBuffer());
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 20_000);
});
