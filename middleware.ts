import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { SECURITY_HEADERS } from './security-headers.mjs';

const ADMIN_MATCHER = ['/admin/:path*', '/api/cms/:path*'];

const isPath = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname.startsWith(prefix));

const jobsAllowedAdmin = ['/admin/jobs', '/admin/job-applications'];
const jobsAllowedApi = ['/api/cms/jobs'];

// Public API endpoints that don't require authentication.
// `/api/cms/seo` was intentionally removed (2026-05-19 audit): the full
// seo.json includes secrets (ahrefsApiKey, ipinfoToken) and PII (admin email),
// and the only client-side caller is the GA fallback fetch in
// components/GoogleAnalytics.tsx — which already has env-var + SSR-prop
// fallbacks and degrades gracefully on 401. The route handler additionally
// scrubs sensitive fields for non-admin callers as defense-in-depth.
const publicApiEndpoints = [
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
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'rhcsolutions.com';
  return `${proto}://${host}`;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Security: Block requests with x-middleware-subrequest header to prevent authorization bypass
  // CVE: Next.js middleware authorization bypass vulnerability
  if (req.headers.get('x-middleware-subrequest')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Canonical host: 301 www → apex so search engines consolidate signals on
  // one hostname. Cloudflare normally handles this at the edge; this is a
  // defensive backstop for direct-to-origin traffic or CF misconfiguration.
  const host = req.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const url = req.nextUrl.clone();
    url.host = host.slice(4);
    return NextResponse.redirect(url, 301);
  }

  // Trailing-slash canonicalization is handled by Next.js itself (default
  // `trailingSlash: false`): requests to `/foo/` 308 → `/foo` in the routing
  // layer before middleware runs. A duplicate redirect here would be dead
  // code — see docs/AUDIT_SEO_2026-05-18.md Phase 4 step 13.

  // Add performance and security headers for all responses
  const response = NextResponse.next();

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/') ||
    pathname === '/web-check' ||
    pathname.startsWith('/web-check/')
  ) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  } else {
    response.headers.set('X-Robots-Tag', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  }
  
  // Security headers — shared with next.config.mjs so /_next/image and other
  // routes that bypass middleware still receive identical CSP/headers.
  // 'unsafe-inline' for scripts is still required by inlined GTM/GA bootstrap
  // snippets in app/layout.tsx. 'unsafe-eval' is intentionally absent.
  for (const { key, value } of SECURITY_HEADERS as Array<{ key: string; value: string }>) {
    response.headers.set(key, value);
  }
  
  // Performance headers. We intentionally do not emit a `Link: rel=preload`
  // for CSS here — Next.js emits per-build hashed CSS filenames (e.g.
  // /_next/static/css/<hash>.css) and a generic directory preload to
  // `/_next/static/css` 404s, burning a request slot for nothing.
  if (!pathname.startsWith('/api/')) {
    response.headers.set('X-DNS-Prefetch-Control', 'on');
  }

  // Cloudflare edge cache for the homepage. Pairs with the CF Cache Rule that
  // makes the edge honor this header — `Cache-Control: s-maxage=...` alone is
  // ignored by Cloudflare for HTML responses.
  if (req.method === 'GET' && pathname === '/') {
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=31535940');
  }
  
  const isAdmin = pathname.startsWith('/admin');
  const isApi = pathname.startsWith('/api/cms');
  const isMfaApi = pathname.startsWith('/api/cms/mfa');
  const isSetupPage = pathname.startsWith('/admin/setup');
  const isSetupApi = pathname.startsWith('/api/cms/setup');
  const onLogin = pathname.startsWith('/admin/login');
  const isPublicApi = publicApiEndpoints.some(endpoint => pathname.startsWith(endpoint));

  // Allow public assets and next internals (with security headers)
  if (!isAdmin && !isApi) {
    return response;
  }

  // Always allow public API endpoints (with security headers)
  if (isPublicApi) {
    return response;
  }

  // Always allow setup API endpoints (with security headers)
  if (isSetupApi) {
    return response;
  }

  // Check if setup is needed via cookie flag
  const setupComplete = req.cookies.get('setup-complete')?.value === 'true';
  
  // If we don't have a setup-complete cookie, check the setup status
  if (!setupComplete && !isSetupPage) {
    // On first admin access without setup cookie, redirect to setup
    // The setup page will verify if setup is actually needed
    if (isAdmin && !onLogin) {
      return NextResponse.redirect(new URL('/admin/setup', req.url));
    }
  }

  // Allow setup page access (with security headers)
  if (isSetupPage) {
    return response;
  }

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // No token: redirect admin, block api
  if (!token) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (onLogin) {
      return response;
    }
    const loginUrl = new URL('/admin/login', getBaseUrl(req));
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token as any).role as string | null;
  const totpEnabled = !!(token as any).totpEnabled;
  const mfaRequired = !!(token as any).mfaRequired;

  const onMfaSetup = pathname.startsWith('/admin/mfa-setup');

  // Force MFA setup before any admin/API access
  if (!totpEnabled || mfaRequired) {
    if (isMfaApi) {
      return response;
    }
    if (isApi) {
      return NextResponse.json({ error: 'MFA required' }, { status: 401 });
    }
    if (!onLogin && !onMfaSetup) {
      const mfaUrl = new URL('/admin/mfa-setup', getBaseUrl(req));
      return NextResponse.redirect(mfaUrl);
    }
    // Allow mfa-setup/login pages (with security headers)
    return response;
  }

  if (onLogin) {
    // Already authenticated and MFA complete: redirect away from login
    return NextResponse.redirect(new URL('/admin/dashboard', getBaseUrl(req)));
  }

  // Role-based restrictions
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (.txt, .html, .xml, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:txt|html|xml|png|jpg|jpeg|gif|svg|ico|webp|avif|css|js)).*)',
    '/admin/:path*',
    '/api/cms/:path*',
  ],
};
