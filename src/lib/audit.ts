import crypto from 'crypto';
import { getDriver } from './cms/db';
import { ensureSchema } from './cms/migrations';

/**
 * Admin audit log. Append-only record of who did what, when — for security
 * forensics and accountability. recordAudit() is best-effort and never throws
 * into the caller's request flow; a failed audit write must not break the
 * action being audited.
 */

const driver = getDriver();

export interface AuditEntry {
  id: string;
  actor: string | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  detail: Record<string, any> | null;
  ip: string | null;
  createdAt: string;
}

export interface RecordAuditInput {
  actor?: string | null;
  actorEmail?: string | null;
  action: string;
  target?: string | null;
  detail?: Record<string, any> | null;
  ip?: string | null;
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Append an audit entry. Best-effort — logs and swallows errors. */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await ensureSchema();
    await driver.run(
      `INSERT INTO audit_log (id, actor, "actorEmail", action, target, detail, ip, "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        input.actor ?? null,
        input.actorEmail ?? null,
        input.action,
        input.target ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
        input.ip ?? null,
        new Date().toISOString(),
      ],
    );
  } catch (err) {
    console.error('[audit] failed to record entry', err);
  }
}

export interface ListAuditOptions {
  limit?: number;
  offset?: number;
  actor?: string;
  action?: string;
}

export async function listAudit(
  opts: ListAuditOptions = {},
): Promise<{ entries: AuditEntry[]; total: number }> {
  await ensureSchema();

  const conditions: string[] = [];
  const params: any[] = [];
  if (opts.actor) {
    conditions.push('actor = ?');
    params.push(opts.actor);
  }
  if (opts.action) {
    conditions.push('action = ?');
    params.push(opts.action);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

  const totalRow = (
    await driver.query<{ count: any }>(`SELECT COUNT(*) as count FROM audit_log${where}`, params)
  )[0];
  const total = Number(totalRow?.count ?? 0);

  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  const offset = Math.max(0, opts.offset ?? 0);
  const rows = await driver.query<any>(
    `SELECT * FROM audit_log${where} ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    actor: r.actor ?? null,
    actorEmail: r.actorEmail ?? null,
    action: r.action,
    target: r.target ?? null,
    detail: r.detail ? safeParse(r.detail) : null,
    ip: r.ip ?? null,
    createdAt: r.createdAt,
  }));

  return { entries, total };
}
