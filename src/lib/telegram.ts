import { getSecret } from './env';

/**
 * Shared Telegram sender. Several call sites used to hand-roll the same
 * `fetch(api.telegram.org/bot<token>/sendMessage)` call; this is the one place
 * to do it. Token/chat-id are validated before interpolation so a malformed
 * value can't redirect the request (SSRF guard) — the bot token can only ever
 * contain `\d+:[A-Za-z0-9_-]+` and the chat id `-?\d+` or `@name`.
 */

const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{20,}$/;
const CHAT_RE = /^-?\d+$|^@[A-Za-z0-9_]{3,}$/;

export async function sendTelegramMessage(opts: {
  token: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
}): Promise<{ ok: boolean; error?: string }> {
  const token = (opts.token || '').trim();
  const chatId = (opts.chatId || '').trim();
  if (!token || !chatId) return { ok: false, error: 'Missing Telegram token/chat ID' };
  if (!TOKEN_RE.test(token)) return { ok: false, error: 'Invalid Telegram bot token format' };
  if (!CHAT_RE.test(chatId)) return { ok: false, error: 'Invalid Telegram chat ID format' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: opts.text,
        parse_mode: opts.parseMode,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.description || ''; } catch { /* ignore */ }
      return { ok: false, error: `Telegram ${res.status}${detail ? `: ${detail}` : ''}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Telegram request failed' };
  }
}

// Named notification channels — each maps to a TELEGRAM_<X>_BOT_TOKEN/CHAT_ID pair
// in secrets.json (see INTEGRATIONS in lib/integrations.ts), with a legacy
// single-bot fallback (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID).
export type TelegramChannel = 'backup' | 'login' | 'contact' | 'forms' | 'resume';

const CHANNEL_KEYS: Record<TelegramChannel, { token: string; chat: string }> = {
  backup: { token: 'TELEGRAM_BACKUP_BOT_TOKEN', chat: 'TELEGRAM_BACKUP_CHAT_ID' },
  login: { token: 'TELEGRAM_LOGIN_ALERT_BOT_TOKEN', chat: 'TELEGRAM_LOGIN_ALERT_CHAT_ID' },
  contact: { token: 'TELEGRAM_CONTACT_BOT_TOKEN', chat: 'TELEGRAM_CONTACT_CHAT_ID' },
  forms: { token: 'TELEGRAM_FORMS_BOT_TOKEN', chat: 'TELEGRAM_FORMS_CHAT_ID' },
  resume: { token: 'TELEGRAM_RESUME_BOT_TOKEN', chat: 'TELEGRAM_RESUME_CHAT_ID' },
};

export function resolveTelegramChannel(channel: TelegramChannel): { token: string; chatId: string } {
  const keys = CHANNEL_KEYS[channel];
  return {
    token: getSecret(keys.token) || getSecret('TELEGRAM_BOT_TOKEN') || '',
    chatId: getSecret(keys.chat) || getSecret('TELEGRAM_CHAT_ID') || '',
  };
}

export function telegramChannelConfigured(channel: TelegramChannel): boolean {
  const { token, chatId } = resolveTelegramChannel(channel);
  return !!token && !!chatId;
}

export async function notifyTelegram(channel: TelegramChannel, text: string): Promise<{ ok: boolean; error?: string }> {
  const { token, chatId } = resolveTelegramChannel(channel);
  if (!token || !chatId) return { ok: false, error: `Telegram channel "${channel}" not configured` };
  return sendTelegramMessage({ token, chatId, text });
}
