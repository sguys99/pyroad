import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 체인 쿼리 흉내 (creations 라우트 테스트와 같은 모양): 결과는 result[`client:table`] 가, 부른 동작은 calls 에 */
type Result = { data?: unknown; error?: unknown };
const mocks = vi.hoisted(() => ({
  user: { id: 'u1', app_metadata: {} } as {
    id: string;
    app_metadata: Record<string, unknown>;
  } | null,
  calls: [] as { client: string; table: string; op: string; arg?: unknown }[],
  result: {} as Record<string, (op: string) => Result>,
  rpc: vi.fn(),
  gate: vi.fn(),
}));

function client(name: string) {
  return {
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: mocks.rpc,
    from(table: string) {
      let op = 'select';
      const q: Record<string, unknown> = {};
      const chain = (k: string) => (arg?: unknown) => {
        if (['insert', 'update', 'delete', 'upsert'].includes(k)) op = k;
        mocks.calls.push({ client: name, table, op: k, arg });
        return q;
      };
      for (const k of ['select', 'upsert', 'update', 'delete', 'eq'])
        q[k] = chain(k);
      const done = async () =>
        (mocks.result[`${name}:${table}`] ?? (() => ({ data: null })))(op);
      q.maybeSingle = done;
      q.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) =>
        done().then(res, rej);
      return q;
    },
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => client('user'),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => client('admin'),
}));
vi.mock('@/lib/consent/server', () => ({ guardianWriteGate: mocks.gate }));
vi.mock('@/lib/gallery/server', () => ({
  countStickers: async () => ({ love: 2 }),
}));

import { POST } from '../[id]/route';

const ID = '11111111-2222-4333-8444-555555555555';
const post = (body: unknown, id = ID) =>
  POST(
    new Request(`http://x/api/gallery/${id}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const react = { action: 'react', sticker: 'love', on: true };

beforeEach(() => {
  mocks.user = { id: 'u1', app_metadata: {} };
  mocks.calls = [];
  mocks.result = {
    'admin:gallery_creations': () => ({ data: { author_id: 'u2' } }),
    'admin:creation_reactions': () => ({ error: null }),
    'admin:creations': () => ({ data: [{ id: ID }] }),
  };
  mocks.rpc
    .mockReset()
    .mockImplementation(async (fn: string) =>
      fn === 'consume_rate_limit'
        ? { data: { allowed: true }, error: null }
        : { data: { result: 'reported', hidden: false }, error: null },
    );
  mocks.gate.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/gallery/{id} 스티커 (P11-07)', () => {
  it('로그인 401 · 정해지지 않은 스티커·글 400 · 잘못된 id 404', async () => {
    mocks.user = null;
    expect((await post(react)).status).toBe(401);
    mocks.user = { id: 'u1', app_metadata: {} };
    expect((await post({ ...react, sticker: 'poop' })).status).toBe(400);
    expect((await post({ action: 'comment', text: '안녕' })).status).toBe(400);
    expect((await post(react, 'nope')).status).toBe(404);
  });

  it('동의 게이트 → 요청 한도 → 공개 작품만 · 내 작품 거절 → service_role 로 붙이고 합계', async () => {
    mocks.gate.mockResolvedValueOnce(
      Response.json({ code: 'guardian_consent' }, { status: 403 }),
    );
    expect((await post(react)).status).toBe(403);

    mocks.rpc.mockResolvedValueOnce({ data: { allowed: false }, error: null });
    expect((await post(react)).status).toBe(429);

    mocks.result['admin:gallery_creations'] = () => ({ data: null });
    expect((await post(react)).status).toBe(404);
    mocks.result['admin:gallery_creations'] = () => ({
      data: { author_id: 'u1' },
    });
    expect(await (await post(react)).json()).toMatchObject({ code: 'own' });
    expect(mocks.calls.some((c) => c.op === 'upsert')).toBe(false);

    mocks.result['admin:gallery_creations'] = () => ({
      data: { author_id: 'u2' },
    });
    const ok = await post(react);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ stickers: { love: 2 } });
    expect(mocks.calls.find((c) => c.op === 'upsert')).toMatchObject({
      client: 'admin',
      arg: { creation_id: ID, user_id: 'u1', sticker: 'love' },
    });
    expect((await post({ ...react, on: false })).status).toBe(200);
    expect(mocks.calls.some((c) => c.op === 'delete')).toBe(true);
  });
});

describe('신고·운영자 숨김', () => {
  it('신고는 동의 게이트 없이 report_creation (본인·없음·한도)', async () => {
    const r = await post({ action: 'report', reason: 'personal_info' });
    expect(r.status).toBe(200);
    expect(mocks.gate).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith('report_creation', {
      p_reporter_id: 'u1',
      p_creation_id: ID,
      p_reason: 'personal_info',
    });
    mocks.rpc.mockImplementation(async (fn: string) =>
      fn === 'consume_rate_limit'
        ? { data: { allowed: true }, error: null }
        : { data: { result: 'own', hidden: false }, error: null },
    );
    expect((await post({ action: 'report', reason: 'other' })).status).toBe(
      400,
    );
    expect((await post({ action: 'report', reason: 'meh' })).status).toBe(400);
    mocks.rpc.mockResolvedValueOnce({ data: { allowed: false }, error: null });
    expect((await post({ action: 'report', reason: 'other' })).status).toBe(
      429,
    );
  });

  it('숨기기는 운영자(app_metadata.role)만, 다시 보이면 published_at 새로', async () => {
    expect((await post({ action: 'moderate', hidden: true })).status).toBe(404);
    expect(mocks.calls.some((c) => c.op === 'update')).toBe(false);
    mocks.user = { id: 'u9', app_metadata: { role: 'admin' } };
    expect((await post({ action: 'moderate', hidden: true })).status).toBe(200);
    expect(
      mocks.calls.find((c) => c.op === 'update')?.arg as object,
    ).toHaveProperty('hidden_at');
    mocks.calls = [];
    await post({ action: 'moderate', hidden: false });
    expect(mocks.calls.find((c) => c.op === 'update')?.arg).toMatchObject({
      hidden_at: null,
    });
    expect(mocks.calls.find((c) => c.op === 'update')?.arg).toHaveProperty(
      'published_at',
    );
  });
});
