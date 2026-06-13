import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import nodemailer from 'nodemailer';
import { getSecret } from '@adminpanel/lib/env';

interface Check {
  name: string;
  ok: boolean;
  message: string;
}

interface TestResult {
  ok: boolean;
  summary: string;
  checks: Check[];
}

const TIMEOUT = 10_000;

const checkAdmin = async (request: NextRequest) => {
  const token = await getToken({ req: request as any, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as any)?.role;
  if (role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized: admin role required' }, { status: 403 }),
    };
  }
  return { authorized: true as const };
};

const ok = (name: string, message: string): Check => ({ name, ok: true, message });
const fail = (name: string, message: string): Check => ({ name, ok: false, message });

async function testTelegram(): Promise<TestResult> {
  const groups: { name: string; tokenKey: string; chatKey: string }[] = [
    { name: 'Contact form', tokenKey: 'TELEGRAM_CONTACT_BOT_TOKEN', chatKey: 'TELEGRAM_CONTACT_CHAT_ID' },
    { name: 'Generic forms', tokenKey: 'TELEGRAM_FORMS_BOT_TOKEN', chatKey: 'TELEGRAM_FORMS_CHAT_ID' },
    { name: 'Resume uploads', tokenKey: 'TELEGRAM_RESUME_BOT_TOKEN', chatKey: 'TELEGRAM_RESUME_CHAT_ID' },
    { name: 'Backups', tokenKey: 'TELEGRAM_BACKUP_BOT_TOKEN', chatKey: 'TELEGRAM_BACKUP_CHAT_ID' },
    { name: 'Login alerts', tokenKey: 'TELEGRAM_LOGIN_ALERT_BOT_TOKEN', chatKey: 'TELEGRAM_LOGIN_ALERT_CHAT_ID' },
  ];

  const checks: Check[] = [];
  for (const g of groups) {
    const tok = getSecret(g.tokenKey);
    const chat = getSecret(g.chatKey);
    if (!tok || !chat) {
      checks.push(fail(g.name, 'Bot token or chat ID not set — skipped'));
      continue;
    }
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${tok}/getMe`, {
        signal: AbortSignal.timeout(TIMEOUT),
      });
      const me = await meRes.json();
      if (!meRes.ok || !me.ok) {
        checks.push(fail(g.name, `Bot token rejected: ${me.description || meRes.statusText}`));
        continue;
      }
      const sendRes = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({
          chat_id: chat,
          text: `✅ Test from RHC admin — ${g.name} channel reachable (bot @${me.result?.username || 'unknown'})`,
        }),
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok || !sendData.ok) {
        checks.push(fail(g.name, `Bot OK, chat unreachable: ${sendData.description || sendRes.statusText}`));
        continue;
      }
      checks.push(ok(g.name, `Sent test message via @${me.result?.username}`));
    } catch (e: any) {
      checks.push(fail(g.name, e?.message || 'Request failed'));
    }
  }

  const configured = checks.filter((c) => c.message !== 'Bot token or chat ID not set — skipped');
  const passed = configured.filter((c) => c.ok).length;
  return {
    ok: configured.length > 0 && passed === configured.length,
    summary: configured.length === 0
      ? 'No Telegram channels configured'
      : `${passed}/${configured.length} channels reachable`,
    checks,
  };
}

async function testSmtp(): Promise<TestResult> {
  const host = getSecret('SMTP_HOST');
  const port = parseInt(getSecret('SMTP_PORT') || '587');
  const user = getSecret('SMTP_USER');
  const pass = getSecret('SMTP_PASS');
  const secure = getSecret('SMTP_SECURE') === 'true';
  const adminEmail = getSecret('ADMIN_EMAIL') || 'admin@example.com';

  if (!host) {
    return { ok: false, summary: 'SMTP_HOST not set', checks: [fail('Connection', 'Host not configured')] };
  }
  if (user === 'your-email@example.com' || pass === 'your-password') {
    return {
      ok: false,
      summary: 'Placeholder SMTP credentials detected',
      checks: [fail('Credentials', 'SMTP_USER / SMTP_PASS are placeholders — replace with real values')],
    };
  }

  // Sanity-check the port/secure combo upfront — surfaces the most common
  // misconfiguration before nodemailer dies with an opaque OpenSSL error.
  const portSecureHint = (() => {
    if (port === 587 && secure) {
      return 'Port 587 uses STARTTLS — set SMTP_SECURE=false (or change port to 465 to keep implicit TLS).';
    }
    if (port === 465 && !secure) {
      return 'Port 465 uses implicit TLS — set SMTP_SECURE=true (or change port to 587 for STARTTLS).';
    }
    if (port === 25 && secure) {
      return 'Port 25 is plaintext/STARTTLS — set SMTP_SECURE=false.';
    }
    return null;
  })();

  const decorate = (raw: string) => {
    if (!portSecureHint) return raw;
    if (/wrong version number|SSL routines|tls_validate_record_header|EPROTO/i.test(raw)) {
      return `${raw} — likely cause: ${portSecureHint}`;
    }
    return raw;
  };

  const checks: Check[] = [];
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      connectionTimeout: TIMEOUT,
      socketTimeout: TIMEOUT,
      requireTLS: !secure && port !== 25, // upgrade on 587 etc.
    });
    await transporter.verify();
    checks.push(ok('Connection', `Connected to ${host}:${port} (${secure ? 'implicit TLS' : 'STARTTLS'})`));

    const info = await transporter.sendMail({
      from: getSecret('SMTP_FROM') || adminEmail,
      to: adminEmail,
      subject: 'RHC admin — SMTP test',
      text: `SMTP integration test from /admin/integrations at ${new Date().toISOString()}`,
    });
    checks.push(ok('Send mail', `Delivered to ${adminEmail} (id: ${info.messageId || '—'})`));
  } catch (e: any) {
    checks.push(fail(checks.length === 0 ? 'Connection' : 'Send mail', decorate(e?.message || 'Failed')));
  }

  if (portSecureHint && checks.some((c) => !c.ok)) {
    checks.push(fail('Suggestion', portSecureHint));
  }

  return {
    ok: checks.every((c) => c.ok),
    summary: checks.every((c) => c.ok) ? `Test email sent to ${adminEmail}` : 'SMTP test failed',
    checks,
  };
}

async function testWhatsApp(): Promise<TestResult> {
  const token = getSecret('WHATSAPP_TOKEN');
  const phoneId = getSecret('WHATSAPP_PHONE_ID');
  if (!token || !phoneId) {
    return {
      ok: false,
      summary: 'WhatsApp not configured',
      checks: [fail('Credentials', 'WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are required')],
    };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneId}?fields=id,verified_name,display_phone_number`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        summary: 'WhatsApp API rejected credentials',
        checks: [fail('Auth', data?.error?.message || `HTTP ${res.status}`)],
      };
    }
    return {
      ok: true,
      summary: `Connected to ${data.verified_name || data.display_phone_number || phoneId}`,
      checks: [ok('Auth', `Phone ID ${data.id} — ${data.verified_name || data.display_phone_number || 'unverified name'}`)],
    };
  } catch (e: any) {
    return { ok: false, summary: 'WhatsApp test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

async function testRecaptcha(): Promise<TestResult> {
  const secret = getSecret('RECAPTCHA_SECRET_KEY');
  if (!secret) {
    return {
      ok: false,
      summary: 'Not configured',
      checks: [fail('Secret', 'RECAPTCHA_SECRET_KEY not set')],
    };
  }
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=test`,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (data['error-codes']?.includes('invalid-input-secret')) {
      return {
        ok: false,
        summary: 'reCAPTCHA secret rejected',
        checks: [fail('Secret', 'Google reports invalid-input-secret — re-check the secret key')],
      };
    }
    return {
      ok: true,
      summary: 'reCAPTCHA secret accepted by Google',
      checks: [ok('Secret', 'Secret accepted (test token expectedly rejected as invalid-input-response)')],
    };
  } catch (e: any) {
    return { ok: false, summary: 'reCAPTCHA test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

async function testIpinfo(): Promise<TestResult> {
  const token = getSecret('IPINFO_TOKEN');
  if (!token) {
    return { ok: false, summary: 'Not configured', checks: [fail('Token', 'IPINFO_TOKEN not set')] };
  }
  try {
    const res = await fetch(`https://ipinfo.io/8.8.8.8/json?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (!res.ok || data?.status === 401) {
      return {
        ok: false,
        summary: 'IPinfo token rejected',
        checks: [fail('Token', data?.error?.message || `HTTP ${res.status}`)],
      };
    }
    return {
      ok: true,
      summary: `Lookup OK — 8.8.8.8 → ${data.country || '??'} (${data.org || 'unknown org'})`,
      checks: [ok('Lookup', `${data.ip} → ${data.city || ''} ${data.country || ''} (${data.org || ''})`.trim())],
    };
  } catch (e: any) {
    return { ok: false, summary: 'IPinfo test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

async function testGoogleAnalyticsSA(): Promise<TestResult> {
  const email = getSecret('NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL');
  let privateKey = getSecret('GA_PRIVATE_KEY');
  const propertyId = getSecret('NEXT_PUBLIC_GA_PROPERTY_ID');

  if (!email || !privateKey) {
    return {
      ok: false,
      summary: 'Service account credentials missing',
      checks: [fail('Credentials', 'Service account email and/or private key not set')],
    };
  }
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  const checks: Check[] = [];

  let accessToken = '';
  try {
    const crypto = await import('crypto');
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const message = `${b64(header)}.${b64(payload)}`;
    const key = crypto.createPrivateKey({ key: privateKey, format: 'pem' });
    const signature = crypto.createSign('RSA-SHA256').update(message).sign(key)
      .toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${message}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
      return {
        ok: false,
        summary: 'OAuth token exchange failed',
        checks: [fail('JWT exchange', data?.error_description || data?.error || `HTTP ${res.status}`)],
      };
    }
    accessToken = data.access_token;
    checks.push(ok('JWT exchange', 'Service account signed in successfully'));
  } catch (e: any) {
    return {
      ok: false,
      summary: 'JWT signing failed',
      checks: [fail('JWT signing', e?.message || 'Invalid private key')],
    };
  }

  if (propertyId) {
    try {
      const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT),
        body: JSON.stringify({
          dateRanges: [{ startDate: 'yesterday', endDate: 'today' }],
          metrics: [{ name: 'activeUsers' }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        checks.push(fail('GA4 Data API', data?.error?.message || `HTTP ${res.status}`));
      } else {
        const users = data?.rows?.[0]?.metricValues?.[0]?.value || '0';
        checks.push(ok('GA4 Data API', `Property ${propertyId} returned ${users} active users (yesterday→today)`));
      }
    } catch (e: any) {
      checks.push(fail('GA4 Data API', e?.message || 'Failed'));
    }
  } else {
    checks.push(fail('GA4 Data API', 'NEXT_PUBLIC_GA_PROPERTY_ID not set — token works but no property to query'));
  }

  return {
    ok: checks.every((c) => c.ok),
    summary: checks.every((c) => c.ok) ? 'GA4 service account works end-to-end' : 'Token works but data API call failed',
    checks,
  };
}

async function testAikido(): Promise<TestResult> {
  const apiToken = getSecret('AIKIDO_API_TOKEN');
  if (!apiToken) {
    return { ok: false, summary: 'Not configured', checks: [fail('Token', 'AIKIDO_API_TOKEN not set')] };
  }
  try {
    const res = await fetch('https://app.aikido.dev/api/public/v1/open-issues?per_page=1', {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        summary: 'Aikido rejected token',
        checks: [fail('Auth', `HTTP ${res.status} — token invalid or lacks API scope`)],
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        summary: 'Aikido API error',
        checks: [fail('API', `HTTP ${res.status} ${res.statusText}`)],
      };
    }
    return { ok: true, summary: 'Aikido API token accepted', checks: [ok('Auth', 'Token accepted by Aikido')] };
  } catch (e: any) {
    return { ok: false, summary: 'Aikido test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

async function testPageSpeed(): Promise<TestResult> {
  const key = getSecret('GOOGLE_PAGESPEED_API_KEY');
  if (!key) {
    return { ok: false, summary: 'Not configured', checks: [fail('Key', 'GOOGLE_PAGESPEED_API_KEY not set')] };
  }
  try {
    const res = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://example.com&strategy=mobile&category=performance&key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(TIMEOUT) }
    );
    const data = await res.json();
    if (res.status === 429 || data?.error?.message?.includes('Quota exceeded')) {
      return {
        ok: false,
        summary: 'Key valid but quota exceeded',
        checks: [fail('Quota', 'Daily quota exhausted — key works, retry after UTC midnight')],
      };
    }
    if (res.status === 400 && /API key not valid/i.test(data?.error?.message || '')) {
      return { ok: false, summary: 'API key invalid', checks: [fail('Auth', data.error.message)] };
    }
    if (!res.ok) {
      return { ok: false, summary: 'PageSpeed API error', checks: [fail('API', data?.error?.message || `HTTP ${res.status}`)] };
    }
    const perf = Math.round((data?.lighthouseResult?.categories?.performance?.score || 0) * 100);
    return {
      ok: true,
      summary: `Key works — example.com performance ${perf}/100`,
      checks: [ok('API', `Lighthouse ran successfully, performance=${perf}`)],
    };
  } catch (e: any) {
    return { ok: false, summary: 'PageSpeed test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

async function testBrevo(): Promise<TestResult> {
  const apiKey = getSecret('BREVO_API_KEY');
  if (!apiKey) {
    return { ok: false, summary: 'Not configured', checks: [fail('Key', 'BREVO_API_KEY not set')] };
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        summary: 'Brevo rejected key',
        checks: [fail('Auth', data?.message || `HTTP ${res.status}`)],
      };
    }
    const plan = data?.plan?.[0]?.type || 'unknown plan';
    return {
      ok: true,
      summary: `Connected to ${data.email || 'Brevo account'} (${plan})`,
      checks: [ok('Account', `${data.firstName || ''} ${data.lastName || ''} <${data.email}> — ${plan}`.trim())],
    };
  } catch (e: any) {
    return { ok: false, summary: 'Brevo test failed', checks: [fail('Network', e?.message || 'Failed')] };
  }
}

const HANDLERS: Record<string, () => Promise<TestResult>> = {
  telegram: testTelegram,
  smtp: testSmtp,
  whatsapp: testWhatsApp,
  recaptcha: testRecaptcha,
  ipinfo: testIpinfo,
  'google-analytics-sa': testGoogleAnalyticsSA,
  aikido: testAikido,
  pagespeed: testPageSpeed,
  brevo: testBrevo,
};

export async function POST(request: NextRequest) {
  const auth = await checkAdmin(request);
  if (!auth.authorized) return auth.response;

  let body: any = {};
  try { body = await request.json(); } catch {}
  const integrationId = String(body?.integrationId || '');

  const handler = HANDLERS[integrationId];
  if (!handler) {
    return NextResponse.json(
      { ok: false, summary: 'No test available for this integration', checks: [] },
      { status: 200 }
    );
  }

  try {
    const result = await handler();
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, summary: 'Test crashed', checks: [{ name: 'handler', ok: false, message: e?.message || 'Unknown error' }] },
      { status: 200 }
    );
  }
}
