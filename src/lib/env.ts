/**
 * Site configuration and secrets. Everything lives in the `secrets` table of
 * cms-data/cms.db (managed in /admin/integrations and /admin/settings), never in
 * an .env file. Values Next.js needs as environment variables (NEXT_PUBLIC_*,
 * NEXTAUTH_*) are loaded from the same table by scripts/env-from-db.mjs when the
 * site is built and started.
 */

import * as path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'cms.db');
// Short cache: an admin save applies within seconds without a restart, including
// in other module instances (host vs admin panel) that keep their own cache.
const CACHE_TTL_MS = 5000;

/** Keys Next.js reads as environment variables at build and start time. */
export function isEnvKey(key: string): boolean {
  return key.startsWith('NEXT_PUBLIC_') || ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'REVALIDATE_SECRET'].includes(key);
}

let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)');
  }
  return db;
}

let cached: Record<string, string> | null = null;
let cachedAt = 0;

function loadAll(): Record<string, string> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const rows = store().prepare('SELECT key, value FROM secrets').all() as { key: string; value: string }[];
    cached = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (err) {
    console.error('[env] Failed to read the secrets table:', err);
    cached = cached || {};
  }
  cachedAt = Date.now();
  return cached;
}

/**
 * Get a configuration value: the real process environment first (set at build /
 * start from the database), then the database itself.
 */
export function getEnvValue(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  return loadAll()[key] ?? '';
}

/** Get several configuration values at once. */
export function getEnvValues(keys: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of keys) result[key] = getEnvValue(key);
  return result;
}

/** Whether a configuration value exists and is non-empty. */
export function hasEnvValue(key: string): boolean {
  return getEnvValue(key) !== '';
}

/** Drop the cache so the next read hits the database. */
export function clearEnvCache(): void {
  cached = null;
}

/**
 * Read a secret from the database (admin-editable without a restart), falling
 * back to the process environment. Returns '' when neither has a value.
 */
export function getSecret(key: string): string {
  const fromStore = loadAll()[key];
  if (typeof fromStore === 'string' && fromStore.trim() !== '') return fromStore.trim();
  return process.env[key] ? String(process.env[key]).trim() : '';
}

/**
 * Save secrets. Only entries whose value is a non-empty trimmed string are
 * written; empty/undefined entries are ignored so a form round-trip can't blank
 * out unrelated secrets.
 */
export function setSecrets(updates: Record<string, string | undefined>): void {
  const now = new Date().toISOString();
  const upsert = store().prepare(
    'INSERT INTO secrets (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt'
  );
  store().transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string' && v.trim() !== '') upsert.run(k, v.trim(), now);
    }
  })();
  cached = null;
}

/** Remove a secret. */
export function deleteSecret(key: string): void {
  store().prepare('DELETE FROM secrets WHERE key = ?').run(key);
  cached = null;
}

/** Every stored secret (a copy). */
export function listSecrets(): Record<string, string> {
  return { ...loadAll() };
}
