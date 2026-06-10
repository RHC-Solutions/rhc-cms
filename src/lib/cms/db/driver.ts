// Minimal data-layer driver seam so cmsDb (src/lib/cms/database.ts) runs on either
// SQLite (default, file-based) or Postgres (opt-in via DATABASE_URL). One portable set
// of SQL strings lives in database.ts; the driver handles dialect differences
// (placeholder style, WAL). All methods are async — the cmsDb API already is.

export type Dialect = 'sqlite' | 'postgres';

export interface Driver {
  dialect: Dialect;
  /** SELECT — returns rows. */
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  /** INSERT/UPDATE/DELETE — returns affected row count as { changes }. */
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** DDL / multi-statement, no params. */
  exec(sql: string): Promise<void>;
}
