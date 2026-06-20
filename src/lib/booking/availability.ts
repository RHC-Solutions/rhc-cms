import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';
import { getModuleSetting, setModuleSetting } from '../module-settings';
import { getService } from './services';

/**
 * Booking availability + open-slot computation.
 *
 * Times in the weekly windows are wall-clock "HH:MM" interpreted in the
 * configured timezone, which for v1 is treated as UTC (the `timezone` field is
 * carried through for a future TZ-aware pass). Appointments are stored as ISO
 * UTC, so slot generation and conflict checks are all done in epoch ms.
 */

const driver = getDriver();
const KEY = 'booking.availability';

export interface TimeWindow {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
}
export interface AvailabilityConfig {
  timezone: string;
  slotIntervalMins: number;
  /** dayOfWeek (0=Sun .. 6=Sat) → open windows */
  weekly: Record<number, TimeWindow[]>;
}

const DEFAULT_CONFIG: AvailabilityConfig = {
  timezone: 'UTC',
  slotIntervalMins: 30,
  weekly: {
    0: [],
    1: [{ start: '09:00', end: '17:00' }],
    2: [{ start: '09:00', end: '17:00' }],
    3: [{ start: '09:00', end: '17:00' }],
    4: [{ start: '09:00', end: '17:00' }],
    5: [{ start: '09:00', end: '17:00' }],
    6: [],
  },
};

export async function getAvailabilityConfig(): Promise<AvailabilityConfig> {
  const cfg = await getModuleSetting<AvailabilityConfig>(KEY, DEFAULT_CONFIG);
  return { ...DEFAULT_CONFIG, ...cfg, weekly: { ...DEFAULT_CONFIG.weekly, ...(cfg.weekly || {}) } };
}

export async function setAvailabilityConfig(config: AvailabilityConfig): Promise<void> {
  await setModuleSetting(KEY, config);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
}

function slotIso(date: string, minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T${pad(h)}:${pad(m)}:00.000Z`;
}

/**
 * Open start times (ISO UTC) for a service on a given 'YYYY-MM-DD'. Excludes
 * windows that can't fit the service duration, slots that overlap existing
 * pending/confirmed appointments, and slots already in the past.
 */
export async function getAvailableSlots(serviceId: string, date: string): Promise<string[]> {
  await ensureSchema();
  const service = await getService(serviceId);
  if (!service || !service.active) return [];

  const cfg = await getAvailabilityConfig();
  const dow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const windows = cfg.weekly[dow] || [];
  if (!windows.length) return [];

  const block = service.durationMins + service.bufferMins;
  const interval = Math.max(5, cfg.slotIntervalMins || 30);

  // Existing bookings that day (overlap exclusion).
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const existing = await driver.query<{ startsAt: string; endsAt: string }>(
    `SELECT "startsAt", "endsAt" FROM appointments
     WHERE "startsAt" >= ? AND "startsAt" <= ? AND status IN ('pending', 'confirmed')`,
    [dayStart, dayEnd],
  );
  const taken = existing.map((a) => [Date.parse(a.startsAt), Date.parse(a.endsAt)] as const);

  const now = Date.now();
  const slots: string[] = [];
  for (const w of windows) {
    const winStart = toMinutes(w.start);
    const winEnd = toMinutes(w.end);
    for (let t = winStart; t + block <= winEnd; t += interval) {
      const startMs = Date.parse(slotIso(date, t));
      const endMs = startMs + service.durationMins * 60_000;
      if (startMs < now) continue;
      const overlaps = taken.some(([s, e]) => startMs < e && endMs > s);
      if (overlaps) continue;
      slots.push(new Date(startMs).toISOString());
    }
  }
  return slots;
}

/** Is a specific start time still bookable for this service? (race-safe re-check) */
export async function isSlotOpen(serviceId: string, startsAtIso: string): Promise<boolean> {
  await ensureSchema();
  const service = await getService(serviceId);
  if (!service || !service.active) return false;
  const startMs = Date.parse(startsAtIso);
  if (!Number.isFinite(startMs) || startMs < Date.now()) return false;
  const endMs = startMs + service.durationMins * 60_000;
  const dayStart = new Date(startMs);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(startMs);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const existing = await driver.query<{ startsAt: string; endsAt: string }>(
    `SELECT "startsAt", "endsAt" FROM appointments
     WHERE "startsAt" >= ? AND "startsAt" <= ? AND status IN ('pending', 'confirmed')`,
    [dayStart.toISOString(), dayEnd.toISOString()],
  );
  return !existing.some((a) => startMs < Date.parse(a.endsAt) && endMs > Date.parse(a.startsAt));
}
