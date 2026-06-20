import { Pool } from 'pg';

/**
 * Validate a Postgres connection string by opening one short-lived connection
 * and running SELECT 1. Used by the first-run setup wizard so an admin choosing
 * Postgres gets immediate feedback instead of a broken app after restart.
 */
export async function validatePostgresUrl(url: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return { ok: false, error: 'Not a postgres:// connection string' };
  }
  const needsSsl = /sslmode=require/i.test(url);
  const pool = new Pool({
    connectionString: url,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 6000,
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Connection failed' };
  } finally {
    await pool.end().catch(() => {});
  }
}
