import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { listAudit } from '@adminpanel/lib/audit';

// /api/cms/* is gated by middleware, but the audit log is security-sensitive so
// we re-check admin role here (defense in depth — see CLAUDE.md → Security & auth).
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((token as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const actor = searchParams.get('actor') || undefined;
  const action = searchParams.get('action') || undefined;

  try {
    const { entries, total } = await listAudit({
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
      actor,
      action,
    });
    return NextResponse.json(
      { entries, total },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    console.error('[api/cms/audit] error', err);
    return NextResponse.json({ error: 'Failed to load audit log' }, { status: 500 });
  }
}
