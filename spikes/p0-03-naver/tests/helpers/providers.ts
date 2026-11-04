/**
 * Registers the mock custom:* providers through the official Auth admin API
 * (supabase.auth.admin.customProviders) — the same call production would use,
 * see provider/custom-naver.provider.json.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { MOCK_BASE } from './e2e.ts';

const common = { client_id: 'p003-naver-client', client_secret: 'p003-naver-secret' };

export const MOCK_PROVIDERS = [
  // A (채택안): OIDC with discovery; the id_token's flat `sub` becomes the identity
  {
    provider_type: 'oidc',
    identifier: 'custom:naver-mock',
    name: 'Naver (mock OIDC)',
    ...common,
    issuer: MOCK_BASE,
    scopes: ['openid'],
    email_optional: true,
  },
  // same but email_optional left at its default (false)
  {
    provider_type: 'oidc',
    identifier: 'custom:naver-mock-strict',
    name: 'Naver (mock OIDC, email required)',
    ...common,
    issuer: MOCK_BASE,
    scopes: ['openid'],
  },
  // original plan: OAuth2 straight at the nested profile API
  {
    provider_type: 'oauth2',
    identifier: 'custom:naver-nested',
    name: 'Naver (OAuth2, nested userinfo)',
    ...common,
    authorization_url: `${MOCK_BASE}/oauth2.0/authorize`,
    token_url: `${MOCK_BASE}/oauth2.0/token`,
    userinfo_url: `${MOCK_BASE}/v1/nid/me`,
    scopes: [],
    pkce_enabled: false,
    email_optional: true,
  },
  // original plan + attribute_mapping with dotted paths + allowlisting the nested object
  {
    provider_type: 'oauth2',
    identifier: 'custom:naver-mapped',
    name: 'Naver (OAuth2, nested + attribute_mapping)',
    ...common,
    authorization_url: `${MOCK_BASE}/oauth2.0/authorize`,
    token_url: `${MOCK_BASE}/oauth2.0/token`,
    userinfo_url: `${MOCK_BASE}/v1/nid/me`,
    scopes: [],
    pkce_enabled: false,
    email_optional: true,
    attribute_mapping: { sub: 'response.id', nickname: 'response.nickname', picture: 'response.profile_image' },
    custom_claims_allowlist: ['response'],
  },
  // 대안 B: OAuth2 whose userinfo_url is our flattening adapter
  {
    provider_type: 'oauth2',
    identifier: 'custom:naver-adapter',
    name: 'Naver (OAuth2 + userinfo adapter)',
    ...common,
    authorization_url: `${MOCK_BASE}/oauth2.0/authorize`,
    token_url: `${MOCK_BASE}/oauth2.0/token`,
    userinfo_url: `${MOCK_BASE}/adapter/v1/nid/me`,
    scopes: [],
    pkce_enabled: false,
    email_optional: true,
  },
] as const;

export async function ensureMockProviders(admin: SupabaseClient) {
  for (const p of MOCK_PROVIDERS) {
    await admin.auth.admin.customProviders.deleteProvider(p.identifier); // ignore not found
    const { error } = await admin.auth.admin.customProviders.createProvider(p as never);
    if (error) throw new Error(`createProvider ${p.identifier}: ${error.message}`);
  }
}
