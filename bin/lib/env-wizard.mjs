// Interactive .env.local wizard for `admin-panel init`.
//
// Pure helpers (parseEnvVars/renderEnv) + the prompt flow (runEnvWizard) live here,
// separate from the CLI entrypoint, so they can be unit-tested by piping a Readable
// (no TTY needed) without triggering the CLI's top-level command dispatch.
// Node built-ins only — no external dependencies.

import readline from 'node:readline/promises';

// Parse `KEY=value   # comment` lines from a .env template into ordered entries.
// Commented-out lines ("# DB_DRIVER=") are intentionally skipped — they stay optional.
export function parseEnvVars(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let value = m[2];
    let comment = '';
    // Split off an inline comment only when it follows whitespace, so a '#' that is
    // part of a value (rare in env, but possible) is not mistaken for a comment.
    const cm = value.match(/^(.*?)\s+#\s?(.*)$/);
    if (cm) { value = cm[1]; comment = cm[2].trim(); }
    out.push({ key: m[1], def: value.trim(), comment });
  }
  return out;
}

// Render a final .env.local from the template, substituting answered values.
// - answered (non-empty) key  -> `KEY=value`   (inline comment dropped)
// - unanswered key            -> the template line is kept verbatim (placeholder + comment)
// - NEXTAUTH_SECRET           -> the generated secret unless explicitly answered
// Comment/section/blank lines are preserved as-is.
export function renderEnv(template, answers, secret) {
  const has = (k) => Object.prototype.hasOwnProperty.call(answers, k) && answers[k] !== '' && answers[k] != null;
  let sawSecret = false;
  const lines = String(template).split(/\r?\n/).map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!m) return line;
    const key = m[1];
    if (key === 'NEXTAUTH_SECRET') { sawSecret = true; return `NEXTAUTH_SECRET=${formatEnvValue(has(key) ? answers[key] : secret)}`; }
    if (has(key)) return `${key}=${formatEnvValue(answers[key])}`;
    return line;
  });
  let body = lines.join('\n');
  if (!sawSecret && !/^NEXTAUTH_SECRET=/m.test(body)) body = `NEXTAUTH_SECRET=${formatEnvValue(secret)}\n` + body;
  if (!body.endsWith('\n')) body += '\n';
  return body;
}

const looksPlaceholder = (v) => /XXXX|your-domain|example\.com|smtp\.example|\+1555/i.test(String(v));

// Format a value safely for a .env line. Next loads env via @next/env, which runs
// dotenv-expand: an unquoted OR quoted `$FOO` is EXPANDED (so a DB password "p@ss$word"
// silently loses "$word"). @next/env only treats a `\$` escape as a literal `$`, and it
// does NOT special-case single quotes. So: write bare when the value has no dotenv-special
// char; otherwise double-quote (neutralises spaces / inline-#) and escape `$` (and `"`,
// backtick) so the value round-trips verbatim. Verified against @next/env 16.
export function formatEnvValue(v) {
  const s = String(v).replace(/[\r\n]+/g, ''); // never let a newline split the .env line
  if (s === '') return '';
  if (!/[\s$#"'\\`]/.test(s)) return s; // no special chars → safe bare
  return '"' + s.replace(/([\\$"`])/g, '\\$1') + '"';
}

// Prompt the operator for .env.local settings. `input`/`output` default to the process
// streams but are injectable for testing. Returns a { KEY: value } answers map; only keys
// the user actually set are included (so renderEnv keeps template placeholders for the rest).
export async function runEnvWizard({ template, secret, input, output, banner }) {
  const rl = readline.createInterface({ input, output });
  // If stdin hits EOF mid-wizard (e.g. a disconnected terminal or truncated pipe), readline
  // closes and further question() calls throw ERR_USE_AFTER_CLOSE. Treat that as "no answer"
  // so the wizard finishes with defaults instead of crashing the installer with a stack trace.
  const q = async (prompt) => {
    try { return await rl.question(prompt); }
    catch (e) { if (e && e.code === 'ERR_USE_AFTER_CLOSE') return ''; throw e; }
  };
  const ask = async (prompt, def = '') => { const a = (await q(prompt)).trim(); return a || def; };
  const ans = {};
  try {
    if (banner) banner();
    // ---- core (always asked) ----
    ans.NEXTAUTH_URL = await ask('  Admin URL  ·  NEXTAUTH_URL [https://admin.your-domain.com]: ', 'https://admin.your-domain.com');
    ans.NEXT_PUBLIC_SITE_URL = await ask('  Public site URL  ·  NEXT_PUBLIC_SITE_URL [https://your-domain.com]: ', 'https://your-domain.com');
    const gen = (await q('  Auto-generate a secure NEXTAUTH_SECRET? [Y/n]: ')).trim().toLowerCase();
    ans.NEXTAUTH_SECRET = (gen === 'n' || gen === 'no')
      ? ((await q('  Enter NEXTAUTH_SECRET: ')).trim() || secret)
      : secret;
    // Set the key even when blank so it counts as "handled" (skips the optional loop);
    // renderEnv treats an empty value as unanswered and keeps the template's blank line
    // (DATABASE_URL's template default IS blank → that is exactly the SQLite path).
    ans.DATABASE_URL = (await q('  Postgres DATABASE_URL  ·  blank = SQLite (zero-config default): ')).trim();
    // ---- optional integrations (gated, then every remaining template var) ----
    const more = (await q('\n  Configure optional integrations now (GA, SMTP, Telegram, Cloudflare…)? Also doable later in /admin. [y/N]: ')).trim().toLowerCase();
    if (more === 'y' || more === 'yes') {
      for (const e of parseEnvVars(template)) {
        if (Object.prototype.hasOwnProperty.call(ans, e.key) || e.key === 'NEXTAUTH_SECRET') continue;
        const def = looksPlaceholder(e.def) ? '' : e.def;
        const hint = e.comment ? `  (${e.comment})` : '';
        const v = (await q(`  ${e.key}${def ? ` [${def}]` : ''}${hint}: `)).trim();
        if (v) ans[e.key] = v;
        else if (def) ans[e.key] = def;
      }
    }
  } finally {
    rl.close();
  }
  return ans;
}
