import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Composable admin auth gate for host sites that embed this admin panel as a
// git submodule. The host site's own middleware.ts keeps its site-level
// concerns (canonical host, CSP/security headers, caching) and simply calls:
//
//   import { adminAuthGate, ADMIN_MATCHER } from '@adminpanel/admin-middleware';
//   export async function middleware(req) {
//     ...site headers...
//     const gate = await adminAuthGate(req);
//     if (gate) return gate;           // short-circuit: redirect / 401 / 403
//     return response;                  // allowed → continue with site response
//   }
//   export const config = { matcher: [ ...site matchers, ...ADMIN_MATCHER ] };
//
// The gate returns a NextResponse to short-circuit, or null to allow through.

export const ADMIN_MATCHER = ['/admin/:path*', '/api/cms/:path*'];

const isPath = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname.startsWith(prefix));

const jobsAllowedAdmin = ['/admin/jobs', '/admin/job-applications'];
const jobsAllowedApi = ['/api/cms/jobs'];

// Public (GET-only) API endpoints that don't require authentication. The
// handlers themselves must still enforce auth on POST/PUT/DELETE.
export const ADMIN_PUBLIC_API_ENDPOINTS = [
  '/api/cms/settings',
  '/api/cms/offices',
  '/api/cms/theme',
  '/api/cms/cookies',
  '/api/cms/google-integration',
  '/api/cms/google-integration/verify-meta',
  '/api/cms/pages',
  '/api/cms/footer',
];

const getBaseUrl = (req: NextRequest) => {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (envUrl) return envUrl;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  return `${proto}://${host}`;
};

/**
 * Returns a NextResponse to short-circuit the request (redirect / 401 / 403),
 * or `null` to let the host middleware continue. Only acts on /admin and
 * /api/cms paths; returns null for everything else.
 */
export async function adminAuthGate(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname.startsWith('/admin');
  const isApi = pathname.startsWith('/api/cms');
  if (!isAdmin && !isApi) return null;

  const isMfaApi = pathname.startsWith('/api/cms/mfa');
  const isSetupPage = pathname.startsWith('/admin/setup');
  const isSetupApi = pathname.startsWith('/api/cms/setup');
  const onLogin = pathname.startsWith('/admin/login');
  const isPublicApi = ADMIN_PUBLIC_API_ENDPOINTS.some((e) => pathname.startsWith(e));

  // Public + setup API endpoints pass through.
  if (isPublicApi || isSetupApi) return null;

  // First-run setup gate (cookie flag set by the setup flow).
  const setupComplete = req.cookies.get('setup-complete')?.value === 'true';
  if (!setupComplete && !isSetupPage && isAdmin && !onLogin) {
    return NextResponse.redirect(new URL('/admin/setup', req.url));
  }
  if (isSetupPage) return null;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (onLogin) return null;
    const loginUrl = new URL('/admin/login', getBaseUrl(req));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token as any).role as string | null;
  const totpEnabled = !!(token as any).totpEnabled;
  const mfaRequired = !!(token as any).mfaRequired;
  const onMfaSetup = pathname.startsWith('/admin/mfa-setup');

  // Force MFA setup before any admin/API access.
  if (!totpEnabled || mfaRequired) {
    if (isMfaApi) return null;
    if (isApi) return NextResponse.json({ error: 'MFA required' }, { status: 401 });
    if (!onLogin && !onMfaSetup) {
      return NextResponse.redirect(new URL('/admin/mfa-setup', getBaseUrl(req)));
    }
    return null;
  }

  if (onLogin) {
    return NextResponse.redirect(new URL('/admin/dashboard', getBaseUrl(req)));
  }

  // Role-based restrictions.
  if (role === 'jobs_manager') {
    if (
      (isAdmin && !isPath(pathname, [...jobsAllowedAdmin, '/admin'])) ||
      (isApi && !isPath(pathname, jobsAllowedApi))
    ) {
      return NextResponse.json({ error: 'Forbidden: jobs manager access only' }, { status: 403 });
    }
  }

  if (role === 'editor') {
    if (isAdmin && pathname.startsWith('/admin/users')) {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }
    if (isApi && pathname.startsWith('/api/cms/users')) {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }
  }

  return null;
}
