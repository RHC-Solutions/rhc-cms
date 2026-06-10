// Tests for the .env.local install wizard. Run: `node --test bin/lib/env-wizard.test.mjs`
// Built-ins only. The @next/env round-trip is skipped gracefully if next isn't installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable, Readable } from 'node:stream';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnvVars, renderEnv, formatEnvValue, runEnvWizard } from './env-wizard.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const template = fs.readFileSync(path.join(repoRoot, '.env.local.example'), 'utf8');

// Feed one answer per readline prompt (1 prompt write == 1 question); '' once exhausted.
function feed(answers) {
  const input = new PassThrough();
  let i = 0;
  const output = new Writable({ write(_c, _e, cb) { const a = i < answers.length ? answers[i++] : ''; setImmediate(() => input.write(a + '\n')); cb(); } });
  return { input, output };
}
const sink = () => new Writable({ write(_c, _e, cb) { cb(); } });

test('formatEnvValue: bare / quoted-escaped / empty / newline-stripped', () => {
  assert.equal(formatEnvValue('plain-1_2.3/x:y@z'), 'plain-1_2.3/x:y@z');
  assert.equal(formatEnvValue('a$b'), '"a\\$b"');           // $ escaped so dotenv-expand keeps it literal
  assert.equal(formatEnvValue('two words'), '"two words"'); // space neutralised
  assert.equal(formatEnvValue('tok#en'), '"tok#en"');       // inline-# neutralised
  assert.equal(formatEnvValue(''), '');
  assert.equal(formatEnvValue('a\nb'), 'ab');               // newline stripped (no line injection); result is bare-safe
  assert.equal(formatEnvValue('a\nb$c'), '"ab\\$c"');       // newline stripped, then $ still escaped
});

test('parseEnvVars: parses active vars, skips commented-out ones', () => {
  const keys = parseEnvVars(template).map((v) => v.key);
  assert.ok(keys.includes('DATABASE_URL') && keys.includes('NEXT_PUBLIC_GA_ID') && keys.includes('SMTP_HOST'));
  assert.ok(!keys.includes('DB_DRIVER') && !keys.includes('SHARED_ROOT')); // these are commented in the template
});

test('renderEnv: injects secret, keeps placeholders, escapes $, preserves comments', () => {
  const out = renderEnv(template, { NEXT_PUBLIC_GA_ID: 'G-AB$C' }, 'GEN+/SECRET==');
  assert.match(out, /^NEXTAUTH_SECRET=GEN\+\/SECRET==$/m);          // secret injected (base64 is bare-safe)
  assert.match(out, /^NEXTAUTH_URL=https:\/\/your-domain\.com$/m);  // unanswered placeholder kept
  assert.match(out, /^NEXT_PUBLIC_GA_ID="G-AB\\\$C"$/m);            // answered value with $ escaped+quoted
  assert.ok(out.includes('# Database'));                            // section comments preserved
});

test('renderEnv: injects an escaped secret even when the template lacks the line', () => {
  const out = renderEnv('FOO=bar\n', {}, 'sec$ret');
  assert.match(out, /^NEXTAUTH_SECRET="sec\\\$ret"$/m);
});

test('runEnvWizard: core path (skip optional)', async () => {
  const { input, output } = feed(['https://admin.acme.test', 'https://acme.test', '', '', 'n']);
  const ans = await runEnvWizard({ template, secret: 'SEC', input, output });
  assert.equal(ans.NEXTAUTH_URL, 'https://admin.acme.test');
  assert.equal(ans.NEXT_PUBLIC_SITE_URL, 'https://acme.test');
  assert.equal(ans.NEXTAUTH_SECRET, 'SEC');
  assert.equal(ans.DATABASE_URL, '');                 // blank = SQLite, handled
  assert.ok(!('NEXT_PUBLIC_GA_ID' in ans));           // optional loop skipped
});

test('runEnvWizard: manual secret + postgres + opt-in optional', async () => {
  const ans = ['https://admin.b.test', 'https://b.test', 'n', 'mysecret123', 'postgres://u:p@h/db', 'y'];
  for (const v of parseEnvVars(template)) {
    if (['NEXTAUTH_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXTAUTH_SECRET', 'DATABASE_URL'].includes(v.key)) continue;
    ans.push(v.key === 'NEXT_PUBLIC_GA_ID' ? 'G-XYZ' : '');
  }
  const { input, output } = feed(ans);
  const r = await runEnvWizard({ template, secret: 'GEN', input, output });
  assert.equal(r.NEXTAUTH_SECRET, 'mysecret123');
  assert.equal(r.DATABASE_URL, 'postgres://u:p@h/db');
  assert.equal(r.NEXT_PUBLIC_GA_ID, 'G-XYZ');
});

test('runEnvWizard: EOF mid-wizard resolves with defaults (no ERR_USE_AFTER_CLOSE)', async () => {
  // Readable.from() ends immediately → readline closes; the wizard must NOT throw.
  const ans = await runEnvWizard({ template, secret: 'SEC', input: Readable.from('https://only-one\n'), output: sink() });
  assert.equal(typeof ans, 'object');
  assert.equal(ans.NEXTAUTH_SECRET, 'SEC');           // always set, even on early EOF
  assert.ok(ans.NEXTAUTH_URL && ans.NEXT_PUBLIC_SITE_URL); // fell back to defaults, didn't crash
});

test('@next/env round-trip: $ / # / space in values survive verbatim', () => {
  let loadEnvConfig;
  try { ({ loadEnvConfig } = createRequire(path.join(repoRoot, 'x.js'))('@next/env')); }
  catch { return; } // next not installed in this checkout — skip
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envwiz-'));
  try {
    const answers = { DATABASE_URL: 'postgres://u:p@ss$word#1@db.h:5432/main', SMTP_PASS: 's p$ce' };
    fs.writeFileSync(path.join(dir, '.env.local'), renderEnv(template, answers, 'Ab9+/x$weird=='));
    const { combinedEnv: e } = loadEnvConfig(dir, false);
    assert.equal(e.DATABASE_URL, answers.DATABASE_URL);
    assert.equal(e.SMTP_PASS, answers.SMTP_PASS);
    assert.equal(e.NEXTAUTH_SECRET, 'Ab9+/x$weird==');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
