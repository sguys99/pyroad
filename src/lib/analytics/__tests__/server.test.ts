import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { fakeAnalyticsDb, type FakeAnalyticsDb } from './fakeAnalyticsDb';

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  getUserCalls: 0,
  admin: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        mocks.getUserCalls += 1;
        return { data: { user: mocks.userId ? { id: mocks.userId } : null } };
      },
    },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.admin,
}));

import {
  anonymizeUserId,
  classifyDevice,
  deleteUserAnalytics,
  getAnalyticsSalt,
  hasOptOutSignal,
  isNewUser,
  loginProvider,
  maybePruneAnalytics,
  recordServerEvent,
  resetAnalyticsPruneClock,
  withHintTracking,
} from '../server';

const SALT = 'test-salt-0123456789abcdefghijklmnopqrstuv';
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const QUEST = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const env = { ANALYTICS_SALT: SALT };

let db: FakeAnalyticsDb;
beforeEach(() => {
  db = fakeAnalyticsDb();
  mocks.admin = db.client;
  mocks.userId = null;
  mocks.getUserCalls = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('anonymizeUserId — HMAC 익명화', () => {
  it('같은 사용자·같은 salt 면 늘 같은 값 (재방문·퍼널 계산)', () => {
    expect(anonymizeUserId(U1, SALT)).toBe(anonymizeUserId(U1, SALT));
  });

  it('사용자가 다르면 다른 값, salt 가 다르면 다른 값', () => {
    expect(anonymizeUserId(U1, SALT)).not.toBe(anonymizeUserId(U2, SALT));
    expect(anonymizeUserId(U1, SALT)).not.toBe(anonymizeUserId(U1, `${SALT}x`));
  });

  it('DB CHECK 형식(base64url 22자)이고 원문 id 나 그 조각을 담지 않음', () => {
    const id = anonymizeUserId(U1, SALT);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    for (const part of U1.split('-')) expect(id).not.toContain(part);
  });

  it('salt 없이 다시 만들 수 없음: 로그용 sha256(user id)(P1-19)와도, 빈 salt HMAC 과도 다름', () => {
    const id = anonymizeUserId(U1, SALT);
    const sha = createHash('sha256').update(U1).digest();
    expect(sha.toString('base64url').slice(0, 22)).not.toBe(id);
    expect(sha.toString('hex').slice(0, 22)).not.toBe(id);
    expect(anonymizeUserId(U1, '')).not.toBe(id);
  });
});

describe('getAnalyticsSalt', () => {
  it('없거나 32자 미만이면 꺼짐', () => {
    expect(getAnalyticsSalt({})).toBeNull();
    expect(getAnalyticsSalt({ ANALYTICS_SALT: '  ' })).toBeNull();
    expect(getAnalyticsSalt({ ANALYTICS_SALT: 'short' })).toBeNull();
    expect(getAnalyticsSalt(env)).toBe(SALT);
  });
});

describe('classifyDevice·hasOptOutSignal', () => {
  it.each([
    [IPHONE, 'mobile'],
    [
      'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      'mobile',
    ],
    [
      'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'tablet',
    ],
    [
      'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'tablet',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'desktop',
    ],
    [null, 'unknown'],
  ])('%s → %s', (ua, expected) => {
    expect(classifyDevice(ua)).toBe(expected);
  });

  it('DNT: 1 · Sec-GPC: 1 이면 거부 신호', () => {
    expect(hasOptOutSignal(new Headers({ dnt: '1' }))).toBe(true);
    expect(hasOptOutSignal(new Headers({ 'sec-gpc': '1' }))).toBe(true);
    expect(hasOptOutSignal(new Headers({ dnt: '0' }))).toBe(false);
    expect(hasOptOutSignal(new Headers())).toBe(false);
  });
});

describe('recordServerEvent — 서버 이벤트 기록', () => {
  const input = () => ({
    headers: new Headers({
      'user-agent': IPHONE,
      'x-forwarded-for': '203.0.113.7',
    }),
    userId: U1,
    name: 'quest_start' as const,
    props: { quest_id: QUEST },
    path: `/quest/${QUEST}?tab=1`,
    dedupeKey: `quest_start:${QUEST}`,
  });

  it('익명 ID·기기 유형·경로 템플릿만 저장하고 user id·IP·UA 원문은 저장하지 않음', async () => {
    expect(await recordServerEvent(input(), { admin: db.client, env })).toBe(
      true,
    );
    expect(db.rows).toEqual([
      {
        name: 'quest_start',
        actor: 'user',
        anon_id: anonymizeUserId(U1, SALT),
        source: 'server',
        props: { quest_id: QUEST },
        device: 'mobile',
        path: '/quest/[id]',
        dedupe_key: `quest_start:${QUEST}`,
      },
    ]);
    const stored = JSON.stringify(db.rows);
    expect(stored).not.toContain(U1);
    expect(stored).not.toContain('203.0.113.7');
    expect(stored).not.toContain('iPhone');
    expect(db.upserts[0].options).toEqual({
      onConflict: 'anon_id,dedupe_key',
      ignoreDuplicates: true,
    });
  });

  it('dedupe: 같은 퀘스트 첫 진입은 한 번만', async () => {
    await recordServerEvent(input(), { admin: db.client, env });
    await recordServerEvent(input(), { admin: db.client, env });
    expect(db.rows).toHaveLength(1);
  });

  it('ANALYTICS_SALT 가 없으면 기록하지 않음', async () => {
    expect(
      await recordServerEvent(input(), { admin: db.client, env: {} }),
    ).toBe(false);
    expect(db.upserts).toHaveLength(0);
  });

  it('DNT·GPC 를 보낸 브라우저는 기록하지 않음', async () => {
    const i = { ...input(), headers: new Headers({ 'sec-gpc': '1' }) };
    expect(await recordServerEvent(i, { admin: db.client, env })).toBe(false);
    expect(db.upserts).toHaveLength(0);
  });

  it('속성에 정해지지 않은 키(개인정보)가 섞이면 기록하지 않음', async () => {
    const i = {
      ...input(),
      props: { quest_id: QUEST, email: 'kid@example.com' } as {
        quest_id: string;
      },
    };
    expect(await recordServerEvent(i, { admin: db.client, env })).toBe(false);
    expect(db.upserts).toHaveLength(0);
  });

  it('DB 오류여도 던지지 않음 (화면·응답에 영향 없음)', async () => {
    db.insertError = { code: '42P01', message: 'relation does not exist' };
    await expect(
      recordServerEvent(input(), { admin: db.client, env }),
    ).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith(
      '[analytics] insert 실패:',
      '42P01 relation does not exist',
    );
  });
});

describe('로그인 이벤트 속성', () => {
  it('provider: issuer 우선, 그다음 app_metadata.provider (00013 social_login_provider 와 같은 규칙)', () => {
    expect(
      loginProvider({
        user_metadata: { iss: 'https://nid.naver.com' },
        app_metadata: { provider: 'google' },
      }),
    ).toBe('naver');
    expect(
      loginProvider({
        user_metadata: {},
        app_metadata: { provider: 'custom:kakao' },
      }),
    ).toBe('kakao');
    expect(loginProvider({ user_metadata: {}, app_metadata: {} })).toBe(
      'unknown',
    );
  });

  it('가입 직후 첫 로그인이면 new_user', () => {
    expect(
      isNewUser({
        created_at: '2026-11-04T01:00:00Z',
        last_sign_in_at: '2026-11-04T01:00:03Z',
      }),
    ).toBe(true);
    expect(
      isNewUser({
        created_at: '2026-10-01T01:00:00Z',
        last_sign_in_at: '2026-11-04T01:00:00Z',
      }),
    ).toBe(false);
    expect(
      isNewUser({
        created_at: '2026-11-04T01:00:00Z',
        last_sign_in_at: undefined,
      }),
    ).toBe(false);
  });
});

describe('deleteUserAnalytics — 탈퇴', () => {
  it('그 사용자의 HMAC 익명 ID 행만 지움', async () => {
    db.rows.push(
      {
        actor: 'user',
        anon_id: anonymizeUserId(U1, SALT),
        name: 'quest_start',
      },
      {
        actor: 'user',
        anon_id: anonymizeUserId(U2, SALT),
        name: 'quest_start',
      },
    );
    await deleteUserAnalytics(db.client, U1, env);
    expect(db.rows).toEqual([
      {
        actor: 'user',
        anon_id: anonymizeUserId(U2, SALT),
        name: 'quest_start',
      },
    ]);
  });

  it('salt 가 없으면 아무것도 하지 않음', async () => {
    await deleteUserAnalytics(db.client, U1, {});
    expect(db.deletes).toHaveLength(0);
  });
});

describe('maybePruneAnalytics — 기회적 보존 정리', () => {
  it('인스턴스마다 1시간에 한 번만 RPC 를 부름 (180일, 최대 5,000행)', async () => {
    resetAnalyticsPruneClock();
    const t0 = 10_000_000;
    await maybePruneAnalytics(db.client, t0);
    await maybePruneAnalytics(db.client, t0 + 30 * 60_000);
    await maybePruneAnalytics(db.client, t0 + 61 * 60_000);
    expect(db.rpcCalls).toEqual([
      {
        fn: 'prune_analytics_events',
        args: { p_retention: '180 days', p_limit: 5000 },
      },
      {
        fn: 'prune_analytics_events',
        args: { p_retention: '180 days', p_limit: 5000 },
      },
    ]);
  });
});

describe('withHintTracking — 튜터 힌트', () => {
  it('분석이 꺼져 있으면 원래 함수를 그대로 돌려주고 getUser 를 부르지 않음', () => {
    const recordHint = vi.fn(async () => {});
    const req = new Request('http://localhost/api/tutor/stream', {
      method: 'POST',
    });
    expect(
      withHintTracking(recordHint, req, { questId: QUEST, level: 1 }),
    ).toBe(recordHint);
    expect(
      withHintTracking(null, req, { questId: QUEST, level: 1 }),
    ).toBeNull();
    expect(mocks.getUserCalls).toBe(0);
  });

  it('켜져 있으면 record_hint 뒤에 hint_used 를 남김 (getUser 는 미리 한 번)', async () => {
    vi.stubEnv('ANALYTICS_SALT', SALT);
    mocks.userId = U1;
    const order: string[] = [];
    const recordHint = vi.fn(async () => {
      order.push('record_hint');
    });
    const req = new Request('http://localhost/api/tutor/stream', {
      method: 'POST',
    });
    const wrapped = withHintTracking(recordHint, req, {
      questId: QUEST,
      level: 2,
    })!;
    expect(wrapped).not.toBe(recordHint);
    await wrapped();
    expect(order).toEqual(['record_hint']);
    expect(mocks.getUserCalls).toBe(1);
    await vi.waitFor(() => expect(db.rows).toHaveLength(1));
    expect(db.rows[0]).toMatchObject({
      name: 'hint_used',
      actor: 'user',
      anon_id: anonymizeUserId(U1, SALT),
      source: 'server',
      props: { quest_id: QUEST, level: 2 },
      path: '/quest/[id]',
      dedupe_key: null,
    });
  });

  it('로그인 확인이 안 되거나 단계 값이 이상하면 힌트 기록만 하고 분석은 건너뜀', async () => {
    vi.stubEnv('ANALYTICS_SALT', SALT);
    const recordHint = vi.fn(async () => {});
    const req = new Request('http://localhost/api/tutor', { method: 'POST' });
    await withHintTracking(recordHint, req, { questId: QUEST, level: 2 })!();
    mocks.userId = U1;
    await withHintTracking(recordHint, req, {
      questId: QUEST,
      level: undefined,
    })!();
    expect(recordHint).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 10));
    expect(db.upserts).toHaveLength(0);
  });
});
