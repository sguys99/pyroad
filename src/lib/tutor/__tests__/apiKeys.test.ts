import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptApiKey, parseKeyring } from '@/lib/crypto/apiKeyCipher';
import { fakeAdmin, type FakeState } from './fakeApiKeyDb';

const mocks = vi.hoisted(() => ({ state: null as unknown as FakeState }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => fakeAdmin(mocks.state),
}));

import {
  deleteUserApiKey,
  loadUserApiKeys,
  normalizeApiKeyInput,
  saveUserApiKey,
  toApiKeyStatus,
  ApiKeyStoreError,
} from '../apiKeys';
import { resetLegacyColumnState } from '../legacyApiKeys';

// 고정 테스트 키 (운영 키 아님)
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const OPENAI = 'sk-proj-legacy-openai-key-9876';
const ANTHROPIC = 'sk-ant-legacy-anthropic-key-5555';

function setState(partial: Partial<FakeState> = {}) {
  mocks.state = {
    users: { [U1]: { preferred_provider: null, custom_api_keys: {} } },
    user_api_keys: [],
    legacyColumn: true,
    ...partial,
  };
}

beforeEach(() => {
  process.env.API_KEY_ENCRYPTION_KEY = TEST_KEY;
  resetLegacyColumnState();
  setState();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.API_KEY_ENCRYPTION_KEY;
  vi.restoreAllMocks();
});

describe('키가 없을 때', () => {
  it('API_KEY_ENCRYPTION_KEY 가 없으면 커스텀 키만 꺼지고 DB 에 쓰지 않음', async () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    setState({ users: { [U1]: { preferred_provider: null, custom_api_keys: { openai: OPENAI } } } });
    expect(await loadUserApiKeys(U1)).toEqual({ enabled: false, keys: {}, unreadable: [] });
    await expect(saveUserApiKey(U1, 'openai', OPENAI)).rejects.toMatchObject({
      reason: 'disabled',
    });
    // 평문을 읽거나 옮기지 않음
    expect(mocks.state.user_api_keys).toEqual([]);
    expect(mocks.state.users[U1].custom_api_keys).toEqual({ openai: OPENAI });
  });

  it('형식이 틀린 키도 꺼짐으로 처리 (앱은 계속 동작)', async () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'too-short';
    expect((await loadUserApiKeys(U1)).enabled).toBe(false);
  });
});

describe('저장·조회·삭제', () => {
  it('저장한 키는 암호문으로만 남고, 조회하면 서버 안에서 복호화', async () => {
    await saveUserApiKey(U1, 'anthropic', ANTHROPIC);
    expect(mocks.state.user_api_keys).toHaveLength(1);
    expect(JSON.stringify(mocks.state.user_api_keys)).not.toContain(ANTHROPIC);

    const loaded = await loadUserApiKeys(U1);
    expect(loaded.keys).toEqual({ anthropic: ANTHROPIC });

    // 클라이언트로 내려보낼 값에는 끝 4자리만
    const status = toApiKeyStatus(loaded);
    expect(status).toEqual({
      enabled: true,
      registered: ['anthropic'],
      masked: { anthropic: '••••5555' },
      unreadable: [],
    });
    expect(JSON.stringify(status)).not.toContain(ANTHROPIC);
  });

  it('같은 provider 는 덮어쓰고, 삭제하면 사라짐', async () => {
    await saveUserApiKey(U1, 'openai', OPENAI);
    await saveUserApiKey(U1, 'openai', 'sk-proj-new-openai-key-0000');
    expect(mocks.state.user_api_keys).toHaveLength(1);
    expect((await loadUserApiKeys(U1)).keys.openai).toBe('sk-proj-new-openai-key-0000');

    await deleteUserApiKey(U1, 'openai');
    expect((await loadUserApiKeys(U1)).keys).toEqual({});
  });

  it('다른 사용자 행으로 옮겨 붙인 암호문은 읽지 못함 (unreadable)', async () => {
    const keyring = parseKeyring(process.env)!;
    mocks.state.user_api_keys.push({
      user_id: U1,
      provider: 'openai',
      ...encryptApiKey(keyring, U2, 'openai', OPENAI),
    });
    const loaded = await loadUserApiKeys(U1);
    expect(loaded.keys).toEqual({});
    expect(loaded.unreadable).toEqual(['openai']);
  });

  it('DB 쓰기 실패는 ApiKeyStoreError(db)', async () => {
    setState({ failKeyWrites: { code: '42501', message: 'permission denied' } });
    const err = await saveUserApiKey(U1, 'openai', OPENAI).catch((e) => e);
    expect(err).toBeInstanceOf(ApiKeyStoreError);
    expect(err.reason).toBe('db');
    expect(String(err)).not.toContain(OPENAI);
  });
});

