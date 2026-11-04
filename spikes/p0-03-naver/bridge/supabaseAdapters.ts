/**
 * Supabase implementations for the 대안 C bridge (service role, server only).
 *
 * Session issuance = admin.generateLink({ type: 'magiclink' }) + verifyOtp({ token_hash }).
 * This yields a normal GoTrue session (refresh token, auth.sessions row), so auth.uid()/RLS,
 * getUser() in middleware and admin.deleteUser all keep working. It needs an email on the
 * user, so users without a Naver email get a synthetic, non-deliverable address derived from
 * the Naver id with a server-side pepper. No email is ever sent (generateLink only returns
 * the hashed token).
 *
 * Rejected alternatives (see report §5): self-signed JWTs (no auth.sessions row -> getUser()
 * fails, no refresh), anonymous sign-in + linking (no way back into the same user on a new
 * device), Supabase third-party auth (users not in auth.users, Naver not a supported issuer).
 */
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionIssuer, UserDirectory } from './naverBridge.ts';

/**
 * Spike placeholder. Production: a subdomain we own (e.g. naver.users.<our-domain>) with a
 * null MX record (RFC 7505) so nothing can ever be delivered and the domain cannot be
 * registered by someone else.
 */
export const SYNTHETIC_EMAIL_DOMAIN = 'naver.users.pyroad.invalid';

export function syntheticEmail(naverId: string, pepper: string, domain = SYNTHETIC_EMAIL_DOMAIN) {
  const h = crypto.createHmac('sha256', pepper).update(`naver:${naverId}`).digest('hex').slice(0, 40);
  return `n_${h}@${domain}`;
}

export function supabaseUserDirectory(admin: SupabaseClient, pepper: string, domain?: string): UserDirectory {
  return {
    async findOrCreateByNaverId(naverId) {
      const email = syntheticEmail(naverId, pepper, domain);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { provider: 'naver', naver_id: naverId },
        user_metadata: {},
      });
      if (!error) return { userId: data.user.id, created: true };
      if (error.code !== 'email_exists') throw error;
      // existing user: generateLink returns the user record without sending mail
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (link.error) throw link.error;
      if (link.data.user.app_metadata?.naver_id !== naverId) throw new Error('naver_id mismatch');
      return { userId: link.data.user.id, created: false };
    },
  };
}

/**
 * anonFactory must return a client whose storage is the response cookies
 * (@supabase/ssr createServerClient in a Route Handler), so verifyOtp writes the session cookies.
 */
export function supabaseSessionIssuer(
  admin: SupabaseClient,
  anonFactory: () => SupabaseClient,
  pepper: string,
  domain?: string,
): SessionIssuer {
  return {
    async issue(userId, naverId) {
      const email = syntheticEmail(naverId, pepper, domain);
      const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
      if (link.error) throw link.error;
      if (link.data.user.id !== userId) throw new Error('user mismatch');
      const client = anonFactory();
      const { data, error } = await client.auth.verifyOtp({
        type: 'magiclink',
        token_hash: link.data.properties.hashed_token,
      });
      if (error || !data.session) throw error ?? new Error('no session');
      return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    },
  };
}
