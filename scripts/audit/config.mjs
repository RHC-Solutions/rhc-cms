/**
 * Read/merge the audit automation config (cms-data/automation.json), the control
 * surface the admin panel (/admin/automation) writes and the cron orchestrators
 * read. Falls back to sane defaults when the file is absent or partial.
 *
 * Shell usage:  node scripts/audit/config.mjs get daily.enabled   -> "true"
 *               node scripts/audit/config.mjs get recipientEmail  -> ""
 * JS usage:     import { loadConfig, DEFAULTS } from './config.mjs'
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './_lib.mjs';

export const CONFIG_PATH = path.join(REPO_ROOT, 'cms-data', 'automation.json');

export const DEFAULTS = {
  daily: { enabled: true, autofix: 'pr' }, // autofix: 'pr' (open PR) | 'off' (report only)
  weekly: { enabled: true },               // weekly safe (patch+minor) dependency PR
  recipientEmail: '',                      // '' => fall back to ADMIN_EMAIL
};

export function loadConfig() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    /* missing/malformed -> defaults */
  }
  return {
    daily: { ...DEFAULTS.daily, ...(raw.daily || {}) },
    weekly: { ...DEFAULTS.weekly, ...(raw.weekly || {}) },
    recipientEmail: typeof raw.recipientEmail === 'string' ? raw.recipientEmail : DEFAULTS.recipientEmail,
    updatedAt: raw.updatedAt || null,
  };
}

/** Persist a sanitized config (used by the admin API; kept here as the SoT). */
export function saveConfig(input) {
  const next = {
    daily: {
      enabled: input?.daily?.enabled !== false,
      autofix: input?.daily?.autofix === 'off' ? 'off' : 'pr',
    },
    weekly: { enabled: input?.weekly?.enabled !== false },
    recipientEmail: typeof input?.recipientEmail === 'string' ? input.recipientEmail.trim() : '',
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  try { fs.chmodSync(CONFIG_PATH, 0o660); } catch { /* best effort */ }
  return next;
}

function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('config.mjs')) {
  const [cmd, key] = process.argv.slice(2);
  if (cmd === 'get') {
    const v = dig(loadConfig(), key);
    process.stdout.write(v === undefined || v === null ? '' : String(v));
  } else {
    process.stdout.write(JSON.stringify(loadConfig()));
  }
}
