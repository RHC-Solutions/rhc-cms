/**
 * Standalone audit-report emailer. Reads the day's artifacts (seo/ai/perf/deps
 * JSON + an optional agent-written summary markdown) and sends an HTML+text
 * digest via the same SMTP credentials the app uses (secrets.json).
 *
 * Usage:  node scripts/audit/send-report.mjs <date>
 * Env:    AUDIT_MODE=daily|weekly   (default daily)
 *         AUDIT_PR_URL=<url>        (optional, linked in the email)
 *         AUDIT_SUMMARY_FILE=<path> (optional markdown prepended to the body)
 *         AUDIT_REPORT_TO=<email>   (overrides ADMIN_EMAIL recipient)
 */
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { getSecret, readArtifact, today, log, REPO_ROOT, PUBLIC_BASE } from './_lib.mjs';

// Site host/domain shown in the digest, derived from NEXT_PUBLIC_SITE_URL.
const SITE_HOST = PUBLIC_BASE.replace(/^https?:\/\//, '').replace(/\/$/, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function row(label, value) {
  return `<tr><td style="padding:4px 12px 4px 0;color:#9aa;">${esc(label)}</td><td style="padding:4px 0;font-weight:600;">${value}</td></tr>`;
}

function issueList(issues, limit = 25) {
  if (!issues?.length) return '<p style="color:#5b8;">None 🎉</p>';
  const order = { high: 0, medium: 1, low: 2, info: 3 };
  const sorted = [...issues].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  const color = { high: '#ff4d4d', medium: '#ffb020', low: '#7aa0ff', info: '#8a8a8a' };
  const items = sorted.slice(0, limit).map((i) =>
    `<li><span style="color:${color[i.severity] || '#aaa'};font-weight:600;">[${esc(i.severity)}]</span> <code>${esc(i.page || i.area || '')}</code> — ${esc(i.detail)}</li>`
  );
  const extra = sorted.length > limit ? `<li style="color:#888;">…and ${sorted.length - limit} more</li>` : '';
  return `<ul style="margin:6px 0 14px;padding-left:18px;line-height:1.5;">${items.join('')}${extra}</ul>`;
}

