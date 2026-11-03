/**
 * Post-login redirect target validation (fixes the B23 pattern in src/app/auth/callback/route.ts,
 * where `next` is appended to the origin unchecked). Same rule for any login callback.
 */
const ALLOWED_PREFIXES = ['/world', '/quest', '/profile', '/settings', '/board', '/onboarding'];

export function safeNext(raw: string | null | undefined, fallback = '/world'): string {
  if (!raw) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  // must be a same-origin absolute path: "/x", never "//host", "/\host", "http:", control chars
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return fallback;
  const url = new URL(decoded, 'https://pyroad.invalid');
  if (url.origin !== 'https://pyroad.invalid') return fallback;
  if (!ALLOWED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) return fallback;
  return url.pathname + url.search;
}
