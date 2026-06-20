import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSecret } from '@adminpanel/lib/env';
import { sendOpsEmail, emailChannelConfigured } from '@adminpanel/lib/email';

const USERS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'users.json');
const SETTINGS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'settings.json');
const SECRETS_FILE = path.join((process.env.SHARED_ROOT || process.cwd()), 'cms-data', 'secrets.json');

// Abuse mitigation. Reset is intentionally unauthenticated (forgot-password
// flow), but the new password is only delivered to a server-side address
// the admin pre-configured (their stored email OR a Telegram chat ID).
// Without limits, an attacker could repeatedly invalidate the admin's
// password and reset MFA from anonymous internet. Keep buckets in-process —
// fine for a single PM2 instance; behind a load balancer move to Redis.
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX = 3;
const ACCOUNT_COOLDOWN_MS = 60 * 60 * 1000;
const ipBucket = new Map<string, number[]>();
const accountLastReset = new Map<string, number>();

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

function ipRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipBucket.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  ipBucket.set(ip, hits);
  return hits.length > IP_MAX;
}

// Pick one character from `chars` using a CSPRNG (unbiased: randomInt rejects
// values that would skew the modulo). Never use Math.random() for secrets.
function pick(chars: string): string {
  return chars[crypto.randomInt(chars.length)];
}

// Generate a secure 64-character password with extra complexity
function generateSecurePassword(length: number = 64): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = lowercase + uppercase + numbers + specialChars;

  const chars: string[] = [];

  // Ensure at least 2 of each type for extra complexity
  for (let i = 0; i < 2; i++) {
    chars.push(pick(lowercase));
    chars.push(pick(uppercase));
    chars.push(pick(numbers));
    chars.push(pick(specialChars));
  }

  // Fill the rest randomly
  while (chars.length < length) {
    chars.push(pick(allChars));
  }

  // Cryptographic Fisher-Yates shuffle to randomize the guaranteed characters.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

