import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fsp from 'fs/promises';
import path from 'path';

// The sitemap is served DYNAMICALLY by src/app/sitemap.ts from the live CMS
// (cms.db) with proper per-section priorities. A static public/sitemap.xml would
// SHADOW that route (Next serves public/* ahead of routes) and serve stale data
// — which is exactly the recurring bug this endpoint used to cause by writing a
// pages.json-derived file. So "generate" now means: remove any static shadow
// and confirm the dynamic sitemap is the source of truth.
const PUBLIC_SITEMAP = path.join(process.cwd(), 'public', 'sitemap.xml');

async function checkAdmin(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = token && (token as any).role ? (token as any).role : null;
  return role === 'admin';
}

export async function POST(request: NextRequest) {
  if (!(await checkAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  try {
    let removed = false;
    try { await fsp.unlink(PUBLIC_SITEMAP); removed = true; } catch { /* not present — fine */ }
    return NextResponse.json({
      success: true,
      dynamic: true,
      message: removed
        ? 'Removed a stale static public/sitemap.xml. Your sitemap is served live at /sitemap.xml from the CMS — no static file needed.'
        : 'Nothing to do — your sitemap is already served live at /sitemap.xml from the CMS (no static file).',
    });
  } catch (error) {
    console.error('Error clearing static sitemap:', error);
    return NextResponse.json({ error: 'Failed to clear static sitemap' }, { status: 500 });
  }
}
