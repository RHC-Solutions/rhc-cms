import { getDriver } from './db';

/**
 * Schema for the platform modules layered on top of the core CMS tables created
 * in database.ts (pages / media / settings). Idempotent (CREATE … IF NOT EXISTS)
 * and memoized so the DDL runs once per process — the same lazy pattern as
 * CMSDatabase.ready(). Every module's data layer awaits ensureSchema() before
 * its first query.
 *
 * Portability rules (see CLAUDE.md → DB driver seam):
 *  - `?` placeholders (the PG driver rewrites to $n)
 *  - quote camelCase columns so Postgres doesn't fold them
 *  - TEXT timestamps (ISO strings), INTEGER for money (cents) and boolean flags
 *  - coerce COUNT(*) with Number(), use ON CONFLICT … DO UPDATE SET x = excluded.x
 */

const driver = getDriver();
let schemaPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) schemaPromise = migrate();
  return schemaPromise;
}

async function migrate(): Promise<void> {
  // --- Admin audit log -------------------------------------------------------
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT,
      "actorEmail" TEXT,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      ip TEXT,
      "createdAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log("createdAt" DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
  `);

  // --- Customer accounts -----------------------------------------------------
  // A separate population from the file-based admin users in users.json. These
  // are the storefront buyers / booking clients; potentially many, so DB-backed.
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      "passwordHash" TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      status TEXT NOT NULL DEFAULT 'active',
      phone TEXT,
      metadata TEXT,
      "lastLogin" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
  `);
}
