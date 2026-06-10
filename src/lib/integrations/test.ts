// Credential validators for the provisioning wizard. Unlike the admin
// /api/admin/integrations/test handlers (which read saved secrets via getSecret),
// these take credentials EXPLICITLY so the wizard can validate what was just typed.
// Each returns a structured result; callers decide whether to block (we don't).

export interface ValidationResult {
  service: string;
  ok: boolean;
  message: string;
}

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// Brevo: GET /v3/account is the documented key-verification endpoint.
export async function validateBrevo(apiKey: string): Promise<ValidationResult> {
  try {
    const res = await fetchWithTimeout('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) return { service: 'brevo', ok: false, message: `Brevo rejected the key (HTTP ${res.status}).` };
    const data: any = await res.json().catch(() => ({}));
    const plan = Array.isArray(data?.plan) ? data.plan[0]?.type : undefined;
    return { service: 'brevo', ok: true, message: `Valid${data?.email ? ` — ${data.email}` : ''}${plan ? ` (${plan})` : ''}.` };
  } catch (e) {
    return { service: 'brevo', ok: false, message: `Could not reach Brevo: ${(e as Error).message}` };
  }
}

// Cloudflare: GET /user/tokens/verify confirms the API token is active.
export async function validateCloudflareToken(token: string): Promise<ValidationResult> {
  try {
    const res = await fetchWithTimeout('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const data: any = await res.json().catch(() => ({}));
    const active = res.ok && data?.success && data?.result?.status === 'active';
    return active
      ? { service: 'cloudflare', ok: true, message: 'Token is active.' }
      : { service: 'cloudflare', ok: false, message: data?.errors?.[0]?.message || `Token verification failed (HTTP ${res.status}).` };
  } catch (e) {
    return { service: 'cloudflare', ok: false, message: `Could not reach Cloudflare: ${(e as Error).message}` };
  }
}

export interface SmtpCreds { host?: string; port?: string | number; user?: string; pass?: string; secure?: boolean }

// SMTP: nodemailer transporter.verify() checks host/port/auth without sending.
export async function validateSmtp(creds: SmtpCreds): Promise<ValidationResult> {
  if (!creds.host) return { service: 'smtp', ok: false, message: 'SMTP host is required.' };
  try {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(creds.port) || 587;
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port,
      secure: creds.secure ?? port === 465,
      auth: creds.user ? { user: creds.user, pass: creds.pass || '' } : undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
    });
    await transporter.verify();
    return { service: 'smtp', ok: true, message: `Connected to ${creds.host}:${port}.` };
  } catch (e) {
    return { service: 'smtp', ok: false, message: `SMTP check failed: ${(e as Error).message}` };
  }
}
