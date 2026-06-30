/**
 * Derive the real client IP for a request that reaches this origin THROUGH
 * Cloudflare.
 *
 * Cloudflare overwrites `cf-connecting-ip` at its edge, so it is the only
 * header a remote client cannot forge for traffic that actually transits CF.
 * Everything else is appended by intermediaries: the *leftmost* X-Forwarded-For
 * entry is fully attacker-controlled (CF appends the real client IP to the
 * right of whatever the client sent), so trusting it lets an attacker rotate a
 * fresh fake IP per request — bypassing the brute-force blocker — or pin a
 * victim's IP into the block list. The login payload's own `ip` field is even
 * worse and must never be used as the blocker key.
 *
 * Precedence: cf-connecting-ip > true-client-ip > x-real-ip > rightmost XFF.
 * The rightmost XFF entry is the hop added by the closest trusted proxy
 * (e.g. CF-appended client IP), which is the safe fallback when CF's header is
 * absent (direct-to-origin request) — never the spoofable leftmost entry.
 */
export type HeaderGetter = (name: string) => string | null | undefined;

export function getClientIp(getHeader: HeaderGetter): string {
  const cf = getHeader('cf-connecting-ip');
  if (cf && cf.trim()) return cf.trim();

  const trueClient = getHeader('true-client-ip');
  if (trueClient && trueClient.trim()) return trueClient.trim();

  const realIp = getHeader('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();

  const xff = getHeader('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return 'unknown';
}
