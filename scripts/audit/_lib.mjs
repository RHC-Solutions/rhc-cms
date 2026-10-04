/**
 * Shared helpers for the daily/weekly audit scripts (scripts/audit/*).
 *
 * Deliberately dependency-light and self-contained: these run from cron via the
 * `claude` CLI orchestrators, so they must work without a Next.js runtime.
 * Secret resolution mirrors src/lib/env.ts:getSecret (the site database's
 * secrets table, then process.env) so the same SMTP/PSI credentials work here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SECRETS_DB = path.join(process.env.SHARED_ROOT || REPO_ROOT, 'cms-data', 'cms.db');
const require = createRequire(import.meta.url);

let _secrets = null;
function loadSecrets() {
  if (_secrets) return _secrets;
  _secrets = {};
  try {
    const Database = require('better-sqlite3');
    const db = new Database(SECRETS_DB, { readonly: true, fileMustExist: true });
    for (const { key, value } of db.prepare('SELECT key, value FROM secrets').all()) _secrets[key] = value;
    db.close();
  } catch {
    /* no database yet — fall through to the process env */
  }
  return _secrets;
}

/** The site database (`secrets` table) → process.env, first non-empty wins. */
export function getSecret(key) {
  const s = loadSecrets()[key];
  if (typeof s === 'string' && s.trim() !== '') return s.trim();
  return process.env[key] ? String(process.env[key]).trim() : '';
}

export const LOCAL_BASE = process.env.AUDIT_LOCAL_BASE || 'http://localhost:3001';
export const PUBLIC_BASE = (getSecret('NEXT_PUBLIC_SITE_URL') || 'https://rhcsolutions.com').replace(/\/$/, '');

/** Local YYYY-MM-DD. */
export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** logs/audit/<date>, created if missing. Date defaults to today(). */
export function auditDir(date = today()) {
  const dir = path.join(REPO_ROOT, 'logs', 'audit', date);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeArtifact(name, obj, date = today()) {
  const file = path.join(auditDir(date), name);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
  return file;
}

export function readArtifact(name, date = today()) {
  try {
    return JSON.parse(fs.readFileSync(path.join(auditDir(date), name), 'utf-8'));
  } catch {
    return null;
  }
}

/** fetch with a hard timeout; returns { ok, status, text, error }. */
export async function fetchText(url, { timeoutMs = 20000, headers } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers, redirect: 'follow' });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: res.headers };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: e?.message || String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Open cms.db read-only and return published page rows with parsed seo. */
export async function loadPages() {
  // Postgres mode (or before first run) has no cms.db file — degrade to empty so the
  // SEO/AI collectors don't crash. (A PG-aware reader is a follow-up.)
  const dbFile = path.join(REPO_ROOT, 'cms-data', 'cms.db');
  if (!fs.existsSync(dbFile)) return [];
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(dbFile, { readonly: true });
  try {
    const rows = db.prepare('SELECT id, title, slug, status, description, seo FROM pages').all();
    return rows.map((r) => {
      let seo = {};
      try {
        seo = r.seo ? JSON.parse(r.seo) : {};
      } catch {
        seo = { _parseError: true };
      }
      return { ...r, seo };
    });
  } finally {
    db.close();
  }
}

export function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}
