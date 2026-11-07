import { beforeEach, describe, expect, it, vi } from 'vitest';

// 로그인 수단 연결 해제 API (P3-07): 서버에서 개수 확인 → 우리 쪽 unlinkIdentity → Kakao provider 쪽 unlink

const { getUser, unlinkIdentity, unlinkAllKakao, reportServerError, order } =
  vi.hoisted(() => {
    const order: string[] = [];
    return {
      order,
      getUser: vi.fn(),
      unlinkIdentity: vi.fn(async () => {
        order.push('unlinkIdentity');
        return { error: null as null | { code?: string; message: string } };
      }),
      unlinkAllKakao: vi.fn(async () => {
        order.push('kakao');
        return 'ok' as 'ok' | 'failed' | 'skipped';
      }),
      reportServerError: vi.fn(),
    };
  });
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser, unlinkIdentity } })),
}));
vi.mock('@/lib/auth/providerUnlink', () => ({ unlinkAllKakao }));
vi.mock('@/lib/api/serverError', () => ({ reportServerError }));

import { POST } from '../route';

const g = { provider: 'google', identity_id: 'i-g', id: 'g-sub' };
const k = { provider: 'kakao', identity_id: 'i-k', id: '123' };
const n = { provider: 'custom:naver', identity_id: 'i-n', id: 'n-sub' };

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/account/unlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}
const asUser = (identities: unknown[]) =>
  getUser.mockResolvedValueOnce({ data: { user: { id: 'u1', identities } } });

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
});

describe('POST /api/account/unlink', () => {
  it('로그인하지 않으면 401', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await post({ provider: 'kakao' })).status).toBe(401);
  });

  it.each([{}, { provider: 'github' }, 'not json'])(
    '잘못된 요청 %o → 400',
    async (body) => {
      asUser([g, k]);
      expect((await post(body)).status).toBe(400);
      expect(unlinkIdentity).not.toHaveBeenCalled();
    },
  );

  it('연결되지 않은 수단 → 404', async () => {
    asUser([g]);
    expect((await post({ provider: 'kakao' })).status).toBe(404);
  });

  it('마지막 수단은 끊지 않음 → 409, 아무것도 부르지 않음', async () => {
    asUser([k]);
    const res = await post({ provider: 'kakao' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      '로그인할 방법이 하나뿐이라 끊을 수 없어요.',
    );
    expect(unlinkIdentity).not.toHaveBeenCalled();
    expect(unlinkAllKakao).not.toHaveBeenCalled();
  });

  it('Kakao: 우리 쪽 unlinkIdentity 먼저, 그다음 Kakao unlink (식별자 없는 응답)', async () => {
    asUser([g, k]);
    const res = await post({ provider: 'kakao' });
    expect(order).toEqual(['unlinkIdentity', 'kakao']);
    expect(unlinkIdentity).toHaveBeenCalledWith(k);
    expect(unlinkAllKakao).toHaveBeenCalledWith([k]);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      provider: 'kakao',
      providerSide: 'ok',
    });
    expect(JSON.stringify(body)).not.toContain('123');
  });

  it('Kakao provider 쪽이 실패해도 해제는 끝난 것 (providerSide failed)', async () => {
    asUser([g, k]);
    unlinkAllKakao.mockResolvedValueOnce('failed');
    const res = await post({ provider: 'kakao' });
    expect(res.status).toBe(200);
    expect((await res.json()).providerSide).toBe('failed');
  });

  it('우리 쪽 해제가 거절되면 provider 쪽은 건드리지 않음 (마지막 identity → 409, 그 밖 → 500 + 보고)', async () => {
    asUser([g, k]);
    unlinkIdentity.mockResolvedValueOnce({
      error: { code: 'single_identity_not_deletable', message: 'x' },
    });
    expect((await post({ provider: 'kakao' })).status).toBe(409);
    asUser([g, k]);
    unlinkIdentity.mockResolvedValueOnce({
      error: { code: 'unexpected_failure', message: 'db boom' },
    });
    const res = await post({ provider: 'kakao' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('boom');
    expect(reportServerError).toHaveBeenCalledTimes(1);
    expect(unlinkAllKakao).not.toHaveBeenCalled();
  });

  it('Naver는 provider 쪽을 직접 끊으라고 안내(manual), Google은 할 일 없음(none)', async () => {
    asUser([g, n]);
    expect(
      (await (await post({ provider: 'naver' })).json()).providerSide,
    ).toBe('manual');
    asUser([g, n]);
    expect(
      (await (await post({ provider: 'google' })).json()).providerSide,
    ).toBe('none');
    expect(unlinkAllKakao).not.toHaveBeenCalled();
  });
});
