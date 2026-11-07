import { beforeEach, describe, expect, it, vi } from 'vitest';

// 탈퇴 때 provider 연결 끊기 (P3-16)

const { reportServerError } = vi.hoisted(() => ({
  reportServerError: vi.fn(),
}));
vi.mock('@/lib/api/serverError', () => ({ reportServerError }));

import {
  KAKAO_UNLINK_URL,
  NAVER_REVOKE_URL,
  kakaoUserIds,
  revokeNaver,
  unlinkAllKakao,
  unlinkKakao,
} from '../providerUnlink';

const KAKAO_ENV = { KAKAO_ADMIN_KEY: 'admin-key-secret' };
const NAVER_ENV = { NAVER_CLIENT_ID: 'cid', NAVER_CLIENT_SECRET: 'csecret' };

function respond(status: number, body: unknown = {}) {
  return vi.fn(
    async () =>
      new Response(body === null ? null : JSON.stringify(body), { status }),
  ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

/** 보고 내용에 비밀값·식별자가 없어야 함 */
function reportedText() {
  return JSON.stringify(
    reportServerError.mock.calls.map(([e, tags]) => [String(e), tags]),
  );
}

beforeEach(() => {
  reportServerError.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('unlinkKakao', () => {
  it('어드민 키로 회원번호 unlink (form, KakaoAK) → ok', async () => {
    const f = respond(200, { id: 1234567890 });
    expect(await unlinkKakao('1234567890', { env: KAKAO_ENV, fetch: f })).toBe(
      'ok',
    );
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(KAKAO_UNLINK_URL);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'KakaoAK admin-key-secret',
    );
    expect(String(init.body)).toBe(
      'target_id_type=user_id&target_id=1234567890',
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('이미 끊긴 사용자(-101)는 ok', async () => {
    const f = respond(400, { code: -101, msg: 'not registered user' });
    expect(await unlinkKakao('42', { env: KAKAO_ENV, fetch: f })).toBe('ok');
    expect(reportServerError).not.toHaveBeenCalled();
  });

  it('4xx → failed, 상태·코드만 보고 (키·회원번호 없음)', async () => {
    const f = respond(401, { code: -401, msg: 'invalid admin key' });
    expect(await unlinkKakao('987654321', { env: KAKAO_ENV, fetch: f })).toBe(
      'failed',
    );
    expect(reportServerError).toHaveBeenCalledTimes(1);
    expect(reportedText()).toContain('kakao unlink http_401_-401');
    expect(reportedText()).not.toContain('admin-key-secret');
    expect(reportedText()).not.toContain('987654321');
  });

  it('시간 초과 → failed (timeout), 재시도 없음', async () => {
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      await new Promise((_, reject) =>
        init.signal!.addEventListener('abort', () =>
          reject(init.signal!.reason),
        ),
      );
      return new Response(null);
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    expect(
      await unlinkKakao('1', { env: KAKAO_ENV, fetch: f, timeoutMs: 10 }),
    ).toBe('failed');
    expect(f).toHaveBeenCalledTimes(1);
    expect(reportedText()).toContain('kakao unlink timeout');
  });

  it('네트워크 오류 → failed (network)', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await unlinkKakao('1', { env: KAKAO_ENV, fetch: f })).toBe('failed');
    expect(reportedText()).toContain('kakao unlink network');
  });

  it('키가 없으면 부르지 않고 skipped (Sentry 없음)', async () => {
    const f = respond(200);
    expect(await unlinkKakao('1', { env: {}, fetch: f })).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
    expect(reportServerError).not.toHaveBeenCalled();
  });

  it('회원번호 모양이 아니면 보내지 않음', async () => {
    const f = respond(200);
    expect(await unlinkKakao('abc&x=1', { env: KAKAO_ENV, fetch: f })).toBe(
      'failed',
    );
    expect(f).not.toHaveBeenCalled();
  });
});

describe('kakaoUserIds · unlinkAllKakao', () => {
  const identities = [
    { provider: 'google', id: 'g-sub', identity_data: { sub: 'g-sub' } },
    { provider: 'kakao', id: '111', identity_data: { sub: '111' } },
    // 대체안 custom:kakao, id 없이 identity_data만
    { provider: 'custom:kakao', identity_data: { provider_id: '222' } },
    { provider: 'custom:naver', id: 'n-sub', identity_data: {} },
  ];

  it('kakao·custom:kakao identity의 회원번호만', () => {
    expect(kakaoUserIds(identities)).toEqual(['111', '222']);
    expect(kakaoUserIds(null)).toEqual([]);
  });

  it('하나라도 실패하면 failed, 없으면 skipped', async () => {
    const f = vi.fn(async (_u: string, init: RequestInit) =>
      String(init.body).includes('222')
        ? new Response('{}', { status: 500 })
        : new Response('{"id":111}', { status: 200 }),
    ) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    expect(await unlinkAllKakao(identities, { env: KAKAO_ENV, fetch: f })).toBe(
      'failed',
    );
    expect(f).toHaveBeenCalledTimes(2);
    expect(
      await unlinkAllKakao([identities[0]], { env: KAKAO_ENV, fetch: f }),
    ).toBe('skipped');
  });
});

describe('revokeNaver', () => {
  it('refresh 토큰을 client_secret_post로 폐기 → ok', async () => {
    const f = respond(200, null);
    expect(
      await revokeNaver(
        { refreshToken: 'rt-secret', accessToken: 'at-secret' },
        { env: NAVER_ENV, fetch: f },
      ),
    ).toBe('ok');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(NAVER_REVOKE_URL);
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({
      client_id: 'cid',
      client_secret: 'csecret',
      token: 'rt-secret',
      token_type_hint: 'refresh_token',
    });
  });

  it('refresh가 없으면 access 토큰', async () => {
    const f = respond(200, null);
    await revokeNaver({ accessToken: 'at' }, { env: NAVER_ENV, fetch: f });
    const body = new URLSearchParams(
      String((f.mock.calls[0] as [string, RequestInit])[1].body),
    );
    expect(body.get('token_type_hint')).toBe('access_token');
  });

  it('4xx → failed, 토큰·secret은 보고하지 않음', async () => {
    const f = respond(401, { error: 'unauthorized_client' });
    expect(
      await revokeNaver(
        { refreshToken: 'rt-secret' },
        { env: NAVER_ENV, fetch: f },
      ),
    ).toBe('failed');
    expect(reportedText()).toContain('naver unlink http_401');
    expect(reportedText()).not.toContain('rt-secret');
    expect(reportedText()).not.toContain('csecret');
  });

  it('토큰이 없으면 failed(no_token), 키가 없으면 skipped', async () => {
    const f = respond(200);
    expect(await revokeNaver({}, { env: NAVER_ENV, fetch: f })).toBe('failed');
    expect(reportedText()).toContain('naver unlink no_token');
    expect(
      await revokeNaver({ refreshToken: 'x' }, { env: {}, fetch: f }),
    ).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });
});
