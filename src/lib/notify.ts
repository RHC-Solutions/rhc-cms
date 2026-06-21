import { getSecret } from './env';
import { sendOpsEmail, emailChannelConfigured } from './email';
import { notifyTelegram, telegramChannelConfigured, type TelegramChannel } from './telegram';

/**
 * Unified ops notification: fan out a message to every channel the host has
 * configured — email (Brevo → SMTP) AND Telegram. Best-effort and never throws;
 * returns per-channel delivery status so callers can log/surface partial failures.
 *
 * Used by the daily auto-update job and the in-app panel-update flow (so the same
 * report reaches whichever channel the operator actually set up).
 */

export interface NotifyResult {
  email: { attempted: boolean; ok: boolean; error?: string };
  telegram: { attempted: boolean; ok: boolean; error?: string };
  anyDelivered: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function notifyOps(opts: {
  subject: string;
  text: string;
  html?: string;
  telegramChannel?: TelegramChannel;
  emailTo?: string;
}): Promise<NotifyResult> {
  const result: NotifyResult = {
    email: { attempted: false, ok: false },
    telegram: { attempted: false, ok: false },
    anyDelivered: false,
  };

  // Email — to the admin/contact address, via whatever email channel is set up.
  const to = (opts.emailTo || getSecret('ADMIN_EMAIL') || getSecret('CONTACT_EMAIL') || '').trim();
  if (to && emailChannelConfigured()) {
    result.email.attempted = true;
    const from = getSecret('BREVO_SENDER_EMAIL') || getSecret('SMTP_USER') || undefined;
    const html = opts.html || `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(opts.text)}</pre>`;
    const r = await sendOpsEmail({ to, subject: opts.subject, html, from, label: 'Notify' });
    result.email.ok = r.ok;
    if (!r.ok) result.email.error = (r as any).error;
  }

  // Telegram — default to the "backup"/ops channel.
  const channel = opts.telegramChannel || 'backup';
  if (telegramChannelConfigured(channel)) {
    result.telegram.attempted = true;
    const r = await notifyTelegram(channel, `${opts.subject}\n\n${opts.text}`);
    result.telegram.ok = r.ok;
    if (!r.ok) result.telegram.error = r.error;
  }

  result.anyDelivered = result.email.ok || result.telegram.ok;
  return result;
}

/** True if the host has at least one notification channel (email or Telegram ops). */
export function notifyChannelsConfigured(): boolean {
  return emailChannelConfigured() || telegramChannelConfigured('backup');
}
