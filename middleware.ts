import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuthGate } from '@adminpanel/admin-middleware';
import { SECURITY_HEADERS } from './security-headers.mjs';

// Standalone middleware for this repo's own (dev/CI) build. In a real host
// site you keep your site-level concerns here and just call adminAuthGate();
// see scripts/install-into-site.mjs for the snippet. This version doubles as
// the single source of truth for the auth gate by delegating to it.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CVE backstop: block the middleware-subrequest auth bypass header.
  if (req.headers.get('x-middleware-subrequest')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const response = NextResponse.next();

  // noindex everything — this is an admin surface.
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  for (const { key, value } of SECURITY_HEADERS as Array<{ key: string; value: string }>) {
    response.headers.set(key, value);
  }

  // Admin auth / MFA / role gate (shared, composable).
  const gate = await adminAuthGate(req);
  if (gate) return gate;

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
