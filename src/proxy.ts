import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAuthSecret } from './lib/auth/secret';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // Check for session token
  const token = await getToken({
    req,
    secret: getAuthSecret(),
  });

  // If no token, redirect to login
  if (!token && (pathname.startsWith('/admin') || pathname.startsWith('/api/cms'))) {
    const loginUrl = new URL('/admin/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Protect all /admin routes and /api/cms routes
export const config = {
  matcher: ['/admin/:path*', '/api/cms/:path*'],
};