function main() {
  const date = process.argv[2] || today();
  const mode = process.env.AUDIT_MODE || 'daily';
  const prUrl = process.env.AUDIT_PR_URL || '';
  const summaryFile = process.env.AUDIT_SUMMARY_FILE || '';

  const seo = readArtifact('seo.json', date);
  const ai = readArtifact('ai.json', date);
  const perf = readArtifact('perf.json', date);
  const deps = readArtifact('deps.json', date);

  let agentSummary = '';
  if (summaryFile && fs.existsSync(summaryFile)) {
    try { agentSummary = fs.readFileSync(summaryFile, 'utf-8'); } catch { /* ignore */ }
  }

  // ---- Subject ----
  const perfMobile = perf?.summary?.mobile?.performance ?? '–';
  const perfDesktop = perf?.summary?.desktop?.performance ?? '–';
  const depCount = deps?.summary?.totalOutdated ?? 0;
  const fixNote = prUrl ? 'fixes in PR' : 'no auto-fixes';
  const subject = mode === 'weekly'
    ? `RHC weekly deps — ${date} — ${depCount} updates available`
    : `RHC daily audit — ${date} — ${fixNote} · ${depCount} dep updates · perf ${perfMobile}/${perfDesktop} (m/d)`;

  // ---- HTML body ----
  const sections = [];
  if (agentSummary)
    sections.push(`<div style="background:#11161c;border-left:3px solid #00FF41;padding:12px 16px;margin:0 0 18px;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px;">${esc(agentSummary)}</div>`);

  if (prUrl)
    sections.push(`<p style="margin:0 0 18px;">🔧 <strong>Auto-fix PR:</strong> <a href="${esc(prUrl)}" style="color:#00F0FF;">${esc(prUrl)}</a></p>`);

  if (perf?.summary) {
    sections.push(`<h3 style="color:#00F0FF;margin:18px 0 6px;">Performance (PageSpeed Insights)</h3>
      <table style="font-size:13px;border-collapse:collapse;">
        ${row('Mobile', `perf ${perf.summary.mobile.performance ?? '–'} · seo ${perf.summary.mobile.seo ?? '–'} · a11y ${perf.summary.mobile.accessibility ?? '–'} · bp ${perf.summary.mobile.bestPractices ?? '–'}`)}
        ${row('Desktop', `perf ${perf.summary.desktop.performance ?? '–'} · seo ${perf.summary.desktop.seo ?? '–'} · a11y ${perf.summary.desktop.accessibility ?? '–'} · bp ${perf.summary.desktop.bestPractices ?? '–'}`)}
      </table>`);
  }

  if (seo) {
    sections.push(`<h3 style="color:#00F0FF;margin:18px 0 6px;">SEO — ${seo.issues?.length || 0} issues</h3>${issueList(seo.issues)}`);
  }
  if (ai) {
    sections.push(`<h3 style="color:#00F0FF;margin:18px 0 6px;">AI / Agent readiness — ${ai.findings?.length || 0} findings</h3>
      <p style="font-size:12px;color:#9aa;margin:0 0 6px;">AI crawlers addressed: ${ai.summary?.crawlersAddressed}/${ai.summary?.crawlersTotal} · llms.txt: ${ai.summary?.hasLlmsTxt ? 'present' : 'missing'}</p>
      ${issueList(ai.findings)}`);
  }
  if (deps) {
    const b = deps.buckets || {};
    const list = (arr) => arr?.length ? arr.map((d) => `${esc(d.name)} ${esc(d.current)}→${esc(d.latest)}`).join(', ') : '—';
    const v = deps.vulnerabilities || {};
    sections.push(`<h3 style="color:#00F0FF;margin:18px 0 6px;">Dependencies</h3>
      <table style="font-size:13px;border-collapse:collapse;">
        ${row('Vulnerabilities', `crit ${v.critical || 0} · high ${v.high || 0} · mod ${v.moderate || 0} · low ${v.low || 0}`)}
        ${row(`Patch (${b.patch?.length || 0})`, esc(list(b.patch)))}
        ${row(`Minor (${b.minor?.length || 0})`, esc(list(b.minor)))}
        ${row(`Major (${b.major?.length || 0}) — manual`, esc(list(b.major)))}
      </table>
      <p style="font-size:12px;color:#888;margin:6px 0 0;">Patch+minor are auto-applied by the weekly PR (Mondays). Majors need your manual call.</p>`);
  }

  const html = `<!doctype html><html><body style="background:#0a0e12;color:#d6dde4;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
    <div style="max-width:680px;margin:0 auto;">
      <h2 style="color:#00FF41;margin:0 0 4px;">${mode === 'weekly' ? 'Weekly dependency report' : 'Daily site audit'}</h2>
      <p style="color:#9aa;margin:0 0 18px;font-size:13px;">${esc(date)} · ${esc(SITE_HOST)}</p>
      ${sections.join('\n')}
      <hr style="border:none;border-top:1px solid #1c2530;margin:22px 0 10px;">
      <p style="color:#667;font-size:11px;">Generated by scripts/audit/${mode === 'weekly' ? 'weekly-deps.sh' : 'daily-audit.sh'}. Reply to this email to change what's audited.</p>
    </div></body></html>`;

  const text = [
    `${mode === 'weekly' ? 'Weekly dependency report' : 'Daily site audit'} — ${date}`,
    agentSummary && `\n${agentSummary}`,
    prUrl && `\nAuto-fix PR: ${prUrl}`,
    perf?.summary && `\nPerf (m/d): ${perfMobile}/${perfDesktop}`,
    seo && `\nSEO issues: ${seo.issues?.length || 0}`,
    ai && `\nAI findings: ${ai.findings?.length || 0}`,
    deps && `\nDeps: ${deps.summary.patch} patch, ${deps.summary.minor} minor, ${deps.summary.major} major`,
  ].filter(Boolean).join('\n');

  // ---- Send ----
  const smtpHost = getSecret('SMTP_HOST');
  const to = process.env.AUDIT_REPORT_TO || getSecret('AUDIT_REPORT_TO') || getSecret('ADMIN_EMAIL') || '';

  // Persist a compact last-run status the admin page (/admin/automation) reads.
  try {
    const statusPath = path.join(REPO_ROOT, 'logs', 'audit', 'status.json');
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({
      date, mode, subject, recipient: to, prUrl: prUrl || null,
      finishedAt: new Date().toISOString(),
      seoIssues: seo?.issues?.length ?? null,
      aiFindings: ai?.findings?.length ?? null,
      perf: perf?.summary ?? null,
      deps: deps?.summary ?? null,
      reportPath: `logs/audit/${date}/report.md`,
    }, null, 2));
  } catch (e) { log('send-report: could not write status.json:', e.message); }

  if (!smtpHost) { log('send-report: SMTP_HOST not configured — printing instead.\n', text); return; }
  if (!to) { log('send-report: no recipient (set AUDIT_REPORT_TO or ADMIN_EMAIL) — printing instead.\n', text); return; }

  const smtpUser = getSecret('SMTP_USER');
  const port = parseInt(getSecret('SMTP_PORT') || '587', 10);
  // Derive TLS mode from the port rather than trusting SMTP_SECURE alone:
  // 465 = implicit TLS (secure:true); 587/25 = STARTTLS (secure:false +
  // requireTLS). This site's secrets set SMTP_SECURE="true" on port 587, which
  // would otherwise trigger an SSL "wrong version number" handshake error.
  const secure = port === 465 ? true : port === 587 ? false : getSecret('SMTP_SECURE') === 'true';
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure,
    requireTLS: !secure,
    auth: smtpUser ? { user: smtpUser, pass: getSecret('SMTP_PASS') } : undefined,
  });

  transporter.sendMail({
    from: getSecret('SMTP_FROM') || getSecret('ADMIN_EMAIL') || (SITE_HOST ? `no-reply@${SITE_HOST}` : 'no-reply@localhost'),
    to, subject, html, text,
  }).then(() => log(`send-report: emailed ${to} — "${subject}"`))
    .catch((e) => { log('send-report: send failed:', e.message); process.exitCode = 1; });
}

main();
