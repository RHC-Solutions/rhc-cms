import { getSecret } from './env';
import { sendBrevoEmail } from './brevo';

/**
 * Send an "ops" email through whichever channel the host has configured —
 * Brevo HTTP API first (most reliable), then SMTP. Returns `{ ok: true }`
 * with the channel that succeeded so callers can decide whether to fall
 * back further (e.g. Telegram) or to roll back state changes.
 *
 * Intentionally distinct from the inline sender in `src/app/api/cms/forms/route.ts`
 * which is fire-and-forget — this one is for flows that *must* know whether
 * delivery succeeded (e.g. password reset).
 *
 * `from` is required for SMTP. For Brevo the API has its own defaulting
 * (`BREVO_SENDER_EMAIL` env → falls back to a hardcoded address), so callers
 * may omit `from` and still get a working Brevo send.
 */
export async function sendOpsEmail({
  to,
  subject,
  html,
  from,
  label = 'Email',
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  label?: string;
}): Promise<
  | { ok: true; channel: 'brevo' | 'smtp' }
  | { ok: false; error: string }
> {
  // 1) Brevo HTTP API — preferred.
  if (getSecret('BREVO_API_KEY')) {
    try {
      const res = await sendBrevoEmail({
        to,
        subject,
        htmlContent: html,
        sender: from ? { email: from } : undefined,
      });
      if (res.success) return { ok: true, channel: 'brevo' };
      console.warn(`[${label}] Brevo failed, trying SMTP fallback:`, res.error);
    } catch (e: any) {
      console.error(`[${label}] Brevo exception, trying SMTP fallback:`, e);
    }
  }

  // 2) SMTP — fallback. Requires a `from` address.
  const smtpHost = getSecret('SMTP_HOST');
  if (smtpHost && from) {
    try {
      const nodemailer = (await import('nodemailer')).default;
      const smtpUser = getSecret('SMTP_USER');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(getSecret('SMTP_PORT') || '587', 10),
        secure: getSecret('SMTP_SECURE') === 'true',
        auth: smtpUser
          ? { user: smtpUser, pass: getSecret('SMTP_PASS') }
          : undefined,
      });
      await transporter.sendMail({ from, to, subject, html });
      return { ok: true, channel: 'smtp' };
    } catch (e: any) {
      console.error(`[${label}] SMTP send failed:`, e);
      return { ok: false, error: e?.message || 'SMTP send failed' };
    }
  }

  return {
    ok: false,
    error: 'No email channel configured (set BREVO_API_KEY, or SMTP_HOST plus a sender address)',
  };
}

/**
 * Quick check whether any email channel is configured on this host.
 * Useful when a flow wants to choose between email and an alternate
 * delivery channel (e.g. Telegram) up front.
 */
export function emailChannelConfigured(): boolean {
  return !!getSecret('BREVO_API_KEY') || !!getSecret('SMTP_HOST');
}
