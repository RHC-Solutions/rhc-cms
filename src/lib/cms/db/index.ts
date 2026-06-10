import type { Driver, Dialect } from './driver';
import { createSqliteDriver } from './sqlite';
import { createPostgresDriver } from './postgres';

// Pick the backend: DB_DRIVER overrides; else Postgres when DATABASE_URL is a
// postgres URL; else SQLite (the zero-config default).
export function dbDialect(): Dialect {
  const explicit = (process.env.DB_DRIVER || '').toLowerCase();
  if (explicit === 'postgres' || explicit === 'sqlite') return explicit;
  return /^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL || '') ? 'postgres' : 'sqlite';
}

export function isSqlite(): boolean {
  return dbDialect() === 'sqlite';
}

let _driver: Driver | null = null;
export function getDriver(): Driver {
  if (!_driver) _driver = dbDialect() === 'postgres' ? createPostgresDriver() : createSqliteDriver();
  return _driver;
}

export type { Driver, Dialect } from './driver';