// Send message to Telegram
async function sendToTelegram(botToken: string, chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send to Telegram:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ipRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many reset attempts. Try again later.' },
        { status: 429 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generic success response used to prevent account enumeration. Any path
    // that would have returned 404/403/400 for a missing/non-admin account
    // returns this same payload after the rate-limit check.
    const genericOk = NextResponse.json({
      success: true,
      message: 'If this account is eligible, a new password has been sent via your configured recovery channel.',
    });

    // Load users
    if (!fs.existsSync(USERS_FILE)) {
      return genericOk;
    }

    const usersData = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(usersData);

    // Find user
    const userIndex = users.findIndex((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (userIndex === -1) {
      return genericOk;
    }

    const user = users[userIndex];

    // Check if user is admin
    if (user.role !== 'admin') {
      return genericOk;
    }

    // Per-account cooldown — prevents repeated MFA wipes for a known admin email.
    const last = accountLastReset.get(user.email.toLowerCase()) || 0;
    if (Date.now() - last < ACCOUNT_COOLDOWN_MS) {
      return genericOk;
    }
    accountLastReset.set(user.email.toLowerCase(), Date.now());

    // Load Telegram credentials for the fallback channel (used when email isn't
    // configured or if email delivery fails). The live bots are configured in
    // cms-data/secrets.json (admin → Integrations), keyed by purpose — NOT in
    // settings.json (which is why this previously reported "not configured"
    // even though Telegram was set up). Prefer the CONTACT pair, fall back to
    // the dedicated login-alert pair, then the legacy settings.json block.
    let telegramConfig = { botToken: '', chatId: '' };
    try {
      if (fs.existsSync(SECRETS_FILE)) {
        const secrets = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
        // Pick a MATCHED bot+chat pair (a bot can only message chats it belongs
        // to). Prefer the CONTACT pair — that's the channel the login-alert
        // notifications actually deliver to, so the admin already monitors it;
        // fall back to the dedicated login-alert pair.
        const pairs: Array<[string, string]> = [
          [secrets.TELEGRAM_CONTACT_BOT_TOKEN, secrets.TELEGRAM_CONTACT_CHAT_ID],
          [secrets.TELEGRAM_LOGIN_ALERT_BOT_TOKEN, secrets.TELEGRAM_LOGIN_ALERT_CHAT_ID],
        ];
        const match = pairs.find(([b, c]) => b && c);
        if (match) telegramConfig = { botToken: match[0], chatId: match[1] };
      }
    } catch { /* fall through to settings.json */ }
    if ((!telegramConfig.botToken || !telegramConfig.chatId) && fs.existsSync(SETTINGS_FILE)) {
      try {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
        if (settings.telegram?.botToken && settings.telegram?.chatId) telegramConfig = settings.telegram;
      } catch { /* ignore */ }
    }
    const telegramConfigured = !!(telegramConfig.botToken && telegramConfig.chatId);
    const emailConfigured = emailChannelConfigured();

    if (!emailConfigured && !telegramConfigured) {
      return NextResponse.json({
        error: 'No recovery channel configured. Add email (BREVO_API_KEY or SMTP) or Telegram in admin settings first.',
      }, { status: 400 });
    }

    // Generate new password
    const newPassword = generateSecurePassword(64);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Snapshot the original user so we can roll back if delivery fails on
    // every configured channel.
    const originalUser = user;

    // Update user password
    users[userIndex] = {
      ...user,
      passwordHash,
      updatedAt: new Date().toISOString(),
      updatedBy: 'password-reset',
      // Reset TOTP to allow login without it
      totpEnabled: false,
      totpSecret: undefined,
      totpTempSecret: undefined,
      recoveryCodes: [],
    };

    // Save users
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

    // Timestamp used in both delivery payloads.
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

    let deliveredVia: 'email' | 'telegram' | null = null;
    const deliveryErrors: string[] = [];

    // 1) Try email first (Brevo → SMTP) if any email channel is configured.
    //    The password is always sent to the admin's STORED email (`user.email`),
    //    never an address from the request body — so the recipient address
    //    comes from server-side state, not user input.
    if (emailConfigured) {
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">🔐 Admin Password Reset</h2>
          <p><strong>Account:</strong> ${user.name} (${user.email})<br>
             <strong>Timestamp:</strong> ${timestamp} UTC</p>
          <p><strong>New password:</strong></p>
          <pre style="background:#f3f4f6;padding:12px 14px;border-radius:6px;font-size:14px;overflow-wrap:anywhere;">${newPassword}</pre>
          <p style="background:#fef3c7;border-left:4px solid #f59e0b;padding:10px 14px;color:#92400e;font-size:14px;">
            ⚠️ <strong>Important:</strong> This 64-character password is single-use — change it after logging in. 2FA has been disabled, please re-enable it from <em>Security → MFA Setup</em>.
          </p>
          <p><strong>Next steps:</strong></p>
          <ol style="font-size:14px;color:#374151;">
            <li>Copy the password above.</li>
            <li>Go to <a href="${siteUrl}/admin/login">${siteUrl}/admin/login</a>.</li>
            <li>Sign in with your email and this password.</li>
            <li>Re-enable 2FA in security settings.</li>
          </ol>
          <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">
            If you did not request this reset, change your password immediately and review your account activity. This is an automated security notification.
          </p>
        </div>
      `;
      const fromAddress =
        getSecret('BREVO_SENDER_EMAIL') ||
        getSecret('ADMIN_EMAIL') ||
        '';
      const sent = await sendOpsEmail({
        to: user.email,
        subject: 'Admin password reset',
        html: emailHtml,
        from: fromAddress || undefined,
        label: 'PasswordReset',
      });
      if (sent.ok) {
        deliveredVia = 'email';
      } else {
        deliveryErrors.push(`email: ${sent.error}`);
      }
    }

    // 2) Fall back to Telegram if email wasn't configured OR email failed AND
    //    Telegram is configured.
    if (!deliveredVia && telegramConfigured) {
      const message = `🔐 <b>Admin Password Reset</b>

<b>Account:</b> ${user.name} (${user.email})
<b>Timestamp:</b> ${timestamp} UTC

<b>New Password:</b>
<code>${newPassword}</code>

⚠️ <b>Important:</b>
• This password is 64 characters long with high complexity
• 2FA/TOTP has been disabled for this account
• Please enable 2FA again after logging in
• Delete this message after copying the password

<b>Next Steps:</b>
1. Copy the password above
2. Go to ${siteUrl}/admin/login
3. Log in with your email and this password
4. Re-enable 2FA in security settings

This is an automated security notification from the admin panel.`;
      const sent = await sendToTelegram(telegramConfig.botToken, telegramConfig.chatId, message);
      if (sent) {
        deliveredVia = 'telegram';
      } else {
        deliveryErrors.push('telegram: send failed');
      }
    }

    if (!deliveredVia) {
      // All configured channels failed — roll back the password change so the
      // admin doesn't get locked out with a password no one received.
      users[userIndex] = originalUser;
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      console.error('[PasswordReset] All channels failed:', deliveryErrors.join('; '));
      return NextResponse.json({
        error: 'Failed to deliver the new password on any configured channel. Original password preserved.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: deliveredVia === 'email'
        ? `Password reset email sent to ${user.email}. 2FA has been disabled.`
        : 'Password has been reset and sent to Telegram. 2FA has been disabled.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
