/**
 * Daily rhc-cms update CHECK (check-only — never applies). If a newer panel is
 * available on GitHub and cms-data/automation.json has autoUpdate.enabled=true, it
 * notifies via Telegram (backup channel) + email (Brevo), then exits. Applying an
 * update is a deliberate, backed-up action from /admin/automation, never unattended.
 *
 * Reuses ../audit/_lib.mjs getSecret (secrets.json → .env.local → env) for creds,
 * matching the existing audit/backup cron conventions.
 *
 * Run:  node scripts/auto-update/check-updates.mjs
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getSecret, log } from '../audit/_lib.mjs';

const ROOT = process.env.SHARED_ROOT || process.cwd();
const REPO = 'RHC-Solutions/rhc-cms';
const BRANCH = 'main';

function autoUpdateCfg() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'cms-data', 'automation.json'), 'utf-8'));
    return cfg?.autoUpdate || { enabled: false, mode: 'check' };
  } catch { return { enabled: false, mode: 'check' }; }
}

function panelDir() {
  const sub = path.join(ROOT, 'vendor', 'admin-panel');
  return fs.existsSync(path.join(sub, '.git')) ? sub : ROOT;
}

async function notifyTelegram(text) {
  const token = getSecret('TELEGRAM_BACKUP_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN');
  const chat = getSecret('TELEGRAM_BACKUP_CHAT_ID') || getSecret('TELEGRAM_CHAT_ID');
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

async function notifyEmail(subject, text) {
  const key = getSecret('BREVO_API_KEY');
  const to = getSecret('ADMIN_EMAIL') || getSecret('CONTACT_EMAIL');
  if (!key || !to) return false;
  const from = getSecret('BREVO_SENDER_EMAIL') || to;
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: from }, to: [{ email: to }], subject, textContent: text }),
    });
    return r.ok;
  } catch { return false; }
}

async function main() {
  const cfg = autoUpdateCfg();
  if (!cfg.enabled) { log('[auto-update] disabled in cms-data/automation.json (autoUpdate.enabled) — exiting.'); return; }

  const dir = panelDir();
  let current;
  try { current = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim(); }
  catch (e) { log('[auto-update] cannot read local panel revision:', e.message); return; }

  let commits;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'admin-panel-updater' },
    });
    if (!r.ok) { log('[auto-update] GitHub API', r.status); return; }
    commits = await r.json();
  } catch (e) { log('[auto-update] check failed:', e.message); return; }

  const latest = commits[0]?.sha;
  if (!latest || latest === current) { log('[auto-update] up to date.'); return; }
  const idx = commits.findIndex((c) => c.sha === current);
  const behind = idx === -1 ? commits.length : idx;
  const list = (idx === -1 ? commits : commits.slice(0, idx))
    .map((c) => `• ${c.sha.slice(0, 8)} ${c.commit.message.split('\n')[0]}`).join('\n');
  const subject = `Admin panel update available — ${behind} commit(s) behind`;
  const text = `${subject}\nLocal ${current.slice(0, 8)} → latest ${latest.slice(0, 8)}\n\n${list}\n\nApply from /admin/automation → Panel updates (backs up first).`;

  const t = await notifyTelegram(text);
  const e = await notifyEmail(subject, text);
  log(`[auto-update] update available (${behind} behind); notified telegram=${t} email=${e}.`);
}

main().catch((e) => { log('[auto-update] fatal:', e.message); process.exit(0); });
