/**
 * Schema describing every runtime server-side integration whose credentials
 * live in cms-data/secrets.json (managed via /admin/integrations).
 *
 * Adding a new integration: append an entry below, then in the consumer code
 * replace `process.env.X` with `getSecret('X')` from '@adminpanel/lib/env'. No UI or API
 * changes needed — the /admin/integrations page reads this list at runtime.
 */

export type IntegrationFieldType = 'text' | 'secret' | 'longtext';

export interface IntegrationField {
  /** Env-var name; also the key used inside cms-data/secrets.json */
  envVar: string;
  /** Human-readable label rendered in the form */
  label: string;
  /** Optional helper text shown under the input */
  description?: string;
  /** 'secret' fields render as password inputs with an eye toggle */
  type?: IntegrationFieldType;
  /** Placeholder example, e.g. 'smtp.gmail.com' */
  example?: string;
  /** Optional: free-form group name for visually clustering fields within an integration */
  group?: string;
}

export interface Integration {
  id: string;
  name: string;
  /** Sub-heading shown under the integration title */
  description: string;
  /** Optional link to the third-party's dashboard for getting credentials */
  dashboardLink?: string;
  fields: IntegrationField[];
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'telegram',
    name: 'Telegram bots',
    description: 'Bot tokens + chat IDs for outbound notifications. Create bots via @BotFather, get chat IDs by sending /start to the bot then calling getUpdates.',
    dashboardLink: 'https://core.telegram.org/bots#how-do-i-create-a-bot',
    fields: [
      { envVar: 'TELEGRAM_CONTACT_BOT_TOKEN', label: 'Contact form — bot token', type: 'secret', group: 'Contact form' },
      { envVar: 'TELEGRAM_CONTACT_CHAT_ID', label: 'Contact form — chat ID', type: 'text', group: 'Contact form' },
      { envVar: 'TELEGRAM_FORMS_BOT_TOKEN', label: 'Generic forms — bot token', type: 'secret', group: 'Generic forms' },
      { envVar: 'TELEGRAM_FORMS_CHAT_ID', label: 'Generic forms — chat ID', type: 'text', group: 'Generic forms' },
      { envVar: 'TELEGRAM_RESUME_BOT_TOKEN', label: 'Resume uploads — bot token', type: 'secret', group: 'Resume uploads' },
      { envVar: 'TELEGRAM_RESUME_CHAT_ID', label: 'Resume uploads — chat ID', type: 'text', group: 'Resume uploads' },
      { envVar: 'TELEGRAM_BACKUP_BOT_TOKEN', label: 'Backups — bot token', type: 'secret', group: 'Backups' },
      { envVar: 'TELEGRAM_BACKUP_CHAT_ID', label: 'Backups — chat ID', type: 'text', group: 'Backups' },
      { envVar: 'TELEGRAM_LOGIN_ALERT_BOT_TOKEN', label: 'Login alerts — bot token', type: 'secret', group: 'Login alerts' },
      { envVar: 'TELEGRAM_LOGIN_ALERT_CHAT_ID', label: 'Login alerts — chat ID', type: 'text', group: 'Login alerts' },
    ],
  },
  {
    id: 'smtp',
    name: 'SMTP (outbound email)',
    description: 'Used for transactional email. Use an app-password / dedicated SMTP user, not your main mailbox password.',
    fields: [
      { envVar: 'SMTP_HOST', label: 'Host', type: 'text', example: 'smtp.example.com' },
      { envVar: 'SMTP_PORT', label: 'Port', type: 'text', example: '587' },
      { envVar: 'SMTP_USER', label: 'Username', type: 'text' },
      { envVar: 'SMTP_PASS', label: 'Password / app password', type: 'secret' },
      { envVar: 'SMTP_SECURE', label: 'Use TLS (true/false)', type: 'text', example: 'true', description: 'true for port 465 implicit TLS, false for 587 STARTTLS' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API',
    description: 'Meta-hosted WhatsApp Business API for sending notifications. Create an app at developers.facebook.com.',
    dashboardLink: 'https://developers.facebook.com/apps/',
    fields: [
      { envVar: 'WHATSAPP_TOKEN', label: 'Access token', type: 'secret' },
      { envVar: 'WHATSAPP_PHONE_ID', label: 'Phone number ID', type: 'text' },
      { envVar: 'WHATSAPP_DESTINATION', label: 'Default destination number', type: 'text', example: '+1XXXXXXXXXX' },
    ],
  },
  {
    id: 'recaptcha',
    name: 'Google reCAPTCHA',
    description: 'Server-side secret for verifying reCAPTCHA tokens. Used as a fallback to Turnstile on legacy forms.',
    dashboardLink: 'https://www.google.com/recaptcha/admin',
    fields: [
      { envVar: 'RECAPTCHA_SECRET_KEY', label: 'Secret key', type: 'secret' },
    ],
  },
  {
    id: 'ipinfo',
    name: 'IPinfo (IP geolocation)',
    description: 'Token for the IPinfo.io API — used to enrich contact-form / login alert records with geo data.',
    dashboardLink: 'https://ipinfo.io/account/token',
    fields: [
      { envVar: 'IPINFO_TOKEN', label: 'Token', type: 'secret' },
    ],
  },
  {
    id: 'google-analytics-sa',
    name: 'Google Analytics service account',
    description: 'Private key for the GA Data API service account. Used to render the analytics dashboard. PEM-encoded; preserve newlines.',
    dashboardLink: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { envVar: 'GA_PRIVATE_KEY', label: 'Private key (PEM)', type: 'longtext', description: 'Paste the full PEM including BEGIN/END lines. Newlines preserved.' },
    ],
  },
  {
    id: 'aikido',
    name: 'Aikido Security',
    description: 'Code-scanning integration. Tokens configured here power the live issue dashboard at /admin/aikido. IDE token is used by the in-editor scanner; API token by the admin Aikido dashboard.',
    dashboardLink: 'https://app.aikido.dev/settings/api-keys',
    fields: [
      { envVar: 'AIKIDO_API_TOKEN', label: 'API token', type: 'secret' },
      { envVar: 'AIKIDO_IDE_TOKEN', label: 'IDE token', type: 'secret' },
    ],
  },
  {
    id: 'pagespeed',
    name: 'Google PageSpeed Insights',
    description: 'API key for fetching Core Web Vitals on demand from the admin performance page.',
    dashboardLink: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { envVar: 'GOOGLE_PAGESPEED_API_KEY', label: 'API key', type: 'secret' },
    ],
  },
  {
    id: 'brevo',
    name: 'Brevo (Sendinblue)',
    description: 'Email marketing and transactional email service. Requires an API key (v3) from your Brevo settings.',
    dashboardLink: 'https://app.brevo.com/settings/keys/api',
    fields: [
      { envVar: 'BREVO_API_KEY', label: 'Brevo API Key (v3)', type: 'secret' },
      { envVar: 'BREVO_SENDER_EMAIL', label: 'Sender Email', type: 'text', example: 'info@rhcsolutions.com', description: 'Sender email, must be a verified sender in your Brevo account.' },
      { envVar: 'BREVO_SENDER_NAME', label: 'Sender Name', type: 'text', example: 'RHC Solutions' },
      { envVar: 'BREVO_CONTACT_LIST_ID', label: 'Contact List ID (optional)', type: 'text', example: '2', description: 'Numeric ID of the contact list where form submissions should be added (e.g. newsletter subscribers).' },
    ],
  },
  {
    id: 'misc',
    name: 'Miscellaneous',
    description: 'Other server-side values that aren\'t tied to a specific third-party.',
    fields: [
      { envVar: 'ADMIN_EMAIL', label: 'Admin contact email', type: 'text', description: 'Destination for admin notifications.' },
      { envVar: 'CONTACT_EMAIL', label: 'Contact form destination email', type: 'text' },
    ],
  },
];

/** Every env-var name listed across all integrations — used as the allow-list
 *  by the save endpoint so a stray field name in the request body can't
 *  poison cms-data/secrets.json. */
export const MANAGED_SECRET_KEYS: ReadonlySet<string> = new Set(
  INTEGRATIONS.flatMap((i) => i.fields.map((f) => f.envVar)),
);
