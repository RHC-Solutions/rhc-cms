import crypto from 'crypto';
import { getDriver } from '../cms/db';
import { ensureSchema } from '../cms/migrations';

/** Bookable services (the "what" a customer schedules). Money in cents. */

const driver = getDriver();

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationMins: number;
  bufferMins: number;
  priceCents: number;
  currency: string;
  active: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapService(r: any): Service {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? null,
    durationMins: Number(r.durationMins ?? 30),
    bufferMins: Number(r.bufferMins ?? 0),
    priceCents: Number(r.priceCents ?? 0),
    currency: r.currency ?? 'usd',
    active: r.active === 1 || r.active === true,
    metadata: r.metadata ? safeParse<Record<string, any>>(r.metadata, {}) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function slugify(input: string): string {
  return (
    input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) ||
    crypto.randomUUID().slice(0, 8)
  );
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 50; i++) {
    const rows = await driver.query<any>('SELECT id FROM services WHERE slug = ? LIMIT 1', [slug]);
    if (!rows[0] || rows[0].id === excludeId) return slug;
    slug = `${slugify(base)}-${i + 2}`;
  }
  return `${slugify(base)}-${crypto.randomUUID().slice(0, 6)}`;
}

export interface ServiceInput {
  name: string;
  slug?: string;
  description?: string;
  durationMins?: number;
  bufferMins?: number;
  priceCents?: number;
  currency?: string;
  active?: boolean;
  metadata?: Record<string, any>;
}

export async function listServices(opts: { activeOnly?: boolean } = {}): Promise<Service[]> {
  await ensureSchema();
  const where = opts.activeOnly ? ' WHERE active = 1' : '';
  const rows = await driver.query<any>(`SELECT * FROM services${where} ORDER BY name ASC`);
  return rows.map(mapService);
}

export async function getService(idOrSlug: string): Promise<Service | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM services WHERE id = ? OR slug = ? LIMIT 1', [
    idOrSlug,
    idOrSlug,
  ]);
  return rows[0] ? mapService(rows[0]) : null;
}

export async function createService(input: ServiceInput): Promise<Service> {
  await ensureSchema();
  if (!input.name?.trim()) throw new Error('name is required');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const slug = await uniqueSlug(input.slug || input.name);
  await driver.run(
    `INSERT INTO services (id, slug, name, description, "durationMins", "bufferMins", "priceCents", currency, active, metadata, "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      input.name.trim(),
      input.description ?? null,
      Math.max(1, Math.round(input.durationMins ?? 30)),
      Math.max(0, Math.round(input.bufferMins ?? 0)),
      Math.max(0, Math.round(input.priceCents ?? 0)),
      (input.currency ?? 'usd').toLowerCase(),
      input.active === false ? 0 : 1,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now,
    ],
  );
  return (await getService(id))!;
}

export async function updateService(id: string, input: ServiceInput): Promise<Service | null> {
  await ensureSchema();
  const existing = await getService(id);
  if (!existing) return null;
  const slug = input.slug ? await uniqueSlug(input.slug, id) : existing.slug;
  const next = { ...existing, ...input, slug };
  await driver.run(
    `UPDATE services SET slug = ?, name = ?, description = ?, "durationMins" = ?, "bufferMins" = ?, "priceCents" = ?, currency = ?, active = ?, metadata = ?, "updatedAt" = ?
     WHERE id = ?`,
    [
      next.slug,
      next.name,
      next.description ?? null,
      Math.max(1, Math.round(next.durationMins ?? 30)),
      Math.max(0, Math.round(next.bufferMins ?? 0)),
      Math.max(0, Math.round(next.priceCents ?? 0)),
      (next.currency ?? 'usd').toLowerCase(),
      next.active === false ? 0 : 1,
      next.metadata ? JSON.stringify(next.metadata) : null,
      new Date().toISOString(),
      id,
    ],
  );
  return getService(id);
}

export async function deleteService(id: string): Promise<boolean> {
  await ensureSchema();
  const res = await driver.run('DELETE FROM services WHERE id = ?', [id]);
  return res.changes > 0;
}
