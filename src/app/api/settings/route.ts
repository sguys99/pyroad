import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  FREE_TIER_PROVIDER,
  getAvailableProviders,
  getUserKeyedProviders,
  resolveUserProvider,
} from '@/lib/tutor/providers/factory';
import type { LLMProviderType } from '@/lib/tutor/providers/types';

const VALID_PROVIDERS: LLMProviderType[] = ['anthropic', 'openai', 'gemini'];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('preferred_provider, custom_api_keys')
    .eq('id', user.id)
    .single();

  // 서버 키로는 무료 티어만 제공 → 유료 provider는 본인 키가 있어야 선택 가능
  const serverProviders = getAvailableProviders().filter(
    (p) => p === FREE_TIER_PROVIDER,
  );
  const customProviders = getUserKeyedProviders(profile?.custom_api_keys);
  const allAvailable = [...new Set([...serverProviders, ...customProviders])];
  const { providerType } = resolveUserProvider(
    profile?.preferred_provider,
    profile?.custom_api_keys,
  );

  return NextResponse.json({
    available_providers: allAvailable,
    current_provider: providerType,
    has_custom_keys: customProviders,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { provider?: string; api_keys?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.provider) {
    if (!VALID_PROVIDERS.includes(body.provider as LLMProviderType)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    updates.preferred_provider = body.provider;
  }

  if (body.api_keys) {
    // 기존 키와 병합
    const { data: profile } = await supabase
      .from('users')
      .select('custom_api_keys')
      .eq('id', user.id)
      .single();

    const existing = (profile?.custom_api_keys ?? {}) as Record<string, string>;
    const merged = { ...existing };

    for (const [key, value] of Object.entries(body.api_keys)) {
      if (!VALID_PROVIDERS.includes(key as LLMProviderType)) continue;
      if (value) {
        merged[key] = value;
      } else {
        delete merged[key];
      }
    }
    updates.custom_api_keys = merged;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
