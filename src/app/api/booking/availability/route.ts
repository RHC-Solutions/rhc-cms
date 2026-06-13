import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots } from '@adminpanel/lib/booking/availability';

// Public open-slot lookup: /api/booking/availability?serviceId=…&date=YYYY-MM-DD
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get('serviceId');
  const date = searchParams.get('date');
  if (!serviceId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'serviceId and date (YYYY-MM-DD) are required' }, { status: 400 });
  }
  try {
    const slots = await getAvailableSlots(serviceId, date);
    return NextResponse.json({ slots });
  } catch (err) {
    console.error('[api/booking/availability] GET', err);
    return NextResponse.json({ error: 'Failed to load availability' }, { status: 500 });
  }
}
