// users.custom_api_keys(평문) → user_api_keys(암호문) 이관 (B13)
//
// 릴리즈 동안만 쓰는 코드입니다. ① 00007 이 테이블을 만들고, 새 앱은 사용자의 키를 처음 읽을 때 이 함수로 옮긴 뒤
// 평문을 비웁니다(lazy 이관). 그 사이 한 번도 오지 않은 사용자는 ③ 전에 scripts/api-keys/migrate-legacy.ts 가
// 같은 함수로 옮깁니다. ③ 00009 가 컬럼을 지우면 첫 조회에서 42703 을 받고 이후로는 건너뜁니다.
// ③ 적용 확인 뒤 이 파일과 호출부를 지웁니다 (docs/release/v0.4-runbook.md "적용 뒤 정리").
//
// 서버 전용 모듈(apiKeys.ts)과 일회성 스크립트가 함께 쓰므로 'server-only' 를 넣지 않고, 클라이언트를 인자로 받습니다.
// 반드시 service_role 클라이언트를 넘깁니다(user_api_keys 는 service_role 전용).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { encryptApiKey, type ApiKeyKeyring } from '@/lib/crypto/apiKeyCipher';
import type { LLMProviderType } from './providers/types';

export const API_KEY_PROVIDERS: readonly LLMProviderType[] = [
  'anthropic',
  'openai',
  'gemini',
];

export type LegacyMigrationResult =
  | { status: 'column-gone' }
  | { status: 'nothing' }
  | { status: 'migrated'; providers: LLMProviderType[] }
  | { status: 'error'; message: string };

// 이 인스턴스에서 컬럼이 없어진 것을 한 번 확인하면 다시 묻지 않음
let legacyColumnGone = false;

/** 테스트 전용 */
export function resetLegacyColumnState() {
  legacyColumnGone = false;
}

function isMissingColumn(error: { code?: string; message?: string }) {
  return (
    error.code === '42703' ||
    /custom_api_keys.*does not exist/i.test(error.message ?? '')
  );
}

/** 평문 jsonb 에서 알려진 provider 의 비어 있지 않은 문자열 키만 */
export function pickLegacyKeys(
  value: unknown,
): Partial<Record<LLMProviderType, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: Partial<Record<LLMProviderType, string>> = {};
  for (const provider of API_KEY_PROVIDERS) {
    const v = record[provider];
    if (typeof v === 'string' && v.trim() !== '') out[provider] = v.trim();
  }
  return out;
}

function isEmptyJson(value: unknown) {
  return (
    value == null ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

/**
 * 한 사용자의 평문 키를 암호화해 user_api_keys 로 옮기고 평문을 비운다.
 * - 이미 user_api_keys 에 있는 provider 는 덮어쓰지 않음(새 앱에서 다시 저장한 키가 이김)
 * - 옮기기에 실패하면 평문을 그대로 두고 다음에 다시 시도
 */
export async function migrateLegacyApiKeys(
  admin: SupabaseClient<Database>,
  keyring: ApiKeyKeyring,
  userId: string,
): Promise<LegacyMigrationResult> {
  if (legacyColumnGone) return { status: 'column-gone' };

  // 00009 이후에는 생성 타입에 컬럼이 없으므로 타입 없는 클라이언트로 읽음
  const untyped = admin as unknown as SupabaseClient;
  const { data, error } = await untyped
    .from('users')
    .select('custom_api_keys')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingColumn(error)) {
      legacyColumnGone = true;
      return { status: 'column-gone' };
    }
    return {
      status: 'error',
      message: `users 조회 실패: ${error.code ?? ''} ${error.message}`,
    };
  }

  const raw = (data as { custom_api_keys?: unknown } | null)?.custom_api_keys;
  if (isEmptyJson(raw)) return { status: 'nothing' };

  const keys = pickLegacyKeys(raw);
  const providers = Object.keys(keys) as LLMProviderType[];
  if (providers.length > 0) {
    const now = new Date().toISOString();
    const rows = providers.map((provider) => ({
      user_id: userId,
      provider,
      ...encryptApiKey(keyring, userId, provider, keys[provider]!),
      updated_at: now,
    }));
    const { error: insertError } = await admin
      .from('user_api_keys')
      .upsert(rows, { onConflict: 'user_id,provider', ignoreDuplicates: true });
    if (insertError) {
      return {
        status: 'error',
        message: `user_api_keys 저장 실패: ${insertError.code ?? ''} ${insertError.message}`,
      };
    }
  }

  // 알 수 없는 provider·빈 값만 있던 경우도 평문 컬럼은 비움
  const { error: clearError } = await untyped
    .from('users')
    .update({ custom_api_keys: {} })
    .eq('id', userId);
  if (clearError) {
    return {
      status: 'error',
      message: `평문 비우기 실패: ${clearError.code ?? ''} ${clearError.message}`,
    };
  }
  return { status: 'migrated', providers };
}
