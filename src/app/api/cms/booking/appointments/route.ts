import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  getAppointment,
} from '@adminpanel/lib/booking/appointments';
import { recordAudit } from '@adminpanel/lib/audit';

export const dynamic = 'force-dynamic';

const VALID = ['pending', 'confirmed', 'cancelled', 'completed'] as const;
const ip = (r: NextRequest) =>
  r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || r.headers.get('x-real-ip') || null;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = (searchParams.get('status') as any) || undefined;
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  try {
    const result = await listAppointments({ status, from, to });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[api/cms/booking/appointments] GET', err);
    return NextResponse.json({ error: 'Failed to list appointments' }, { status: 500 });
  }
}

// Admin-created booking (bypasses the public availability gate).
export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    if (!body?.serviceId || !body?.startsAt) {
      return NextResponse.json({ error: 'serviceId and startsAt are required' }, { status: 400 });
    }
    const appt = await createAppointment({ ...body, skipSlotCheck: true });
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'appointment.create',
      target: appt.id,
      detail: { service: appt.serviceName, startsAt: appt.startsAt },
      ip: ip(request),
    });
    return NextResponse.json(appt, { status: 201 });
  } catch (err: any) {
    console.error('[api/cms/booking/appointments] POST', err);
    return NextResponse.json({ error: err?.message || 'Failed to create appointment' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const body = await request.json();
    const { id, status } = body || {};
    if (!id || !VALID.includes(status)) {
      return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 });
    }
    const before = await getAppointment(id);
    if (!before) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    const updated = await updateAppointmentStatus(id, status);
    await recordAudit({
      actor: (token as any)?.email || 'admin',
      actorEmail: (token as any)?.email || 'admin',
      action: 'appointment.status',
      target: id,
      detail: { from: before.status, to: status },
      ip: ip(request),
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/cms/booking/appointments] PATCH', err);
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 });
  }
}
