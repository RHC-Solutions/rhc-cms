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

  // --- E-commerce: products -------------------------------------------------
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      "priceCents" INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      images TEXT,
      category TEXT,
      "trackStock" INTEGER NOT NULL DEFAULT 0,
      stock INTEGER,
      metadata TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  `);

  // --- E-commerce: product variants (optional per product) ------------------
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      "productId" TEXT NOT NULL,
      label TEXT NOT NULL,
      sku TEXT,
      "priceCents" INTEGER,
      stock INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants("productId");
  `);

  // --- E-commerce: orders ---------------------------------------------------
  // items / shipping are JSON snapshots; money in integer cents. Stock is
  // decremented when the order transitions to 'paid'.
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      "orderNumber" TEXT UNIQUE NOT NULL,
      "customerId" TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      "subtotalCents" INTEGER NOT NULL DEFAULT 0,
      "totalCents" INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      items TEXT,
      shipping TEXT,
      notes TEXT,
      "stripeSessionId" TEXT,
      "stripePaymentIntent" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders("createdAt" DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders("customerId");
    CREATE INDEX IF NOT EXISTS idx_orders_session ON orders("stripeSessionId");
  `);

  // --- Generic per-module settings (key/value JSON) -------------------------
  // Used by booking availability, i18n locale config, gift-card settings, etc.
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS module_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);

  // --- Booking: services ----------------------------------------------------
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      "durationMins" INTEGER NOT NULL DEFAULT 30,
      "bufferMins" INTEGER NOT NULL DEFAULT 0,
      "priceCents" INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'usd',
      active INTEGER NOT NULL DEFAULT 1,
      metadata TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);
    CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
  `);

  // --- Booking: appointments ------------------------------------------------
  // Times stored as ISO-8601 UTC. serviceName is snapshotted so renaming a
  // service doesn't rewrite past bookings.
  await driver.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      "serviceId" TEXT,
      "serviceName" TEXT,
      "customerId" TEXT,
      "customerName" TEXT,
      "customerEmail" TEXT,
      "customerPhone" TEXT,
      "startsAt" TEXT NOT NULL,
      "endsAt" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      notes TEXT,
      "priceCents" INTEGER,
      currency TEXT,
      "googleEventId" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    )
  `);
  await driver.exec(`
    CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments("startsAt");
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments("serviceId");
    CREATE INDEX IF NOT EXISTS idx_appointments_email ON appointments("customerEmail");
  `);
}
