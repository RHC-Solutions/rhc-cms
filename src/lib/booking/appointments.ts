import crypto from 'crypto';
import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';
import { getService } from './services';
import { isSlotOpen } from './availability';
import { findOrCreateCustomer } from '../accounts';
import { createCalendarEvent, deleteCalendarEvent } from './calendar';

const driver = getDriver();

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  serviceId: string | null;
  serviceName: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  priceCents: number | null;
  currency: string | null;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapAppt(r: any): Appointment {
  return {
    id: r.id,
    serviceId: r.serviceId ?? null,
    serviceName: r.serviceName ?? null,
    customerId: r.customerId ?? null,
    customerName: r.customerName ?? null,
    customerEmail: r.customerEmail ?? null,
    customerPhone: r.customerPhone ?? null,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: (r.status as AppointmentStatus) ?? 'confirmed',
    notes: r.notes ?? null,
    priceCents: r.priceCents == null ? null : Number(r.priceCents),
    currency: r.currency ?? null,
    googleEventId: r.googleEventId ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createAppointment(input: {
  serviceId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  startsAt: string;
  notes?: string | null;
  status?: AppointmentStatus;
  /** Admin-created bookings may bypass the public availability check. */
  skipSlotCheck?: boolean;
}): Promise<Appointment> {
  await ensureSchema();
  const service = await getService(input.serviceId);
  if (!service) throw new Error('Service not found');

  const startMs = Date.parse(input.startsAt);
  if (!Number.isFinite(startMs)) throw new Error('Invalid start time');

  if (!input.skipSlotCheck) {
    const open = await isSlotOpen(service.id, input.startsAt);
    if (!open) throw new Error('That time is no longer available');
  }

  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(startMs + service.durationMins * 60_000).toISOString();

  let customerId: string | null = null;
  if (input.customerEmail) {
    try {
      const customer = await findOrCreateCustomer({
        email: input.customerEmail,
        name: input.customerName || undefined,
        phone: input.customerPhone || undefined,
      });
      customerId = customer.id;
    } catch (err) {
      console.error('[booking] customer link failed', err);
    }
  }

  const status: AppointmentStatus = input.status || 'confirmed';
  let googleEventId: string | null = null;
  if (status === 'confirmed') {
    googleEventId = await createCalendarEvent({
      summary: `${service.name} — ${input.customerName || input.customerEmail || 'Booking'}`,
      description: input.notes,
      startIso,
      endIso,
      attendeeEmail: input.customerEmail,
    });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await driver.run(
    `INSERT INTO appointments (id, "serviceId", "serviceName", "customerId", "customerName", "customerEmail", "customerPhone", "startsAt", "endsAt", status, notes, "priceCents", currency, "googleEventId", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      service.id,
      service.name,
      customerId,
      input.customerName ?? null,
      input.customerEmail ?? null,
      input.customerPhone ?? null,
      startIso,
      endIso,
      status,
      input.notes ?? null,
      service.priceCents,
      service.currency,
      googleEventId,
      now,
      now,
    ],
  );
  return (await getAppointment(id))!;
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM appointments WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapAppt(rows[0]) : null;
}

export async function listAppointments(
  opts: { status?: AppointmentStatus; from?: string; to?: string; limit?: number; offset?: number } = {},
): Promise<{ appointments: Appointment[]; total: number }> {
  await ensureSchema();
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }
  if (opts.from) {
    conditions.push('"startsAt" >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    conditions.push('"startsAt" <= ?');
    params.push(opts.to);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const totalRow = (
    await driver.query<{ count: any }>(`SELECT COUNT(*) as count FROM appointments${where}`, params)
  )[0];
  const total = Number(totalRow?.count ?? 0);
  const limit = Math.min(Math.max(1, opts.limit ?? 200), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    `SELECT * FROM appointments${where} ORDER BY "startsAt" DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { appointments: rows.map(mapAppt), total };
}

export async function getAppointmentsForEmail(email: string): Promise<Appointment[]> {
  await ensureSchema();
  const rows = await driver.query<any>(
    'SELECT * FROM appointments WHERE LOWER("customerEmail") = ? ORDER BY "startsAt" DESC LIMIT 200',
    [email.trim().toLowerCase()],
  );
  return rows.map(mapAppt);
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment | null> {
  await ensureSchema();
  const appt = await getAppointment(id);
  if (!appt) return null;
  // Drop the calendar event when cancelling.
  if (status === 'cancelled' && appt.googleEventId) {
    await deleteCalendarEvent(appt.googleEventId);
  }
  await driver.run('UPDATE appointments SET status = ?, "updatedAt" = ? WHERE id = ?', [
    status,
    new Date().toISOString(),
    id,
  ]);
  return getAppointment(id);
}
