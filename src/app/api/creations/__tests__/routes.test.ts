import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 체인 쿼리 흉내: 마지막 결과는 tables[table] 의 함수가 정함. 부른 동작은 calls 에 */
type Result = { data?: unknown; error?: unknown; count?: number };
const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  calls: [] as { client: string; table: string; op: string; arg?: unknown }[],
  result: {} as Record<string, (op: string) => Result>,
  rpc: vi.fn(),
  gate: vi.fn(),
  purge: vi.fn(),
}));
vi.mock('@vercel/functions', () => ({ dangerouslyDeleteByTag: mocks.purge }));

function client(name: string) {
  return {
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    rpc: mocks.rpc,
    from(table: string) {
      let op = 'select';
      const q: Record<string, unknown> = {};
      const chain = (k: string) => (arg?: unknown) => {
        if (['insert', 'update', 'delete'].includes(k)) op = k;
        mocks.calls.push({ client: name, table, op: k, arg });
        return q;
      };
      for (const k of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'in',
        'order',
      ])
        q[k] = chain(k);
      const done = async () =>
        (mocks.result[`${name}:${table}`] ?? (() => ({ data: null })))(op);
      q.single = done;
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

import { GET, POST } from '../route';
import { DELETE, PATCH } from '../[id]/route';

const ID = '11111111-2222-4333-8444-555555555555';
const QUEST = '22222222-2222-4333-8444-555555555555';
const PNG = new Uint8Array(80);
PNG.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const commands = () =>
  new Blob([
    gzipSync(
      JSON.stringify([
        ['t', '별'],
        ['m', 1, 10, 0],
      ]),
    ),
  ]);

function post(
  meta: unknown,
  files: { commands?: Blob; thumbnail?: Blob } = {},
) {
  const form = new FormData();
  form.set('meta', typeof meta === 'string' ? meta : JSON.stringify(meta));
  if (files.commands) form.set('commands', files.commands);
  if (files.thumbnail) form.set('thumbnail', files.thumbnail);
  return POST(
    new Request('http://x/api/creations', { method: 'POST', body: form }),
  );
}
const patch = (body: unknown, id = ID) =>
  PATCH(
    new Request(`http://x/api/creations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
    {
      params: Promise.resolve({ id }),
    },
  );
const drawing = {
  kind: 'drawing',
  title: '별 그림',
  questId: QUEST,
  code: 'import turtle',
};
const ROW = {
  id: ID,
  quest_id: QUEST,
  title: '모험',
  code: 'name = input()',
  transcript: [{ text: '이름이 뭐야?' }, { text: '콩이', answer: true }],
  commands_gz: null,
  visibility: 'private',
  show_code: false,
  hidden_at: null,
  published_at: null,
};
const inserted = () =>
  mocks.calls.find((c) => c.op === 'insert')?.arg as Record<string, unknown>;

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.calls = [];
  mocks.result = {
    'user:creations': (op) =>
      op === 'insert'
        ? { data: { id: ID } }
        : op === 'delete'
          ? { data: [{ id: ID }] }
          : { data: ROW },
    'user:quests': () => ({
      data: [
        { id: QUEST, quest_type: 'project', stage: { world: { order: 3 } } },
      ],
    }),
    'user:user_progress': () => ({ data: [{ quest_id: QUEST }] }),
    'admin:creations': () => ({ error: null }),
  };
  mocks.rpc
    .mockReset()
    .mockResolvedValue({ data: { allowed: true }, error: null });
  mocks.gate.mockReset().mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/creations (P11-06)', () => {
  it('로그인하지 않으면 401, 모양이 틀리면 400 (저장하지 않음)', async () => {
    mocks.user = null;
    expect((await post(drawing, { commands: commands() })).status).toBe(401);
    mocks.user = { id: 'u1' };
    expect((await post('not json')).status).toBe(400);
    expect(
      (
        await post(
          { ...drawing, title: '가'.repeat(21) },
          { commands: commands() },
        )
      ).status,
    ).toBe(400);
    expect((await post(drawing)).status).toBe(400); // 그림인데 명령 없음
    expect((await post(drawing, { commands: new Blob(['[]']) })).status).toBe(
      400,
    ); // gzip 아님
    expect(
      (
        await post(drawing, {
          commands: commands(),
          thumbnail: new Blob(['<svg/>']),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          { ...drawing, code: 'x'.repeat(20_001) },
          { commands: commands() },
        )
      ).status,
    ).toBe(400);
    expect(inserted()).toBeUndefined();
  });

  it('그림: 명령을 다시 압축해 bytea 로, 썸네일 PNG, 본인 세션으로 비공개 저장 (visibility 는 보내지 않음)', async () => {
    const res = await post(drawing, {
      commands: commands(),
      thumbnail: new Blob([PNG]),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: ID });
    const row = inserted();
    expect(mocks.calls.find((c) => c.op === 'insert')?.client).toBe('user');
    expect(row).toMatchObject({
      user_id: 'u1',
      quest_id: QUEST,
      kind: 'drawing',
      title: '별 그림',
      transcript: null,
    });
    expect(String(row.commands_gz)).toMatch(/^\\x1f8b/);
    expect(String(row.thumbnail)).toMatch(/^\\x89504e47/);
    expect(row).not.toHaveProperty('visibility');
    expect(mocks.rpc).toHaveBeenCalledWith(
      'consume_rate_limit',
      expect.objectContaining({ p_bucket: 'creations:save' }),
    );
  });

  it('대화: 기록 그대로 · 금칙어는 422 · 비공개라 이메일은 저장됨 · 요청 한도 429 · 60개 409', async () => {
    const conv = {
      kind: 'conversation',
      title: '모험',
      questId: null,
      code: '',
      transcript: ROW.transcript,
    };
    expect((await post(conv)).status).toBe(201);
    expect(inserted().transcript).toEqual(ROW.transcript);
    expect(
      (await post({ ...conv, transcript: [{ text: 'kid@naver.com' }] })).status,
    ).toBe(201);
    const bad = await post({ ...conv, title: '시발' });
    expect(bad.status).toBe(422);
    expect((await bad.json()).code).toBe('moderation');
    mocks.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
    expect((await post(conv)).status).toBe(429);
    mocks.rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    mocks.result['user:creations'] = () => ({
      error: { code: 'PT409', message: 'creations_limit' },
    });
    expect((await post(conv)).status).toBe(409);
  });
});

describe('GET /api/creations', () => {
  it('본인 목록 (그림 바이트 없이)', async () => {
    mocks.result['user:creations'] = () => ({ data: [{ id: ID }] });
    const res = await GET();
    expect(await res.json()).toEqual({ creations: [{ id: ID }] });
    const sel = String(mocks.calls.find((c) => c.op === 'select')?.arg);
    expect(sel).not.toMatch(/thumbnail|commands_gz|\bcode\b/);
  });
});

describe('PATCH /api/creations/{id}', () => {
  it('비공개 고치기는 본인 세션 + 늘 private, 제목 금칙어 422', async () => {
    expect((await patch({ title: '새 이름' })).status).toBe(200);
    const upd = mocks.calls.find((c) => c.op === 'update');
    expect(upd).toMatchObject({
      client: 'user',
      arg: { title: '새 이름', visibility: 'private' },
    });
    expect(mocks.gate).not.toHaveBeenCalled();
    expect((await patch({ title: '시발' })).status).toBe(422);
    expect((await patch({}, ID)).status).toBe(400);
    expect((await patch({ title: 'x' }, 'nope')).status).toBe(404);
  });

  it('공개: 동의 게이트 → 숨김 → 출품 자격(3월드 프로젝트 완료) → 개인정보 → service_role', async () => {
    mocks.gate.mockResolvedValueOnce(
      Response.json({ code: 'guardian_consent' }, { status: 403 }),
    );
    expect((await patch({ visibility: 'public' })).status).toBe(403);

    mocks.result['user:creations'] = () => ({
      data: { ...ROW, hidden_at: '2026-11-16' },
    });
    expect((await patch({ visibility: 'public' })).status).toBe(409);

    mocks.result['user:creations'] = () => ({ data: ROW });
    mocks.result['user:quests'] = () => ({
      data: [{ id: QUEST, quest_type: 'code', stage: { world: { order: 3 } } }],
    });
    expect(await (await patch({ visibility: 'public' })).json()).toMatchObject({
      code: 'not_eligible',
    });
    mocks.result['user:quests'] = () => ({
      data: [
        { id: QUEST, quest_type: 'project', stage: { world: { order: 1 } } },
      ],
    });
    expect((await patch({ visibility: 'public' })).status).toBe(409);
    mocks.result['user:quests'] = () => ({
      data: [
        { id: QUEST, quest_type: 'project', stage: { world: { order: 3 } } },
      ],
    });
    mocks.result['user:user_progress'] = () => ({ data: [] });
    expect((await patch({ visibility: 'public' })).status).toBe(409);
    mocks.result['user:user_progress'] = () => ({
      data: [{ quest_id: QUEST }],
    });

    mocks.result['user:creations'] = () => ({
      data: { ...ROW, transcript: [{ text: '010-1234-5678 로 전화해' }] },
    });
    expect((await patch({ visibility: 'public' })).status).toBe(422);
    // 코드 보기를 켜면 코드 안 글자도 검사
    mocks.result['user:creations'] = () => ({
      data: { ...ROW, code: 'print("123456789")' },
    });
    expect((await patch({ visibility: 'public', showCode: true })).status).toBe(
      422,
    );
    expect(
      mocks.calls.some((c) => c.client === 'admin' && c.op === 'update'),
    ).toBe(false);

    mocks.result['user:creations'] = () => ({ data: ROW });
    const ok = await patch({ visibility: 'public' });
    expect(ok.status).toBe(200);
    const upd = mocks.calls.find(
      (c) => c.client === 'admin' && c.op === 'update',
    );
    expect(upd?.arg).toMatchObject({ visibility: 'public', title: '모험' });
    expect(
      mocks.calls
        .filter((c) => c.client === 'admin' && c.op === 'eq')
        .map((c) => c.arg),
    ).toContain('user_id');
  });
});

describe('DELETE /api/creations/{id}', () => {
  it('본인 세션으로 지움, 없으면 404', async () => {
    const del = (id = ID) =>
      DELETE(new Request('http://x'), { params: Promise.resolve({ id }) });
    expect((await del()).status).toBe(200);
    mocks.result['user:creations'] = () => ({ data: [] });
    expect((await del()).status).toBe(404);
    expect((await del('x')).status).toBe(404);
  });

  it('작품 자랑 카드(P11-08): 지우기·내리기 뒤 그 작품 카드의 CDN 사본을 태그로 지움 (지우기는 행이 사라지기 전에 id 를 구함)', async () => {
    mocks.purge.mockReset();
    mocks.result['admin:share_cards'] = () => ({
      data: [{ id: 'cardAAAAAAAAAAAAAAAAAA' }],
    });
    const del = await DELETE(new Request('http://x'), {
      params: Promise.resolve({ id: ID }),
    });
    expect(del.status).toBe(200);
    const order = mocks.calls
      .filter((c) => c.op === 'delete' || c.table === 'share_cards')
      .map((c) => `${c.table}:${c.op}`);
    expect(order.indexOf('share_cards:select')).toBeLessThan(
      order.indexOf('creations:delete'),
    );
    expect(mocks.calls).toContainEqual(
      expect.objectContaining({
        table: 'share_cards',
        op: 'eq',
        arg: 'kind',
      }),
    );
    expect(mocks.purge).toHaveBeenCalledWith([
      'share-card-cardAAAAAAAAAAAAAAAAAA',
    ]);

    mocks.purge.mockReset();
    mocks.result['user:creations'] = () => ({ data: ROW });
    expect((await patch({ visibility: 'private' })).status).toBe(200);
    expect(mocks.purge).toHaveBeenCalledWith([
      'share-card-cardAAAAAAAAAAAAAAAAAA',
    ]);
  });
});
