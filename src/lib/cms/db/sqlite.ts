import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import type { Driver } from './driver';

// SQLite driver — wraps better-sqlite3 (synchronous) in the async Driver interface.
// Native `?` placeholders. Opens the db (and ensures cms-data/) on creation.
export function createSqliteDriver(): Driver {
  const dataDir = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'cms.db'));
  db.pragma('journal_mode = WAL');
  return {
    dialect: 'sqlite',
    async query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(params) as T[];
    },
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const info = db.prepare(sql).run(params);
      return { changes: info.changes };
    },
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
  };
}
