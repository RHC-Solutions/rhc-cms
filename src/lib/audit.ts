/**
 * Admin audit log: an append-only record of who did what, when, in the
 * `audit_log` table of cms-data/cms.db (created on first use, same shape as the
 * product line). recordAudit() is best-effort and never throws into the
 * caller's request flow; a failed audit write must not break the action.
 */

import crypto from 'crypto';
import * as path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'cms.db');

let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        actor TEXT,
        "actorEmail" TEXT,
        action TEXT NOT NULL,
        target TEXT,
        detail TEXT,
        ip TEXT,
        "createdAt" TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log("createdAt" DESC);
    `);
  }
  return db;
}

export interface RecordAuditInput {
  actor?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  detail?: Record<string, any> | null;
  ip?: string | null;
}

/** Append an audit entry. Best-effort — logs and swallows errors. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    store()
      .prepare(
        `INSERT INTO audit_log (id, actor, "actorEmail", action, target, detail, ip, "createdAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        input.actor ?? null,
        input.actorEmail ?? null,
        input.action,
        input.target ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
        input.ip ?? null,
        new Date().toISOString(),
      );
  } catch (err) {
    console.error('[audit] failed to record entry', err);
  }
}
