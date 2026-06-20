import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { setEnvValue } from '@adminpanel/lib/env';

async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return false;
  const role = String((token as any).role || '').toLowerCase();
  return role === 'admin' || role === 'administrator';
}

interface EnvSettings {
  nextauthUrl: string;
  nextauthSecret: string;
  ga4PropertyId: string;
  ga4ServiceAccountEmail: string;
  ga4PrivateKey: string;
  ga4KeyId: string;
  ga4ProjectId: string;
  cloudflareApiToken: string;
  cloudflareTurnstileSiteKey: string;
  cloudflareTurnstileSecretKey: string;
  cloudflareZoneId: string;
  cloudflareAccountId: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  contactEmail: string;
  office365ClientId: string;
  office365ClientSecret: string;
  office365TenantId: string;
  office365RefreshToken: string;
  recaptchaSiteKey: string;
  recaptchaSecretKey: string;
  telegramResumeBotToken: string;
  telegramResumeChatId: string;
  telegramContactBotToken: string;
  telegramContactChatId: string;
  telegramBackupBotToken: string;
  telegramBackupChatId: string;
  telegramLoginAlertBotToken: string;
  telegramLoginAlertChatId: string;
  siteUrl: string;
  bookingUrl: string;
  gaId: string;
  gtmId: string;
  ipinfoToken: string;
}

const ENV_FILE = path.join(process.cwd(), '.env.local');

const ENV_VAR_MAPPING: Record<keyof EnvSettings, string> = {
  nextauthUrl: 'NEXTAUTH_URL',
  nextauthSecret: 'NEXTAUTH_SECRET',
  ga4PropertyId: 'NEXT_PUBLIC_GA_PROPERTY_ID',
  ga4ServiceAccountEmail: 'NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL',
  ga4PrivateKey: 'GA_PRIVATE_KEY',
  ga4KeyId: 'NEXT_PUBLIC_GA_KEY_ID',
  ga4ProjectId: 'NEXT_PUBLIC_GA_PROJECT_ID',
  cloudflareApiToken: 'CLOUDFLARE_API_TOKEN',
  cloudflareTurnstileSiteKey: 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY',
  cloudflareTurnstileSecretKey: 'CLOUDFLARE_TURNSTILE_SECRET_KEY',
  cloudflareZoneId: 'NEXT_PUBLIC_CLOUDFLARE_ZONE_ID',
  cloudflareAccountId: 'CLOUDFLARE_ACCOUNT_ID',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpUser: 'SMTP_USER',
  smtpPass: 'SMTP_PASS',
  contactEmail: 'CONTACT_EMAIL',
  office365ClientId: 'OFFICE365_CLIENT_ID',
  office365ClientSecret: 'OFFICE365_CLIENT_SECRET',
  office365TenantId: 'OFFICE365_TENANT_ID',
  office365RefreshToken: 'OFFICE365_REFRESH_TOKEN',
  recaptchaSiteKey: 'NEXT_PUBLIC_RECAPTCHA_SITE_KEY',
  recaptchaSecretKey: 'RECAPTCHA_SECRET_KEY',
  telegramResumeBotToken: 'TELEGRAM_RESUME_BOT_TOKEN',
  telegramResumeChatId: 'TELEGRAM_RESUME_CHAT_ID',
  telegramContactBotToken: 'TELEGRAM_CONTACT_BOT_TOKEN',
  telegramContactChatId: 'TELEGRAM_CONTACT_CHAT_ID',
  telegramBackupBotToken: 'TELEGRAM_BACKUP_BOT_TOKEN',
  telegramBackupChatId: 'TELEGRAM_BACKUP_CHAT_ID',
  telegramLoginAlertBotToken: 'TELEGRAM_LOGIN_ALERT_BOT_TOKEN',
  telegramLoginAlertChatId: 'TELEGRAM_LOGIN_ALERT_CHAT_ID',
  siteUrl: 'NEXT_PUBLIC_SITE_URL',
  bookingUrl: 'NEXT_PUBLIC_BOOKING_URL',
  gaId: 'NEXT_PUBLIC_GA_ID',
  gtmId: 'NEXT_PUBLIC_GTM_ID',
  ipinfoToken: 'IPINFO_TOKEN',
};

function getEnvValue(key: string): string {
  try {
    const content = fs.readFileSync(ENV_FILE, 'utf-8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const settings: EnvSettings = {} as EnvSettings;

    for (const [key, envVar] of Object.entries(ENV_VAR_MAPPING)) {
      settings[key as keyof EnvSettings] = getEnvValue(envVar);
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to load configuration', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const data: EnvSettings = await request.json();

    // Save all settings
    for (const [key, envVar] of Object.entries(ENV_VAR_MAPPING)) {
      const value = data[key as keyof EnvSettings];
      if (value) {
        setEnvValue(envVar, value);
      }
    }

    return NextResponse.json({
      success: true,
      message: '✓ All settings saved successfully. Remember to restart the application.',
    });
  } catch (error) {
    console.error('Failed to save environment settings:', error);
    return NextResponse.json(
      { message: 'Failed to save settings', error: String(error) },
      { status: 500 }
    );
  }
}
