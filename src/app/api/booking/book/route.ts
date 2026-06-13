import { NextRequest, NextResponse } from 'next/server';
import { createAppointment } from '@adminpanel/lib/booking/appointments';
import { recordAudit } from '@adminpanel/lib/audit';

// Public booking submission. Re-validates the slot server-side (race-safe) so a
// client can't book an unavailable or past time.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  const { serviceId, name, email, phone, startsAt, notes } = body || {};
  if (!serviceId || !startsAt) {
    return NextResponse.json({ error: 'serviceId and startsAt are required' }, { status: 400 });
  }
  try {
    const appt = await createAppointment({
      serviceId,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      startsAt,
      notes,
      status: 'confirmed',
    });
    await recordAudit({
      actor: email || 'public',
      action: 'appointment.booked',
      target: appt.id,
      detail: { service: appt.serviceName, startsAt: appt.startsAt },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });
    return NextResponse.json({
      id: appt.id,
      serviceName: appt.serviceName,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      status: appt.status,
    });
  } catch (err: any) {
    const msg = err?.message || 'Failed to book appointment';
    const status = /no longer available|invalid start/i.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
