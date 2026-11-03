/**
 * Creates (or updates) custom:naver on a Supabase project from provider/custom-naver.provider.json.
 * Phase 3 (P3-04) helper — run once per environment, server-side only:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
 *   NAVER_CLIENT_ID=... NAVER_CLIENT_SECRET=... node scripts/create-naver-provider.ts
 *
 * (Dashboard alternative: Authentication > Sign In / Providers > Custom Providers > New Provider >
 *  Auto-discovery (OIDC), issuer https://nid.naver.com, and enable "email optional".)
 * Prints no secrets.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k}`);
  return v;
};

const raw = JSON.parse(fs.readFileSync(new URL('../provider/custom-naver.provider.json', import.meta.url), 'utf8'));
delete raw._comment;
const body = { ...raw, client_id: env('NAVER_CLIENT_ID'), client_secret: env('NAVER_CLIENT_SECRET') };

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const existing = await admin.auth.admin.customProviders.listProviders();
if (existing.error) throw existing.error;
const found = (existing.data as unknown as { providers?: Array<{ identifier: string }> }).providers?.some(
  (p) => p.identifier === body.identifier,
);
const { provider_type: _t, identifier, ...updatable } = body;
const res = found
  ? await admin.auth.admin.customProviders.updateProvider(identifier, updatable)
  : await admin.auth.admin.customProviders.createProvider(body);
if (res.error) {
  console.error(`${found ? 'update' : 'create'} failed: ${res.error.message}`);
  process.exit(1);
}
const p = res.data as unknown as { identifier: string; issuer?: string; email_optional?: boolean; pkce_enabled?: boolean };
console.log(`${found ? 'updated' : 'created'} ${p.identifier} issuer=${p.issuer} email_optional=${p.email_optional} pkce=${p.pkce_enabled}`);
