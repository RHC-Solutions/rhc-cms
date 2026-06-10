import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { exportDesignPack } from '@adminpanel/lib/design-pack/export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Export the current site as a design pack (.zip). Admin-only — the pack is a
// curated template, but generating it reads the full content set.
export async function GET(request: NextRequest) {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = String((token as any)?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'administrator') {
    return NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const name = url.searchParams.get('name') || undefined;
    const templatize = url.searchParams.get('templatize') !== 'false';
    const zip = await exportDesignPack({ name, templatize, createdAt: new Date().toISOString() });
    const filename = `design-pack-${(name || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.zip`;
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Export failed: ${(e as Error).message}` }, { status: 500 });
  }
}
