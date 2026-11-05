import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  FREE_TIER_PROVIDER,
  getAvailableProviders,
  resolveUserProvider,
} from '@/lib/tutor/providers/factory';
import {
  ApiKeyStoreError,
  deleteUserApiKey,
  isApiKeyProvider,
  loadUserApiKeys,
  normalizeApiKeyInput,
  saveUserApiKey,
  toApiKeyStatus,
} from '@/lib/tutor/apiKeys';
import type { LLMProviderType } from '@/lib/tutor/providers/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { motionSettingsSchema } from '@/lib/motion/schema';
import { motionFromUserSettings } from '@/lib/motion/server';
import type { MotionSettings } from '@/lib/motion/tier';
import type { Json } from '@/lib/types/database';

// 사용자 API 키는 user_api_keys(service_role 전용)에 암호문으로만 저장하고,
// 응답에는 등록 여부와 끝 4자리만 넣는다 (B13). users 에는 preferred_provider 만 쓴다 (P1-01 UPDATE 컬럼 권한).
//
// 움직임 설정 `motion` (P2-15): users.settings 는 클라이언트 UPDATE 권한이 없으므로(P1-01, 00008) 클라이언트 직접 쓰기를 열지 않고
// 여기서 zod strict 로 검사한 뒤 service_role 로 settings.motion 만 바꾼다 (다른 키 sound 등은 그대로 둠).

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ data: profile }, apiKeys] = await Promise.all([
    supabase
      .from('users')
      .select('preferred_provider, settings')
      .eq('id', user.id)
      .single(),
    loadUserApiKeys(user.id),
  ]);
  const status = toApiKeyStatus(apiKeys);

  // 서버 키로는 무료 티어만 제공 → 유료 provider는 본인 키가 있어야 선택 가능
  const serverProviders = getAvailableProviders().filter(
    (p) => p === FREE_TIER_PROVIDER,
  );
  const allAvailable = [...new Set([...serverProviders, ...status.registered])];
  const { providerType } = resolveUserProvider(
    profile?.preferred_provider,
    apiKeys.keys,
  );

  return NextResponse.json({
    available_providers: allAvailable,
    current_provider: providerType,
    has_custom_keys: status.registered,
    masked_keys: status.masked,
    unreadable_keys: status.unreadable,
    custom_keys_enabled: status.enabled,
    motion: motionFromUserSettings(profile?.settings),
  });
}

/** users.settings 의 motion 키만 바꾼다 (읽고 합쳐 씀. 같은 사용자의 다른 설정 키와 동시에 쓰는 화면은 아직 없음, P2-14 참고) */
async function saveMotionSettings(
  userId: string,
  motion: MotionSettings,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error: readError } = await admin
    .from('users')
    .select('settings')
    .eq('id', userId)
    .single();
  if (readError || !data) {
    reportServerError(readError ?? new Error('user row missing'), {
      area: 'settings',
      op: 'read settings',
    });
    return false;
  }
  const current =
    data.settings &&
    typeof data.settings === 'object' &&
    !Array.isArray(data.settings)
      ? data.settings
      : {};
  const { error } = await admin
    .from('users')
    .update({ settings: { ...current, motion } as unknown as Json })
    .eq('id', userId);
  if (error) {
    reportServerError(error, { area: 'settings', op: 'update motion' });
    return false;
  }
  return true;
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { provider?: unknown; api_keys?: unknown; motion?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let provider: LLMProviderType | undefined;
  if (body.provider !== undefined) {
    if (!isApiKeyProvider(body.provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    provider = body.provider;
  }

  // 키 변경: { provider: '새 키' } 저장, { provider: '' } 삭제. 알 수 없는 provider 는 무시
  const toSave: [LLMProviderType, string][] = [];
  const toDelete: LLMProviderType[] = [];
  if (body.api_keys !== undefined) {
    if (
      !body.api_keys ||
      typeof body.api_keys !== 'object' ||
      Array.isArray(body.api_keys)
    ) {
      return NextResponse.json({ error: 'Invalid api_keys' }, { status: 400 });
    }
    for (const [key, value] of Object.entries(body.api_keys)) {
      if (!isApiKeyProvider(key)) continue;
      if (value === '' || value === null) {
        toDelete.push(key);
        continue;
      }
      const normalized = normalizeApiKeyInput(value);
      if (!normalized) {
        return NextResponse.json(
          {
            error:
              'API 키 모양이 올바르지 않아요. 복사한 키를 그대로 붙여 넣어 주세요.',
            code: 'invalid_key',
          },
          { status: 400 },
        );
      }
      toSave.push([key, normalized]);
    }
  }

  let motion: MotionSettings | undefined;
  if (body.motion !== undefined) {
    const parsed = motionSettingsSchema.safeParse(body.motion);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid motion' }, { status: 400 });
    }
    motion = parsed.data;
  }

  if (!provider && !motion && toSave.length === 0 && toDelete.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  try {
    for (const [p, key] of toSave) await saveUserApiKey(user.id, p, key);
    for (const p of toDelete) await deleteUserApiKey(user.id, p);
  } catch (err) {
    if (err instanceof ApiKeyStoreError && err.reason === 'disabled') {
      return NextResponse.json(
        {
          error: '지금은 내 API 키를 저장할 수 없어요.',
          code: 'custom_keys_disabled',
        },
        { status: 503 },
      );
    }
    console.error(
      '[settings] API 키 저장 실패:',
      err instanceof Error ? err.message : 'unknown',
    );
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (motion && !(await saveMotionSettings(user.id, motion))) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  if (provider) {
    const { error } = await supabase
      .from('users')
      .update({ preferred_provider: provider })
      .eq('id', user.id);
    if (error) {
      return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
