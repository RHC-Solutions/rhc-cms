import { getDriver } from './cms/db';
import { ensureSchema } from './cms/migrations';

/**
 * Generic per-module settings, stored as JSON in the module_settings KV table.
 * Used by booking availability, i18n locale config, gift-card settings, etc.
 * Keep keys namespaced, e.g. 'booking.availability', 'i18n.config'.
 */

const driver = getDriver();

export async function getModuleSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureSchema();
  const rows = await driver.query<{ value: string }>(
    'SELECT value FROM module_settings WHERE key = ? LIMIT 1',
    [key],
  );
  if (!rows[0]) return fallback;
  try {
    return JSON.parse(rows[0].value) as T;
  } catch {
    return fallback;
  }
}

export async function setModuleSetting(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await driver.run(
    `INSERT INTO module_settings (key, value, "updatedAt") VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}
