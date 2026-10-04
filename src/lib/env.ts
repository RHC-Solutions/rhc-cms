/**
 * Site configuration and secrets. Everything lives in the `secrets` table of
 * cms-data/cms.db (managed in /admin/settings → Integrations and Environment),
 * never in an .env file. Values Next.js needs as environment variables
 * (NEXT_PUBLIC_*, NEXTAUTH_*, the database connection) are loaded from the same
 * table by scripts/env-from-db.mjs when the site is built and started.
 *
 * The table is always in the local SQLite file, also when CMS content runs on
 * Postgres. A cms-data/secrets.json left by an older version is moved into it
 * on first use.
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { decryptSecret } from './crypto/secret-box';

const DATA_DIR = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data');
const DB_PATH = path.join(DATA_DIR, 'cms.db');
const LEGACY_SECRETS_PATH = path.join(DATA_DIR, 'secrets.json');
// Short cache: an admin save applies within seconds without a restart, including
// in other module instances that keep their own cache.
const CACHE_TTL_MS = 5000;

const ENV_KEYS = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'REVALIDATE_SECRET', 'DATABASE_URL', 'DB_DRIVER', 'PGSSLMODE'];

/** Keys Next.js reads as environment variables at build and start time. */
export function isEnvKey(key: string): boolean {
  return key.startsWith('NEXT_PUBLIC_') || ENV_KEYS.includes(key);
}

let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.exec('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)');
    importLegacySecrets(db);
  }
  return db;
}

// Older versions kept admin-managed secrets in cms-data/secrets.json, encrypted
// with a key derived from NEXTAUTH_SECRET. Move them into the table once (values
// already in the table win), then delete the file. If any value can't be
// decrypted, the file is kept so nothing is lost.
function importLegacySecrets(conn: Database.Database): void {
  let legacy: unknown;
  try {
    legacy = JSON.parse(fs.readFileSync(LEGACY_SECRETS_PATH, 'utf-8'));
  } catch {
    return; // no legacy file: the normal case
  }
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return;
  const insert = conn.prepare('INSERT OR IGNORE INTO secrets (key, value, updatedAt) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  let unreadable = 0;
  conn.transaction(() => {
    for (const [key, stored] of Object.entries(legacy as Record<string, unknown>)) {
      if (typeof stored !== 'string' || stored === '') continue;
      const value = decryptSecret(stored);
      if (value === '') unreadable++;
      else insert.run(key, value, now);
    }
  })();
  if (unreadable) {
    console.error(`[env] ${unreadable} value(s) in cms-data/secrets.json could not be decrypted; the file was kept.`);
    return;
  }
  try {
    fs.unlinkSync(LEGACY_SECRETS_PATH);
    console.log('[env] Moved cms-data/secrets.json into the database and removed the file.');
  } catch {
    /* another process removed it first */
  }
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

const UPSERT =
  'INSERT INTO secrets (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt';

/**
 * Get a configuration value: the real process environment first (set at build /
 * start from the database), then the database itself.
 */
export function getEnvValue(key: string): string {
  if (process.env[key]) return process.env[key] as string;
  return loadAll()[key] ?? '';
}

/**
 * Store a single configuration value. Shared by the environment admin route and
 * the first-run provisioning endpoint. NOTE: NEXT_PUBLIC_* and NEXTAUTH_* values
 * only take effect after the next build and restart.
 */
export function setEnvValue(key: string, value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`Invalid setting name: ${JSON.stringify(key)}`);
  }
  store().prepare(UPSERT).run(key, value, new Date().toISOString());
  cached = null;
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
 * Write secrets to the database. Only entries whose value is a non-empty trimmed
 * string are written; empty/undefined entries are ignored so the form pre-fill
 * round-trip doesn't blank out unrelated secrets.
 */
export function setSecrets(updates: Record<string, string | undefined>): void {
  const conn = store();
  const upsert = conn.prepare(UPSERT);
  const now = new Date().toISOString();
  conn.transaction(() => {
    for (const [k, v] of Object.entries(updates)) {
      if (typeof v === 'string' && v.trim() !== '') upsert.run(k, v.trim(), now);
    }
  })();
  cached = null;
}

/** Remove a secret from the database. */
export function deleteSecret(key: string): void {
  store().prepare('DELETE FROM secrets WHERE key = ?').run(key);
  cached = null;
}

/**
 * Return a shallow copy of every value stored in the database. Does NOT include
 * process-environment fallbacks; callers that want the merged view should use
 * `getSecret` per key.
 */
export function listSecrets(): Record<string, string> {
  return { ...loadAll() };
}
