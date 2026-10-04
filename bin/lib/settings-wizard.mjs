// Interactive settings wizard for `admin-panel init` / `admin-panel settings`.
//
// Settings are stored in the host's database (the `secrets` table of
// cms-data/cms.db), never in an .env file. The prompt flow (runSettingsWizard),
// the database helpers and the package.json script wrapper live here, separate
// from the CLI entrypoint, so they can be unit-tested by piping a Readable (no TTY
// needed) without triggering the CLI's top-level command dispatch.
// Node built-ins only; the database is opened with the host's better-sqlite3, or
// Node's built-in node:sqlite when the host's dependencies aren't installed.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createRequire } from 'node:module';

// The settings the wizard asks for. Everything else (email, Telegram, analytics,
// Cloudflare…) is configured in /admin → Settings → Integrations.
export const CORE_KEYS = ['NEXTAUTH_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_SECRET', 'DATABASE_URL'];

// Example values offered as prompt defaults. They are never stored.
export const looksPlaceholder = (v) => /your-domain|example\.com/i.test(String(v));

const UPSERT =
  'INSERT INTO secrets (key, value, updatedAt) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt';

// Open (creating if needed) the settings table in <dataRoot>/cms-data/cms.db.
// better-sqlite3 is resolved from the host (siteRoot), where `init` installs it.
export async function openSettingsDb({ siteRoot, dataRoot = siteRoot }) {
  const file = path.join(dataRoot, 'cms-data', 'cms.db');
  const created = !fs.existsSync(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let db;
  try {
    const Database = createRequire(path.join(siteRoot, 'package.json'))('better-sqlite3');
    db = new Database(file);
  } catch {
    let DatabaseSync;
    try {
      ({ DatabaseSync } = await import('node:sqlite'));
    } catch {
      throw new Error('Could not open cms-data/cms.db: install the panel dependencies (run init without --no-install) and retry.');
    }
    db = new DatabaseSync(file);
  }
  // A new database holds secrets: owner-only until the operator widens it.
  if (created) fs.chmodSync(file, 0o600);
  db.exec('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL, updatedAt TEXT NOT NULL)');
  return {
    file,
    get(key) {
      const row = db.prepare('SELECT value FROM secrets WHERE key = ?').get(key);
      return row ? String(row.value) : '';
    },
    set(values) {
      const upsert = db.prepare(UPSERT);
      const now = new Date().toISOString();
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === 'string' && v.trim() !== '') upsert.run(k, v.trim(), now);
      }
    },
    close() {
      db.close();
    },
  };
}

// Route a package.json script's `next dev|build|start` through the panel's settings
// loader, keeping any env prefix (NODE_ENV=production) and chained steps. Returns the
// script unchanged when it is already wired or has no `next` command to wrap.
export function wrapNextScript(script, loader) {
  if (typeof script !== 'string' || script.includes('env-from-db.mjs')) return script;
  return script.replace(
    /(^|&&\s*|;\s*)((?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*)next\s+(dev|build|start)\b/,
    (_m, pre, envs, sub) => `${pre}${envs}${loader} next ${sub}`
  );
}

// Prompt the operator for the core settings. `current` holds values already stored
// (offered as defaults so a re-run keeps them); `input`/`output` default to the
// process streams but are injectable for testing. Returns a { KEY: value } map.
export async function runSettingsWizard({ current = {}, secret, input, output, banner }) {
  const rl = readline.createInterface({ input, output });
  // If stdin hits EOF mid-wizard (e.g. a disconnected terminal or truncated pipe), readline
  // closes and further question() calls throw ERR_USE_AFTER_CLOSE. Treat that as "no answer"
  // so the wizard finishes with defaults instead of crashing the installer with a stack trace.
  const q = async (prompt) => {
    try { return await rl.question(prompt); }
    catch (e) { if (e && e.code === 'ERR_USE_AFTER_CLOSE') return ''; throw e; }
  };
  const ask = async (prompt, def = '') => { const a = (await q(`${prompt} [${def}]: `)).trim(); return a || def; };
  const ans = {};
  try {
    if (banner) banner();
    ans.NEXTAUTH_URL = await ask('  Admin URL  ·  NEXTAUTH_URL', current.NEXTAUTH_URL || 'https://admin.your-domain.com');
    ans.NEXT_PUBLIC_SITE_URL = await ask('  Public site URL  ·  NEXT_PUBLIC_SITE_URL', current.NEXT_PUBLIC_SITE_URL || 'https://your-domain.com');
    if (current.NEXTAUTH_SECRET) {
      // Replacing the secret signs everyone out, so keeping it is the default.
      const rot = (await q('  Keep the current NEXTAUTH_SECRET? [Y/n]: ')).trim().toLowerCase();
      ans.NEXTAUTH_SECRET = rot === 'n' || rot === 'no' ? secret : current.NEXTAUTH_SECRET;
    } else {
      const gen = (await q('  Auto-generate a secure NEXTAUTH_SECRET? [Y/n]: ')).trim().toLowerCase();
      ans.NEXTAUTH_SECRET = (gen === 'n' || gen === 'no')
        ? ((await q('  Enter NEXTAUTH_SECRET: ')).trim() || secret)
        : secret;
    }
    // Blank = SQLite, the zero-config default (cms-data/cms.db).
    ans.DATABASE_URL = (await q(`  Postgres DATABASE_URL  ·  blank = SQLite (zero-config default)${current.DATABASE_URL ? ' [keep current]' : ''}: `)).trim()
      || current.DATABASE_URL || '';
  } finally {
    rl.close();
  }
  return ans;
}
