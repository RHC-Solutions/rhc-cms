#!/usr/bin/env node
// Postgres-portability check for the cmsDb SQL contract, run against pg-mem (an
// in-memory Postgres) so we don't need a live server. Validates the dialect concerns
// that a SQLite-only dev box can't otherwise catch: `?`→`$n` translation, quoted
// camelCase columns surviving Postgres identifier folding, ON CONFLICT upsert, and
// COUNT(*) returning a bigint that Number() must coerce.
//   Run: node scripts/test-db-portability.mjs
import { newDb } from 'pg-mem';
import fs from 'node:fs';

let failures = 0;
const assert = (cond, msg) => { if (!cond) { failures++; console.error('  ✗', msg); } else console.log('  ✓', msg); };

// --- toPgPlaceholders: use the REAL function from source (no drift) ---
const src = fs.readFileSync(new URL('../src/lib/cms/db/postgres.ts', import.meta.url), 'utf8');
const m = src.match(/export function toPgPlaceholders\(sql: string\): string \{[\s\S]*?\n\}/);
if (!m) { console.error('could not extract toPgPlaceholders'); process.exit(2); }
const toPg = eval('(' + m[0].replace('export function', 'function').replace('(sql: string): string', '(sql)') + ')');

console.log('toPgPlaceholders:');
assert(toPg('a=? AND b=?') === 'a=$1 AND b=$2', '`?`→`$1..$n`');
assert(toPg('x IN (?,?,?)') === 'x IN ($1,$2,$3)', 'repeated placeholders');
assert(toPg('no params') === 'no params', 'no placeholders untouched');

// --- SQL contract against pg-mem (mirrors database.ts DDL + queries) ---
const db = newDb();
const { Pool } = db.adapters.createPg();
const pool = new Pool();
const q = async (sql, p = []) => (await pool.query(toPg(sql), p)).rows;

console.log('Postgres SQL contract (pg-mem):');
await pool.query(`CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
  category TEXT, status TEXT DEFAULT 'draft', "showInFooter" INTEGER DEFAULT 0,
  blocks TEXT, seo TEXT, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL)`);
await pool.query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
assert(true, 'DDL with quoted camelCase columns accepted');

const c = (await q('SELECT COUNT(*) as count FROM pages'))[0];
assert(Number(c.count) === 0, `COUNT(*) coerces via Number() (raw=${JSON.stringify(c.count)} typeof=${typeof c.count})`);

await q(`INSERT INTO pages (id,title,slug,description,category,status,"showInFooter",blocks,seo,"createdAt","updatedAt")
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ['home', 'Home', '/', 'd', 'main', 'published', 0, '[]', '{}', 't0', 't0']);
const row = (await q('SELECT * FROM pages WHERE slug = ? OR id = ? LIMIT 1', ['/', '/']))[0];
assert(row && 'showInFooter' in row && 'createdAt' in row && 'updatedAt' in row,
  `SELECT * preserves camelCase keys (got: ${row ? Object.keys(row).join(',') : 'no row'})`);
assert(row && row.slug === '/' && Number(row.showInFooter) === 0, 'row values correct');

await q(`INSERT INTO settings (key,value) VALUES (?,?)`, ['siteSettings', '{"a":1}']);
await q(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ['siteSettings', '{"a":2}']);
const s = (await q('SELECT value FROM settings WHERE key = ?', ['siteSettings']))[0];
assert(s && s.value === '{"a":2}', 'ON CONFLICT(key) DO UPDATE ... excluded.value upserts');

console.log(failures ? `\nFAILED (${failures})` : '\nPASS — Postgres SQL contract holds');
process.exit(failures ? 1 : 0);
