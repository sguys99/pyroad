import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fakeAnalyticsDb,
  type FakeAnalyticsDb,
} from '@/lib/analytics/__tests__/fakeAnalyticsDb';

const mocks = vi.hoisted(() => ({
  db: null as unknown as { client: unknown },
  userId: null as string | null,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.db.client,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      }),
    },
  }),
}));

import { POST } from '../route';
import {
  anonymizeUserId,
  resetAnalyticsPruneClock,
} from '@/lib/analytics/server';

const SALT = 'route-test-salt-0123456789abcdefghijklmnop';
const SID = 'AbCdEfGhIjKlMnOpQrStUv';
const U1 = '11111111-1111-1111-1111-111111111111';
const QUEST = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

let db: FakeAnalyticsDb;

function post(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return POST(
    new Request('http://localhost:3000/api/analytics', {
      method: 'POST',
      // sendBeacon 은 문자열을 text/plain 으로 보냄
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
        'user-agent': ANDROID,
        'x-forwarded-for': '203.0.113.7',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

const landing = (extra: Record<string, unknown> = {}) => ({
  sid: SID,
  events: [
    { name: 'landing_view', path: '/?utm_source=kakao' },
    {
      name: 'landing_cta_click',
      props: { cta: 'hero', provider: 'google' },
      path: '/',
    },
  ],
  ...extra,
});

beforeEach(() => {
  db = fakeAnalyticsDb();
  mocks.db = db;
  mocks.userId = null;
  resetAnalyticsPruneClock();
  vi.stubEnv('ANALYTICS_SALT', SALT);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/analytics — 저장 (P1-17)', () => {
  it('비로그인: 세션 ID 를 익명 ID 로, 기기 유형·경로 템플릿만 저장 (IP·UA 원문·쿼리 없음)', async () => {
    const res = await post(landing());
    expect(res.status).toBe(204);
    expect(db.rows).toEqual([
      {
        name: 'landing_view',
        actor: 'visitor',
        anon_id: SID,
        source: 'client',
        props: {},
        device: 'mobile',
        path: '/',
        dedupe_key: null,
      },
      {
        name: 'landing_cta_click',
        actor: 'visitor',
        anon_id: SID,
        source: 'client',
        props: { cta: 'hero', provider: 'google' },
        device: 'mobile',
        path: '/',
        dedupe_key: null,
      },
    ]);
    const stored = JSON.stringify(db.rows);
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('Android');
    expect(stored).not.toContain('utm_source');
    // 비로그인은 사용자 단위가 없으므로 전체 합계 버킷
    expect(db.rpcCalls[0]).toEqual({
      fn: 'consume_global_rate_limit',
      args: {
        p_bucket: 'analytics:visitor',
        p_per_minute: 120,
        p_per_day: 5000,
      },
    });
  });

  it('로그인: 익명 ID = HMAC(user id), 사용자별 버킷. 세션 ID·user id 는 저장하지 않음', async () => {
    mocks.userId = U1;
    expect((await post(landing())).status).toBe(204);
    expect(db.rows.every((r) => r.actor === 'user')).toBe(true);
    expect(db.rows.every((r) => r.anon_id === anonymizeUserId(U1, SALT))).toBe(
      true,
    );
    const stored = JSON.stringify(db.rows);
    expect(stored).not.toContain(U1);
    expect(stored).not.toContain(SID);
    expect(db.rpcCalls[0]).toEqual({
      fn: 'consume_rate_limit',
      args: {
        p_user_id: U1,
        p_bucket: 'analytics:client',
        p_per_minute: 20,
        p_per_day: 300,
      },
    });
  });

  it('한도 env 로 바꿀 수 있음 (형식이 틀리면 기본값)', async () => {
    vi.stubEnv('ANALYTICS_LIMIT_VISITOR', '5/50');
    await post(landing());
    expect(db.rpcCalls[0].args).toMatchObject({
      p_per_minute: 5,
      p_per_day: 50,
    });
    vi.stubEnv('ANALYTICS_LIMIT_VISITOR', 'lots');
    await post(landing());
    expect(db.rpcCalls[2].args).toMatchObject({
      p_per_minute: 120,
      p_per_day: 5000,
    });
  });

  it('저장 뒤 보존 기간 정리를 기회적으로 부름', async () => {
    await post(landing());
    await vi.waitFor(() =>
      expect(db.rpcCalls.map((c) => c.fn)).toContain('prune_analytics_events'),
    );
  });
});

describe('POST /api/analytics — 거부', () => {
  it.each([
    [
      '서버 전용 이벤트 (quest_complete)',
      {
        sid: SID,
        events: [
          {
            name: 'quest_complete',
            props: {
              quest_id: QUEST,
              hints_used: 0,
              used_golden_key: false,
              level_up: false,
              stage_cleared: false,
            },
          },
        ],
      },
    ],
    [
      '서버 전용 이벤트 (login_success)',
      {
        sid: SID,
        events: [
          {
            name: 'login_success',
            props: { provider: 'google', new_user: true },
          },
        ],
      },
    ],
    [
      '개인정보 속성 (email)',
      {
        sid: SID,
        events: [
          {
            name: 'landing_cta_click',
            props: {
              cta: 'hero',
              provider: 'google',
              email: 'kid@example.com',
            },
          },
        ],
      },
    ],
    ['개인정보 키 (user_id)', { ...landing(), user_id: U1 }],
    ['sid 형식', { ...landing(), sid: 'not valid' }],
  ])('%s → 400, 저장 안 함', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_events' });
    expect(db.upserts).toHaveLength(0);
    expect(db.rpcCalls).toHaveLength(0);
  });

  it('JSON 이 아니면 400', async () => {
    expect((await post('{oops')).status).toBe(400);
  });

  it('8KB 를 넘으면 413 (읽기 전 Content-Length, 읽은 뒤 실제 크기)', async () => {
    expect((await post(landing(), { 'content-length': '9000' })).status).toBe(
      413,
    );
    const big = JSON.stringify({
      sid: SID,
      events: [{ name: 'landing_view', path: `/${'a'.repeat(9000)}` }],
    });
    expect((await post(big)).status).toBe(413);
    expect(db.upserts).toHaveLength(0);
  });

  it('다른 사이트에서 보낸 요청은 403', async () => {
    expect(
      (await post(landing(), { origin: 'https://evil.example' })).status,
    ).toBe(403);
    expect(
      (await post(landing(), { 'sec-fetch-site': 'cross-site' })).status,
    ).toBe(403);
    expect(db.upserts).toHaveLength(0);
  });

  it('한도를 넘으면 429 + Retry-After, 저장 안 함', async () => {
    db.rpcResult.consume_global_rate_limit = {
      data: { allowed: false, retry_after: 17, denied_minute: 1 },
      error: null,
    };
    const res = await post(landing());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(db.upserts).toHaveLength(0);
  });
});

describe('POST /api/analytics — 꺼짐·거부 신호·실패', () => {
  it('ANALYTICS_SALT 가 없으면 검증만 하고 버림 (204, DB 호출 없음)', async () => {
    vi.stubEnv('ANALYTICS_SALT', '');
    expect((await post(landing())).status).toBe(204);
    expect(db.rpcCalls).toHaveLength(0);
    expect(db.upserts).toHaveLength(0);
  });

  it.each<Record<string, string>>([{ dnt: '1' }, { 'sec-gpc': '1' }])(
    '추적 거부 신호 %j 면 버림',
    async (h) => {
      expect((await post(landing(), h)).status).toBe(204);
      expect(db.upserts).toHaveLength(0);
    },
  );

  it('한도 DB 가 실패해도 통과시키고, 저장이 실패해도 204 (클라이언트에 영향 없음)', async () => {
    db.rpcResult.consume_global_rate_limit = {
      data: null,
      error: { code: '42883', message: 'function does not exist' },
    };
    db.insertError = { code: '42P01', message: 'relation does not exist' };
    expect((await post(landing())).status).toBe(204);
    expect(db.upserts).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      '[analytics] insert 실패:',
      '42P01 relation does not exist',
    );
  });
});
