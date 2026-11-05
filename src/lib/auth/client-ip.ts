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
 *
 * Proxy-overwrite guard (2026-11-05): the reverse proxy in front of Next
 * replaced `cf-connecting-ip` (and x-real-ip) with its own $remote_addr — the
 * Cloudflare EDGE address (e.g. 172.69.x.x, "Lisbon"). Every login alert showed
 * a CF IP and the brute-force blocker keyed on an edge shared by many visitors.
 * So any candidate that is itself a Cloudflare address is skipped, and the
 * fallback walks X-Forwarded-For from the RIGHT past Cloudflare hops: the first
 * non-CF entry is the one CF appended for the real client. Entries left of it
 * are client-controlled and never reached.
 */
export type HeaderGetter = (name: string) => string | null | undefined;

// https://www.cloudflare.com/ips-v4 and /ips-v6
const CF_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];
const CF_V6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

function v4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

// Expand an IPv6 address to 8 x 16-bit groups (null if malformed).
function v6Groups(ip: string): number[] | null {
  if (!/^[0-9a-f:]+$/i.test(ip) || ip.split('::').length > 2) return null;
  const [head, tail] = ip.includes('::') ? ip.split('::') : [ip, undefined];
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail ? tail.split(':') : [];
  const fill = tail !== undefined ? 8 - h.length - t.length : 0;
  if (fill < 0) return null;
  const parts = [...h, ...Array(fill).fill('0'), ...t];
  if (parts.length !== 8 || parts.some((p) => p.length === 0 || p.length > 4)) return null;
  return parts.map((p) => parseInt(p, 16));
}

function inV4(ip: number, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const b = v4ToInt(base)!;
  const n = Number(bits);
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return (ip & mask) === (b & mask);
}

function inV6(g: number[], cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const b = v6Groups(base)!;
  let n = Number(bits);
  for (let i = 0; i < 8 && n > 0; i++, n -= 16) {
    const take = Math.min(16, n);
    const mask = (0xffff << (16 - take)) & 0xffff;
    if ((g[i] & mask) !== (b[i] & mask)) return false;
  }
  return true;
}

export function isCloudflareIp(raw: string): boolean {
  const ip = raw.trim().replace(/^::ffff:/i, '');
  const v4 = v4ToInt(ip);
  if (v4 !== null) return CF_V4.some((c) => inV4(v4, c));
  const v6 = v6Groups(ip);
  return v6 !== null && CF_V6.some((c) => inV6(v6, c));
}

export function getClientIp(getHeader: HeaderGetter): string {
  for (const name of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip']) {
    const v = getHeader(name)?.trim();
    if (v && !isCloudflareIp(v)) return v;
  }

  const xff = getHeader('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((p) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      if (!isCloudflareIp(parts[i])) return parts[i];
    }
  }

  return getHeader('cf-connecting-ip')?.trim() || 'unknown';
}
