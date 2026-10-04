#!/usr/bin/env node
/**
 * Runs a command with the site's settings loaded from the database
 * (cms-data/cms.db, `secrets` table). The site keeps no .env file.
 *
 *   node scripts/env-from-db.mjs next build
 *   node scripts/env-from-db.mjs next start -p 3003 -H 0.0.0.0
 *
 * A host site that embeds the panel runs it from the submodule
 * (node vendor/admin-panel/scripts/env-from-db.mjs next build). The database is
 * found from the working directory, or from SHARED_ROOT when the data lives
 * elsewhere.
 *
 * Only the keys Next.js reads as environment variables are passed on
 * (NEXT_PUBLIC_*, NEXTAUTH_*, REVALIDATE_SECRET and the database connection).
 * Everything else stays in the database and is read at runtime through
 * getSecret() in src/lib/env.ts.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.env.SHARED_ROOT || process.cwd(), 'cms-data', 'cms.db');
const ENV_KEYS = ['NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'REVALIDATE_SECRET', 'DATABASE_URL', 'DB_DRIVER', 'PGSSLMODE'];
const isEnvKey = (k) => k.startsWith('NEXT_PUBLIC_') || ENV_KEYS.includes(k);

const fromDb = {};
try {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  for (const { key, value } of db.prepare('SELECT key, value FROM secrets').all()) {
    if (isEnvKey(key)) fromDb[key] = value;
  }
  db.close();
} catch (e) {
  console.error(`[env-from-db] no settings loaded from ${DB_PATH}: ${e.message}`);
}

// An admin that runs on its own address against another site's data (SHARED_ROOT)
// shares that site's table, whose NEXTAUTH_URL is the other site's address. The
// NEXTAUTH_URL its own process definition sets wins.
if (process.env.SHARED_ROOT && process.env.NEXTAUTH_URL) delete fromDb.NEXTAUTH_URL;

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: node scripts/env-from-db.mjs <command> [args...]');
  process.exit(2);
}

// The database is the single source of truth for these keys.
const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...fromDb } });
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => child.kill(sig));
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
