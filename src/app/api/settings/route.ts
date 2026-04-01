import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAvailableProviders } from '@/lib/tutor/providers/factory';
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

  const available = getAvailableProviders();

  // 사용자 커스텀 키가 있는 provider도 available에 포함
  const customKeys = (profile?.custom_api_keys ?? {}) as Record<string, string>;
  const customProviders = (Object.keys(customKeys) as LLMProviderType[]).filter(
    (k) => !!customKeys[k],
  );
  const allAvailable = [...new Set([...available, ...customProviders])];

  return NextResponse.json({
    available_providers: allAvailable,
    current_provider: profile?.preferred_provider ?? 'anthropic',
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
