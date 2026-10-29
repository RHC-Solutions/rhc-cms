/**
 * Generic per-module settings, stored as JSON in the `module_settings` table of
 * cms-data/cms.db (created on first use). Keep keys namespaced, e.g.
 * 'cloudpanel.config'. Same table and API as the product line, so an upgrade
 * finds its settings where it expects them.
 */

import * as path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'cms.db');

let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE IF NOT EXISTS module_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, "updatedAt" TEXT NOT NULL)');
  }
  return db;
}

export async function getModuleSetting<T>(key: string, fallback: T): Promise<T> {
  const row = store().prepare('SELECT value FROM module_settings WHERE key = ? LIMIT 1').get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setModuleSetting(key: string, value: unknown): Promise<void> {
  store()
    .prepare(
      `INSERT INTO module_settings (key, value, "updatedAt") VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"`,
    )
    .run(key, JSON.stringify(value), new Date().toISOString());
}
