import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  gate: vi.fn(),
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
vi.mock('@/lib/analytics/server', () => ({ trackServerEvent: mocks.track }));

import { DELETE, GET, POST } from '../route';

// 처리방침 시행일 판정은 켜 둔다 (B79). 꺼진 경우는 따로 확인
const policy = vi.hoisted(() => ({ live: true }));
vi.mock('@/lib/legal/policyGate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/legal/policyGate')>()),
  isPolicyLive: async () => policy.live,
}));

const req = (method: string) =>
  new Request('http://x/api/guardian-report', { method });
const TOKEN = 'rG6TzuP93C8blCS4ZdyehQ';

beforeEach(() => {
  mocks.user = { id: 'u1' };
  mocks.gate.mockReset().mockResolvedValue(null);
  mocks.track.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({
    data: { active: true, created_at: '2026-11-13T00:00:00Z', token: TOKEN },
    error: null,
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/api/guardian-report (P9-15)', () => {
  it('처리방침 시행일 전(B79)은 상태·만들기·끄기 모두 404 not_yet, RPC 를 부르지 않음', async () => {
    policy.live = false;
    try {
      for (const [fn, m] of [
        [GET, 'GET'],
        [POST, 'POST'],
        [DELETE, 'DELETE'],
      ] as const) {
        const res = await fn(req(m));
        expect(res.status).toBe(404);
        expect(await res.json()).toMatchObject({ code: 'not_yet' });
      }
      expect(mocks.rpc).not.toHaveBeenCalled();
    } finally {
      policy.live = true;
    }
  });

  it('로그인하지 않으면 401, RPC 를 부르지 않음', async () => {
    mocks.user = null;
    expect((await GET(req('GET'))).status).toBe(401);
    expect((await POST(req('POST'))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('만들기: 보호자 동의 게이트 → 확인한 id 로 create, 경로·캐시 금지, 분석에 토큰 없음', async () => {
    const res = await POST(req('POST'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      active: true,
      createdAt: '2026-11-13T00:00:00Z',
      path: `/guardian/${TOKEN}`,
    });
    expect(mocks.gate).toHaveBeenCalledWith('u1', expect.anything());
    expect(mocks.rpc).toHaveBeenCalledWith('guardian_report_link', {
      p_user_id: 'u1',
      p_action: 'create',
    });
    expect(mocks.track).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'guardian_report_link',
        props: { action: 'create' },
      }),
    );
    expect(JSON.stringify(mocks.track.mock.calls)).not.toContain(TOKEN);
  });

  it('동의 전이면 게이트 응답(403) 그대로, 링크를 만들지 않음 — 끄기는 게이트 없이', async () => {
    mocks.gate.mockResolvedValue(
      Response.json({ code: 'guardian_consent' }, { status: 403 }),
    );
    expect((await POST(req('POST'))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({
      data: { active: false, created_at: null },
      error: null,
    });
    const off = await DELETE(req('DELETE'));
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({ active: false, createdAt: null });
    expect(mocks.rpc).toHaveBeenCalledWith('guardian_report_link', {
      p_user_id: 'u1',
      p_action: 'off',
    });
  });

  it('상태는 분석을 남기지 않음, RPC 오류는 일반 문구 500', async () => {
    mocks.rpc.mockResolvedValue({
      data: { active: true, created_at: '2026-11-13T00:00:00Z' },
      error: null,
    });
    expect(await (await GET(req('GET'))).json()).toEqual({
      active: true,
      createdAt: '2026-11-13T00:00:00Z',
    });
    expect(mocks.track).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await GET(req('GET'));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('boom');
  });
});
