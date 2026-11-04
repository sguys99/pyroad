import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  ApiKeyConfigError,
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  parseKeyring,
  type ApiKeyKeyring,
} from '@/lib/crypto/apiKeyCipher';
import { API_KEY_PROVIDERS, migrateLegacyApiKeys } from './legacyApiKeys';
import type { LLMProviderType } from './providers/types';

/**
 * 사용자 API 키 저장소 (서버 전용, B13)
 *
 * 키는 user_api_keys(service_role 전용, 00007)에 AES-256-GCM 암호문으로만 저장합니다(src/lib/crypto/apiKeyCipher.ts).
 * 평문 키는 서버 안에서만(튜터 provider 호출) 쓰고 클라이언트에는 등록 여부와 끝 4자리 마스킹만 내려보냅니다.
 * 서버 env API_KEY_ENCRYPTION_KEY 가 없거나 형식이 틀리면 커스텀 키 기능만 꺼지고(서버 무료 티어만) 앱은 그대로 동작합니다.
 */

export interface UserApiKeys {
  /** API_KEY_ENCRYPTION_KEY 가 설정되어 커스텀 키를 쓸 수 있는지 */
  enabled: boolean;
  /** 복호화한 키 (서버 안에서만) */
  keys: Partial<Record<LLMProviderType, string>>;
  /** 저장돼 있지만 복호화하지 못한 provider (키 분실·교체 실수). 다시 등록해야 함 */
  unreadable: LLMProviderType[];
}

let configErrorLogged = false;

function getKeyring(): ApiKeyKeyring | null {
  try {
    return parseKeyring(process.env);
  } catch (err) {
    if (!configErrorLogged) {
      configErrorLogged = true;
      console.error(
        '[apiKeys] API_KEY_ENCRYPTION_KEY 설정 오류 → 커스텀 키 기능을 끕니다:',
        err instanceof ApiKeyConfigError ? err.message : 'unknown',
      );
    }
    return null;
  }
}

export function isCustomKeyEnabled(): boolean {
  return getKeyring() !== null;
}

export function isApiKeyProvider(value: unknown): value is LLMProviderType {
  return (
    typeof value === 'string' &&
    (API_KEY_PROVIDERS as readonly string[]).includes(value)
  );
}

const MAX_API_KEY_LENGTH = 512;

/** 입력 키 정규화. 형식이 틀리면 null (공백·제어문자 포함, 너무 짧거나 김) */
export function normalizeApiKeyInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  if (key.length < 8 || key.length > MAX_API_KEY_LENGTH) return null;
  // API 키는 출력 가능한 ASCII 이고 공백이 없음
  if (!/^[\x21-\x7e]+$/.test(key)) return null;
  return key;
}

/** ① 기간(users.custom_api_keys 가 남아 있는 동안) 평문 키를 옮김. 실패해도 조회는 계속 */
async function migrateLegacy(
  admin: ReturnType<typeof createAdminClient>,
  keyring: ApiKeyKeyring,
  userId: string,
) {
  const result = await migrateLegacyApiKeys(admin, keyring, userId);
  if (result.status === 'error') {
    console.error(
      '[apiKeys] 평문 키 이관 실패 (다음 조회 때 다시 시도):',
      result.message,
    );
  }
}

export async function loadUserApiKeys(userId: string): Promise<UserApiKeys> {
  const keyring = getKeyring();
  if (!keyring) return { enabled: false, keys: {}, unreadable: [] };

  const admin = createAdminClient();
  await migrateLegacy(admin, keyring, userId);

  const { data, error } = await admin
    .from('user_api_keys')
    .select('provider, key_version, iv, auth_tag, ciphertext')
    .eq('user_id', userId);
  if (error) {
    console.error(
      '[apiKeys] user_api_keys 조회 실패:',
      error.code,
      error.message,
    );
    return { enabled: true, keys: {}, unreadable: [] };
  }

  const keys: UserApiKeys['keys'] = {};
  const unreadable: LLMProviderType[] = [];
  for (const row of data ?? []) {
    if (!isApiKeyProvider(row.provider)) continue;
    try {
      keys[row.provider] = decryptApiKey(keyring, userId, row.provider, row);
    } catch (err) {
      unreadable.push(row.provider);
      console.error(
        `[apiKeys] ${row.provider} 키 복호화 실패 (key_version ${row.key_version}):`,
        err instanceof Error ? err.message : 'unknown',
      );
    }
  }
  return { enabled: true, keys, unreadable };
}

/** 클라이언트에 내려보낼 상태: 등록된 provider 와 끝 4자리만 */
export function toApiKeyStatus(loaded: UserApiKeys) {
  const registered = API_KEY_PROVIDERS.filter(
    (p) => loaded.keys[p] !== undefined,
  );
  return {
    enabled: loaded.enabled,
    registered,
    masked: Object.fromEntries(
      registered.map((p) => [p, maskApiKey(loaded.keys[p]!)]),
    ) as Partial<Record<LLMProviderType, string>>,
    unreadable: loaded.unreadable,
  };
}

export class ApiKeyStoreError extends Error {
  constructor(
    message: string,
    readonly reason: 'disabled' | 'db',
  ) {
    super(message);
    this.name = 'ApiKeyStoreError';
  }
}

/** 저장(같은 provider 는 덮어씀). 키는 normalizeApiKeyInput 을 거친 값 */
export async function saveUserApiKey(
  userId: string,
  provider: LLMProviderType,
  plaintext: string,
): Promise<void> {
  const keyring = getKeyring();
  if (!keyring) throw new ApiKeyStoreError('custom keys disabled', 'disabled');

  const admin = createAdminClient();
  // 평문이 남아 있으면 먼저 옮기고 비움 → 나중에 평문 값이 새 키를 덮거나 지운 키가 되살아나지 않음
  await migrateLegacy(admin, keyring, userId);

  const { error } = await admin.from('user_api_keys').upsert(
    {
      user_id: userId,
      provider,
      ...encryptApiKey(keyring, userId, provider, plaintext),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider' },
  );
  if (error)
    throw new ApiKeyStoreError(`save failed: ${error.code ?? ''}`, 'db');
}

export async function deleteUserApiKey(
  userId: string,
  provider: LLMProviderType,
): Promise<void> {
  const admin = createAdminClient();
  const keyring = getKeyring();
  if (keyring) await migrateLegacy(admin, keyring, userId);

  const { error } = await admin
    .from('user_api_keys')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error)
    throw new ApiKeyStoreError(`delete failed: ${error.code ?? ''}`, 'db');
}
