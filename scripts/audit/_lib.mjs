/**
 * Shared helpers for the daily/weekly audit scripts (scripts/audit/*).
 *
 * Deliberately dependency-light and self-contained: these run from cron via the
 * `claude` CLI orchestrators, so they must work without a Next.js runtime.
 * Secret resolution mirrors src/lib/env.ts:getSecret (secrets.json wins, then
 * .env.local) so the same SMTP/PSI credentials work here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SECRETS_PATH = path.join(REPO_ROOT, 'cms-data', 'secrets.json');
const ENV_PATH = path.join(REPO_ROOT, '.env.local');

let _secrets = null;
function loadSecrets() {
  if (_secrets) return _secrets;
  try {
    const raw = fs.readFileSync(SECRETS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      _secrets = parsed;
      return _secrets;
    }
  } catch {
    /* missing/malformed — fall through */
  }
  _secrets = {};
  return _secrets;
}

let _env = null;
function loadEnv() {
  if (_env) return _env;
  _env = {};
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) _env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env.local — fine */
  }
  return _env;
}

/** secrets.json → .env.local → process.env, first non-empty wins. */
export function getSecret(key) {
  const s = loadSecrets()[key];
  if (typeof s === 'string' && s.trim() !== '') return s.trim();
  const e = loadEnv()[key];
  if (typeof e === 'string' && e.trim() !== '') return e.trim();
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
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(path.join(REPO_ROOT, 'cms-data', 'cms.db'), { readonly: true });
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
