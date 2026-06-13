import crypto from 'crypto';

/**
 * Lightweight signed-cookie session for STOREFRONT customers — deliberately
 * separate from the admin NextAuth session so customer logins never carry an
 * admin role. A compact HS256 JWT (no extra dependency) signed with
 * NEXTAUTH_SECRET. Returns null when no secret is available.
 */

export const CUSTOMER_COOKIE = 'ap_customer';
export const CUSTOMER_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
};

function secret(): string {
  return (process.env.NEXTAUTH_SECRET || process.env.SECRETS_ENCRYPTION_KEY || '').trim();
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJson(obj: unknown): string {
  return b64url(Buffer.from(JSON.stringify(obj)));
}

export function createCustomerSession(customerId: string, ttlSeconds = 60 * 60 * 24 * 30): string | null {
  const s = secret();
  if (!s) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlJson({ sub: customerId, iat: now, exp: now + ttlSeconds });
  const data = `${header}.${payload}`;
  const sig = b64url(crypto.createHmac('sha256', s).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyCustomerSession(token: string | undefined | null): string | null {
  const s = secret();
  if (!s || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = b64url(crypto.createHmac('sha256', s).update(`${header}.${payload}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return null;
    return typeof decoded.sub === 'string' ? decoded.sub : null;
  } catch {
    return null;
  }
}
