import { NextResponse } from 'next/server';
import { listServices } from '@adminpanel/lib/booking/services';

// Public list of bookable services (active only). Under /api/booking/* which is
// not gated by the admin middleware.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const services = await listServices({ activeOnly: true });
    return NextResponse.json({ services });
  } catch (err) {
    console.error('[api/booking/services] GET', err);
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }
}
