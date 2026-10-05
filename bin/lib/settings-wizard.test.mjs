// Tests for the install settings wizard. Run: `node --test bin/lib/settings-wizard.test.mjs`
// Built-ins only. The better-sqlite3 case is skipped gracefully if it isn't installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable, Readable } from 'node:stream';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSettingsWizard, openSettingsDb, wrapNextScript, looksPlaceholder } from './settings-wizard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

// Feed one answer per readline prompt (1 prompt write == 1 question); '' once exhausted.
function feed(answers) {
  const input = new PassThrough();
  let i = 0;
  const output = new Writable({ write(_c, _e, cb) { const a = i < answers.length ? answers[i++] : ''; setImmediate(() => input.write(a + '\n')); cb(); } });
  return { input, output };
}
const sink = () => new Writable({ write(_c, _e, cb) { cb(); } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'settingswiz-'));

test('wrapNextScript: wraps next dev/build/start, keeps env prefix and chained steps', () => {
  const L = 'node vendor/admin-panel/scripts/env-from-db.mjs';
  assert.equal(wrapNextScript('next build', L), `${L} next build`);
  assert.equal(wrapNextScript('next dev --turbopack', L), `${L} next dev --turbopack`);
  assert.equal(wrapNextScript('NODE_ENV=production next start -p 3001', L), `NODE_ENV=production ${L} next start -p 3001`);
  assert.equal(wrapNextScript('next build && node scripts/x.mjs', L), `${L} next build && node scripts/x.mjs`);
  assert.equal(wrapNextScript('rm -rf .next && next build', L), `rm -rf .next && ${L} next build`);
});

test('wrapNextScript: leaves wired or non-next scripts alone', () => {
  const L = 'node vendor/admin-panel/scripts/env-from-db.mjs';
  assert.equal(wrapNextScript(`${L} next build`, L), `${L} next build`);
  assert.equal(wrapNextScript('node server.js', L), 'node server.js');
  assert.equal(wrapNextScript('cross-env NODE_ENV=production next start', L), 'cross-env NODE_ENV=production next start');
  assert.equal(wrapNextScript(undefined, L), undefined);
});

test('looksPlaceholder: flags the example domains only', () => {
  assert.ok(looksPlaceholder('https://admin.your-domain.com'));
  assert.ok(looksPlaceholder('https://example.com'));
  assert.ok(!looksPlaceholder('https://acme.test'));
});

test('runSettingsWizard: core path with a generated secret', async () => {
  const { input, output } = feed(['https://admin.acme.test', 'https://acme.test', '', '']);
  const ans = await runSettingsWizard({ secret: 'SEC', input, output });
  assert.equal(ans.NEXTAUTH_URL, 'https://admin.acme.test');
  assert.equal(ans.NEXT_PUBLIC_SITE_URL, 'https://acme.test');
  assert.equal(ans.NEXTAUTH_SECRET, 'SEC');
  assert.equal(ans.DATABASE_URL, '');                 // blank = SQLite
});

test('runSettingsWizard: manual secret + postgres', async () => {
  const { input, output } = feed(['https://admin.b.test', 'https://b.test', 'n', 'mysecret123', 'postgres://u:p@h/db']);
  const ans = await runSettingsWizard({ secret: 'GEN', input, output });
  assert.equal(ans.NEXTAUTH_SECRET, 'mysecret123');
  assert.equal(ans.DATABASE_URL, 'postgres://u:p@h/db');
});

test('runSettingsWizard: a re-run keeps stored values and the current secret by default', async () => {
  const current = { NEXTAUTH_URL: 'https://admin.c.test', NEXT_PUBLIC_SITE_URL: 'https://c.test', NEXTAUTH_SECRET: 'OLD', DATABASE_URL: 'postgres://c/db' };
  const kept = await runSettingsWizard({ current, secret: 'NEW', ...feed(['', '', '', '']) });
  assert.deepEqual(kept, current);
  const rotated = await runSettingsWizard({ current, secret: 'NEW', ...feed(['', '', 'n', '']) });
  assert.equal(rotated.NEXTAUTH_SECRET, 'NEW');
});

test('runSettingsWizard: EOF mid-wizard resolves with defaults (no ERR_USE_AFTER_CLOSE)', async () => {
  // Readable.from() ends immediately → readline closes; the wizard must NOT throw.
  const ans = await runSettingsWizard({ secret: 'SEC', input: Readable.from('https://only-one\n'), output: sink() });
  assert.equal(typeof ans, 'object');
  assert.equal(ans.NEXTAUTH_SECRET, 'SEC');           // always set, even on early EOF
  assert.ok(ans.NEXTAUTH_URL && ans.NEXT_PUBLIC_SITE_URL); // fell back to defaults, didn't crash
});

test('openSettingsDb (node:sqlite fallback): creates the table owner-only, upserts, skips blanks', async () => {
  const site = tmp();
  try {
    fs.writeFileSync(path.join(site, 'package.json'), '{"name":"host"}');
    const db = await openSettingsDb({ siteRoot: site }); // no node_modules here → node:sqlite
    db.set({ NEXTAUTH_SECRET: 'a$b"c', NEXTAUTH_URL: 'https://x.test', DATABASE_URL: '' });
    db.set({ NEXTAUTH_URL: 'https://y.test' });
    assert.equal(db.get('NEXTAUTH_SECRET'), 'a$b"c');   // stored verbatim, no escaping needed
    assert.equal(db.get('NEXTAUTH_URL'), 'https://y.test');
    assert.equal(db.get('DATABASE_URL'), '');           // blank values are not written
    db.close();
    assert.equal(fs.statSync(path.join(site, 'cms-data', 'cms.db')).mode & 0o777, 0o600);
    assert.ok(!fs.existsSync(path.join(site, '.env.local')));
  } finally {
    fs.rmSync(site, { recursive: true, force: true });
  }
});

test('openSettingsDb (better-sqlite3): same table, readable by the app', async () => {
  try { createRequire(path.join(repoRoot, 'package.json'))('better-sqlite3'); }
  catch { return; } // dependencies not installed in this checkout — skip
  const data = tmp();
  try {
    const db = await openSettingsDb({ siteRoot: repoRoot, dataRoot: data });
    db.set({ NEXT_PUBLIC_SITE_URL: 'https://z.test' });
    db.close();
    const Database = createRequire(path.join(repoRoot, 'package.json'))('better-sqlite3');
    const check = new Database(path.join(data, 'cms-data', 'cms.db'), { readonly: true });
    assert.equal(check.prepare('SELECT value FROM secrets WHERE key = ?').get('NEXT_PUBLIC_SITE_URL').value, 'https://z.test');
    check.close();
  } finally {
    fs.rmSync(data, { recursive: true, force: true });
  }
});
