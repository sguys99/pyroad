import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeAdmin, type FakeState } from '@/lib/tutor/__tests__/fakeApiKeyDb';

const mocks = vi.hoisted(() => ({
  state: null as unknown as FakeState,
  userUpdates: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeAdmin(mocks.state),
}));
// 사용자 클라이언트: users 쓰기를 기록 (P1-01 이후 preferred_provider 만 쓸 수 있음)
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const db = fakeAdmin(mocks.state);
    return {
      auth: { getUser: async () => ({ data: { user: { id: U1 } } }) },
      from: (table: string) => {
        const b = db.from(table);
        const update = b.update;
        b.update = (values: Record<string, unknown>) => {
          mocks.userUpdates.push(values);
          return update(values);
        };
        return b;
      },
    };
  },
}));

import { GET, PATCH } from '../route';
import { resetLegacyColumnState } from '@/lib/tutor/legacyApiKeys';

const U1 = '11111111-1111-1111-1111-111111111111';
const TEST_KEY = Buffer.alloc(32, 9).toString('base64');
const SECRET = 'sk-ant-route-test-key-abcd1234';

function patch(body: unknown) {
  return PATCH(
    new Request('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  process.env.API_KEY_ENCRYPTION_KEY = TEST_KEY;
  resetLegacyColumnState();
  mocks.userUpdates = [];
  mocks.state = {
    users: { [U1]: { preferred_provider: null, custom_api_keys: {} } },
    user_api_keys: [],
    legacyColumn: true,
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.API_KEY_ENCRYPTION_KEY;
  vi.restoreAllMocks();
});

describe('/api/settings (B13, P1-01)', () => {
  it('키 저장 → 응답·DB 어디에도 원문이 없고, 등록 여부와 끝 4자리만 내려감', async () => {
    const res = await patch({
      provider: 'anthropic',
      api_keys: { anthropic: SECRET },
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(mocks.state.user_api_keys)).not.toContain(SECRET);

    const body = await (await GET()).json();
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(body.has_custom_keys).toEqual(['anthropic']);
    expect(body.masked_keys).toEqual({ anthropic: '••••1234' });
    expect(body.current_provider).toBe('anthropic');
    expect(body.custom_keys_enabled).toBe(true);

    // 사용자 클라이언트로는 preferred_provider 만 씀 (API 키는 service_role 로 user_api_keys 에)
    expect(mocks.userUpdates).toEqual([{ preferred_provider: 'anthropic' }]);
  });

  it('빈 문자열은 삭제', async () => {
    await patch({ api_keys: { anthropic: SECRET } });
    expect((await patch({ api_keys: { anthropic: '' } })).status).toBe(200);
    expect(mocks.state.user_api_keys).toEqual([]);
    expect((await (await GET()).json()).has_custom_keys).toEqual([]);
  });

  it('모양이 이상한 키·provider 는 400', async () => {
    expect(
      (await patch({ api_keys: { openai: 'has space key 1234' } })).status,
    ).toBe(400);
    expect((await patch({ provider: 'mistral' })).status).toBe(400);
    expect((await patch({ api_keys: ['x'] })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect(mocks.state.user_api_keys).toEqual([]);
  });

  it('암호화 키가 없으면 저장은 503, 조회는 기능 꺼짐으로', async () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    const res = await patch({ api_keys: { openai: 'sk-proj-disabled-0000' } });
    expect(res.status).toBe(503);
    const body = await (await GET()).json();
    expect(body.custom_keys_enabled).toBe(false);
    expect(body.has_custom_keys).toEqual([]);
    // provider 선택 저장은 계속 동작
    expect((await patch({ provider: 'gemini' })).status).toBe(200);
  });

  it('①만 적용된 DB: 평문 키를 첫 조회에서 옮기고 응답에는 마스킹만', async () => {
    mocks.state.users[U1] = {
      preferred_provider: 'openai',
      custom_api_keys: { openai: SECRET },
    };
    const body = await (await GET()).json();
    expect(body.has_custom_keys).toEqual(['openai']);
    expect(body.current_provider).toBe('openai');
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(mocks.state.users[U1].custom_api_keys).toEqual({});
  });

  it('①+③ DB: users.custom_api_keys 가 없어도 저장·조회 동작', async () => {
    mocks.state.users[U1] = { preferred_provider: null };
    mocks.state.legacyColumn = false;
    expect(
      (await patch({ provider: 'anthropic', api_keys: { anthropic: SECRET } }))
        .status,
    ).toBe(200);
    expect((await (await GET()).json()).has_custom_keys).toEqual(['anthropic']);
  });
});

describe('/api/settings 움직임 설정 (P2-15)', () => {
  const SOUND = { version: 1, muted: false, master: 0.8 };

  beforeEach(() => {
    mocks.state.users[U1] = {
      preferred_provider: null,
      custom_api_keys: {},
      settings: { sound: SOUND, motion: { tier: 'auto', reduced: 'system' } },
    };
  });

  it('조회: users.settings.motion 을 돌려줌 (없거나 이상한 값은 기본값)', async () => {
    expect((await (await GET()).json()).motion).toEqual({
      tier: 'auto',
      reduced: 'system',
    });
    mocks.state.users[U1].settings = { motion: { tier: 'turbo', reduced: 1 } };
    expect((await (await GET()).json()).motion).toEqual({
      tier: 'auto',
      reduced: 'system',
    });
    mocks.state.users[U1].settings = {};
    expect((await (await GET()).json()).motion).toEqual({
      tier: 'auto',
      reduced: 'system',
    });
  });

  it('저장: motion 만 바꾸고 다른 설정(sound)은 그대로, 사용자 클라이언트로는 users 를 쓰지 않음', async () => {
    const res = await patch({ motion: { tier: 'minimal', reduced: 'on' } });
    expect(res.status).toBe(200);
    expect(mocks.state.users[U1].settings).toEqual({
      sound: SOUND,
      motion: { tier: 'minimal', reduced: 'on' },
    });
    expect(mocks.userUpdates).toEqual([]);
    expect((await (await GET()).json()).motion).toEqual({
      tier: 'minimal',
      reduced: 'on',
    });
  });

  it.each([
    ['모르는 단계', { tier: 'ultra', reduced: 'system' }],
    ['모르는 동작 줄이기', { tier: 'auto', reduced: 'maybe' }],
    ['키 빠짐', { tier: 'lite' }],
    ['측정값 같은 다른 키', { tier: 'lite', reduced: 'off', measured: 'lite' }],
    ['객체 아님', 'minimal'],
    ['배열', ['lite', 'on']],
  ])('%s → 400, 저장 안 함', async (_label, motion) => {
    const res = await patch({ motion });
    expect(res.status).toBe(400);
    expect(mocks.state.users[U1].settings).toEqual({
      sound: SOUND,
      motion: { tier: 'auto', reduced: 'system' },
    });
  });

  it('settings 가 비어 있던 행에도 motion 을 넣음', async () => {
    mocks.state.users[U1].settings = null;
    expect(
      (await patch({ motion: { tier: 'lite', reduced: 'off' } })).status,
    ).toBe(200);
    expect(mocks.state.users[U1].settings).toEqual({
      motion: { tier: 'lite', reduced: 'off' },
    });
  });
});

describe('/api/settings 사운드 설정 (P2-14)', () => {
  const MOTION = { tier: 'auto', reduced: 'system' };
  const SOUND = {
    version: 1,
    muted: false,
    master: 0.8,
    sfx: { enabled: true, volume: 0.7 },
    bgm: { enabled: false, volume: 0.4 },
    voice: { enabled: true, volume: 0.9 },
    updatedAt: 0,
  };
  const changed = (over: Record<string, unknown> = {}) => ({
    ...SOUND,
    sfx: { enabled: false, volume: 0.5 },
    updatedAt: 1_762_300_000_000,
    ...over,
  });

  beforeEach(() => {
    mocks.state.users[U1] = {
      preferred_provider: null,
      custom_api_keys: {},
      settings: { sound: SOUND, motion: MOTION },
    };
  });

  it('조회: users.settings.sound 를 정규화해서 돌려줌 (없으면 null)', async () => {
    expect((await (await GET()).json()).sound).toEqual(SOUND);
    mocks.state.users[U1].settings = {
      sound: { ...SOUND, master: 'loud', sfx: { enabled: 'yes' } },
    };
    expect((await (await GET()).json()).sound).toEqual(SOUND);
    mocks.state.users[U1].settings = { motion: MOTION };
    expect((await (await GET()).json()).sound).toBeNull();
  });

  it('저장: sound 만 바꾸고 motion 은 그대로, 사용자 클라이언트로는 users 를 쓰지 않음', async () => {
    expect((await patch({ sound: changed() })).status).toBe(200);
    expect(mocks.state.users[U1].settings).toEqual({
      sound: changed(),
      motion: MOTION,
    });
    expect(mocks.userUpdates).toEqual([]);
  });

  it('motion 과 sound 를 연달아·동시에 바꿔도 둘 다 남음 (원자적 갱신, 00020)', async () => {
    const motion = { tier: 'minimal', reduced: 'on' };
    const [a, b] = await Promise.all([
      patch({ motion }),
      patch({ sound: changed() }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(mocks.state.users[U1].settings).toEqual({
      sound: changed(),
      motion,
    });
    // 한 요청에 둘 다
    const both = { sound: changed({ muted: true }), motion: MOTION };
    expect((await patch(both)).status).toBe(200);
    expect(mocks.state.users[U1].settings).toEqual(both);
  });

  it.each([
    ['볼륨 범위 밖', changed({ master: 1.5 })],
    ['모르는 키', { ...changed(), theme: 'dark' }],
    ['카테고리 모양', changed({ bgm: { enabled: true } })],
    [
      '카테고리에 다른 키',
      changed({ sfx: { enabled: true, volume: 1, pan: 0 } }),
    ],
    ['버전', changed({ version: 2 })],
    ['먼 미래 시각', changed({ updatedAt: Date.now() + 10 * 86_400_000 })],
    ['객체 아님', 'mute'],
  ])('%s → 400, 저장 안 함', async (_label, sound) => {
    expect((await patch({ sound })).status).toBe(400);
    expect(mocks.state.users[U1].settings).toEqual({
      sound: SOUND,
      motion: MOTION,
    });
  });

  it('사용자 행이 없으면 500 (조용히 성공하지 않음)', async () => {
    delete mocks.state.users[U1];
    expect((await patch({ sound: changed() })).status).toBe(500);
  });
});
