import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDriver } from './cms/db';
import { ensureSchema } from './cms/migrations';

/**
 * Customer accounts — the storefront / booking population, distinct from the
 * file-based admin users in src/lib/auth/users.ts. DB-backed (potentially many),
 * driver-portable. Passwords are bcrypt-hashed; guest customers may have a null
 * passwordHash (created at checkout without a login).
 */

const driver = getDriver();

export type CustomerRole = 'customer';
export type CustomerStatus = 'active' | 'disabled';

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  role: CustomerRole;
  status: CustomerStatus;
  phone: string | null;
  metadata: Record<string, any> | null;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function mapRow(r: any): Customer {
  return {
    id: r.id,
    email: r.email,
    name: r.name ?? null,
    role: (r.role as CustomerRole) ?? 'customer',
    status: (r.status as CustomerStatus) ?? 'active',
    phone: r.phone ?? null,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    lastLogin: r.lastLogin ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createCustomer(input: {
  email: string;
  name?: string;
  password?: string;
  phone?: string;
  metadata?: Record<string, any>;
}): Promise<Customer> {
  await ensureSchema();
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('email is required');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = input.password ? bcrypt.hashSync(input.password, 10) : null;
  await driver.run(
    `INSERT INTO customers (id, email, name, "passwordHash", role, status, phone, metadata, "lastLogin", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, 'customer', 'active', ?, ?, NULL, ?, ?)`,
    [
      id,
      email,
      input.name ?? null,
      passwordHash,
      input.phone ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now,
    ],
  );
  return (await getCustomer(id))!;
}

/** Create the customer if the email is new, otherwise return the existing row.
 *  Used at guest checkout where an account may or may not already exist. */
export async function findOrCreateCustomer(input: {
  email: string;
  name?: string;
  phone?: string;
}): Promise<Customer> {
  const existing = await findCustomerByEmail(input.email);
  if (existing) return existing;
  return createCustomer(input);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM customers WHERE email = ? LIMIT 1', [
    email.trim().toLowerCase(),
  ]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listCustomers(
  opts: { limit?: number; offset?: number } = {},
): Promise<{ customers: Customer[]; total: number }> {
  await ensureSchema();
  const totalRow = (await driver.query<{ count: any }>('SELECT COUNT(*) as count FROM customers'))[0];
  const total = Number(totalRow?.count ?? 0);
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    'SELECT * FROM customers ORDER BY "createdAt" DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );
  return { customers: rows.map(mapRow), total };
}

/** Verify credentials. Returns the customer (and stamps lastLogin) on success,
 *  null otherwise. Active accounts with a password only. */
export async function verifyCustomerPassword(
  email: string,
  password: string,
): Promise<Customer | null> {
  await ensureSchema();
  const rows = await driver.query<any>('SELECT * FROM customers WHERE email = ? LIMIT 1', [
    email.trim().toLowerCase(),
  ]);
  const row = rows[0];
  if (!row || !row.passwordHash || row.status !== 'active') return null;
  if (!bcrypt.compareSync(password, row.passwordHash)) return null;
  await driver.run('UPDATE customers SET "lastLogin" = ? WHERE id = ?', [
    new Date().toISOString(),
    row.id,
  ]);
  return mapRow(row);
}

export async function setCustomerPassword(id: string, password: string): Promise<void> {
  await ensureSchema();
  const hash = bcrypt.hashSync(password, 10);
  await driver.run('UPDATE customers SET "passwordHash" = ?, "updatedAt" = ? WHERE id = ?', [
    hash,
    new Date().toISOString(),
    id,
  ]);
}

export async function updateCustomer(
  id: string,
  updates: Partial<Pick<Customer, 'name' | 'status' | 'phone' | 'metadata'>>,
): Promise<Customer | null> {
  await ensureSchema();
  const existing = await getCustomer(id);
  if (!existing) return null;
  const next = { ...existing, ...updates };
  await driver.run(
    `UPDATE customers SET name = ?, status = ?, phone = ?, metadata = ?, "updatedAt" = ? WHERE id = ?`,
    [
      next.name,
      next.status,
      next.phone,
      next.metadata ? JSON.stringify(next.metadata) : null,
      new Date().toISOString(),
      id,
    ],
  );
  return getCustomer(id);
}
