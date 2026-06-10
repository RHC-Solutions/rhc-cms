import { Pool } from 'pg';
import type { Driver } from './driver';

// Convert portable `?` placeholders to Postgres `$1..$n`. Our SQL has no literal `?`,
// so a positional replace is safe.
export function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Postgres driver — pg Pool from DATABASE_URL. Connects lazily on first query.
export function createPostgresDriver(): Driver {
  const connectionString = process.env.DATABASE_URL;
  const needsSsl = /sslmode=require/i.test(connectionString || '') || /^require$/i.test(process.env.PGSSLMODE || '');
  const pool = new Pool({ connectionString, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  return {
    dialect: 'postgres',
    async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
      const res = await pool.query(toPgPlaceholders(sql), params as any[]);
      return res.rows as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const res = await pool.query(toPgPlaceholders(sql), params as any[]);
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string): Promise<void> {
      await pool.query(sql);
    },
  };
}
