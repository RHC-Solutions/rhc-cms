import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  getAvailabilityConfig,
  setAvailabilityConfig,
  type AvailabilityConfig,
} from '@adminpanel/lib/booking/availability';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getAvailabilityConfig();
    return NextResponse.json({ config }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/booking/availability] GET', err);
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const config = body?.config as AvailabilityConfig;
    if (!config || typeof config !== 'object' || !config.weekly) {
      return NextResponse.json({ error: 'A valid config is required' }, { status: 400 });
    }
    await setAvailabilityConfig(config);
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'booking.availability.update',
      target: null,
      detail: { slotIntervalMins: config.slotIntervalMins },
      ip: null,
    });
    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error('[api/cms/booking/availability] PUT', err);
    return NextResponse.json({ error: 'Failed to save availability' }, { status: 500 });
  }
}