describe('평문 이관 (①만 적용된 DB: users.custom_api_keys 가 남아 있음)', () => {
  it('처음 조회할 때 암호화해 옮기고 평문을 비움', async () => {
    setState({
      users: {
        [U1]: {
          preferred_provider: 'openai',
          custom_api_keys: { openai: OPENAI, anthropic: ANTHROPIC, unknown: 'x' },
        },
      },
    });
    const loaded = await loadUserApiKeys(U1);
    expect(loaded.keys).toEqual({ openai: OPENAI, anthropic: ANTHROPIC });
    expect(mocks.state.users[U1].custom_api_keys).toEqual({});
    expect(mocks.state.user_api_keys.map((r) => r.provider).sort()).toEqual([
      'anthropic',
      'openai',
    ]);
    expect(JSON.stringify(mocks.state.user_api_keys)).not.toContain(OPENAI);
  });

  it('이미 새 테이블에 있는 키는 평문 값으로 덮어쓰지 않음', async () => {
    await saveUserApiKey(U1, 'openai', 'sk-proj-saved-in-new-app-1111');
    mocks.state.users[U1].custom_api_keys = { openai: OPENAI }; // 이전 앱 인스턴스가 늦게 쓴 경우
    expect((await loadUserApiKeys(U1)).keys.openai).toBe('sk-proj-saved-in-new-app-1111');
    expect(mocks.state.users[U1].custom_api_keys).toEqual({});
  });

  it('지운 키가 평문에서 되살아나지 않음', async () => {
    setState({ users: { [U1]: { preferred_provider: null, custom_api_keys: { openai: OPENAI } } } });
    await deleteUserApiKey(U1, 'openai');
    expect((await loadUserApiKeys(U1)).keys).toEqual({});
    expect(mocks.state.users[U1].custom_api_keys).toEqual({});
  });

  it('새 테이블 저장에 실패하면 평문을 지우지 않음 (다음에 다시 시도)', async () => {
    setState({
      users: { [U1]: { preferred_provider: null, custom_api_keys: { openai: OPENAI } } },
      failKeyWrites: { code: '57014', message: 'timeout' },
    });
    expect((await loadUserApiKeys(U1)).keys).toEqual({});
    expect(mocks.state.users[U1].custom_api_keys).toEqual({ openai: OPENAI });
  });
});

describe('①+③ DB (00009 로 users.custom_api_keys 가 없음)', () => {
  it('컬럼이 없으면 이관을 건너뛰고 새 테이블만 씀. 이후 조회에서는 다시 묻지 않음', async () => {
    setState({ users: { [U1]: { preferred_provider: null } }, legacyColumn: false });
    await saveUserApiKey(U1, 'gemini', 'AIzaSy-test-gemini-key-4321');
    expect((await loadUserApiKeys(U1)).keys).toEqual({ gemini: 'AIzaSy-test-gemini-key-4321' });

    // 컬럼이 없다는 것을 기억함: 같은 인스턴스에서는 users.custom_api_keys 를 다시 읽지 않음
    mocks.state.legacyColumn = true;
    mocks.state.users[U1].custom_api_keys = { openai: OPENAI };
    expect((await loadUserApiKeys(U1)).keys.openai).toBeUndefined();
  });
});

describe('normalizeApiKeyInput', () => {
  it('앞뒤 공백을 지우고 모양이 이상한 값은 거부', () => {
    expect(normalizeApiKeyInput(`  ${OPENAI}\n`)).toBe(OPENAI);
    expect(normalizeApiKeyInput('short')).toBeNull();
    expect(normalizeApiKeyInput('has space inside-key')).toBeNull();
    expect(normalizeApiKeyInput('키-한글-포함-0000')).toBeNull();
    expect(normalizeApiKeyInput('x'.repeat(513))).toBeNull();
    expect(normalizeApiKeyInput(12345678)).toBeNull();
  });
});
